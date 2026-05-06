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
    
    // AI Improvement: Refresh Global Gallery recognition to catch any matches for this newly created user!
    // Break circular dependency with local require
    const { galleryService } = require('./galleryService');
    galleryService.refreshGalleryRecognition().catch((err: any) => console.log('[Sync] Background refresh failed:', err));
    
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
      // SOFT VALIDATION: We want to be helpful. As long as at least ONE photo has a face, we proceed.
      // We filter out the photos that don't have faces so they don't pollute the recognition model.
      const validFiles: any[] = [];
      const failedLabels: string[] = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const filePath = path.join(UPLOADS_DIR, file.filename);
        const data = await faceAi.detectFaces(filePath);
        
        if (data.faces && data.faces.length > 0) {
          validFiles.push(file);
        } else {
          const label = file.originalname.replace('.jpg', '');
          failedLabels.push(label);
          console.log(`[userService] Skipping "${label}" - no face detected.`);
        }
      }

      if (validFiles.length === 0) {
        throw httpError(400, `No face detected in any of your photos. Please ensure your face is clearly visible in at least one image.`);
      }

      // Update the 'files' variable to only contain valid ones for the rest of the function
      files = validFiles;
      
      // Update the update payload with only valid URLs
      updates.profile_picture = buildUploadUrl(files[0].filename);
      updates.profile_pictures = files.map(f => buildUploadUrl(f.filename));
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
      if (err.code === 'P2025') {
        throw httpError(404, 'User not found');
      }
      throw err;
    }

    if (files && files.length > 0) {
      const urls = files.map(f => buildUploadUrl(f.filename));
      
      // Update User with all pictures
      await userRepository.updateById(userId, { 
        profile_picture: urls[0], // First one as main thumbnail
        profile_pictures: urls    // All angles for recognition
      });

      // Hide/De-list previous profile pictures to keep gallery clean
      await galleryRepository.hideOldProfilePictures(userId);

      // Also create individual gallery items for tracking/matching
      // Only the FRONT face (first one) is visible in the main gallery
      await Promise.all(files.map((file, index) => 
        galleryRepository.createOne({
          url: buildUploadUrl(file.filename),
          uploadedAt: new Date(),
          label: `${updatedUser.name}'s Profile Picture`,
          isProfile: true,
          showInGallery: index === 0, // Only show the first angle (Front)
          userId: updatedUser.id,
          recognizedUserIds: [updatedUser.id],
        })
      ));

      // Clear cached profile descriptor so it re-calculates from the new multi-angle pictures
      await userRepository.updateById(userId, { profileDescriptor: null });
      
      // Refresh gallery recognition in background with the new face data
      const { galleryService } = require('./galleryService');
      galleryService.refreshGalleryRecognition().catch((err: any) => console.log('[Sync] Background refresh failed:', err));
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
