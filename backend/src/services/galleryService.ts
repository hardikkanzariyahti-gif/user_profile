import * as fs from 'fs';
import * as path from 'path';
import faceAi from '../../faceAi';
import { UPLOADS_DIR } from '../config/constants';
import galleryRepository from '../repositories/galleryRepository';
import userRepository from '../repositories/userRepository';
import { toGalleryResponse } from '../utils/serializers';
import httpError from '../utils/httpError';
import { buildUploadUrl } from '../utils/urlUtils';
import { normalizeHashtags, normalizeTag } from '../utils/hashtagUtils';
import prisma from '../config/prisma';

async function getGalleryItemResponseById(id: number) {
  const [item, allUsers] = await Promise.all([
    galleryRepository.findById(id),
    userRepository.findAllForRecognition(),
  ]);
  if (!item) throw httpError(404, 'Gallery item not found');

  const userMap: Record<number, any> = {};
  for (const u of allUsers) userMap[u.id] = u;

  const enriched: any = {
    ...item,
    recognizedUsers: (Array.isArray((item as any).recognizedUserIds) ? (item as any).recognizedUserIds : [])
      .map((uid: any) => userMap[Number(uid)])
      .filter(Boolean),
  };

  return toGalleryResponse(enriched);
}

async function getUsersMap() {
  const allUsers = await userRepository.findAllForRecognition();
  const userMap: Record<number, any> = {};
  for (const u of allUsers) userMap[u.id] = u;
  return userMap;
}

export class LabeledFaceDescriptors {
  label: string;
  descriptors: Float32Array[];
  constructor(label: string, descriptors: Float32Array[]) {
    this.label = label;
    this.descriptors = descriptors;
  }
}

// ─── In-Memory Model Cache ────────────────────────────────────────────────────
// buildLabeledDescriptors is expensive (reads all gallery items + runs AI scans).
// Cache the result in memory for MODEL_CACHE_TTL_MS to avoid rebuilding on every
// upload or refresh call.  Cache is invalidated whenever we tag/untag a face.
const MODEL_CACHE_TTL_MS = 3 * 60 * 1000; // 3 minutes
let _modelCache: LabeledFaceDescriptors[] | null = null;
let _modelCacheTime = 0;

function invalidateModelCache() {
  _modelCache = null;
  _modelCacheTime = 0;
  _clusterCache = null;
  _clusterCacheTime = 0;
  console.log('[Model Cache] 🗑️  Invalidated (Model & Clusters)');
}

const CLUSTER_CACHE_TTL_MS = 2 * 60 * 1000; // 2 minutes
let _clusterCache: any[] | null = null;
let _clusterCacheTime = 0;

async function getCachedModel(): Promise<LabeledFaceDescriptors[]> {
  const now = Date.now();
  if (_modelCache && (now - _modelCacheTime) < MODEL_CACHE_TTL_MS) {
    console.log(`[Model Cache] ⚡ HIT — using in-memory model (${_modelCache.length} user(s))`);
    return _modelCache;
  }
  console.log('[Model Cache] 🐢 MISS — rebuilding recognition model...');
  const allUsers = await userRepository.findAllForRecognition();
  const model = await buildLabeledDescriptors(allUsers);
  _modelCache = model;
  _modelCacheTime = Date.now();
  return model;
}

// ─── Face Descriptor DB Cache ─────────────────────────────────────────────────
// Store face descriptors in the DB so each image is only AI-scanned ONCE.

async function detectFacesWithCache(item: any): Promise<{ descriptor: Float32Array, box: any }[]> {
  // HIT: non-empty cached array
  if (item.faceDescriptors && Array.isArray(item.faceDescriptors) && (item.faceDescriptors as any[]).length > 0) {
    const deserialized = (item.faceDescriptors as any[])
      .map(d => ({ descriptor: faceAi.deserializeDescriptor(d.descriptor)!, box: d.box }))
      .filter(d => d.descriptor !== null);
    if (deserialized.length > 0) {
      console.log(`[Face Cache] ⚡ HIT item ${item.id} — ${deserialized.length} face(s)`);
      return deserialized;
    }
  }

  // MISS: run AI scan (single image)
  console.log(`[Face Cache] 🐢 MISS item ${item.id} — scanning...`);
  if (!item.url) return [];
  const filename = item.url.split('/').pop();
  if (!filename) return [];
  const filePath = path.join(UPLOADS_DIR, filename);
  if (!fs.existsSync(filePath)) return [];

  const detections = await faceAi.detectFaces(filePath);

  // Persist result to DB (background, non-blocking)
  const serialized = detections.map(d => ({
    descriptor: faceAi.serializeDescriptor(d.descriptor),
    box: d.box,
  }));
  galleryRepository.updateById(item.id, { faceDescriptors: serialized })
    .catch(err => console.error(`[Face Cache] Failed to save for item ${item.id}:`, err));

  return detections;
}

/**
 * BATCH version of detectFacesWithCache.
 * - Cache HITs are resolved instantly (no AI call needed).
 * - Cache MISSes are batched into a SINGLE parallel call to the Python service.
 * Returns results in the same order as `items`.
 */
