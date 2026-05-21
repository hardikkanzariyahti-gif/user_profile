import * as fs from 'fs';
import * as path from 'path';
import sharp from 'sharp';
import faceAi from '../../faceAi';
import { UPLOADS_DIR } from '../config/constants';
import galleryRepository from '../repositories/galleryRepository';
import userRepository from '../repositories/userRepository';
import { toGalleryResponse } from '../utils/serializers';
import httpError from '../utils/httpError';
import { buildUploadUrl } from '../utils/urlUtils';
import { normalizeHashtags, normalizeTag, cleanupAIPayload, enrichMetadataWithHashtagFallbacks } from '../utils/hashtagUtils';
import prisma from '../config/prisma';
import { getGalleryPreprocessQueue, getGalleryRefreshQueue, getGalleryScanQueue } from '../queues/galleryQueues';
import { getRedis } from '../queues/redis';
import { setSyncState } from '../queues/syncStateStore';

async function optimizeImageInProcess(srcPath: string, optPath: string) {
  try {
    const optDir = path.dirname(optPath);
    if (!fs.existsSync(optDir)) {
      fs.mkdirSync(optDir, { recursive: true });
    }

    // Generate main analytical optimized surrogate
    const meta = await sharp(srcPath).metadata();
    const origWidth = meta.width || 0;
    const origHeight = meta.height || 0;
    const maxDimension = Math.max(origWidth, origHeight);

    let targetSize = 1600;
    if (maxDimension > 3500) {
      targetSize = 2400;
    } else if (maxDimension > 2000) {
      targetSize = 2000;
    }

    await sharp(srcPath)
      .rotate()
      .resize({ width: targetSize, height: targetSize, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 85, mozjpeg: true })
      .toFile(optPath);

    // SAFETY IN-PROCESS THUMBNAIL: Generate small UI-friendly cache 
    const name = path.basename(srcPath).replace(/\.[a-z0-9]+$/i, '');
    const thumbDir = path.join(UPLOADS_DIR, 'thumbs');
    if (!fs.existsSync(thumbDir)) fs.mkdirSync(thumbDir, { recursive: true });

    const thumbPath = path.join(thumbDir, `${name}_400.jpg`);
    if (!fs.existsSync(thumbPath)) {
      await sharp(srcPath)
        .rotate()
        .resize({ width: 400, height: 400, fit: 'cover' })
        .jpeg({ quality: 75, mozjpeg: true })
        .toFile(thumbPath);
      console.log(`[Optimizer] Successfully seeded mini-thumbnail: ${path.basename(thumbPath)}`);
    }
  } catch (err) {
    console.error('[Sharp Optimization Failed]', err);
  }
}

async function pickScanPathAndOptimize(srcPath: string): Promise<string> {
  const name = srcPath.split(/[/\\]/).pop() || '';
  const opt = path.join(UPLOADS_DIR, 'optimized', name);
  if (fs.existsSync(opt)) return opt;

  await optimizeImageInProcess(srcPath, opt);
  if (fs.existsSync(opt)) return opt;
  return srcPath;
}

async function getGalleryItemResponseById(id: number) {
  const [item, allUsers] = await Promise.all([
    galleryRepository.findById(id),
    userRepository.findAllForRecognition(),
  ]);
  if (!item) throw httpError(404, 'Gallery item not found');

  const userMap: Record<number, any> = {};
  for (const u of allUsers) userMap[u.id] = u;

  const faceDescs = Array.isArray((item as any).faceDescriptors) ? (item as any).faceDescriptors as any[] : [];
  let secureUserIds: number[] = (Array.isArray((item as any).recognizedUserIds) ? (item as any).recognizedUserIds : []).map(Number);

  // 🛡️ GUARDIAN PROTOCOL (Item 6): If detailed spatial face descriptors are loaded, always yield absolute priority 
  // to discrete face-level linkage arrays to eradicate ghost records or stale image-level summaries.
  if (faceDescs.length > 0) {
    const extractedSet = new Set<number>();
    for (const f of faceDescs) {
      const directId = f?.manuallyTaggedUserId != null ? Number(f.manuallyTaggedUserId) : (f?.personId != null ? Number(f.personId) : (f?.userId != null ? Number(f.userId) : null));
      if (directId !== null && !isNaN(directId) && directId > 0) {
        extractedSet.add(directId);
      }
    }
    // Override ONLY if we recovered concrete truth records from within face descriptors to avoid clearing correctly assigned orphaned logic.
    if (extractedSet.size > 0) {
      secureUserIds = Array.from(extractedSet);
    }
  }

  const enriched: any = {
    ...item,
    recognizedUsers: secureUserIds
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

// Prevents duplicate scan jobs being spawned for the same image at the same time.
const _processingLock = new Set<number>();

interface ImageTask {
  imageId: number;
  isForceScan: boolean;
  isForceMeta: boolean;
  resolve: () => void;
  reject: (e: Error) => void;
  retries: number;
}

class ImageTaskQueue {
  public queue: ImageTask[] = [];
  public active = new Set<number>();
  private concurrency = 2; // Process max 2 images at a time for absolute safe concurrency

  public totalJobs = 0;
  public completedJobs = 0;

  public async getStage(): Promise<'Upload' | 'Face' | 'Metadata' | 'Complete'> {
    if (this.active.size === 0 && this.queue.length === 0) {
      return 'Complete';
    }
    const activeIds = Array.from(this.active);
    if (activeIds.length === 0) return 'Upload';
    try {
      const items = await prisma.galleryItem.findMany({
        where: { id: { in: activeIds } },
        select: { scanStatus: true, metadataStatus: true }
      });
      const hasMeta = items.some(item => 
        item.metadataStatus === 'object_detection' || 
        item.metadataStatus === 'metadata_generation'
      );
      if (hasMeta) return 'Metadata';
      const hasFace = items.some(item => item.scanStatus === 'face_scan');
      if (hasFace) return 'Face';
    } catch { }
    return 'Upload';
  }

  public enqueue(imageId: number, isForceScan = false, isForceMeta = false): Promise<void> {
    return new Promise((resolve, reject) => {
      // Avoid duplicate processing of same imageId
      if (this.active.has(imageId) || this.queue.some(q => q.imageId === imageId)) {
        console.log(`[QUEUE] imageId ${imageId} already processing or queued. Skipping enqueue.`);
        return resolve(); // Already handled
      }
      if (this.active.size === 0 && this.queue.length === 0) {
        this.totalJobs = 1;
        this.completedJobs = 0;
      } else {
        this.totalJobs++;
      }
      this.queue.push({ imageId, isForceScan, isForceMeta, resolve, reject, retries: 0 });
      this.next();
    });
  }

  public cancelAll(): { activeCancelled: number; queuedCancelled: number } {
    const activeCancelled = this.active.size;
    const queuedCancelled = this.queue.length;
    console.log(`[QUEUE] Cancelling all background jobs. Active: ${activeCancelled}, Queued: ${queuedCancelled}`);
    
    for (const task of this.queue) {
      task.reject(new Error('Job cancelled by administrator action.'));
    }
    
    this.queue = [];
    this.active.clear();
    this.totalJobs = 0;
    this.completedJobs = 0;

    return { activeCancelled, queuedCancelled };
  }

  private async next() {
    if (this.active.size >= this.concurrency) return;
    if (this.queue.length === 0) return;

    const task = this.queue.shift()!;
    this.active.add(task.imageId);
    console.log(`[QUEUE] picked imageId ${task.imageId} (attempt #${task.retries + 1})`);

    this.executeTask(task);
  }

  private async executeTask(task: ImageTask) {
    const TIMEOUT_MS = 60000; // 60 second limit per image
    let timer: NodeJS.Timeout | null = null;

    try {
      const timeoutPromise = new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('Timeout: Process took more than 60 seconds')), TIMEOUT_MS);
      });

      // Execute direct pipeline call
      const { galleryService } = await import('./galleryService');
      await Promise.race([
        galleryService.processGalleryImageDirect(task.imageId, task.isForceScan, task.isForceMeta),
        timeoutPromise
      ]);

      if (timer) clearTimeout(timer);
      task.resolve();
    } catch (err: any) {
      if (timer) clearTimeout(timer);
      console.error(`[QUEUE] 🛑 Task failure or timeout on ID ${task.imageId}:`, err.message);

      // Exponential Retry Logic (Requirement 3)
      if (task.retries < 3) {
        const nextRetry = task.retries + 1;
        const delayMs = Math.pow(2, nextRetry) * 3000; // 6s, 12s, 24s backoff
        console.log(`[QUEUE] [RETRY] Rescheduling task ${task.imageId} in ${delayMs}ms (Retry ${nextRetry}/3)...`);

        setTimeout(() => {
          this.queue.push({ ...task, retries: nextRetry });
          this.next();
        }, delayMs);
      } else {
        // Final Failure - Explicit recovery: write failure to DB to avoid stuck state
        console.log(`[FAIL] Exhausted all retries for task ${task.imageId}. Marking explicitly as failed.`);
        try {
          const currentItem = await galleryRepository.findById(task.imageId);
          const currentRaw = (currentItem?.metadata as any)?.rawJson || {};

          await galleryRepository.updateById(task.imageId, {
            scanStatus: 'failed',
            metadataStatus: 'failed',
            metadata: {
              ...currentRaw,
              lastScanError: `Max Retries Failed: ${err.message}`,
              lastMetaError: `Max Retries Failed: ${err.message}`,
            }
          });
          console.log(`[DB] updated statuses imageId ${task.imageId} to failed due to exhaust retry`);
        } catch (dbErr) {
          console.error(`[QUEUE] Critical write fail for stuck item ${task.imageId}:`, dbErr);
        }
        task.reject(err);
      }
    } finally {
      this.active.delete(task.imageId);
      this.completedJobs++;
      // Process next in line immediately
      setImmediate(() => this.next());
    }
  }
}

