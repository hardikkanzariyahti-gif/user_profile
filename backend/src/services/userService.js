const path = require('path');
const userRepository = require('../repositories/userRepository');
const galleryRepository = require('../repositories/galleryRepository');
const { APP_BASE_URL } = require('../config/constants');
const { validateCreateUserInput, validateUpdateUserInput } = require('../validators/userValidators');
const { toUserResponse } = require('../utils/serializers');
const httpError = require('../utils/httpError');

function buildUploadUrl(filename) {
  return `${APP_BASE_URL}/uploads/${filename}`;
}

function normalizeUserId(id) {
  const userId = Number(id);
  if (!Number.isInteger(userId) || userId <= 0) {
    throw httpError(400, 'Invalid user id');
  }
  return userId;
}

const userService = {
  async createUser(body) {
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

  async getUserById(id) {
    const userId = normalizeUserId(id);
    const user = await userRepository.findById(userId);
    if (!user) {
      throw httpError(404, 'User not found');
    }
    return toUserResponse(user);
  },

  async updateUser(id, body, file) {
    const userId = normalizeUserId(id);
    const updates = validateUpdateUserInput(body);

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
    } catch (err) {
      if (err.code === 'P2025') {
        throw httpError(404, 'User not found');
      }
      throw err;
    }

    if (file) {
      await galleryRepository.createOne({
        url: buildUploadUrl(file.filename),
        uploadedAt: new Date(),
        label: `${updatedUser.name}'s New Profile Picture`,
        isProfile: true,
        userId: updatedUser.id,
        recognizedUserIds: [updatedUser.id],
      });
    }

    return toUserResponse(updatedUser);
  },

  async deleteUser(id) {
    const userId = normalizeUserId(id);
    try {
      await userRepository.deleteById(userId);
      return { message: 'User deleted successfully' };
    } catch (err) {
      if (err.code === 'P2025') {
        throw httpError(404, 'User not found');
      }
      throw err;
    }
  },

  buildUploadUrl,
  normalizeUserId,
};

module.exports = userService;
