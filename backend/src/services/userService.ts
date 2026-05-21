import * as fs from 'fs';
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
      const descriptor = await faceAi.getFaceDescriptor(filePath, { useOriginal: true });
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

    if (!files || files.length === 0) {
      // If there are NO files uploaded but we require at least one for face logic
      // (This assumes profile enrollment requires an image if updating profile form)
      // Note: If updates only contain name/email, we shouldn't throw. 
      // But if profile_pictures was intended, it's checked here.
    }

    if (files && files.length > 0) {
      // ── SEQUENTIAL FALLBACK MULTI-ANGLE VALIDATION ─────────────────────────
      const validationResults: any[] = [];

      for (const file of files) {
        const filePath = path.join(UPLOADS_DIR, file.filename);
        const fileExists = fs.existsSync(filePath);
        const stats = fileExists ? fs.statSync(filePath) : null;

        console.log(`[PROFILE_FACE] image path: ${filePath}`);
        console.log(`[PROFILE_FACE] image exists: ${fileExists}`);
        console.log(`[PROFILE_FACE] image size: ${stats ? stats.size : 0} bytes`);

        if (!fileExists || !stats || stats.size === 0) {
          console.log(`[PROFILE_FACE] detected faces count: 0`);
          console.log(`[PROFILE_FACE] descriptor generated: false`);
          console.log(`[PROFILE_FACE] error: File does not exist or is empty`);
          validationResults.push({ file, hasFace: false, faces: [], data: null });
          continue;
        }

        // Pass 1: Try on original uncompressed high-quality image
        let data = await faceAi.detectFaces(filePath, { useOriginal: true });
        let faces = data?.faces || [];
        let fallbackPass = 'Original';

        // Pass 2: Try resized 1600 version
        if (faces.length === 0) {
          console.log(`[PROFILE_FACE] 0 faces on original, trying 1600px resize...`);
          data = await faceAi.detectFaces(filePath, { targetW: 1600, targetH: 1600 });
          faces = data?.faces || [];
          fallbackPass = 'Resize 1600';
        }

        // Pass 3: Try contrast normalized image
        if (faces.length === 0) {
          console.log(`[PROFILE_FACE] 0 faces on resize, trying contrast normalized version...`);
          data = await faceAi.detectFaces(filePath, { targetW: 1280, targetH: 1280, applyContrast: true });
          faces = data?.faces || [];
          fallbackPass = 'Contrast Normalization';
        }

        console.log(`[PROFILE_FACE] detected faces count (${fallbackPass}): ${faces.length}`);

        let mainFace: any = null;
        let desc: any = null;
        let errorMsg = 'None';

        if (faces.length > 0) {
          // If multiple faces, choose largest face for profile descriptor
          faces.sort((a: any, b: any) => (b.box._width * b.box._height) - (a.box._width * a.box._height));
          mainFace = faces[0];
          desc = faceAi.serializeDescriptor(mainFace.descriptor);
          if (!desc || (desc.length !== 128 && desc.length !== 512)) {
            errorMsg = `Invalid descriptor length ${desc ? desc.length : 'null'}`;
          }
        } else {
          errorMsg = 'No face detected in this photo after all fallbacks';
        }

        const isSuccess = !!desc && errorMsg === 'None';
        console.log(`[PROFILE_FACE] descriptor generated: ${isSuccess}`);
        if (!isSuccess) {
          console.log(`[PROFILE_FACE] error: ${errorMsg}`);
        } else {
          console.log(`[PROFILE_FACE] error: none`);
        }

        validationResults.push({
          file,
          hasFace: isSuccess,
          faces: mainFace ? [mainFace] : [],
          data
        });
      }

      const validFiles = validationResults.filter(r => r.hasFace).map(r => r.file);
      const failedLabels = validationResults
        .filter(r => !r.hasFace)
        .map(r => r.file.originalname.replace('.jpg', ''));

      if (failedLabels.length > 0) {
        console.log(`[userService] Skipping angles with no face: ${failedLabels.join(', ')}`);
      }

      if (validFiles.length === 0) {
        const pathFailed = validationResults.some(r => r.data === null);
        if (pathFailed) {
          throw httpError(400, 'Face photos could not be loaded. Please try uploading again.');
        } else {
          throw httpError(400, 'No clear face detected. Please retake with better lighting.');
        }
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
