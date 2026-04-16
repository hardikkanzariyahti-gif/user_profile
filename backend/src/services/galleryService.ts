import * as fs from 'fs';
import * as path from 'path';
import * as faceApiLib from '@vladmandic/face-api';
import faceAi from '../../faceAi';
import { UPLOADS_DIR } from '../config/constants';
import galleryRepository from '../repositories/galleryRepository';
import userRepository from '../repositories/userRepository';
import { toGalleryResponse } from '../utils/serializers';
import httpError from '../utils/httpError';
import userService from './userService';

async function buildLabeledDescriptors(users: any[]) {
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

function arraysEqual(a: number[] = [], b: number[] = []): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

const galleryService = {
  async listGallery(userId: any = null) {
    const [galleryItems, usersWithProfilePicture] = await Promise.all([
      galleryRepository.findAll(),
      userRepository.findUsersWithProfilePicture(),
    ]);

    const dynamicProfileItems = usersWithProfilePicture.map((u: any) => ({
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

    uniqueItems.sort((a: any, b: any) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());

    let visibleItems = uniqueItems;
    if (userId !== null && userId !== undefined) {
      const normalizedUserId = userService.normalizeUserId(userId);
      visibleItems = uniqueItems.filter((item: any) => {
        const ownerId = item.userId != null ? Number(item.userId) : null;
        const recognizedIds = Array.isArray(item.recognizedUserIds)
          ? item.recognizedUserIds.map((id: any) => Number(id))
          : [];
        return ownerId === normalizedUserId || recognizedIds.includes(normalizedUserId);
      });
    }

    const allRecognizedIds = new Set();
    visibleItems.forEach((item: any) => {
      if (Array.isArray(item.recognizedUserIds)) {
        item.recognizedUserIds.forEach((id: any) => allRecognizedIds.add(Number(id)));
      }
    });

    const recognizedUsers = allRecognizedIds.size > 0
      ? await userRepository.findManyByIds(Array.from(allRecognizedIds) as number[])
      : [];

    const userMap: any = recognizedUsers.reduce((acc: any, user: any) => {
      acc[user.id] = { id: user.id, name: user.name };
      return acc;
    }, {});

    const enrichedItems = visibleItems.map((item: any) => {
      const itemRecognizedUsers = Array.isArray(item.recognizedUserIds)
        ? item.recognizedUserIds.map((id: any) => userMap[Number(id)]).filter(Boolean)
        : [];
      return {
        ...item,
        recognizedUsers: itemRecognizedUsers,
      };
    });

    return enrichedItems.map(toGalleryResponse);
  },

  async uploadGallery(files: any[] = [], userId: any = null) {
    if (!files || files.length === 0) {
      throw httpError(400, 'No files uploaded');
    }

    const knownUsers = await userRepository.findUsersWithProfilePicture();
    const labeledDescriptors = await buildLabeledDescriptors(knownUsers);
    const uploaderId = userId ? Number(userId) : null;

    const items = [];
    for (const file of files) {
      let recognizedUserIds = [];
      if (labeledDescriptors.length > 0) {
        const matches = await faceAi.identifyAllFaces(file.path, labeledDescriptors);
        recognizedUserIds = matches
          .filter((m: any) => m.label !== 'unknown')
          .map((m: any) => JSON.parse(m.label).id);
      }

      const uniqueUserIds = [...new Set(recognizedUserIds.map((id: any) => Number(id)))] as number[];
      items.push({
        url: userService.buildUploadUrl(file.filename),
        uploadedAt: new Date(),
        recognizedUserIds: uniqueUserIds,
        userId: uploaderId,
      });
    }

    await galleryRepository.createMany(items);
    return this.listGallery(userId);
  },

  async refreshGalleryRecognition() {
    const knownUsers = await userRepository.findUsersWithProfilePicture();
    const labeledDescriptors = await buildLabeledDescriptors(knownUsers);
    const allItems = await galleryRepository.findAll();
    let updatedCount = 0;

    for (const item of allItems) {
      if (item.isProfile) continue;
      if (!item.url) continue;

      const filename = item.url.split('/').pop();
      if (!filename) continue;
      const filePath = path.join(UPLOADS_DIR, filename);
      if (!fs.existsSync(filePath)) continue;

      const matches = labeledDescriptors.length > 0
        ? await faceAi.identifyAllFaces(filePath, labeledDescriptors)
        : [];

      const recognizedUserIds = [...new Set(
        matches
          .filter((m: any) => m.label !== 'unknown' && m.distance !== null)
          .map((m: any) => {
            try {
              return Number(JSON.parse(m.label).id);
            } catch (err) {
              return null;
            }
          })
          .filter((id: number | null): id is number => Number.isInteger(id) && id !== null && id > 0),
      )] as number[];

      const normalizedIds = (recognizedUserIds as number[]).sort((a: number, b: number) => a - b);
      const existingIds = (Array.isArray(item.recognizedUserIds)
        ? item.recognizedUserIds.map((id: any) => Number(id)).sort((a: number, b: number) => a - b)
        : []) as number[];

      if (!arraysEqual(normalizedIds, existingIds)) {
        await galleryRepository.updateById(item.id, { recognizedUserIds: normalizedIds });
        updatedCount += 1;
      }
    }

    return { updatedCount, total: allItems.length };
  },
};

export { galleryService, buildLabeledDescriptors };
export default galleryService;