async function detectFacesWithCacheBatch(
  items: any[],
  force = false
): Promise<Array<{ descriptor: Float32Array; box: any }[]>> {
  const results: Array<{ descriptor: Float32Array; box: any }[]> = new Array(items.length);
  const missIndices: number[] = [];
  const missPaths: string[] = [];

  // Pass 1 — resolve cache hits immediately
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (
      !force &&
      item.faceDescriptors &&
      Array.isArray(item.faceDescriptors) &&
      (item.faceDescriptors as any[]).length > 0
    ) {
      const deserialized = (item.faceDescriptors as any[])
        .map((d: any) => ({ descriptor: faceAi.deserializeDescriptor(d.descriptor)!, box: d.box }))
        .filter((d: any) => d.descriptor !== null);
      if (deserialized.length > 0) {
        console.log(`[Face Cache] ⚡ HIT item ${item.id} — ${deserialized.length} face(s)`);
        results[i] = deserialized;
        continue;
      }
    }

    // Mark as MISS
    if (!item.url) { results[i] = []; continue; }
    const filename = item.url.split('/').pop();
    if (!filename) { results[i] = []; continue; }
    const filePath = path.join(UPLOADS_DIR, filename);
    if (!fs.existsSync(filePath)) { results[i] = []; continue; }

    missIndices.push(i);
    missPaths.push(filePath);
  }

  if (missIndices.length === 0) return results;

  // Pass 2 — batch-scan all misses with ONE parallel Python call
  console.log(`[Face Cache] 🚀 BATCH scanning ${missIndices.length} item(s) in parallel...`);
  const batchDetections = await faceAi.detectFacesBatch(missPaths);

  // Pass 3 — store results & persist to DB
  for (let j = 0; j < missIndices.length; j++) {
    const idx = missIndices[j];
    const item = items[idx];
    const detections = batchDetections[j];
    results[idx] = detections;

    // Persist to DB non-blocking
    const serialized = detections.map((d: any) => ({
      descriptor: faceAi.serializeDescriptor(d.descriptor),
      box: d.box,
    }));
    galleryRepository.updateById(item.id, { faceDescriptors: serialized })
      .catch((err: any) => console.error(`[Face Cache] Failed to save item ${item.id}:`, err));
  }

  return results;
}

// ─── Profile Descriptor DB Cache ─────────────────────────────────────────────

async function getProfileDescriptorWithCache(user: any): Promise<Float32Array | null> {
  if (user.profileDescriptor) {
    return faceAi.deserializeDescriptor(user.profileDescriptor);
  }
  if (!user.profile_picture) return null;

  const filename = user.profile_picture.split('/').pop();
  const filePath = path.join(UPLOADS_DIR, filename!);
  if (!fs.existsSync(filePath)) return null;

  const descriptor = await faceAi.getFaceDescriptor(filePath);
  if (descriptor) {
    userRepository.updateById(user.id, {
      profileDescriptor: faceAi.serializeDescriptor(descriptor),
    }).catch(err => console.error(`[Profile Cache] Failed to save for user ${user.id}:`, err));
  }
  return descriptor;
}

// ─── Recognition Model Builder ────────────────────────────────────────────────
/**
 * Build a LabeledFaceDescriptors model for each user so face-api can match
 * detected faces to known people.
 *
 * Strategy per user:
 *   1. Profile picture → single best face (ground truth anchor)
 *   2. If no profile picture → bootstrap from all faces found in their tagged photos
 *   3. Enrich with up to 10 additional confirmed photos (improves angle coverage)
 */
