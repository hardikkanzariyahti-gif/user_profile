import * as path from 'path';
import userRepository from '../repositories/userRepository';
import galleryRepository from '../repositories/galleryRepository';
import { UPLOADS_DIR } from '../config/constants';
import { validateCreateUserInput, validateUpdateUserInput } from '../validators/userValidators';
import { toUserResponse } from '../utils/serializers';
import { buildUploadUrl } from '../utils/urlUtils';
import httpError from '../utils/httpError';
import faceAi from '../../faceAi';

function normalizeUserId(id: any): number {
  const userId = Number(id);
  if (!Number.isInteger(userId) || userId <= 0) {
    throw httpError(400, 'Invalid user id');
  }
  return userId;
}

const userService = {
  async createUser(body: any) {
    const payload = validateCreateUserInput(body);

    const existing = await userRepository.findByEmail(payload.email);
    if (existing) {
      throw httpError(400, 'A user with this email already exists.');
    }

    const user = await userRepository.create(payload);

    return toUserResponse(user);
  },

  async listUsers() {
    const users = await userRepository.findAll();
    return users.map(toUserResponse);
  },

  async getUserById(id: any) {
    const userId = normalizeUserId(id);
    const user = await userRepository.findById(userId);
    if (!user) {
      throw httpError(404, 'User not found');
    }
    return toUserResponse(user);
  },

  async verifyFaceQuality(file: any) {
    const filePath = path.join(UPLOADS_DIR, file.filename);
    try {
      const descriptor = await faceAi.getFaceDescriptor(filePath);
      return {
        isValid: !!descriptor,
        message: !!descriptor ? 'Clear face detected!' : 'Face is too blurry or not clear enough. Please ensure good lighting and look straight at the camera.'
      };
    } finally {
      // Optional: Delete the temp file after verification if you don't want to keep failed checks
      // For now we keep it simple.
    }
  },

  async updateUser(id: any, body: any, files: any[] = []) {
    const userId = normalizeUserId(id);
    const updates: any = validateUpdateUserInput(body);

    if (files && files.length > 0) {
      // ── PARALLEL VALIDATION ──────────────────────────────────────────────
      const validationResults = await Promise.all(
        files.map(async (file) => {
          const filePath = path.join(UPLOADS_DIR, file.filename);
          const data = await faceAi.detectFaces(filePath);
          const faces = data.faces || [];
          return { file, hasFace: faces.length > 0, faces, data };
        })
      );

      const validFiles = validationResults.filter(r => r.hasFace).map(r => r.file);
      const failedLabels = validationResults
        .filter(r => !r.hasFace)
        .map(r => r.file.originalname.replace('.jpg', ''));

      if (failedLabels.length > 0) {
        console.log(`[userService] Skipping angles with no face: ${failedLabels.join(', ')}`);
      }

      if (validFiles.length === 0) {
        throw httpError(400, 'No face detected in any of your photos. Please ensure your face is clearly visible in at least one image.');
      }

      files = validFiles;
      updates.profile_picture = buildUploadUrl(files[0].filename);
      updates.profile_pictures = files.map((f: any) => buildUploadUrl(f.filename));

      // Build profileDescriptors array containing embedding, crop, and qualityScore
      const profileDescriptors: any[] = [];
      validationResults.forEach(vr => {
        if (vr.hasFace) {
          const mainFace = vr.faces[0];
          const desc = faceAi.serializeDescriptor(mainFace.descriptor);
          
          if (desc.length !== 512 && desc.length !== 128) {
            console.warn(`[Profile Enrolment] Embedding length ${desc.length} is invalid for user ${userId}`);
          }

          // Profile Enrollment Debug log as requested:
          console.log(`[Profile Debug] userId: ${userId}, face detected: yes, face count: ${vr.faces.length}, embedding length: ${desc.length}, crop size: ${mainFace.box._width}x${mainFace.box._height}, quality score: ${mainFace.confidence}`);

          profileDescriptors.push({
            descriptor: desc,
            faceCrop: buildUploadUrl(vr.file.filename),
            box: mainFace.box,
            qualityScore: mainFace.confidence ?? 1.0,
            addedAt: new Date().toISOString()
          });
        }
      });

      updates.profileDescriptor = profileDescriptors;
    }

    if (Object.keys(updates).length === 0) {
      const existing = await userRepository.findById(userId);
      if (!existing) throw httpError(404, 'User not found');
      return toUserResponse(existing);
    }

    if (updates.email) {
      const owner = await userRepository.findByEmail(updates.email);
      if (owner && owner.id !== userId) {
        throw httpError(400, 'A user with this email already exists.');
      }
    }

    let updatedUser;
    try {
      updatedUser = await userRepository.updateById(userId, updates);
    } catch (err: any) {
      if (err.code === 'P2025') throw httpError(404, 'User not found');
      throw err;
    }

    if (files && files.length > 0) {
      const urls = (files as any[]).map((f: any) => buildUploadUrl(f.filename));

      await Promise.all([
        galleryRepository.hideOldProfilePictures(userId),
        ...(files as any[]).map((file: any) =>
          galleryRepository.createOne({
            url: buildUploadUrl(file.filename),
            uploadedAt: new Date(),
            isProfile: true,
            userId: updatedUser.id,
            recognizedUserIds: [updatedUser.id],
          })
        ),
      ]);

      const { galleryService } = require('./galleryService');
      galleryService.refreshGalleryRecognition().catch((err: any) =>
        console.log('[Sync] Background refresh failed:', err)
      );
    }

    return toUserResponse(updatedUser);
  },

  async deleteUser(id: any) {
    const userId = normalizeUserId(id);
    try {
      await userRepository.deleteById(userId);
      return { message: 'User deleted successfully' };
    } catch (err: any) {
      if (err.code === 'P2025') {
        throw httpError(404, 'User not found');
      }
      throw err;
    }
  },

  buildUploadUrl,
  normalizeUserId,
};

export default userService;
