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

// ─── In-Memory Model Cache ────────────────────────────────────────────────────
// buildLabeledDescriptors is expensive (reads all gallery items + runs AI scans).
// Cache the result in memory for MODEL_CACHE_TTL_MS to avoid rebuilding on every
// upload or refresh call.  Cache is invalidated whenever we tag/untag a face.
const MODEL_CACHE_TTL_MS = 3 * 60 * 1000; // 3 minutes
let _modelCache: faceApiLib.LabeledFaceDescriptors[] | null = null;
let _modelCacheTime = 0;

function invalidateModelCache() {
  _modelCache = null;
  _modelCacheTime = 0;
  console.log('[Model Cache] 🗑️  Invalidated');
}

async function getCachedModel(): Promise<faceApiLib.LabeledFaceDescriptors[]> {
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

  // MISS: run AI scan
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

    if (!descriptors.includes(groundTruth)) descriptors.push(groundTruth);

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
        // Professional limit for memorizing diverse profile angles (0.68)
        if (dist < bestDist && dist < 0.68) { bestDist = dist; best = det.descriptor; }
      }
      if (best && !descriptors.includes(best)) descriptors.push(best);
    }

    console.log(`[AI Model] ✅ ${user.name} — ${descriptors.length} descriptor(s)`);
    return new faceApiLib.LabeledFaceDescriptors(
      JSON.stringify({ id: user.id, name: user.name }),
      descriptors
    );
  }));

  const model = results.filter((r): r is faceApiLib.LabeledFaceDescriptors => r !== null);
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
      const normalizedUserId = userService.normalizeUserId(userId);
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

  // ── Upload gallery ──────────────────────────────────────────────────────────
  async uploadGallery(files: any[] = [], userId: any = null) {
    if (!files || files.length === 0) throw httpError(400, 'No files uploaded');

    const labeledDescriptors = await getCachedModel();
    const uploaderId = userId ? Number(userId) : null;

    const items = await Promise.all(files.map(async (file) => {
      // Detect all faces in the uploaded image
      const detections = await faceAi.detectFaces(file.path);
      const faceDescriptors = detections.map(d => ({
        descriptor: faceAi.serializeDescriptor(d.descriptor),
        box: d.box,
      }));

      // Identify each detected face
      let recognizedUserIds: number[] = [];
      if (labeledDescriptors.length > 0 && detections.length > 0) {
        recognizedUserIds = detections
          .map(det => {
            const match = faceAi.findBestMatchWithMargin(det.descriptor, labeledDescriptors);
            if (match.label === 'unknown') return null;
            return parseUserId(match.label);
          })
          .filter((id): id is number => id !== null);
      }

      return {
        url: userService.buildUploadUrl(file.filename),
        uploadedAt: new Date(),
        recognizedUserIds: [...new Set(recognizedUserIds)],
        userId: uploaderId,
        faceDescriptors,
      };
    }));

    await galleryRepository.createMany(items);
    // Invalidate model cache so next request picks up new training data
    invalidateModelCache();
    return this.listGallery(userId);
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
        updateData.faceDescriptors = newDescriptors;
      }
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
      console.log('[AI Sync] ✨ Intelligent Force rescan — clearing descriptor caches ONLY for missed faces...');
      const toWipe = allItems.filter(i => 
        !i.isProfile && 
        i.url && 
        (Array.isArray(i.faceDescriptors) ? i.faceDescriptors.length === 0 : true)
      );
      
      await Promise.all(
        toWipe.map(item =>
          galleryRepository.updateById(item.id, { faceDescriptors: null }).catch(() => {})
        )
      );
      allItems = await galleryRepository.findAll();
      console.log(`[AI Sync] ✅ Scheduled heavy re-scan only for ${toWipe.length} item(s)`);
    }

    // Build (or restore from cache) the recognition model
    // Force a fresh model build (don't reuse cached model during a refresh)
    invalidateModelCache();
    const labeledDescriptors = await getCachedModel();

    if (labeledDescriptors.length === 0) {
      console.log('[AI Sync] ⚠️  No users in model — nothing to recognize. Aborting.');
      this.syncState.isScanning = false;
      return { updatedCount: 0, total: allItems.length };
    }

    let updatedCount = 0;
    const realItems = allItems.filter(i => !i.isProfile && i.url);
    this.syncState.total = realItems.length;
    console.log(`[AI Sync] Scanning ${realItems.length} photos with ${labeledDescriptors.length} known user(s)...\n`);

    // Process in batches of 3 (balance speed vs CPU)
    const CHUNK = 3;
    for (let i = 0; i < realItems.length; i += CHUNK) {
      const chunk = realItems.slice(i, i + CHUNK);
      await Promise.all(chunk.map(async (item) => {
        // Existing tags (never removed)
        const existingIds = (Array.isArray(item.recognizedUserIds)
          ? item.recognizedUserIds.map(id => Number(id))
          : []).sort((a, b) => a - b);

        // Detect faces (uses cache or re-scans)
        const detections = await detectFacesWithCache(item);
        console.log(`  Item ${item.id}: ${detections.length} face(s) detected`);

        // Identify each detected face
        const aiIds = detections
          .map(det => {
            const match = faceAi.findBestMatchWithMargin(det.descriptor, labeledDescriptors);
            if (match.label === 'unknown') return null;
            const id = parseUserId(match.label);
            if (id !== null) console.log(`    → matched user ${id} (dist=${match.distance?.toFixed(3)})`);
            return id;
          })
          .filter((id): id is number => id !== null);

        // Merge without removing existing tags
        const merged = [...new Set([...existingIds, ...aiIds])].sort((a, b) => a - b);

        if (!arraysEqual(merged, existingIds)) {
          await galleryRepository.updateById(item.id, { recognizedUserIds: merged });
          updatedCount++;
          const added = merged.filter(id => !existingIds.includes(id));
          console.log(`  ✅ Item ${item.id}: added [${added.join(', ')}]`);
        }
      }));
      
      this.syncState.current += chunk.length;
      
      // CRITICAL: Yield the event loop to Node so the API doesn't freeze under load
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\n✅ AI Sync done in ${duration}s — updated ${updatedCount}/${realItems.length} photos.\n`);
    this.syncState.isScanning = false;
    return { updatedCount, total: realItems.length, durationSc: duration };
  },
};

export { galleryService, buildLabeledDescriptors };
export default galleryService;