async function buildLabeledDescriptors(users: any[]) {
  const allGalleryItems = await galleryRepository.findAll();

  const results = await Promise.all(users.map(async (user) => {
    const descriptors: Float32Array[] = [];

    // Step 1: Profile picture ground truth
    let groundTruth = await getProfileDescriptorWithCache(user);

    // Step 2: Bootstrap from manually tagged photos (users with no profile pic)
    if (!groundTruth) {
      const taggedPhotos = allGalleryItems.filter(item =>
        !item.isProfile &&
        Array.isArray(item.recognizedUserIds) &&
        item.recognizedUserIds.map(id => Number(id)).includes(Number(user.id))
      );

      for (const item of taggedPhotos.slice(0, 8)) {

        // Exact Face-to-ID fallback
        let foundExplicit = false;
        if (Array.isArray(item.faceDescriptors)) {
          const faceDescs = item.faceDescriptors as any[];
          const explicitFaces = faceDescs.filter(d => d && Number(d.manuallyTaggedUserId) === Number(user.id));
          if (explicitFaces.length > 0) {
            for (const d of explicitFaces) {
              if (d && d.descriptor) {
                const deserialized = faceAi.deserializeDescriptor(d.descriptor);
                if (deserialized) descriptors.push(deserialized);
              }
            }
            foundExplicit = true;
          }
        }

        if (foundExplicit) {
          if (descriptors.length >= 3) break;
          continue;
        }

        // Generic fallback for backwards compatibility
        const detections = await detectFacesWithCache(item);
        for (const d of detections) {
          descriptors.push(d.descriptor);
        }
        if (descriptors.length >= 3) break; // enough bootstrap samples
      }

      if (descriptors.length > 0) {
        groundTruth = descriptors[0];
        console.log(`[AI Model] 🏷️  Bootstrapped ${user.name} from ${descriptors.length} face(s) in tagged photos`);
      }
    }

    if (!groundTruth) {
      console.log(`[AI Model] ⚠️  No face data for ${user.name} — skip`);
      return null;
    }

    if (!descriptors.some(d => faceAi.euclideanDistance(d, groundTruth!) < 0.01)) {
      descriptors.push(groundTruth);
    }

    // Step 3: Collect additional confirmed training samples (better accuracy)
    const confirmedPhotos = allGalleryItems.filter(item =>
      !item.isProfile &&
      Array.isArray(item.recognizedUserIds) &&
      item.recognizedUserIds.map(id => Number(id)).includes(Number(user.id))
    );

    for (const item of confirmedPhotos.slice(0, 30)) {

      // Check for explicitly tagged face first
      if (Array.isArray(item.faceDescriptors)) {
        const faceDescs = item.faceDescriptors as any[];
        const explicitFace = faceDescs.find(d => d && Number(d.manuallyTaggedUserId) === Number(user.id));
        if (explicitFace && explicitFace.descriptor) {
          const deserialized = faceAi.deserializeDescriptor(explicitFace.descriptor);
          if (deserialized && !descriptors.includes(deserialized)) {
            descriptors.push(deserialized);
            continue; // Skip generic fallback distance check
          }
        }
      }

      const detections = await detectFacesWithCache(item);
      // Pick the detection closest to ground truth (reject wrong faces from group shots)
      let best: Float32Array | null = null;
      let bestDist = Infinity;
      for (const det of detections) {
        const dist = faceAi.euclideanDistance(groundTruth!, det.descriptor);
        // Professional limit for memorizing diverse profile angles (0.58)
        if (dist < bestDist && dist < 0.58) { bestDist = dist; best = det.descriptor; }
      }
      if (best && !descriptors.some(d => faceAi.euclideanDistance(d, best!) < 0.01)) {
        descriptors.push(best);
      }
    }

    console.log(`[AI Model] ✅ ${user.name} — ${descriptors.length} descriptor(s)`);
    return new LabeledFaceDescriptors(
      JSON.stringify({ id: user.id, name: user.name }),
      descriptors
    );
  }));

  const model = results.filter((r): r is LabeledFaceDescriptors => r !== null);
  console.log(`[AI Model] 🎯 Built for ${model.length} user(s)`);
  return model;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function arraysEqual(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((v, i) => v === b[i]);
}

function parseUserId(label: string): number | null {
  try { return Number(JSON.parse(label).id); } catch { return null; }
}

function parseUserFromLabel(label: string): { id: number; name: string } | null {
  try { return JSON.parse(label); } catch { return null; }
}

async function getUserMapForSuggestions(): Promise<Record<number, any>> {
  const allUsers = await userRepository.findAllForRecognition();
  const userMap: Record<number, any> = {};
  for (const u of allUsers) userMap[u.id] = u;
  return userMap;
}

async function recognizeImageWithSuggestions(imagePath: string): Promise<{
  faces: Array<{
    box: any;
    confidence: number;
    isConfident: boolean;
    topSuggestion: { id: number; name: string; confidence: number; distance: number } | null;
    allSuggestions: Array<{ id: number; name: string; confidence: number; distance: number }>;
    label: string;
    reason: string | null;
  }>;
  highConfidenceCount: number;
  lowConfidenceCount: number;
}> {
  const [labeledDescriptors, userMap] = await Promise.all([
    getCachedModel(),
    getUserMapForSuggestions(),
  ]);

  const suggestions = await faceAi.getFaceSuggestions(imagePath, labeledDescriptors);

  const enrichedFaces = suggestions.map((face: any) => {
    const enrichedSuggestions = face.allSuggestions.map((s: any) => {
      const userData = parseUserFromLabel(s.label);
      return {
        id: userData?.id ?? 0,
        name: userData?.name ?? 'Unknown',
        confidence: s.confidence,
        distance: s.distance,
      };
    });

    return {
      box: face.box,
      confidence: face.confidence,
      isConfident: face.isConfident,
      topSuggestion: enrichedSuggestions[0] || null,
      allSuggestions: enrichedSuggestions,
      label: face.label,
      reason: face.reason,
    };
  });

  return {
    faces: enrichedFaces,
    highConfidenceCount: enrichedFaces.filter((f: any) => f.isConfident).length,
    lowConfidenceCount: enrichedFaces.filter((f: any) => !f.isConfident).length,
  };
}

// ─── Gallery Service ──────────────────────────────────────────────────────────

const galleryService = {

  // ── List gallery ────────────────────────────────────────────────────────────
  // Pure DB query — NO AI calls here. Fast.
  async listGallery(userId: any = null) {
    const [galleryItems, allUsers] = await Promise.all([
      galleryRepository.findAll(),
      userRepository.findAllForRecognition(),
    ]);

    // Build lookup map: userId → user (with profile_picture)
    const userMap: Record<number, any> = {};
    for (const u of allUsers) userMap[u.id] = u;

    // Synthetic profile items for users who have profile pictures
    const dynamicProfileItems = allUsers
      .filter((u: any) => u.profile_picture)
      .map((u: any) => ({
        id: `profile-${u.id}`,
        url: u.profile_picture,
        uploadedAt: new Date(0),
        label: `${u.name}'s Profile`,
        isProfile: true,
        userId: u.id,
        recognizedUserIds: [u.id],
      }));

    const merged = [...galleryItems, ...dynamicProfileItems];
    const seenUrls = new Set<string>();
    const uniqueItems: any[] = [];

    for (const item of merged) {
      if (!item.url || seenUrls.has(item.url)) continue;
      const filename = item.url.split('/').pop();
      if (!filename) continue;
      if (!fs.existsSync(path.join(UPLOADS_DIR, filename))) continue;
      seenUrls.add(item.url);
      uniqueItems.push(item);
    }

    uniqueItems.sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());

    // Filter for personal view
    let visibleItems = uniqueItems;
    if (userId !== null && userId !== undefined) {
      const normalizedUserId = Number(userId);
      visibleItems = uniqueItems.filter((item: any) => {
        const ownerId = item.userId != null ? Number(item.userId) : null;
        const recIds = Array.isArray(item.recognizedUserIds)
          ? item.recognizedUserIds.map((id: any) => Number(id))
          : [];
        return ownerId === normalizedUserId || recIds.includes(normalizedUserId);
      });
    }

    // Enrich with user data (name + profilePicture)
    const enriched = visibleItems.map((item: any) => ({
      ...item,
      recognizedUsers: (Array.isArray(item.recognizedUserIds) ? item.recognizedUserIds : [])
        .map((id: any) => userMap[Number(id)])
        .filter(Boolean),
    }));

    return enriched.map(toGalleryResponse);
  },

  async getGalleryItem(id: number) {
    return getGalleryItemResponseById(id);
  },

  async deleteGalleryItem(id: number) {
    const item = await galleryRepository.findById(id);
    if (!item) throw httpError(404, 'Gallery item not found');
    if (item.isProfile) throw httpError(400, 'Profile photos cannot be deleted from the gallery.');

    const itemUrl = item.url;
    await galleryRepository.deleteById(id);

    const [remainingItems, users] = await Promise.all([
      galleryRepository.findAll(),
      userRepository.findAllForRecognition(),
    ]);

    const stillUsedInGallery = remainingItems.some((g: any) => g.url === itemUrl);
    const stillUsedAsProfile = users.some((u: any) => u.profile_picture === itemUrl);

    if (!stillUsedInGallery && !stillUsedAsProfile) {
      const filename = itemUrl?.split('/').pop();
      if (filename) {
        const filePath = path.join(UPLOADS_DIR, filename);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      }
    }

    invalidateModelCache();
    return { message: 'Photo deleted successfully.' };
  },

  async setGalleryItemHashtags(id: number, hashtagsInput: any) {
    const item = await galleryRepository.findById(id);
    if (!item) throw httpError(404, 'Gallery item not found');
    if ((item as any).isProfile) throw httpError(400, 'Cannot tag a profile item.');

    const hashtags = normalizeHashtags(hashtagsInput);
    await galleryRepository.updateById(id, { hashtags });
    return getGalleryItemResponseById(id);
  },

  async searchGalleryByHashtag(rawTag: string) {
    const tag = normalizeTag(rawTag);
    if (!tag) throw httpError(400, 'Valid hashtag is required.');

    const [items, userMap] = await Promise.all([
      galleryRepository.findByHashtag(tag),
      getUsersMap(),
    ]);

    const enriched = items.map((item: any) => ({
      ...item,
      recognizedUsers: (Array.isArray(item.recognizedUserIds) ? item.recognizedUserIds : [])
        .map((id: any) => userMap[Number(id)])
        .filter(Boolean),
    }));

    return enriched.map(toGalleryResponse);
  },

  // ── Upload gallery ──────────────────────────────────────────────────────────
  async uploadGallery(files: any[] = [], userId: any = null) {
    if (!files || files.length === 0) throw httpError(400, 'No files uploaded');

    const uploaderId = userId ? Number(userId) : null;

    const itemsToSave = files.map(file => ({
      url: buildUploadUrl(file.filename),
      uploadedAt: new Date(),
      recognizedUserIds: [] as number[],
      userId: uploaderId,
      faceDescriptors: null,
    }));

    await galleryRepository.createMany(itemsToSave);

    const urls = itemsToSave.map(i => i.url);
    const newItems = await prisma.galleryItem.findMany({
      where: { url: { in: urls } }
    });

    const pairs = files
      .map(file => ({
        file,
        item: newItems.find((i: any) => i.url && i.url.includes(file.filename))
      }))
      .filter(p => p.item);

    setImmediate(async () => {
      try {
        this.syncState.isScanning = true;
        this.syncState.current = 0;
        this.syncState.total = pairs.length;

        const labeledDescriptors = await getCachedModel();

        this.syncState.total = pairs.length;

        const UPLOAD_BATCH = 10;
        const batches = Array.from({ length: Math.ceil(pairs.length / UPLOAD_BATCH) }, (_, i) =>
          pairs.slice(i * UPLOAD_BATCH, i * UPLOAD_BATCH + UPLOAD_BATCH)
        );

        console.log(`[Upload BG] 🚀 Parallel Scanning ${pairs.length} images in ${batches.length} batches...`);

        await Promise.all(batches.map(async (chunk) => {
          const filePaths = chunk.map(p => p.file.path);
          const batchResults = await faceAi.detectFacesBatch(filePaths);

          await Promise.all(chunk.map(async ({ item }, j) => {
            if (!item) return;
            const detections = batchResults[j];
            const faceDescriptors = detections.map((d: any) => ({
              descriptor: faceAi.serializeDescriptor(d.descriptor),
              box: d.box,
            }));

            let recognizedUserIds: number[] = [];
            if (labeledDescriptors.length > 0 && detections.length > 0) {
              recognizedUserIds = detections
                .map((det: any) => {
                  const match = faceAi.findBestMatchWithMargin(det.descriptor, labeledDescriptors);
                  return match.label === 'unknown' ? null : parseUserId(match.label);
                })
                .filter((id: any): id is number => id !== null);
            }

            try {
              await galleryRepository.updateById(item.id, {
                faceDescriptors,
                recognizedUserIds: [...new Set(recognizedUserIds)],
              });
            } catch (dbErr) {
              console.warn(`[Upload BG] ⚠️ Failed to update item ${item.id}, retrying once...`);
              await new Promise(r => setTimeout(r, 1000));
              await galleryRepository.updateById(item.id, {
                faceDescriptors,
                recognizedUserIds: [...new Set(recognizedUserIds)],
              }).catch(e => console.error(`[Upload BG] ❌ Permanent failure for item ${item.id}:`, e.message));
            }
          }));

          this.syncState.current += chunk.length;
        }));

        this.syncState.isScanning = false;
        invalidateModelCache();
        console.log(`[Upload] ✅ Parallel background detection complete.`);
      } catch (err) {
        console.error('[Upload] ❌ Parallel background detection failed:', err);
      }
    });

    const gallery = await this.listGallery(userId);
    return gallery;
  },

  // ── Tag a face manually ────────────────────────────────────────────────────
  /**
   * Manually tag a user in a gallery photo.
   * - Tag is permanent — never removed by AI refresh
   * - If user has no profile picture yet, sets this photo as their first one
   * - Clears item's face cache (forces fresh detection on next sync)
   * - Invalidates in-memory model cache (model must be rebuilt with new training data)
   * - Triggers background refresh to propagate recognition to other photos
   */
  async tagUnknownFace(galleryItemId: number, userId: number, faceIndex?: number) {
    const [allItems, user] = await Promise.all([
      galleryRepository.findAll(),
      userRepository.findById(userId),
    ]);

    const item = allItems.find(i => i.id === galleryItemId);
    if (!item || !user) throw new Error('Item or User not found');
    if (item.isProfile) throw new Error('Cannot tag a profile photo directly.');

    const existingIds = (Array.isArray(item.recognizedUserIds)
      ? item.recognizedUserIds.map((id: any) => Number(id))
      : []);

    let updateData: any = {};
    if (!existingIds.includes(Number(userId))) {
      updateData.recognizedUserIds = [...existingIds, Number(userId)];
    }

    if (faceIndex !== undefined && Array.isArray(item.faceDescriptors)) {
      const newDescriptors = [...item.faceDescriptors] as any[];
      if (newDescriptors[faceIndex]) {
        newDescriptors[faceIndex].manuallyTaggedUserId = Number(userId);
        updateData.faceDescriptors = newDescriptors;
      }
    } else if (faceIndex === undefined) {
      // Old generic tag behaviour: clear cache so next sync recomputes
      updateData.faceDescriptors = null;
    }

    await galleryRepository.updateById(galleryItemId, updateData);

    const profilePictureSet = !user.profile_picture;
    if (profilePictureSet && item.url) {
      await userRepository.updateById(userId, {
        profile_picture: item.url,
        profileDescriptor: null, // Force re-calculation
      });
    }

    // Invalidate in-memory model so background refresh uses fresh training data
    invalidateModelCache();

    // Background refresh: propagates the new tag to recognise this person elsewhere
    this.refreshGalleryRecognition().catch(err => console.error('[Tag] BG refresh failed:', err));

    return { message: `Tagged ${user.name} successfully`, profilePictureSet };
  },

  // ── Untag a face ────────────────────────────────────────────────────────────
  async untagFace(galleryItemId: number, userId: number, faceIndex?: number) {
    const allItems = await galleryRepository.findAll();
    const item = allItems.find(i => i.id === galleryItemId);
    if (!item) throw new Error('Item not found');

    const existingIds = (Array.isArray(item.recognizedUserIds)
      ? item.recognizedUserIds.map((id: any) => Number(id))
      : []);

    let updateData: any = {
      recognizedUserIds: existingIds.filter(id => id !== Number(userId)),
    };

    if (faceIndex !== undefined && Array.isArray(item.faceDescriptors)) {
      const newDescriptors = [...item.faceDescriptors] as any[];
      if (newDescriptors[faceIndex] && Number(newDescriptors[faceIndex].manuallyTaggedUserId) === Number(userId)) {
        newDescriptors[faceIndex].manuallyTaggedUserId = null;
      }
      if (!newDescriptors[faceIndex].rejectedUserIds) newDescriptors[faceIndex].rejectedUserIds = [];
      newDescriptors[faceIndex].rejectedUserIds.push(Number(userId));
      updateData.faceDescriptors = newDescriptors;
    } else if (Array.isArray(item.faceDescriptors)) {
      // Global untag from the whole photo (happens when clicking X on the tag)
      // Add this user to rejected lists for ALL faces in this photo so AI doesn't re-tag them!
      const newDescriptors = [...item.faceDescriptors] as any[];
      for (const d of newDescriptors) {
        if (d) {
          if (Number(d.manuallyTaggedUserId) === Number(userId)) d.manuallyTaggedUserId = null;
          if (!d.rejectedUserIds) d.rejectedUserIds = [];
          d.rejectedUserIds.push(Number(userId));
        }
      }
      updateData.faceDescriptors = newDescriptors;
    }

    await galleryRepository.updateById(galleryItemId, updateData);

    invalidateModelCache();
    this.refreshGalleryRecognition().catch(err => console.error('[Untag] BG refresh failed:', err));
    return { message: 'Tag removed successfully' };
  },

  // ── Refresh recognition ──────────────────────────────────────────────────────
  /**
   * Re-scan all gallery photos and ADD newly recognized users to each photo.
   *
   * RULE: Existing tags (manual or previous AI) are NEVER removed.
   *       AI can only ADD more users to a photo's tag list.
   *
   * @param forceRescan  Clear all cached face descriptors first so the improved
   *                     detector re-processes every photo from scratch.
   *                     Essential after detection logic changes.
   */
  syncState: { isScanning: false, total: 0, current: 0 },

  async refreshGalleryRecognition(forceRescan = false) {
    if (this.syncState.isScanning) {
      console.log('⚠️ AI Sync already running, ignoring parallel request.');
      return { message: 'Sync in progress' };
    }

    this.syncState = { isScanning: true, total: 0, current: 0 };
    console.log(`\n🚀 AI Sync starting... (forceRescan=${forceRescan})`);
    const startTime = Date.now();

    let allItems = await galleryRepository.findAll();

    // Intelligent Force Rescan (~0 seconds):
    // We only wipe cached faceDescriptors for photos that previously FAILED to detect any faces.
    // Photos that already have bounding boxes skip the heavy image processing, meaning 1,000s of photos 
    // finish recalculating identities instantly instead of waiting 30+ minutes!
    if (forceRescan) {
      console.log('[AI Sync] 🚨 SMART FORCE RESCAN — AI will re-analyze all images but strictly preserve your manual tags.');
    }

    // Build (or restore from cache) the recognition model
    // Force a fresh model build (don't reuse cached model during a refresh)
    invalidateModelCache();
    const labeledDescriptors = await getCachedModel();

    if (labeledDescriptors.length === 0) {
      console.log('[AI Sync] ⚠️  No users in model — skipping Auto-Identification, but running AI Detection to draw face boxes for Manual Tagging.');
    }

    let updatedCount = 0;
    const realItems = allItems.filter(i => !i.isProfile && i.url);
    this.syncState.total = realItems.length;
    console.log(`[AI Sync] Scanning ${realItems.length} photos with ${labeledDescriptors.length} known user(s)...\n`);

    // Using Parallel processing with functional batching (map)
    const CHUNK = 10;
    const batches = Array.from({ length: Math.ceil(realItems.length / CHUNK) }, (_, i) =>
      realItems.slice(i * CHUNK, i * CHUNK + CHUNK)
    );

    await Promise.all(batches.map(async (chunk) => {
      // ── Batch face detection in parallel ──
      const chunkDetections = await detectFacesWithCacheBatch(chunk, forceRescan);

      // ── Process matches for this batch ──
      await Promise.all(chunk.map(async (item, chunkIdx) => {
        const detections = chunkDetections[chunkIdx];
        const existingIds = (Array.isArray(item.recognizedUserIds)
          ? item.recognizedUserIds.map((id: any) => Number(id))
          : []).sort((a: number, b: number) => a - b);

        const faceDescs = Array.isArray(item.faceDescriptors) ? item.faceDescriptors as any[] : [];
        
        // During a Force Rescan, we must clear previous AI guesses but KEEP your manual tags.
        let baseIds = existingIds;
        if (forceRescan) {
          baseIds = faceDescs
            .map((fd: any) => fd.manuallyTaggedUserId)
            .filter((id: any) => id != null)
            .map((id: any) => Number(id))
            .filter((id: number) => !isNaN(id));
        }

        if (labeledDescriptors.length === 0) {
           if (forceRescan) await galleryRepository.updateById(item.id, { recognizedUserIds: baseIds });
           return;
        }

        // 1. Determine re-matching results while respecting rejections
        const aiIds: number[] = [];
        const newFaceDescriptors = detections.map((det: any, fi: number) => {
          const cachedFace = faceDescs[fi] || {};
          const rejectedIds = Array.isArray(cachedFace.rejectedUserIds) ? cachedFace.rejectedUserIds : [];
          const manuallyTaggedUserId = cachedFace.manuallyTaggedUserId || null;

          const match = faceAi.findBestMatchWithMargin(det.descriptor, labeledDescriptors);
          let recognizedId = null;
          
          if (match.label !== 'unknown') {
            const id = parseUserId(match.label);
            if (id !== null && !rejectedIds.includes(id)) {
              recognizedId = id;
              aiIds.push(id);
            }
          }

          // Build a fresh descriptor object but PERSIST the manual data
          return {
            descriptor: faceAi.serializeDescriptor(det.descriptor),
            box: det.box,
            rejectedUserIds: rejectedIds,
            manuallyTaggedUserId,
            isIgnored: cachedFace.isIgnored || false
          };
        });

        const merged = [...new Set([...baseIds, ...aiIds])].sort((a: number, b: number) => a - b);

        // Always update descriptors during a sync to ensure they are up to date with the latest AI results
        if (aiIds.length > 0) {
          updatedCount++;
        }

        await galleryRepository.updateById(item.id, { 
          recognizedUserIds: merged,
          faceDescriptors: newFaceDescriptors 
        });
      }));

      this.syncState.current += chunk.length;
    }));

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\n✅ AI Sync done in ${duration}s — updated ${updatedCount}/${realItems.length} photos.\n`);
    this.syncState.isScanning = false;
    return { updatedCount, total: realItems.length, durationSc: duration };
  },

  // ── People Clustering ────────────────────────────────────────────────────────
  async getUnknownFaceClusters() {
    const now = Date.now();
    if (_clusterCache && (now - _clusterCacheTime) < CLUSTER_CACHE_TTL_MS) {
      console.log(`[Clustering] ⚡ HIT — using cached clusters (${_clusterCache.length} item(s))`);
      return _clusterCache;
    }

    console.log('[Clustering] 🐢 MISS — Analyzing gallery for unknown people...');
    const allItems = await galleryRepository.findAll();
    const labeledDescriptors = await getCachedModel();

    const realItems = allItems.filter(i => !i.isProfile && i.url);

    const CLUSTER_CHUNK = 10;
    const batches = Array.from({ length: Math.ceil(realItems.length / CLUSTER_CHUNK) }, (_, i) =>
      realItems.slice(i * CLUSTER_CHUNK, i * CLUSTER_CHUNK + CLUSTER_CHUNK)
    );

    const unknownPhotos = (await Promise.all(batches.map(async (chunk) => {
      const chunkDetections = await detectFacesWithCacheBatch(chunk);

      return chunk.map((item, chunkIdx) => {
        const detections = chunkDetections[chunkIdx];
        const faceDescs = Array.isArray(item.faceDescriptors) ? item.faceDescriptors as any[] : [];
        const recognizedIds = Array.isArray(item.recognizedUserIds)
          ? item.recognizedUserIds.map((id: any) => Number(id))
          : [];

        const unknownFacesInPhoto = detections
          .map((det: any, i: number) => {
            const cachedFace = faceDescs[i] || {};
            if (cachedFace.manuallyTaggedUserId || cachedFace.isIgnored) return null;

            const descriptor = det?.descriptor;
            const box = det?.box || cachedFace.box;
            if (!box) return null;

            if (!descriptor) {
              return { itemId: item.id, faceIndex: i, box, descriptor: null };
            }

            const match = faceAi.findBestMatchWithMargin(descriptor, labeledDescriptors);
            if (match.label !== 'unknown') return null;

            return {
              itemId: item.id,
              faceIndex: i,
              box,
              descriptor,
              aiSuggestion: null,
            };
          })
          .filter((f: any) => f !== null);

        // Only show photos that have ACTUAL unknown faces with real bounding boxes.
        // Photos with zero detected faces should NOT appear in the People page.
        if (unknownFacesInPhoto.length === 0) return null;

        return {
          clusterId: `photo-${item.id}`,
          faceCount: unknownFacesInPhoto.length,
          anchorImage: buildUploadUrl(item.url?.split('/').pop() || ''),
          anchorBox: unknownFacesInPhoto[0]?.box || null,
          uploadedAt: new Date(item.uploadedAt).getTime(),
          relatedPhotos: unknownFacesInPhoto.map((f: any) => ({
            itemId: f.itemId,
            faceIndex: f.faceIndex,
            url: buildUploadUrl(item.url?.split('/').pop() || ''),
            box: f.box,
          })),
        };
      });
    }))).flat().filter(r => r !== null);

    const cleanedClusters = unknownPhotos
      .sort((a, b) => b.uploadedAt - a.uploadedAt)
      .map(({ uploadedAt, ...photo }) => photo);

    _clusterCache = cleanedClusters;
    _clusterCacheTime = Date.now();

    console.log(`[Clustering] Found ${cleanedClusters.length} photo(s) containing unknown faces.`);
    return cleanedClusters;
  },

  async getTagSuggestions(galleryItemId: number) {
    const item = await galleryRepository.findById(galleryItemId);
    if (!item) throw httpError(404, 'Gallery item not found');

    const filename = item.url.split('/').pop();
    if (!filename) throw httpError(400, 'Invalid image path');
    const filePath = path.join(UPLOADS_DIR, filename);

    if (!fs.existsSync(filePath)) {
      const detections = await detectFacesWithCache(item);
      const userMap = await getUserMapForSuggestions();
      return {
        url: item.url,
        faces: detections.map((det, idx) => {
          const cachedFace = (Array.isArray(item.faceDescriptors) ? item.faceDescriptors[idx] : null) as any;
          return {
            faceIndex: idx,
            box: det.box,
            confidence: 0,
            isConfident: false,
            topSuggestion: null,
            allSuggestions: [],
            label: 'unknown',
            reason: 'no_detection_cache',
          };
        }),
        highConfidenceCount: 0,
        lowConfidenceCount: detections.length,
        needsScanning: true,
      };
    }

    const result = await recognizeImageWithSuggestions(filePath);
    return {
      url: item.url,
      ...result,
      needsScanning: false,
    };
  },

  async getSuggestionForUpload(filePath: string) {
    const result = await recognizeImageWithSuggestions(filePath);
    return result;
  },

  async mergeClusterFaces(userId: number, faces: { itemId: number, faceIndex: number }[]) {
    const allItems: any[] = await galleryRepository.findAll();

    let updateCount = 0;
    await Promise.all(faces.map(async (face) => {
      const item = allItems.find(i => i.id === face.itemId);
      if (!item) return;

      let updateData: any = {};

      const existingIds = Array.isArray(item.recognizedUserIds) ? item.recognizedUserIds.map((id: any) => Number(id)) : [];
      if (!existingIds.includes(userId)) {
        updateData.recognizedUserIds = [...existingIds, userId];
      }

      if (face.faceIndex >= 0 && Array.isArray(item.faceDescriptors)) {
        const newDescriptors = [...item.faceDescriptors] as any[];
        if (newDescriptors[face.faceIndex]) {
          newDescriptors[face.faceIndex].manuallyTaggedUserId = userId;
          updateData.faceDescriptors = newDescriptors;
        }
      }

      if (Object.keys(updateData).length > 0) {
        await galleryRepository.updateById(item.id, updateData);
        updateCount++;
      }
    }));

    invalidateModelCache();

    invalidateModelCache();

    return { message: `Successfully matched person to ${updateCount} unknown photo(s).`, updatedCount: updateCount };
  },

  async setProfilePictureFromGalleryItem(userId: number, galleryItemId: number) {
    const [user, item] = await Promise.all([
      userRepository.findById(userId),
      galleryRepository.findById(galleryItemId),
    ]);

    if (!user) throw httpError(404, 'User not found');
    if (!item || !item.url) throw httpError(404, 'Gallery item not found');
    if (item.isProfile) throw httpError(400, 'Cannot use a profile item as source.');

    if (user.profile_picture) {
      // User already has a profile picture — don't overwrite it automatically.
      return { updated: false, message: 'User already has a profile picture.' };
    }

    await userRepository.updateById(userId, {
      profile_picture: item.url,
      profileDescriptor: null,
    });

    invalidateModelCache();

    this.refreshGalleryRecognition().catch(err => console.error('[Profile Fallback] BG refresh failed:', err));

    return { updated: true, message: 'Profile picture set from selected photo.' };
  },

  async ignoreClusterFaces(faces: { itemId: number, faceIndex: number }[]) {
    const allItems: any[] = await galleryRepository.findAll();
    let updateCount = 0;
    await Promise.all(faces.map(async (face) => {
      const item = allItems.find(i => i.id === face.itemId);
      if (!item) return;

      if (Array.isArray(item.faceDescriptors)) {
        const newDescriptors = [...item.faceDescriptors] as any[];
        if (newDescriptors[face.faceIndex]) {
          newDescriptors[face.faceIndex].isIgnored = true;
          await galleryRepository.updateById(item.id, { faceDescriptors: newDescriptors });
          updateCount++;
        }
      }
    }));

    invalidateModelCache();
    return { message: `Successfully ignored ${updateCount} face(s). Discovery list cleaned.`, updatedCount: updateCount };
  },

  async resetIgnoredFaces() {
    const allItems: any[] = await galleryRepository.findAll();
    let resetCount = 0;
    await Promise.all(allItems.map(async (item) => {
      if (Array.isArray(item.faceDescriptors)) {
        const newDescriptors = [...item.faceDescriptors] as any[];
        let itemChanged = false;
        newDescriptors.forEach(d => {
          if (d && d.isIgnored) {
            delete d.isIgnored;
            itemChanged = true;
            resetCount++;
          }
        });
        if (itemChanged) {
          await galleryRepository.updateById(item.id, { faceDescriptors: newDescriptors });
        }
      }
    }));

    if (resetCount > 0) {
      invalidateModelCache();
    }
    return { message: `Restored ${resetCount} faces to discovery.`, resetCount };
  },

};

export { galleryService, buildLabeledDescriptors };
export default galleryService;
