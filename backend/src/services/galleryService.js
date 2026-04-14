const fs = require('fs');
const path = require('path');
const faceApiLib = require('@vladmandic/face-api');
const faceAi = require('../../faceAi');
const { UPLOADS_DIR } = require('../config/constants');
const galleryRepository = require('../repositories/galleryRepository');
const userRepository = require('../repositories/userRepository');
const { toGalleryResponse } = require('../utils/serializers');
const httpError = require('../utils/httpError');
const userService = require('./userService');

async function buildLabeledDescriptors(users) {
  const labeledDescriptors = [];

  for (const user of users) {
    if (!user.profile_picture) continue;

    const filename = user.profile_picture.split('/').pop();
    const filePath = path.join(UPLOADS_DIR, filename);
    if (!fs.existsSync(filePath)) continue;

    const descriptor = await faceAi.getFaceDescriptor(filePath);
    if (!descriptor) continue;

    const labelData = JSON.stringify({ id: user.id, name: user.name });
    labeledDescriptors.push(new faceApiLib.LabeledFaceDescriptors(labelData, [descriptor]));
  }

  return labeledDescriptors;
}

const galleryService = {
  async listGallery(userId = null) {
    const [galleryItems, usersWithProfilePicture] = await Promise.all([
      galleryRepository.findAll(),
      userRepository.findUsersWithProfilePicture(),
    ]);

    const dynamicProfileItems = usersWithProfilePicture.map((u) => ({
      id: `profile-${u.id}`,
      url: u.profile_picture,
      uploadedAt: new Date(0),
      label: `${u.name}'s Profile`,
      isProfile: true,
      userId: u.id,
      recognizedUserIds: [u.id],
    }));

    const merged = [...galleryItems, ...dynamicProfileItems];
    const seenUrls = new Set();
    const uniqueItems = [];

    for (const item of merged) {
      if (!item.url || seenUrls.has(item.url)) continue;

      const filename = item.url.split('/').pop();
      const filePath = path.join(UPLOADS_DIR, filename);
      if (!fs.existsSync(filePath)) continue;

      seenUrls.add(item.url);
      uniqueItems.push(item);
    }

    uniqueItems.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));

    let visibleItems = uniqueItems;
    if (userId !== null && userId !== undefined) {
      const normalizedUserId = userService.normalizeUserId(userId);
      visibleItems = uniqueItems.filter((item) => {
        const ownerId = item.userId != null ? Number(item.userId) : null;
        const recognizedIds = Array.isArray(item.recognizedUserIds)
          ? item.recognizedUserIds.map((id) => Number(id))
          : [];
        return ownerId === normalizedUserId || recognizedIds.includes(normalizedUserId);
      });
    }

    return visibleItems.map(toGalleryResponse);
  },

  async uploadGallery(files, userId = null) {
    if (!files || files.length === 0) {
      throw httpError(400, 'No files uploaded');
    }

    const knownUsers = await userRepository.findUsersWithProfilePicture();
    const labeledDescriptors = await buildLabeledDescriptors(knownUsers);

    const items = [];
    for (const file of files) {
      let recognizedUserIds = [];
      if (labeledDescriptors.length > 0) {
        const matches = await faceAi.identifyAllFaces(file.path, labeledDescriptors);
        recognizedUserIds = matches
          .filter((m) => m.label !== 'unknown')
          .map((m) => JSON.parse(m.label).id);
      }

      items.push({
        url: userService.buildUploadUrl(file.filename),
        uploadedAt: new Date(),
        recognizedUserIds,
      });
    }

    await galleryRepository.createMany(items);
    return this.listGallery(userId);
  },
};

module.exports = {
  galleryService,
  buildLabeledDescriptors,
};
