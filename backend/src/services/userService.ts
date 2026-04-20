import * as path from 'path';
import userRepository from '../repositories/userRepository';
import galleryRepository from '../repositories/galleryRepository';
import { UPLOADS_DIR } from '../config/constants';
import { validateCreateUserInput, validateUpdateUserInput } from '../validators/userValidators';
import { toUserResponse } from '../utils/serializers';
import { buildUploadUrl } from '../utils/urlUtils';
import httpError from '../utils/httpError';

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

  async updateUser(id: any, body: any, file: any) {
    const userId = normalizeUserId(id);
    const updates: any = validateUpdateUserInput(body);

    if (file) {
      updates.profile_picture = buildUploadUrl(file.filename);
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

    if (file) {
      await galleryRepository.createOne({
        url: buildUploadUrl(file.filename),
        uploadedAt: new Date(),
        label: `${updatedUser.name}'s Profile Picture`,
        isProfile: true,
        userId: updatedUser.id,
        recognizedUserIds: [updatedUser.id],
      });
      // Clear cached profile descriptor so it re-calculates from the new picture
      await userRepository.updateById(userId, { profileDescriptor: null });
      // Refresh gallery recognition in background with the new face data
      // Break circular dependency with local require
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