const imageQueue = new ImageTaskQueue();

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

  const data = await faceAi.detectFaces(filePath);
  const detections = data.faces || [];

  // Persist result to DB (background, non-blocking)
  const serialized = detections.map((d: any) => ({
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
    const data = batchDetections[j];
    const detections = data.faces || [];
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

async function getProfileDescriptorsWithCache(user: any): Promise<Float32Array[]> {
  if (user.profileDescriptor && (Array.isArray(user.profileDescriptor) ? user.profileDescriptor.length > 0 : true)) {
    try {
      const cached = Array.isArray(user.profileDescriptor) ? user.profileDescriptor : [user.profileDescriptor];
      const parsed = cached.map((d: any) => {
        const raw = d && typeof d === 'object' && d.descriptor ? d.descriptor : d;
        return faceAi.deserializeDescriptor(raw);
      }).filter((d: any): d is Float32Array => d !== null);
      if (parsed.length > 0) return parsed;
    } catch (e) {
      console.warn(`[Profile Cache] Failed to deserialize for user ${user.id}, re-calculating...`);
    }
  }

  const urls = Array.isArray(user.profile_pictures) && user.profile_pictures.length > 0
    ? user.profile_pictures
    : (user.profile_picture ? [user.profile_picture] : []);

  if (urls.length === 0) return [];

  const descriptors: Float32Array[] = [];
  for (const url of urls) {
    const filename = url.split('/').pop();
    if (!filename) continue;
    const filePath = path.join(UPLOADS_DIR, filename);
    if (!fs.existsSync(filePath)) continue;

    const descriptor = await faceAi.getFaceDescriptor(filePath);
    if (descriptor) descriptors.push(descriptor);
  }

  if (descriptors.length > 0) {
    const serialized = descriptors.map(d => faceAi.serializeDescriptor(d));
    userRepository.updateById(user.id, {
      profileDescriptor: serialized,
    }).catch(err => console.error(`[Profile Cache] Failed to save for user ${user.id}:`, err.message));
  }

  return descriptors;
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

    // Step 1: Profile picture ground truth (multiple angles supported)
    const profileDescriptors = await getProfileDescriptorsWithCache(user);
    descriptors.push(...profileDescriptors);
    let groundTruth = profileDescriptors.length > 0 ? profileDescriptors[0] : null;

    // Step 2: Bootstrap from manually tagged photos (users with no profile pic)
    if (!groundTruth && descriptors.length === 0) {
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

    if (!descriptors.some(d => faceAi.cosineDistance(d, groundTruth!) < 0.01)) {
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
        const dist = faceAi.cosineDistance(groundTruth!, det.descriptor);
        // Professional limit for memorizing diverse profile angles (cosine distance ~ 0.17)
        if (dist < bestDist && dist < 0.17) { bestDist = dist; best = det.descriptor; }
      }
      if (best && !descriptors.some(d => faceAi.cosineDistance(d, best!) < 0.01)) {
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
  async listGallery(userId: any = null, search: string = '') {
    const [galleryItems, allUsers] = await Promise.all([
      galleryRepository.findAllLight(),
      userRepository.findAllForRecognition(),
    ]);

    const q = search.toLowerCase().trim();

    // Build lookup map: userId → user (with profile_picture)
    const userMap: Record<number, any> = {};
    for (const u of allUsers) userMap[u.id] = u;

    const merged = galleryItems.filter((item: any) => !item.isProfile);
    const seenUrls = new Set<string>();
    const uniqueItems: any[] = [];

    for (const item of merged) {
      if (!item.url || seenUrls.has(item.url)) continue;

      const filename = item.url.split('/').pop();
      if (!filename || !fs.existsSync(path.join(UPLOADS_DIR, filename))) continue;

      // ─── SEARCH FILTER ───
      if (q) {
        const i = item as any;
        const recognizedUsers = (Array.isArray(i.recognizedUserIds) ? i.recognizedUserIds : [])
          .map((id: any) => userMap[Number(id)])
          .filter(Boolean);

        const hashtagNames = Array.isArray(i.hashtags) ? i.hashtags.map((h: any) => h.name) : [];
        const tags = hashtagNames.join(' ').toLowerCase();
        const names = recognizedUsers.map((u: any) => u.name.toLowerCase()).join(' ');
        const metadataStr = JSON.stringify(i.metadata || {}).toLowerCase();
        const dateStr = new Date(i.uploadedAt).toDateString().toLowerCase();

        const matches = tags.includes(q) || names.includes(q) || metadataStr.includes(q) || dateStr.includes(q) || (i.label && i.label.toLowerCase().includes(q));
        if (!matches) continue;
      }

      seenUrls.add(item.url);
      uniqueItems.push(item);
    }

    uniqueItems.sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());

    // Filter for personal view (if userId is provided)
    let visibleItems = uniqueItems;
    if (userId !== null && userId !== undefined && userId !== 'null') {
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
      hashtags: Array.isArray(item.hashtags) ? item.hashtags.map((h: any) => h.name) : [],
      metadata: item.metadata ? (item.metadata.rawJson || item.metadata) : {},
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

    // Fix 2: Explicitly preserve manual selections into internal metadata cache for AI isolation
    const existingMeta = (item.metadata as any) || {};
    const rawJson = (existingMeta.rawJson as any) || {};
    const updatedMeta = {
      ...rawJson,
      manualHashtags: hashtags // Track actual manual user assignments
    };

    await galleryRepository.updateById(id, {
      hashtags,
      metadata: updatedMeta
    });
    return getGalleryItemResponseById(id);
  },

  async setGalleryItemCustomMetadata(id: number, customLocation: string, customEvent: string) {
    const item = await galleryRepository.findById(id);
    if (!item) throw httpError(404, 'Gallery item not found');

    const currentMetadata = (item.metadata as any) || {};
    const rawJson = (currentMetadata.rawJson as any) || {};

    const updatedMetadata = {
      ...rawJson,
      customLocation: customLocation || '',
      customEvent: customEvent || '',
    };

    await galleryRepository.updateById(id, {
      metadata: updatedMetadata,
      objects: (item.metadata as any)?.objects || [],
      scenes: (item.metadata as any)?.scenes || [],
      ocrText: (item.metadata as any)?.ocrText || [],
    });

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
  async uploadGallery(
    files: any[] = [],
    userId: any = null,
    eventInfo?: { eventName?: string; location?: string; date?: string; description?: string; eventId?: number; tags?: string[] }
  ) {
    if (!files || files.length === 0) throw httpError(400, 'No files uploaded');

    const uploaderId = userId ? Number(userId) : null;

    // 1. Auto-Album generation/association for Event / Tour uploads
    let targetAlbumId: number | null = null;
    if (eventInfo && (eventInfo.eventId || eventInfo.eventName)) {
      if (eventInfo.eventId) {
        targetAlbumId = eventInfo.eventId;
        console.log(`[EVENT_SELECT] eventId: ${targetAlbumId}`);
      } else if (eventInfo.eventName) {
        let effectiveUserId = uploaderId;
        // Hard fallback to first admin/user to prevent relation constraints if uploader ID is somehow missing
        if (!effectiveUserId) {
          const firstUser = await prisma.user.findFirst({ select: { id: true } });
          if (firstUser) effectiveUserId = firstUser.id;
        }

        if (effectiveUserId) {
          let album = await prisma.album.findFirst({
            where: {
              title: eventInfo.eventName,
              userId: effectiveUserId
            }
          });

          if (!album) {
            album = await prisma.album.create({
              data: {
                title: eventInfo.eventName,
                description: eventInfo.description || `Photo event: ${eventInfo.eventName}`,
                userId: effectiveUserId,
                isGlobal: true
              }
            });
            console.log(`[Event Upload] Created custom event album: "${album.title}" (ID: ${album.id})`);
          } else {
            console.log(`[Event Upload] Appending items to existing album: "${album.title}" (ID: ${album.id})`);
          }
          targetAlbumId = album.id;
          console.log(`[EVENT_SELECT] eventId: ${targetAlbumId}`);
        }
      }
    }

    // 2. Map gallery items and embed preset metadata
    const itemsToSave = files.map(file => ({
      url: buildUploadUrl(file.filename),
      uploadedAt: eventInfo?.date ? new Date(eventInfo.date) : new Date(),
      recognizedUserIds: [] as number[],
      userId: uploaderId,
      faceDescriptors: null,
      scanStatus: 'pending',
      metadataStatus: 'pending',
      hashtags: eventInfo?.tags || undefined,
      // Seed the metadata which automatically gets merged & protected by AI pipelines
      metadata: eventInfo ? {
        eventName: eventInfo.eventName,
        customEvent: eventInfo.eventName,
        location: eventInfo.location || null,
        customLocation: eventInfo.location || null,
        description: eventInfo.description || null,
        metadataGenerated: false
      } : undefined,
      // Express connection to the Album via Prisma implicit M-N relations
      albums: targetAlbumId ? {
        connect: [{ id: targetAlbumId }]
      } : undefined
    }));

    await galleryRepository.createMany(itemsToSave);

    const urls = itemsToSave.map(i => i.url);
    const newItems = await prisma.galleryItem.findMany({
      where: { url: { in: urls } },
      include: { hashtags: true, metadata: true }
    });

    const pairs = files
      .map(file => ({
        file,
        item: newItems.find((i: any) => i.url && i.url.includes(file.filename))
      }))
      .filter(p => p.item);

    const itemIds = pairs.map((p: any) => Number(p.item?.id)).filter((id: number) => !isNaN(id));
    const queue = getGalleryPreprocessQueue();
    const redis = getRedis();
    if (queue && redis) {
      await setSyncState(redis, { isScanning: true, stage: 'preprocess', message: 'Preparing images…', current: 0, total: itemIds.length } as any);
      await queue.add(
        'preprocess',
        { type: 'upload', itemIds },
        { attempts: 3, backoff: { type: 'exponential', delay: 2000 }, removeOnComplete: true, removeOnFail: 50, priority: 1 }
      );
    } else {
      // Backward-compatible fallback: route straight to concurrent-safe, in-memory job queue
      console.log(`[Upload] 🚀 Enqueueing ${itemIds.length} uploaded items into task queue...`);
      for (const id of itemIds) {
        imageQueue.enqueue(id).catch(() => { });
      }
    }

    const gallery = await this.listGallery(userId);
    return {
      gallery,
      albumId: targetAlbumId,
      uploadedItemIds: itemIds
    };
  },

  async forceScanItem(galleryItemId: number) {
    const item = await galleryRepository.findById(galleryItemId);
    if (!item) throw httpError(404, 'Gallery item not found');
    if (item.isProfile) throw httpError(400, 'Profile pictures cannot be indexed in the analytical metadata stream.');
    if (!item.url) throw httpError(400, 'Gallery item has no image URL');

    // ── Idempotency Lock ──────────────────────────────────────────────────────
    if (_processingLock.has(galleryItemId)) {
      console.log(`[Force Scan] ⏭️ Skipped: image ${galleryItemId} is already being scanned.`);
      return { message: 'Scan already in progress for this image.', skipped: true };
    }
    _processingLock.add(galleryItemId);
    console.log(`[Force Scan] 🔒 Lock acquired for image ${galleryItemId}.`);

    try {
      // 🚀 Master Unified Pipeline Call
      // For force re-scans, we specify both forceScan=true and forceMeta=true!
      await this.processGalleryImage(galleryItemId, true, true);

      invalidateModelCache();
      return { message: 'Image successfully force-scanned.' };
    } finally {
      _processingLock.delete(galleryItemId);
      console.log(`[Force Scan] 🔓 Lock released for image ${galleryItemId}.`);
    }
  },

  async identifyFacesInDetections(detections: any[], labeledDescriptors: LabeledFaceDescriptors[], faceDescs: any[], baseIds: number[]) {
    const aiIds: number[] = [];
    const descriptors = detections.map((det: any, fi: number) => {
      const cachedFace = faceDescs[fi] || {};
      const rejectedIds = Array.isArray(cachedFace.rejectedUserIds) ? cachedFace.rejectedUserIds : [];
      const manuallyTaggedUserId = cachedFace.manuallyTaggedUserId || null;

      const match = faceAi.findBestMatchWithMargin(det.descriptor, labeledDescriptors);

      if (match.label !== 'unknown') {
        const id = parseUserId(match.label);
        if (id !== null && !rejectedIds.includes(id)) {
          aiIds.push(id);
        }
      }

      return {
        descriptor: faceAi.serializeDescriptor(det.descriptor),
        box: det.box,
        rejectedUserIds: rejectedIds,
        manuallyTaggedUserId,
        isIgnored: cachedFace.isIgnored || false
      };
    });
    return { aiIds: [...new Set(aiIds)], descriptors };
  },

  // ── Tag a face manually ────────────────────────────────────────────────────
  async tagUnknownFace(galleryItemId: number, userId: number, faceIndex?: number) {
    const [item, user] = await Promise.all([
      galleryRepository.findById(galleryItemId),
      userRepository.findById(userId),
    ]);

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
    }

    await galleryRepository.updateById(galleryItemId, updateData);

    const profilePictureSet = !user.profile_picture;
    if (profilePictureSet && item.url) {
      await userRepository.updateById(userId, {
        profile_picture: item.url,
        profileDescriptor: null,
      });
    }

    invalidateModelCache();
    this.refreshGalleryRecognition().catch(err => console.error('[Tag] BG refresh failed:', err));

    return { message: `Tagged ${user.name} successfully`, profilePictureSet };
  },

  async bulkTagAndAlbum(itemIds: number[], targetUserId: number | null | undefined, currentUserId: number, targetTagName?: string | null) {
    try {
      // 1. Resolve target user profile or event tag
      let user = null;
      let albumTitle = '';

      if (targetUserId) {
        user = await userRepository.findById(Number(targetUserId));
        if (!user) throw new Error('Target user profile not found.');
        albumTitle = user.name.trim();
      } else if (targetTagName) {
        const trimmedName = targetTagName.trim();
        if (!trimmedName) throw new Error('Tag name cannot be empty.');
        
        // Look up user by name (case-insensitive)
        const existingUser = await prisma.user.findFirst({
          where: {
            name: { equals: trimmedName, mode: 'insensitive' }
          }
        });

        if (existingUser) {
          user = existingUser;
          albumTitle = existingUser.name.trim();
        } else {
          // As explicitly requested: Event/Album creation must save only in the Album/Event table.
          // It must NOT create user/profile records or fake emails.
          albumTitle = trimmedName;
          console.log(`[EVENT_CREATE] eventName: ${albumTitle}`);
          console.log(`[EVENT_CREATE] shouldNotCreateProfile: true`);
        }
      } else {
        throw new Error('Either targetUserId or targetTagName must be provided.');
      }

      // 2. Validate current user to own the album to avoid Prisma Foreign Key 500 errors
      const ownerExists = await prisma.user.findUnique({ where: { id: currentUserId } });
      const finalUserId = ownerExists ? currentUserId : (await prisma.user.findFirst({ select: { id: true } }))?.id;
      if (!finalUserId) {
        throw new Error('No valid database user exists to own the album. Please register a profile first.');
      }

      // 3. Filter valid photo IDs that physically exist in the DB
      const uniqueItemIds = Array.from(new Set(itemIds.map(Number)));
      const existingItems = await prisma.galleryItem.findMany({
        where: {
          id: { in: uniqueItemIds },
          isProfile: false
        },
        select: { id: true, url: true, recognizedUserIds: true }
      });
      
      const validItemIds = existingItems.map(item => item.id);
      if (validItemIds.length === 0) {
        throw new Error('None of the selected photos exist in the database catalog.');
      }

      // 4. Run Album Creation & Custom Photo Tag updates inside one single database Transaction for speed and safety
      const transactionResult = await prisma.$transaction(async (tx) => {
        // Search if album already exists with the same title under this user (case-insensitive)
        const existingAlbum = await tx.album.findFirst({
          where: {
            userId: finalUserId,
            title: { equals: albumTitle, mode: 'insensitive' }
          }
        });

        let targetAlbum;
        if (existingAlbum) {
          // Connect existing items
          targetAlbum = await tx.album.update({
            where: { id: existingAlbum.id },
            data: {
              items: {
                connect: validItemIds.map(id => ({ id }))
              }
            },
            include: { items: true }
          });
        } else {
          // Create new album
          targetAlbum = await tx.album.create({
            data: {
              title: albumTitle,
              userId: finalUserId,
              isGlobal: true,
              items: {
                connect: validItemIds.map(id => ({ id }))
              }
            },
            include: { items: true }
          });
        }

        // Apply recognized user tags to the photo records inside the transaction only if user exists
        if (user) {
          for (const item of existingItems) {
            const currentIds = Array.isArray(item.recognizedUserIds) ? item.recognizedUserIds.map(Number) : [];
            if (!currentIds.includes(Number(user.id))) {
              await tx.galleryItem.update({
                where: { id: item.id },
                data: {
                  recognizedUserIds: [...currentIds, Number(user.id)]
                }
              });
            }
          }
        }

        return targetAlbum;
      });

      if (!user) {
        console.log(`[EVENT_CREATE] createdAlbumId: ${transactionResult.id}`);
        if (transactionResult.items && transactionResult.items.length > 0) {
          console.log(`[EVENT_PHOTOS] eventId: ${transactionResult.id}`);
          console.log(`[EVENT_PHOTOS] count: ${transactionResult.items.length}`);
          transactionResult.items.forEach((item: any) => {
            console.log(`[EVENT_PHOTOS] imageUrl: ${item.url}`);
          });
        }
      }

      // 5. Invalidate client-side caches
      invalidateModelCache();

      const successMsg = user 
        ? `Successfully tagged ${validItemIds.length} photos with "${user.name}" and synced to album "${albumTitle}".` 
        : `Successfully organized ${validItemIds.length} photos into event album "${albumTitle}".`;
      console.log(`[BulkTag] ${successMsg}`);

      return {
        success: true,
        message: successMsg,
        albumId: transactionResult.id,
        albumTitle: albumTitle
      };
    } catch (err: any) {
      console.error('[BulkTag] Failed creating custom tag and album:', err);
      throw new Error(`Bulk tag and album creation failed: ${err.message}`);
    }
  },

  async untagFace(galleryItemId: number, userId: number, faceIndex?: number) {
    const item = await galleryRepository.findById(galleryItemId);
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
    }

    await galleryRepository.updateById(galleryItemId, updateData);

    invalidateModelCache();
    this.refreshGalleryRecognition().catch(err => console.error('[Untag] BG refresh failed:', err));
    return { message: 'Tag removed successfully' };
  },

  async getProcessingStatus() {
    const activeCount = imageQueue.active.size;
    const queuedCount = imageQueue.queue.length;
    const isProcessing = activeCount > 0 || queuedCount > 0;
    const stage = await imageQueue.getStage();
    
    let total = imageQueue.totalJobs;
    let completed = imageQueue.completedJobs;
    
    if (isProcessing && total === 0) {
      total = activeCount + queuedCount;
      completed = 0;
    }
    
    return {
      isProcessing,
      total,
      completed: Math.min(completed, total),
      stage
    };
  },

  syncState: { isScanning: false, total: 0, current: 0 },

  async refreshGalleryRecognition(forceRescan = false) {
    if (this.syncState.isScanning) {
      console.log('⚠️ AI Sync already running, ignoring parallel request.');
      return { message: 'Sync in progress' };
    }

    const queue = getGalleryRefreshQueue();
    const redis = getRedis();
    if (queue && redis) {
      await setSyncState(redis, { isScanning: true, stage: 'preprocess', message: 'Preparing images…', current: 0, total: 0 } as any);
      await queue.add(
        'refresh',
        { forceRescan },
        { jobId: `gallery:refresh:${forceRescan ? 'force' : 'soft'}`, attempts: 3, backoff: { type: 'exponential', delay: 2000 }, removeOnComplete: true, removeOnFail: 50, priority: 5 }
      );
      return { message: 'Queued sync', forceRescan };
    }

    this.syncState = { isScanning: true, total: 0, current: 0 };
    console.log(`\n🚀 AI Sync starting... (forceRescan=${forceRescan})`);
    const startTime = Date.now();

    let allItems = await galleryRepository.findAll();
    invalidateModelCache();
    const labeledDescriptors = await getCachedModel();

    let updatedCount = 0;
    const realItems = allItems.filter(i => !i.isProfile && i.url);
    this.syncState.total = realItems.length;

    // Separate into cache hits (already have descriptors) and misses (need scan)
    const misses = forceRescan ? realItems : realItems.filter(item => !Array.isArray(item.faceDescriptors) || (item.faceDescriptors as any[]).length === 0);
    const hits = forceRescan ? [] : realItems.filter(item => Array.isArray(item.faceDescriptors) && (item.faceDescriptors as any[]).length > 0);

    console.log(`[AI Sync] ⚡ In-memory matching on ${hits.length} cached images, scanning ${misses.length} misses...`);

    // Process hits instantly in memory from DB cache
    for (const item of hits) {
      const faceDescs = item.faceDescriptors as any[];
      const baseIds = faceDescs
        .map((fd: any) => fd.manuallyTaggedUserId)
        .filter((id: any) => id != null)
        .map((id: any) => Number(id))
        .filter((id: number) => !isNaN(id));

      const aiIds: number[] = [];
      const updatedFaceDescriptors = faceDescs.map((fd: any) => {
        const descriptor = faceAi.deserializeDescriptor(fd.descriptor);
        if (!descriptor) return fd;
        const match = faceAi.findBestMatchWithMargin(descriptor, labeledDescriptors);

        // Source and Priority Logic
        let manuallyTaggedUserId = fd.manuallyTaggedUserId || null;
        let personId: number | null = manuallyTaggedUserId || fd.personId || null;
        let personName: string | null = fd.personName || null;
        let status = fd.status || 'unknown';
        let source = fd.source || 'auto_scan';
        let confidence = fd.confidence || 0;
        let sim = fd.similarity || 0.0;

        if (manuallyTaggedUserId) {
          status = 'recognized';
          source = 'manual_tag';
          confidence = 100;
          sim = 1.0;
        } else if (match.label !== 'unknown') {
          const id = parseUserId(match.label);
          if (id !== null && !fd.rejectedUserIds?.includes(id)) {
            aiIds.push(id);
            personId = id;
            const userData = parseUserFromLabel(match.label);
            if (userData) personName = userData.name;
            status = 'recognized';
            source = 'rescan_match';
            sim = match.confidence ? match.confidence / 100 : 0.0;
            confidence = Math.round(sim * 100);
          }
        } else if (personId) {
          // Preserve previous correct automatic recognition
          status = 'preserved_existing';
          source = 'preserved_existing';
          if (!confidence) confidence = Math.round(sim * 100) || 70;
        } else {
          status = match.reason === 'ambiguous' ? 'possible_match' : 'unknown';
          source = 'auto_scan';
          sim = match.confidence ? match.confidence / 100 : 0.0;
          confidence = Math.round(sim * 100);
        }

        return {
          ...fd,
          personId,
          personName,
          similarity: sim,
          status,
          source,
          confidence,
        };
      });

      const previousRecognizedIds = Array.isArray(item.recognizedUserIds) ? item.recognizedUserIds.map(Number) : [];
      const merged = [...new Set([...baseIds, ...aiIds, ...previousRecognizedIds])];
      const currentRecognized = Array.isArray(item.recognizedUserIds) ? item.recognizedUserIds.map(Number) : [];
      const hasChanged = merged.length !== currentRecognized.length || !merged.every(id => currentRecognized.includes(id));

      if (hasChanged) {
        console.log(`[AI Sync] Preserving and updating gallery item ${item.id}: old recognized count: ${currentRecognized.length}, final merged count: ${merged.length}`);
        await galleryRepository.updateById(item.id, {
          recognizedUserIds: merged,
          faceDescriptors: updatedFaceDescriptors
        });
      }
      updatedCount++;
      this.syncState.current++;
    }

    // Process misses in batch chunks
    if (misses.length > 0) {
      const CHUNK = 10;
      const batches = Array.from({ length: Math.ceil(misses.length / CHUNK) }, (_, i) =>
        misses.slice(i * CHUNK, i * CHUNK + CHUNK)
      );

      for (const chunk of batches) {
        const filePaths = await Promise.all(chunk.map(i => pickScanPathAndOptimize(path.join(UPLOADS_DIR, i.url?.split('/').pop() || ''))));
        const chunkResults = await faceAi.detectFacesBatch(filePaths);

        await Promise.all(chunk.map(async (item, chunkIdx) => {
          const data = chunkResults[chunkIdx];
          const detections = data.faces || [];
          const metadata = data.metadata || {};

          let scaleX = 1;
          let scaleY = 1;
          try {
            const optPath = filePaths[chunkIdx];
            const origPath = path.join(UPLOADS_DIR, item.url?.split('/').pop() || '');
            if (optPath !== origPath && fs.existsSync(optPath) && fs.existsSync(origPath)) {
              const [origMeta, optMeta] = await Promise.all([
                sharp(origPath).metadata(),
                sharp(optPath).metadata()
              ]);
              if (origMeta.width && optMeta.width && origMeta.height && optMeta.height) {
                let realOrigW = origMeta.width;
                let realOrigH = origMeta.height;
                if ((origMeta.orientation || 1) >= 5) {
                  realOrigW = origMeta.height;
                  realOrigH = origMeta.width;
                }
                scaleX = realOrigW / optMeta.width;
                scaleY = realOrigH / optMeta.height;
              }
            }
          } catch (e) {
            console.error('[Scale calculation failed]', e);
          }

          const faceDescs = Array.isArray(item.faceDescriptors) ? item.faceDescriptors as any[] : [];
          const baseIds = faceDescs
            .map((fd: any) => fd.manuallyTaggedUserId)
            .filter((id: any) => id != null)
            .map((id: any) => Number(id))
            .filter((id: number) => !isNaN(id));

          const aiIds: number[] = [];
          const newFaceDescriptors = detections.map((det: any, fi: number) => {
            const cachedFace = faceDescs[fi] || {};
            const rejectedIds = Array.isArray(cachedFace.rejectedUserIds) ? cachedFace.rejectedUserIds : [];
            const match = faceAi.findBestMatchWithMargin(det.descriptor, labeledDescriptors, forceRescan);

            // Source and Priority Logic
            let manuallyTaggedUserId = cachedFace.manuallyTaggedUserId || null;
            let personId: number | null = manuallyTaggedUserId || cachedFace.personId || null;
            let personName: string | null = cachedFace.personName || null;
            let status = cachedFace.status || 'unknown';
            let source = cachedFace.source || 'auto_scan';
            let confidence = cachedFace.confidence || 0;
            let sim = match.confidence ? match.confidence / 100 : 0.0;

            if (manuallyTaggedUserId) {
              status = 'recognized';
              source = 'manual_tag';
              confidence = 100;
              personId = Number(manuallyTaggedUserId);
            } else if (match.label !== 'unknown') {
              const id = parseUserId(match.label);
              if (id !== null && !rejectedIds.includes(id)) {
                aiIds.push(id);
                personId = id;
                const userData = parseUserFromLabel(match.label);
                if (userData) personName = userData.name;
                status = 'recognized';
                source = 'rescan_match';
                confidence = Math.round(sim * 100);
              }
            } else if (personId) {
              // Preserve previous correct automatic recognition
              status = 'preserved_existing';
              source = 'preserved_existing';
              if (!confidence) confidence = Math.round(sim * 100) || 70;
            } else {
              status = match.reason === 'ambiguous' ? 'possible_match' : 'unknown';
              source = 'auto_scan';
              confidence = Math.round(sim * 100);
            }

            // Detailed scanning log as requested in Fix 7:
            console.log(`[Gallery Face Scan] File: ${path.basename(filePaths[chunkIdx])}, face #${fi}, box: ${det.box._width}x${det.box._height}, confidence: ${det.confidence ?? 0}, matched: ${personName || 'unknown'}, similarity: ${sim.toFixed(4)}, second best: ${match.secondCandidate || 'none'}, margin: ${typeof match.margin === 'number' ? match.margin.toFixed(4) : 'none'}, status: ${status}`);

            // Scale boxes back to original image dimensions
            const scaledBox = { ...det.box };
            if (scaledBox._x !== undefined) {
              scaledBox._x = Math.round(scaledBox._x * scaleX);
              scaledBox._y = Math.round(scaledBox._y * scaleY);
              scaledBox._width = Math.round(scaledBox._width * scaleX);
              scaledBox._height = Math.round(scaledBox._height * scaleY);
            }
            const scaledExpanded = { ...(det.expandedBox || det.box) };
            if (scaledExpanded._x !== undefined) {
              scaledExpanded._x = Math.round(scaledExpanded._x * scaleX);
              scaledExpanded._y = Math.round(scaledExpanded._y * scaleY);
              scaledExpanded._width = Math.round(scaledExpanded._width * scaleX);
              scaledExpanded._height = Math.round(scaledExpanded._height * scaleY);
            }

            return {
              descriptor: faceAi.serializeDescriptor(det.descriptor),
              box: scaledBox,
              expandedBox: scaledExpanded,
              landmarks: det.landmarks || [],
              confidence: Math.round((det.confidence || 0) * 100),
              personId,
              personName,
              similarity: sim,
              status,
              source,
              rejectedUserIds: rejectedIds,
              manuallyTaggedUserId: cachedFace.manuallyTaggedUserId || null,
              isIgnored: cachedFace.isIgnored || false
            };
          }).filter((fd: any) => fd !== null);

          const previousRecognizedIds = Array.isArray(item.recognizedUserIds) ? item.recognizedUserIds.map(Number) : [];
          const merged = [...new Set([...baseIds, ...aiIds, ...previousRecognizedIds])];

          const currentTags = Array.isArray(item.hashtags) ? item.hashtags.map((h: any) => h.name) : [];
          const newHashtags = new Set([...currentTags]);
          if (metadata.person_count > 0) {
            newHashtags.add(`${metadata.person_count}_people`);
            if (metadata.person_count === 1) newHashtags.add('portrait');
            else newHashtags.add('group_photo');
          }
          if (metadata.orientation) newHashtags.add(metadata.orientation);

          await galleryRepository.updateById(item.id, {
            recognizedUserIds: merged,
            faceDescriptors: newFaceDescriptors,
            metadata,
            hashtags: Array.from(newHashtags)
          });
          updatedCount++;
        }));

        this.syncState.current += chunk.length;
      }
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
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

    const allUnknownFaces: Array<{ itemId: number; url: string; faceIndex: number; box: any; descriptor: Float32Array; uploadedAt: number; similarity: number; status: string }> = [];

    for (const chunk of batches) {
      const chunkDetections = await detectFacesWithCacheBatch(chunk);
      chunk.forEach((item, chunkIdx) => {
        const detections = chunkDetections[chunkIdx];
        const faceDescs = Array.isArray(item.faceDescriptors) ? item.faceDescriptors as any[] : [];

        detections.forEach((det: any, i: number) => {
          const cachedFace = faceDescs[i] || {};
          if (cachedFace.manuallyTaggedUserId || cachedFace.isIgnored) return;

          const box = det?.box || cachedFace.box;
          if (!box) return;
          const descriptor = det?.descriptor;
          if (!descriptor) return;

          let isUnknown = false;
          if (cachedFace.status) {
            isUnknown = (cachedFace.status === 'unknown' || cachedFace.status === 'possible' || cachedFace.status === 'ambiguous');
          } else {
            const match = faceAi.findBestMatchWithMargin(descriptor, labeledDescriptors);
            isUnknown = (match.label === 'unknown');
          }

          if (isUnknown) {
            allUnknownFaces.push({
              itemId: item.id,
              url: buildUploadUrl(item.url?.split('/').pop() || ''),
              faceIndex: i,
              box,
              descriptor,
              uploadedAt: new Date(item.uploadedAt).getTime(),
              similarity: cachedFace.similarity || 0,
              status: cachedFace.status || 'unknown',
            });
          }
        });
      });
    }

    // Cluster all unknown faces by embedding distance threshold
    const CLUSTER_DISTANCE_THRESHOLD = 0.35; // Strict limit to prevent unrelated face merging

    const clusters: Array<{ 
      clusterId: string; 
      faceCount: number; 
      anchorImage: string; 
      anchorBox: any; 
      uploadedAt: number; 
      relatedPhotos: any[];
      descriptors: Float32Array[];
    }> = [];

    for (const face of allUnknownFaces) {
      let matchedCluster = null;
      let minDistance = 2;

      for (const cluster of clusters) {
        let totalDist = 0;
        for (const desc of cluster.descriptors) {
          totalDist += faceAi.cosineDistance(face.descriptor, desc);
        }
        const avgDist = totalDist / cluster.descriptors.length;

        if (avgDist < minDistance) {
          minDistance = avgDist;
          matchedCluster = cluster;
        }
      }

      if (matchedCluster && minDistance <= CLUSTER_DISTANCE_THRESHOLD) {
        matchedCluster.faceCount += 1;
        matchedCluster.descriptors.push(face.descriptor);
        matchedCluster.relatedPhotos.push({
          itemId: face.itemId,
          faceIndex: face.faceIndex,
          url: face.url,
          box: face.box,
          similarity: face.similarity,
          status: face.status,
        });
        matchedCluster.uploadedAt = Math.max(matchedCluster.uploadedAt, face.uploadedAt);
      } else {
        clusters.push({
          clusterId: `cluster-${face.itemId}-${face.faceIndex}`,
          faceCount: 1,
          anchorImage: face.url,
          anchorBox: face.box,
          uploadedAt: face.uploadedAt,
          descriptors: [face.descriptor],
          relatedPhotos: [{
            itemId: face.itemId,
            faceIndex: face.faceIndex,
            url: face.url,
            box: face.box,
            similarity: face.similarity,
            status: face.status,
          }]
        });
      }
    }

    const cleanedClusters = clusters
      .sort((a, b) => b.uploadedAt - a.uploadedAt)
      .map(({ descriptors, uploadedAt, ...clusterData }) => clusterData);

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

    // Manual Tag Learning Logic
    const user = await userRepository.findById(userId);
    if (user) {
      let currentDescriptors = Array.isArray(user.profileDescriptor) ? [...user.profileDescriptor] : (user.profileDescriptor ? [user.profileDescriptor] : []);
      let descriptorsChanged = false;

      for (const face of faces) {
        const item = allItems.find(i => i.id === face.itemId);
        if (item && face.faceIndex >= 0 && Array.isArray(item.faceDescriptors)) {
          const fd = item.faceDescriptors[face.faceIndex] as any;
          if (fd && fd.descriptor) {
            const incomingArr = faceAi.deserializeDescriptor(fd.descriptor);
            if (incomingArr) {
              let isDuplicate = false;
              for (const cd of currentDescriptors) {
                const rawCD = cd && typeof cd === 'object' && 'descriptor' in (cd as any) ? (cd as any).descriptor : cd;
                const cdArr = faceAi.deserializeDescriptor(rawCD);
                if (cdArr) {
                  const dist = faceAi.cosineDistance(incomingArr, cdArr);
                  if (dist < 0.02) { // Cosine similarity >= 0.98
                    isDuplicate = true;
                    break;
                  }
                }
              }

              if (!isDuplicate) {
                currentDescriptors.push({
                  descriptor: fd.descriptor,
                  faceCrop: item.url,
                  box: fd.box,
                  qualityScore: fd.confidence ?? 1.0,
                  addedAt: new Date().toISOString()
                });
                descriptorsChanged = true;
                console.log(`[Manual Learning] Appended new face training sample to user ${user.name}`);
              }
            }
          }
        }
      }

      if (descriptorsChanged) {
        await userRepository.updateById(userId, { profileDescriptor: currentDescriptors });
      }
    }

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

  async getAllHashtags() {
    const hashtags = await galleryRepository.getAllUniqueHashtags();
    return hashtags.map(h => h.name);
  },

  async getSearchSuggestions(query: string) {
    const q = String(query || '').toLowerCase().trim();
    if (!q) return [];

    const [users, hashtags, gallery] = await Promise.all([
      userRepository.findAllForRecognition(),
      galleryRepository.getAllUniqueHashtags(),
      galleryRepository.findAll()
    ]);

    const suggestions: any[] = [];
    const seenValues = new Set<string>();

    // 1. Match People
    users.forEach(u => {
      const name = u.name.toLowerCase();
      if (name.includes(q) && !seenValues.has(`user-${u.id}`)) {
        seenValues.add(`user-${u.id}`);
        suggestions.push({ type: 'person', value: u.name, id: u.id });
      }
    });

    // 2. Match Hashtags
    hashtags.forEach(h => {
      const tagName = h.name.toLowerCase();
      if (tagName.includes(q) && !seenValues.has(`tag-${tagName}`)) {
        seenValues.add(`tag-${tagName}`);
        suggestions.push({ type: 'hashtag', value: tagName });
      }
    });

    // 3. Scan visual metadata in the gallery items for matches
    gallery.forEach(item => {
      const meta = (item as any).metadata ? ((item as any).metadata.rawJson || (item as any).metadata) : {};

      const objects = Array.isArray(meta.objects) ? meta.objects : [];
      const scenes = Array.isArray(meta.scenes) ? meta.scenes : [];
      const ocrText = Array.isArray(meta.ocrText) ? meta.ocrText : [];

      objects.forEach((obj: any) => {
        const rawName = String(typeof obj === 'string' ? obj : (obj.name || '')).toLowerCase();
        if (rawName.includes(q) && !seenValues.has(`obj-${rawName}`) && rawName.length > 1) {
          seenValues.add(`obj-${rawName}`);
          suggestions.push({ type: 'object', value: rawName });
        }
      });

      scenes.forEach((sc: any) => {
        const lab = String(sc?.label || '').toLowerCase();
        if (lab.includes(q) && !seenValues.has(`scene-${lab}`) && lab.length > 1) {
          seenValues.add(`scene-${lab}`);
          suggestions.push({ type: 'scene', value: lab });
        }
      });

      ocrText.forEach((txt: string) => {
        const val = String(txt || '').toLowerCase();
        if (val.includes(q) && !seenValues.has(`ocr-${val}`) && val.length > 2 && val.length < 25) {
          seenValues.add(`ocr-${val}`);
          suggestions.push({ type: 'ocr', value: val });
        }
      });
    });

    // Sort prioritized: People -> Tags -> Objects -> Scenes -> OCR
    const typeOrder: Record<string, number> = { person: 1, hashtag: 2, object: 3, scene: 4, ocr: 5 };
    suggestions.sort((a, b) => {
      if (typeOrder[a.type] !== typeOrder[b.type]) return typeOrder[a.type] - typeOrder[b.type];
      // Then match closeness to the start
      const aPos = a.value.toLowerCase().indexOf(q);
      const bPos = b.value.toLowerCase().indexOf(q);
      return aPos - bPos;
    });

    return suggestions.slice(0, 12);
  },


  // ── Backfill Progress State ────────────────────────────────────────────────
  // Exposed as a getter so the status endpoint can read it without triggering a scan.
  backfillState: {
    isRunning: false,
    total: 0,
    processed: 0,
    failed: 0,
    currentImageId: null as number | null,
    startedAt: null as Date | null,
    finishedAt: null as Date | null,
  },

  async backfillMissingMetadata(force = false) {
    // ── Idempotency Lock ──────────────────────────────────────────────────────
    if (galleryService.backfillState.isRunning) {
      console.log('[Backfill] ⏭️ Already running — returning current progress.');
      return { running: true, message: 'Metadata backfill already running', ...galleryService.backfillState };
    }

    console.log(`[Backfill] 🚀 Starting metadata backfill (force=${force})...`);

    // Find candidate images
    const items = await prisma.galleryItem.findMany({
      where: { isProfile: false },
      include: { metadata: true, hashtags: true },
    });

    // Filter: Select any legacy metadata record missing the high-accuracy 'strictAIActive' flag (Requirement 8)
    const candidates = items.filter(item => {
      if (force) return true; // force=true → regenerate everything
      if (!item.metadata) return true; // no metadata record at all
      const raw = (item.metadata as any).rawJson as any;
      // Already completed with high-accuracy strict-AI scans -> safe skip!
      if (raw && raw.strictAIActive === true) return false;
      return true; // Treat as legacy to enable accurate correction backfill
    });

    console.log(`[Backfill] Found ${candidates.length} image(s) that need metadata (force=${force}).`);

    if (candidates.length === 0) {
      console.log('[Backfill] ✅ All images already have metadata. Nothing to do.');
      return { running: false, message: 'All images already have metadata.', total: 0, processed: 0, failed: 0 };
    }

    // Set lock + reset progress
    galleryService.backfillState.isRunning = true;
    galleryService.backfillState.total = candidates.length;
    galleryService.backfillState.processed = 0;
    galleryService.backfillState.failed = 0;
    galleryService.backfillState.currentImageId = null;
    galleryService.backfillState.startedAt = new Date();
    galleryService.backfillState.finishedAt = null;

    // Respond immediately and run async in background
    setImmediate(async () => {
      try {
        for (const item of candidates) {
          galleryService.backfillState.currentImageId = item.id;

          try {
            console.log(`[Backfill] 🔍 Engaging Strict AI Generation for legacy ID ${item.id} (${galleryService.backfillState.processed + 1}/${candidates.length})...`);

            // Directly execute unified strict AI pipeline (Requirement 8)
            // Passing forceRegenerateAI = true enforces a clean, accurate re-scan wiping legacy hallucinations!
            await galleryService.generateMetadataForImage(item.id, true);

            galleryService.backfillState.processed++;
            console.log(`[Backfill] ✅ ID ${item.id} strict AI corrections applied.`);
          } catch (err: any) {
            console.error(`[Backfill] 🛑 Error correcting legacy ID ${item.id}:`, err.message);
            galleryService.backfillState.failed++;
          }
        }
      } finally {
        galleryService.backfillState.isRunning = false;
        galleryService.backfillState.currentImageId = null;
        galleryService.backfillState.finishedAt = new Date();
        console.log(`[Backfill] 🎉 Complete. Processed: ${galleryService.backfillState.processed}, Failed: ${galleryService.backfillState.failed}.`);
      }
    });

    return {
      running: true,
      message: `Backfill started for ${candidates.length} image(s).`,
      total: candidates.length,
      processed: 0,
      failed: 0,
    };
  },

  getBackfillStatus() {
    const s = galleryService.backfillState;
    return {
      running: s.isRunning,
      total: s.total,
      processed: s.processed,
      failed: s.failed,
      remaining: Math.max(0, s.total - s.processed - s.failed),
      currentImageId: s.currentImageId,
      startedAt: s.startedAt,
      finishedAt: s.finishedAt,
    };
  },

  // 🚀 [Required Fix 1] - Single Unified High-Priority Integration Vector
  async processGalleryImage(imageId: number, isForceScan = false, isForceMeta = false) {
    // Channel through concurrent-safe, in-memory task queue
    await imageQueue.enqueue(imageId, isForceScan, isForceMeta);
    return getGalleryItemResponseById(imageId);
  },

  async processGalleryImageDirect(imageId: number, isForceScan = false, isForceMeta = false) {
    console.log(`[PROCESS] started ${imageId} (forceScan=${isForceScan}, forceMeta=${isForceMeta})`);

    const item = await galleryRepository.findById(imageId);
    if (!item) {
      console.warn(`[PROCESS] Image ${imageId} not found in repository.`);
      return;
    }

    // Check if the physical image file exists on disk (Requirement 5 & 6)
    const filename = item.url.split('/').pop();
    const filePath = filename ? path.join(UPLOADS_DIR, filename) : null;
    if (!filePath || !fs.existsSync(filePath)) {
      console.warn(`[PROCESS] Image ${imageId} file not found on disk: "${filePath}". Marking as failed_missing_file.`);
      
      const currentRaw = (item?.metadata as any)?.rawJson || {};
      await galleryRepository.updateById(imageId, {
        scanStatus: 'failed_missing_file',
        metadataStatus: 'failed_missing_file',
        metadata: {
          ...currentRaw,
          lastScanError: 'File not found on disk. Skipped background retries.',
          lastMetaError: 'File not found on disk. Skipped background retries.',
        }
      });
      return;
    }

    const currentScan = item.scanStatus || 'pending';
    const currentMeta = item.metadataStatus || 'pending';

    // Skip Logic: don't redo completed tasks unless explicit Force Rescan (Requirement 7)
    const runScan = isForceScan || currentScan !== 'completed';
    const runMeta = isForceMeta || currentMeta !== 'completed';

    if (!runScan && !runMeta) {
      console.log(`[PROCESS] skipped ${imageId} — already fully analyzed.`);
      return;
    }

    // 1. Update initial statuses immediately to 'saved' (representing 20% real-world progress)
    const initialUpdate: any = {};
    if (runScan) initialUpdate.scanStatus = 'saved';
    if (runMeta) initialUpdate.metadataStatus = 'saved';

    await galleryRepository.updateById(imageId, initialUpdate);
    console.log(`[DB] updated statuses to 'saved' for imageId ${imageId}`);

    let scanError: string | null = null;
    let metaError: string | null = null;

    // 2. Face Recognition stage (represents 40% real-world progress)
    if (runScan) {
      try {
        await galleryRepository.updateById(imageId, { scanStatus: 'face_scan' });
        await this.scanAndRecognizeImage(imageId);
        console.log(`[FACE] completed ${imageId}`);
        await galleryRepository.updateById(imageId, { scanStatus: 'completed' });
      } catch (err: any) {
        scanError = err?.message || 'Face scan failed';
        console.error(`[FACE] failed ${imageId}:`, scanError);
        await galleryRepository.updateById(imageId, { scanStatus: 'failed' });
      }
    } else {
      console.log(`[FACE] skipped ${imageId} (already completed)`);
    }

    // 3. Metadata extraction & Object detection stage (represents 60% & 80% progress)
    if (runMeta) {
      try {
        await galleryRepository.updateById(imageId, { metadataStatus: 'object_detection' });
        await this.generateMetadataForImage(imageId, isForceMeta);
        console.log(`[META] completed ${imageId}`);
        await galleryRepository.updateById(imageId, { metadataStatus: 'completed' });
      } catch (err: any) {
        metaError = err?.message || 'Metadata extraction failed';
        console.error(`[META] failed ${imageId}:`, metaError);
        await galleryRepository.updateById(imageId, { metadataStatus: 'failed' });
      }
    } else {
      console.log(`[META] skipped ${imageId} (already completed)`);
    }

    // 4. Explicit error preservation in DB
    if (scanError || metaError) {
      try {
        const freshItem = await galleryRepository.findById(imageId);
        const currentRaw = (freshItem?.metadata as any)?.rawJson || {};
        const errorMeta = {
          ...currentRaw,
          ...(scanError ? { lastScanError: scanError } : {}),
          ...(metaError ? { lastMetaError: metaError } : {}),
        };
        await galleryRepository.updateById(imageId, { metadata: errorMeta });
      } catch (e: any) {
        console.error(`[DB] Failed saving error info for ${imageId}:`, e.message);
      }
    }

    console.log(`[DB] updated statuses imageId ${imageId}`);
  },

  async generateMetadataForImage(imageId: number, forceRegenerateAI = false) {
    const item = await galleryRepository.findById(imageId);
    if (!item || !item.url) {
      throw new Error(`Image ${imageId} not found or has no URL`);
    }
    if (item.isProfile) {
      console.log(`[METADATA] Skipping profile item ${imageId}`);
      return null;
    }

    const existingMeta = item.metadata as any;
    // Check if rawJson inside ImageMetadata already has objects/scenes generated
    const rawJsonMeta = existingMeta?.rawJson as any;
    const isPopulated = existingMeta && (
      (Array.isArray(rawJsonMeta?.objects) && rawJsonMeta.objects.length > 0) ||
      (Array.isArray(existingMeta.objects) && existingMeta.objects.length > 0) ||
      rawJsonMeta?.metadataGenerated === true
    );

    if (isPopulated && !forceRegenerateAI) {
      console.log(`[METADATA] Image ${imageId} already has metadata — skipping.`);
      return existingMeta;
    }

    const filePath = path.join(UPLOADS_DIR, item.url.split('/').pop() || '');
    if (!fs.existsSync(filePath)) {
      throw new Error(`Image file not found on disk for ID ${imageId}: ${filePath}`);
    }

    console.log(`[METADATA] Extracting metadata for image ${imageId}...`);

    // This will throw if AI service is unreachable — caught by processGalleryImage
    const aiMetadata = await faceAi.extractMetadata(filePath);

    // Transition to metadata generation stage (80% real progress milestone)
    await galleryRepository.updateById(imageId, { metadataStatus: 'metadata_generation' });

    const rawObjects = aiMetadata.objects || [];
    const rawScenes = aiMetadata.scenes || [];
    const rawOcr = aiMetadata.ocrText || [];

    console.log(`[METADATA] Image ${imageId}: objects=${rawObjects.length} scenes=${rawScenes.length} ocr=${rawOcr.length}`);

    const currentRaw = existingMeta ? (existingMeta.rawJson || {}) : {};

    // Preserve manual hashtags across regenerations
    const manualTags = Array.isArray(currentRaw.manualHashtags)
      ? currentRaw.manualHashtags
      : (Array.isArray(item.hashtags) ? item.hashtags.map((h: any) => h.name) : []);

    // When force regenerating, discard stale AI results; otherwise merge
    const prevObjects = forceRegenerateAI ? [] : (Array.isArray(existingMeta?.objects) ? existingMeta.objects : []);
    const prevScenes = forceRegenerateAI ? [] : (Array.isArray(existingMeta?.scenes) ? existingMeta.scenes : []);
    const prevOcr = forceRegenerateAI ? [] : (Array.isArray(existingMeta?.ocrText) ? existingMeta.ocrText : []);

    const cleaned = cleanupAIPayload(
      {},
      [...prevObjects, ...rawObjects],
      [...prevScenes, ...rawScenes],
      [...prevOcr, ...rawOcr],
    );

    const combinedHashtags = Array.from(new Set([...manualTags, ...cleaned.autoHashtags]));

    // ── Deep Folksomonic Enrichment Fallback (Requirement 2, 3 & 5) ─────────
    const faceDescs = Array.isArray(item.faceDescriptors) ? item.faceDescriptors : [];
    const faceScannerCount = faceDescs.length;

    const currentPersonCount = faceScannerCount > 0 
      ? faceScannerCount 
      : (aiMetadata.metadata?.person_count ?? rawObjects.filter((o: any) => (o?.name || o) === 'person').length);
    const fallbacks = enrichMetadataWithHashtagFallbacks(
      combinedHashtags,
      cleaned.cleanObjects,
      cleaned.cleanScenes,
      currentPersonCount,
      cleaned.caption || ''
    );

    const enrichedMetadata = {
      ...currentRaw,
      objects: fallbacks.objects,
      scenes: fallbacks.scenes,
      ocrText: cleaned.cleanOcr,
      activities: cleaned.cleanActivities || [],
      environment: cleaned.cleanEnvironment || [],
      caption: fallbacks.caption || '',
      // Explicit mapping for additive columns (Requirement 1)
      description: fallbacks.caption || '',
      aiSummary: fallbacks.caption || '',
      eventName: currentRaw.customEvent || currentRaw.eventName || null,
      location: currentRaw.customLocation || currentRaw.location || null,
      // Preserve face-analysis fields from first scan call
      person_count: fallbacks.peopleCount,
      dominant_color: aiMetadata.metadata?.dominant_color ?? null,
      aspect_ratio: aiMetadata.metadata?.aspect_ratio ?? null,
      orientation: aiMetadata.metadata?.orientation ?? null,
      metadataGenerated: true,
      metadataVersion: "strict-v1",
      strictAIActive: true,
      metadataGeneratedAt: new Date().toISOString(),
    };

    await galleryRepository.updateById(imageId, {
      metadata: enrichedMetadata,
      hashtags: combinedHashtags,
      objects: fallbacks.objects,
      scenes: fallbacks.scenes,
      ocrText: cleaned.cleanOcr,
    });

    console.log(`[METADATA] Saved metadata for image ${imageId}.`);
    return enrichedMetadata;
  },

  // Continuity Shim for Workers/Backwards links
  async generateMetadata(imageId: number) {
    return this.generateMetadataForImage(imageId, false);
  },

  async scanAndRecognizeImage(imageId: number) {
    const item = await galleryRepository.findById(imageId);
    if (!item || !item.url) return;

    const filename = item.url.split('/').pop() || '';
    const filePath = path.join(UPLOADS_DIR, filename);

    console.log(`[UPLOAD] imageId: ${imageId} sourceType: normal`);
    console.log(`[SCAN] verifying file exists at ${filePath}...`);
    if (!fs.existsSync(filePath)) {
      console.error(`[SCAN] file not found for ID ${imageId}`);
      return;
    }

    let width = 0, height = 0;
    try {
      const meta = await sharp(filePath).metadata();
      width = meta.width || 0;
      height = meta.height || 0;
    } catch (err) { }
    console.log(`[UPLOAD] imageId: ${imageId} original dimensions: ${width}x${height}`);

    console.log(`[SCAN] scanning high-quality original image path: ${filePath}`);

    let faceDescriptors: any = { status: 'failed', reason: 'Pending' };
    let recognizedUserIds: number[] = [];

    try {
      const data = await faceAi.detectFaces(filePath);
      const detections = data.faces || [];
      console.log(`[SCAN] imageId: ${imageId} face count: ${detections.length}`);
      console.log(`[FACE] detected faces count: ${detections.length}`);

      invalidateModelCache();
      const labeledDescriptors = await getCachedModel();

      // 🔍 [Fix 2 Audit Logger] - Verifying Embedded Matrix integrity before executing compares
      const totalUsers = labeledDescriptors.length;
      const totalEmbeddings = labeledDescriptors.reduce((acc, cur) => acc + cur.descriptors.length, 0);
      console.log(`[SCAN-EMBEDDINGS] 📊 System Analytics: TotalLoadedUsers=${totalUsers} | CollectiveEmbeddings=${totalEmbeddings}`);

      labeledDescriptors.forEach(ld => {
        const parsed = parseUserFromLabel(ld.label);
        console.log(`   -> Reference User "${parsed?.name || 'Unknown'}" [ID: ${parsed?.id}]: ${ld.descriptors.length} vectors registered.`);
      });

      if (totalEmbeddings === 0) {
        console.warn(`[SCAN-CRITICAL] ⚠️ WARNING: Recognition pipeline engaged with ZERO target embeddings. Matches mathematically impossible.`);
      }

      // PREPARE MATCHING INFRASTRUCTURE
      const existingFaceDescs = Array.isArray(item.faceDescriptors) ? item.faceDescriptors as any[] : [];
      const finalMergedFaceDescriptors: any[] = [];
      const finalUserIdsSet = new Set<number>();

      console.log(`[SCAN-AUDIT] Start Match Process for ID ${imageId}. Detected Count: ${detections.length}. Previous Known Count: ${existingFaceDescs.length}`);

      // ITERATE AND RESOLVE EACH DETECTED FACE TO GUARANTEE SPATIAL CONSISTENCY
      const matchedPrevFaceIndices = new Set<number>();

      detections.forEach((det: any, index: number) => {
        let bestPrevFace: any = null;
        let maxOverlap = 0;
        let bestPrevIndex = -1;

        // 1. Find best spatial match in previous history using intersection over union calculations
        existingFaceDescs.forEach((prevFace: any, pIdx: number) => {
          const iouScore = calculateIoU(det.box, prevFace.box);
          if (iouScore > maxOverlap && iouScore >= 0.4) {
            maxOverlap = iouScore;
            bestPrevFace = prevFace;
            bestPrevIndex = pIdx;
          }
        });

        if (bestPrevIndex !== -1) {
          matchedPrevFaceIndices.add(bestPrevIndex);
        }

        // 2. Determine Auto Identification Score via AI Inference
        let autoUserId: number | null = null;
        let autoConfidence = 0;
        let bestMatchDetails = 'No usable embeddings';

        if (labeledDescriptors.length > 0) {
          const match = faceAi.findBestMatchWithMargin(det.descriptor, labeledDescriptors);
          autoConfidence = match.confidence ? match.confidence / 100 : 0;
          if (match.label !== 'unknown') {
            autoUserId = parseUserId(match.label);
            const userNode = parseUserFromLabel(match.label);
            bestMatchDetails = `${userNode?.name || 'User'} (${(autoConfidence * 100).toFixed(1)}% confidence)`;
          } else {
            bestMatchDetails = `Unknown (Max confidence: ${(autoConfidence * 100).toFixed(1)}%)`;
          }
        }

        console.log(`   [Face Index ${index}] Match attempt: ${bestMatchDetails}. Final CandidateID=${autoUserId}. ThreshMin=0.5`);

        // 3. Apply Absolute Source Priority Hierarchy:
        // Priority: manual_tag > auto_scan > preserved_existing
        let finalAssignedUserId: number | null = null;
        let finalStatus = 'unknown';
        let finalSource = 'auto_scan';

        if (bestPrevFace && bestPrevFace.manuallyTaggedUserId != null) {
          // RULE: Manual tags supersede ALL automated findings permanently.
          finalAssignedUserId = Number(bestPrevFace.manuallyTaggedUserId);
          finalStatus = 'recognized';
          finalSource = 'manual_tag';
          console.log(`   -> Face Index ${index}: Preserved active manual tag (User ${finalAssignedUserId}) blocking automated drift.`);
        } else if (autoUserId !== null && autoConfidence >= 0.5) {
          // RULE: Confident New Scans replace older weaker preserves
          finalAssignedUserId = autoUserId;
          finalStatus = 'recognized';
          finalSource = 'auto_scan';
          console.log(`   -> Face Index ${index}: Confident New Identification (User ${autoUserId}, conf=${autoConfidence.toFixed(2)}) implemented.`);
        } else if (bestPrevFace && (bestPrevFace.personId != null || bestPrevFace.userId != null)) {
          // RULE: Fallback to existing preserved state only if correlation score passes overlap thresholds.
          const prevId = Number(bestPrevFace.personId || bestPrevFace.userId);
          if (!isNaN(prevId)) {
            finalAssignedUserId = prevId;
            finalStatus = 'recognized';
            finalSource = 'preserved_existing';
            console.log(`   -> Face Index ${index}: Reverting to historical spatial intersection capture (User ${finalAssignedUserId}).`);
          }
        } else if (autoUserId !== null && autoConfidence >= 0.3) {
          // 🔍 RULE: "Save possible_match if borderline" - Low Conf fallback
          finalAssignedUserId = autoUserId;
          finalStatus = 'possible_match';
          finalSource = 'auto_scan_weak';
          console.log(`   -> Face Index ${index}: Borderline candidate captured (${autoConfidence.toFixed(2)}). Saved as possible_match.`);
        } else {
          finalStatus = 'unknown';
          finalSource = 'auto_scan';
        }

        // Build the finalized high-fidelity descriptor payload
        const descriptorPackage: any = {
          box: det.box,
          descriptor: faceAi.serializeDescriptor(det.descriptor),
          source: finalSource,
          status: finalStatus,
          isIgnored: bestPrevFace?.isIgnored === true,
          confidence: autoConfidence,
        };

        // Attach unified mapping indicators
        if (finalSource === 'manual_tag') {
          descriptorPackage.manuallyTaggedUserId = finalAssignedUserId;
        } else if (finalAssignedUserId !== null && !isNaN(finalAssignedUserId)) {
          descriptorPackage.personId = finalAssignedUserId;
        }

        finalMergedFaceDescriptors.push(descriptorPackage);
        if (finalAssignedUserId !== null && !isNaN(finalAssignedUserId)) {
          finalUserIdsSet.add(finalAssignedUserId);
        }
      });

      // 4. Strictly preserve any manual tags that weren't spatially captured by this scan (Requirement 8)
      existingFaceDescs.forEach((prevFace: any, pIdx: number) => {
        if (!matchedPrevFaceIndices.has(pIdx) && prevFace.manuallyTaggedUserId != null) {
          console.log(`   -> [SCAN-RETAIN] Preserving orphaned manual tag (User ${prevFace.manuallyTaggedUserId}) to block AI wiping.`);
          finalMergedFaceDescriptors.push({
            ...prevFace,
            source: 'manual_tag',
            status: 'recognized',
          });
          finalUserIdsSet.add(Number(prevFace.manuallyTaggedUserId));
        }
      });

      // RECONCILIATION COMPLETE
      const finalRecognizedArray = Array.from(finalUserIdsSet);
      const matchedUserIds = finalRecognizedArray;
      const unmatchedCount = detections.length - finalMergedFaceDescriptors.filter(f => f.status === 'recognized').length;

      console.log(`[FACE] matched users: ${JSON.stringify(matchedUserIds)}`);
      console.log(`[FACE] unmatched faces: ${unmatchedCount}`);
      console.log(`[PHOTO] recognizedUserIds saved: ${JSON.stringify(finalRecognizedArray)}`);
      console.log(`[SCAN-SUCCESS] Commit State for ${imageId}: Derived Users=${JSON.stringify(finalRecognizedArray)} FacesSaved=${finalMergedFaceDescriptors.length}`);

      await galleryRepository.updateById(imageId, {
        faceDescriptors: finalMergedFaceDescriptors,
        recognizedUserIds: finalRecognizedArray,
      });

      // 5. Relational Synchro to discrete image_people table (Requirement 1)
      try {
        const users = await prisma.user.findMany({
          where: { id: { in: finalRecognizedArray } },
          select: { id: true, name: true }
        });
        const userNameMap = new Map(users.map(u => [u.id, u.name]));

        await prisma.imagePeople.deleteMany({
          where: { galleryItemId: imageId }
        });

        await prisma.imagePeople.createMany({
          data: finalMergedFaceDescriptors.map((face: any) => {
            const effectiveUserId = face.manuallyTaggedUserId ?? face.personId ?? null;
            const isManual = face.source === 'manual_tag';

            return {
              galleryItemId: imageId,
              userId: effectiveUserId,
              userName: effectiveUserId ? userNameMap.get(effectiveUserId) || 'User' : null,
              boundingBox: face.box,
              confidence: face.confidence || 0,
              isManualTag: isManual,
              lastScanError: null,
            };
          })
        });
        console.log(`[DB SAVE] synced ${finalMergedFaceDescriptors.length} tags to table image_people.`);
      } catch (relErr: any) {
        console.error(`[DB SAVE] relational mapping skipped for image_people:`, relErr.message);
      }
      console.log(`[SCAN] imageId: ${imageId} finalized persistence complete.`);
    } catch (err: any) {
      console.error(`[SCAN] AI failure for imageId ${imageId}:`, err.message);
      throw err; // Re-throw so processGalleryImage can record the failure
    }
  },

  async syncWithFileSystem() {
    console.log('[System] 📂 Starting File System Sync...');
    if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

    const files = fs.readdirSync(UPLOADS_DIR)
      .filter(f => /\.(jpg|jpeg|png|webp|jfif|jpg)$/i.test(f));

    const existing = await prisma.galleryItem.findMany({ select: { url: true } });
    const existingFilenames = new Set(existing.map(e => e.url.split('/').pop()));

    const missing = files.filter(f => !existingFilenames.has(f));

    if (missing.length === 0) {
      console.log('[System] 📂 File system is in sync.');
      return { count: 0 };
    }

    console.log(`[System] 📂 Found ${missing.length} missing files. Importing in chunks...`);

    const newItems: any[] = [];
    const CHUNK_SIZE = 50;
    for (let i = 0; i < missing.length; i += CHUNK_SIZE) {
      const chunk = missing.slice(i, i + CHUNK_SIZE);
      const chunkItems = await Promise.all(chunk.map(async (filename) => {
        const url = buildUploadUrl(filename);

        // Extract original timestamp from standard prefix format (e.g., 1776319310404-911463443.jpg)
        let fileDate = new Date();
        const parts = filename.split('-');
        if (parts.length > 0) {
          const msStr = parts[0];
          if (/^\d{13}$/.test(msStr)) {
            fileDate = new Date(Number(msStr));
          } else {
            try {
              const stats = fs.statSync(path.join(UPLOADS_DIR, filename));
              fileDate = stats.birthtime || stats.mtime || new Date();
            } catch (e) { }
          }
        }

        return galleryRepository.createOne({
          url,
          uploadedAt: fileDate,
          recognizedUserIds: [],
        });
      }));
      newItems.push(...chunkItems);
      console.log(`[System] 📂 Imported chunk ${Math.ceil(i / CHUNK_SIZE) + 1}/${Math.ceil(missing.length / CHUNK_SIZE)}...`);
    }

    console.log(`[System] 📂 Successfully imported ${newItems.length} photos.`);
    return { count: newItems.length };
  },

  async initializeQueue() {
    console.log('[System] ⚡ Booting ImageTaskQueue recovery & startup protocol...');

    try {
      // 1. Recovery: Reset stuck 'processing' items back to 'failed' to clear any stuck UI spinners on boot
      const stuckItems = await prisma.galleryItem.findMany({
        where: {
          OR: [
            { scanStatus: 'processing' },
            { metadataStatus: 'processing' }
          ]
        },
        include: { metadata: true }
      });

      if (stuckItems.length > 0) {
        console.log(`[System] 🛠️ Found ${stuckItems.length} stuck processing items. Resetting to failed...`);
        for (const item of stuckItems) {
          const currentRaw = (item?.metadata as any)?.rawJson || {};
          await galleryRepository.updateById(item.id, {
            scanStatus: item.scanStatus === 'processing' ? 'failed' : item.scanStatus,
            metadataStatus: item.metadataStatus === 'processing' ? 'failed' : item.metadataStatus,
            metadata: {
              ...currentRaw,
              lastScanError: 'System restarted during processing. Mark as failed.',
              lastMetaError: 'System restarted during processing. Mark as failed.'
            }
          });
        }
        console.log('[System] 🛠️ Stuck items successfully recovered.');
      }

      // [Configuration Option] Startup auto-scanning / automatic folder rescan is permanently disabled.
      // We do not run folder synchronization or auto-enqueue 670 old pending photos on startup.
      console.log('[System] ✨ Startup auto-scanning and sync completely disabled to prevent background processing loops.');
    } catch (err: any) {
      console.error('[System] 🛑 Gallery Queue Startup failed:', err.message);
    }
  },

  async cancelProcessing() {
    console.log('[System] 🛑 Received request to cancel all background processing.');
    
    // 1. Cancel in-memory task queue
    const queueStatus = imageQueue.cancelAll();

    // 2. Scan DB for pending or processing or failed items whose physical files are missing
    const items = await prisma.galleryItem.findMany({
      where: {
        OR: [
          { scanStatus: { in: ['pending', 'processing', 'failed', 'face_scan', 'saved'] } },
          { metadataStatus: { in: ['pending', 'processing', 'failed', 'object_detection', 'metadata_generation', 'saved'] } }
        ]
      },
      select: { id: true, url: true, metadata: true }
    });

    let cleanedCount = 0;
    const affectedDetails: { id: number; url: string }[] = [];

    for (const item of items) {
      const filename = item.url.split('/').pop();
      const filePath = filename ? path.join(UPLOADS_DIR, filename) : null;
      
      if (!filePath || !fs.existsSync(filePath)) {
        cleanedCount++;
        affectedDetails.push({ id: item.id, url: item.url });
        
        const currentRaw = (item?.metadata as any)?.rawJson || {};
        await galleryRepository.updateById(item.id, {
          scanStatus: 'failed_missing_file',
          metadataStatus: 'failed_missing_file',
          metadata: {
            ...currentRaw,
            lastScanError: 'File not found on disk. Cancelled and cleaned up.',
            lastMetaError: 'File not found on disk. Cancelled and cleaned up.',
          }
        });
      }
    }

    // 3. Reset any remaining 'processing', 'face_scan', 'object_detection', or 'metadata_generation' states to 'failed' (since they were cancelled)
    const remainingActive = await prisma.galleryItem.findMany({
      where: {
        OR: [
          { scanStatus: { in: ['processing', 'face_scan', 'saved'] } },
          { metadataStatus: { in: ['processing', 'object_detection', 'metadata_generation', 'saved'] } }
        ]
      },
      select: { id: true, url: true }
    });

    for (const item of remainingActive) {
      await galleryRepository.updateById(item.id, {
        scanStatus: 'failed',
        metadataStatus: 'failed'
      });
    }

    console.log(`[System] 🛑 Processing cancelled. Terminated: ${queueStatus.activeCancelled} active, ${queueStatus.queuedCancelled} queued. Marked ${cleanedCount} missing files as failed_missing_file.`);
    
    return {
      success: true,
      message: `Successfully cancelled all background tasks. Stopped ${queueStatus.activeCancelled} active, ${queueStatus.queuedCancelled} queued. Cleaned up ${cleanedCount} missing files from the queue.`,
      activeCancelled: queueStatus.activeCancelled,
      queuedCancelled: queueStatus.queuedCancelled,
      cleanedCount,
      affectedDetails
    };
  }

};

export { galleryService, buildLabeledDescriptors };
export default galleryService;

function calculateBoxArea(b: any): number {
  if (!b) return 0;
  return Math.max(0, b._width || 0) * Math.max(0, b._height || 0);
}

function calculateIoU(a: any, b: any): number {
  if (!a || !b) return 0;
  const ax1 = a._x ?? a.x ?? 0;
  const ay1 = a._y ?? a.y ?? 0;
  const aw = a._width ?? a.width ?? 0;
  const ah = a._height ?? a.height ?? 0;

  const bx1 = b._x ?? b.x ?? 0;
  const by1 = b._y ?? b.y ?? 0;
  const bw = b._width ?? b.width ?? 0;
  const bh = b._height ?? b.height ?? 0;

  const ax2 = ax1 + aw;
  const ay2 = ay1 + ah;
  const bx2 = bx1 + bw;
  const by2 = by1 + bh;

  const ix1 = Math.max(ax1, bx1);
  const iy1 = Math.max(ay1, by1);
  const ix2 = Math.min(ax2, bx2);
  const iy2 = Math.min(ay2, by2);

  const iw = Math.max(0, ix2 - ix1);
  const ih = Math.max(0, iy2 - iy1);
  const inter = iw * ih;

  if (inter <= 0) return 0;

  const areaA = calculateBoxArea({ _width: aw, _height: ah });
  const areaB = calculateBoxArea({ _width: bw, _height: bh });

  return inter / (areaA + areaB - inter);
}

