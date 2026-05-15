"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.galleryService = exports.LabeledFaceDescriptors = void 0;
exports.buildLabeledDescriptors = buildLabeledDescriptors;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const sharp_1 = __importDefault(require("sharp"));
const faceAi_1 = __importDefault(require("../../faceAi"));
const constants_1 = require("../config/constants");
const galleryRepository_1 = __importDefault(require("../repositories/galleryRepository"));
const userRepository_1 = __importDefault(require("../repositories/userRepository"));
const serializers_1 = require("../utils/serializers");
const httpError_1 = __importDefault(require("../utils/httpError"));
const urlUtils_1 = require("../utils/urlUtils");
const hashtagUtils_1 = require("../utils/hashtagUtils");
const prisma_1 = __importDefault(require("../config/prisma"));
const galleryQueues_1 = require("../queues/galleryQueues");
const redis_1 = require("../queues/redis");
const syncStateStore_1 = require("../queues/syncStateStore");
async function optimizeImageInProcess(srcPath, optPath) {
    try {
        const optDir = path.dirname(optPath);
        if (!fs.existsSync(optDir)) {
            fs.mkdirSync(optDir, { recursive: true });
        }
        // Generate main analytical optimized surrogate
        const meta = await (0, sharp_1.default)(srcPath).metadata();
        const origWidth = meta.width || 0;
        const origHeight = meta.height || 0;
        const maxDimension = Math.max(origWidth, origHeight);
        let targetSize = 1600;
        if (maxDimension > 3500) {
            targetSize = 2400;
        }
        else if (maxDimension > 2000) {
            targetSize = 2000;
        }
        await (0, sharp_1.default)(srcPath)
            .rotate()
            .resize({ width: targetSize, height: targetSize, fit: 'inside', withoutEnlargement: true })
            .jpeg({ quality: 85, mozjpeg: true })
            .toFile(optPath);
        // SAFETY IN-PROCESS THUMBNAIL: Generate small UI-friendly cache 
        const name = path.basename(srcPath).replace(/\.[a-z0-9]+$/i, '');
        const thumbDir = path.join(constants_1.UPLOADS_DIR, 'thumbs');
        if (!fs.existsSync(thumbDir))
            fs.mkdirSync(thumbDir, { recursive: true });
        const thumbPath = path.join(thumbDir, `${name}_400.jpg`);
        if (!fs.existsSync(thumbPath)) {
            await (0, sharp_1.default)(srcPath)
                .rotate()
                .resize({ width: 400, height: 400, fit: 'cover' })
                .jpeg({ quality: 75, mozjpeg: true })
                .toFile(thumbPath);
            console.log(`[Optimizer] Successfully seeded mini-thumbnail: ${path.basename(thumbPath)}`);
        }
    }
    catch (err) {
        console.error('[Sharp Optimization Failed]', err);
    }
}
async function pickScanPathAndOptimize(srcPath) {
    const name = srcPath.split(/[/\\]/).pop() || '';
    const opt = path.join(constants_1.UPLOADS_DIR, 'optimized', name);
    if (fs.existsSync(opt))
        return opt;
    await optimizeImageInProcess(srcPath, opt);
    if (fs.existsSync(opt))
        return opt;
    return srcPath;
}
async function getGalleryItemResponseById(id) {
    const [item, allUsers] = await Promise.all([
        galleryRepository_1.default.findById(id),
        userRepository_1.default.findAllForRecognition(),
    ]);
    if (!item)
        throw (0, httpError_1.default)(404, 'Gallery item not found');
    const userMap = {};
    for (const u of allUsers)
        userMap[u.id] = u;
    const faceDescs = Array.isArray(item.faceDescriptors) ? item.faceDescriptors : [];
    let secureUserIds = (Array.isArray(item.recognizedUserIds) ? item.recognizedUserIds : []).map(Number);
    // 🛡️ GUARDIAN PROTOCOL (Item 6): If detailed spatial face descriptors are loaded, always yield absolute priority 
    // to discrete face-level linkage arrays to eradicate ghost records or stale image-level summaries.
    if (faceDescs.length > 0) {
        const extractedSet = new Set();
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
    const enriched = {
        ...item,
        recognizedUsers: secureUserIds
            .map((uid) => userMap[Number(uid)])
            .filter(Boolean),
    };
    return (0, serializers_1.toGalleryResponse)(enriched);
}
async function getUsersMap() {
    const allUsers = await userRepository_1.default.findAllForRecognition();
    const userMap = {};
    for (const u of allUsers)
        userMap[u.id] = u;
    return userMap;
}
// Prevents duplicate scan jobs being spawned for the same image at the same time.
const _processingLock = new Set();
class ImageTaskQueue {
    constructor() {
        this.queue = [];
        this.active = new Set();
        this.concurrency = 2; // Process max 2 images at a time for absolute safe concurrency
    }
    enqueue(imageId, isForceScan = false, isForceMeta = false) {
        return new Promise((resolve, reject) => {
            // Avoid duplicate processing of same imageId
            if (this.active.has(imageId) || this.queue.some(q => q.imageId === imageId)) {
                console.log(`[QUEUE] imageId ${imageId} already processing or queued. Skipping enqueue.`);
                return resolve(); // Already handled
            }
            this.queue.push({ imageId, isForceScan, isForceMeta, resolve, reject, retries: 0 });
            this.next();
        });
    }
    async next() {
        if (this.active.size >= this.concurrency)
            return;
        if (this.queue.length === 0)
            return;
        const task = this.queue.shift();
        this.active.add(task.imageId);
        console.log(`[QUEUE] picked imageId ${task.imageId} (attempt #${task.retries + 1})`);
        this.executeTask(task);
    }
    async executeTask(task) {
        const TIMEOUT_MS = 60000; // 60 second limit per image
        let timer = null;
        try {
            const timeoutPromise = new Promise((_, reject) => {
                timer = setTimeout(() => reject(new Error('Timeout: Process took more than 60 seconds')), TIMEOUT_MS);
            });
            // Execute direct pipeline call
            const { galleryService } = await Promise.resolve().then(() => __importStar(require('./galleryService')));
            await Promise.race([
                galleryService.processGalleryImageDirect(task.imageId, task.isForceScan, task.isForceMeta),
                timeoutPromise
            ]);
            if (timer)
                clearTimeout(timer);
            task.resolve();
        }
        catch (err) {
            if (timer)
                clearTimeout(timer);
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
            }
            else {
                // Final Failure - Explicit recovery: write failure to DB to avoid stuck state
                console.log(`[FAIL] Exhausted all retries for task ${task.imageId}. Marking explicitly as failed.`);
                try {
                    const currentItem = await galleryRepository_1.default.findById(task.imageId);
                    const currentRaw = currentItem?.metadata?.rawJson || {};
                    await galleryRepository_1.default.updateById(task.imageId, {
                        scanStatus: 'failed',
                        metadataStatus: 'failed',
                        metadata: {
                            ...currentRaw,
                            lastScanError: `Max Retries Failed: ${err.message}`,
                            lastMetaError: `Max Retries Failed: ${err.message}`,
                        }
                    });
                    console.log(`[DB] updated statuses imageId ${task.imageId} to failed due to exhaust retry`);
                }
                catch (dbErr) {
                    console.error(`[QUEUE] Critical write fail for stuck item ${task.imageId}:`, dbErr);
                }
                task.reject(err);
            }
        }
        finally {
            this.active.delete(task.imageId);
            // Process next in line immediately
            setImmediate(() => this.next());
        }
    }
}
const imageQueue = new ImageTaskQueue();
class LabeledFaceDescriptors {
    constructor(label, descriptors) {
        this.label = label;
        this.descriptors = descriptors;
    }
}
exports.LabeledFaceDescriptors = LabeledFaceDescriptors;
// ─── In-Memory Model Cache ────────────────────────────────────────────────────
// buildLabeledDescriptors is expensive (reads all gallery items + runs AI scans).
// Cache the result in memory for MODEL_CACHE_TTL_MS to avoid rebuilding on every
// upload or refresh call.  Cache is invalidated whenever we tag/untag a face.
const MODEL_CACHE_TTL_MS = 3 * 60 * 1000; // 3 minutes
let _modelCache = null;
let _modelCacheTime = 0;
function invalidateModelCache() {
    _modelCache = null;
    _modelCacheTime = 0;
    _clusterCache = null;
    _clusterCacheTime = 0;
    console.log('[Model Cache] 🗑️  Invalidated (Model & Clusters)');
}
const CLUSTER_CACHE_TTL_MS = 2 * 60 * 1000; // 2 minutes
let _clusterCache = null;
let _clusterCacheTime = 0;
async function getCachedModel() {
    const now = Date.now();
    if (_modelCache && (now - _modelCacheTime) < MODEL_CACHE_TTL_MS) {
        console.log(`[Model Cache] ⚡ HIT — using in-memory model (${_modelCache.length} user(s))`);
        return _modelCache;
    }
    console.log('[Model Cache] 🐢 MISS — rebuilding recognition model...');
    const allUsers = await userRepository_1.default.findAllForRecognition();
    const model = await buildLabeledDescriptors(allUsers);
    _modelCache = model;
    _modelCacheTime = Date.now();
    return model;
}
// ─── Face Descriptor DB Cache ─────────────────────────────────────────────────
// Store face descriptors in the DB so each image is only AI-scanned ONCE.
async function detectFacesWithCache(item) {
    // HIT: non-empty cached array
    if (item.faceDescriptors && Array.isArray(item.faceDescriptors) && item.faceDescriptors.length > 0) {
        const deserialized = item.faceDescriptors
            .map(d => ({ descriptor: faceAi_1.default.deserializeDescriptor(d.descriptor), box: d.box }))
            .filter(d => d.descriptor !== null);
        if (deserialized.length > 0) {
            console.log(`[Face Cache] ⚡ HIT item ${item.id} — ${deserialized.length} face(s)`);
            return deserialized;
        }
    }
    // MISS: run AI scan (single image)
    console.log(`[Face Cache] 🐢 MISS item ${item.id} — scanning...`);
    if (!item.url)
        return [];
    const filename = item.url.split('/').pop();
    if (!filename)
        return [];
    const filePath = path.join(constants_1.UPLOADS_DIR, filename);
    if (!fs.existsSync(filePath))
        return [];
    const data = await faceAi_1.default.detectFaces(filePath);
    const detections = data.faces || [];
    // Persist result to DB (background, non-blocking)
    const serialized = detections.map((d) => ({
        descriptor: faceAi_1.default.serializeDescriptor(d.descriptor),
        box: d.box,
    }));
    galleryRepository_1.default.updateById(item.id, { faceDescriptors: serialized })
        .catch(err => console.error(`[Face Cache] Failed to save for item ${item.id}:`, err));
    return detections;
}
/**
 * BATCH version of detectFacesWithCache.
 * - Cache HITs are resolved instantly (no AI call needed).
 * - Cache MISSes are batched into a SINGLE parallel call to the Python service.
 * Returns results in the same order as `items`.
 */
async function detectFacesWithCacheBatch(items, force = false) {
    const results = new Array(items.length);
    const missIndices = [];
    const missPaths = [];
    // Pass 1 — resolve cache hits immediately
    for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (!force &&
            item.faceDescriptors &&
            Array.isArray(item.faceDescriptors) &&
            item.faceDescriptors.length > 0) {
            const deserialized = item.faceDescriptors
                .map((d) => ({ descriptor: faceAi_1.default.deserializeDescriptor(d.descriptor), box: d.box }))
                .filter((d) => d.descriptor !== null);
            if (deserialized.length > 0) {
                console.log(`[Face Cache] ⚡ HIT item ${item.id} — ${deserialized.length} face(s)`);
                results[i] = deserialized;
                continue;
            }
        }
        // Mark as MISS
        if (!item.url) {
            results[i] = [];
            continue;
        }
        const filename = item.url.split('/').pop();
        if (!filename) {
            results[i] = [];
            continue;
        }
        const filePath = path.join(constants_1.UPLOADS_DIR, filename);
        if (!fs.existsSync(filePath)) {
            results[i] = [];
            continue;
        }
        missIndices.push(i);
        missPaths.push(filePath);
    }
    if (missIndices.length === 0)
        return results;
    // Pass 2 — batch-scan all misses with ONE parallel Python call
    console.log(`[Face Cache] 🚀 BATCH scanning ${missIndices.length} item(s) in parallel...`);
    const batchDetections = await faceAi_1.default.detectFacesBatch(missPaths);
    // Pass 3 — store results & persist to DB
    for (let j = 0; j < missIndices.length; j++) {
        const idx = missIndices[j];
        const item = items[idx];
        const data = batchDetections[j];
        const detections = data.faces || [];
        results[idx] = detections;
        // Persist to DB non-blocking
        const serialized = detections.map((d) => ({
            descriptor: faceAi_1.default.serializeDescriptor(d.descriptor),
            box: d.box,
        }));
        galleryRepository_1.default.updateById(item.id, { faceDescriptors: serialized })
            .catch((err) => console.error(`[Face Cache] Failed to save item ${item.id}:`, err));
    }
    return results;
}
// ─── Profile Descriptor DB Cache ─────────────────────────────────────────────
async function getProfileDescriptorsWithCache(user) {
    if (user.profileDescriptor && (Array.isArray(user.profileDescriptor) ? user.profileDescriptor.length > 0 : true)) {
        try {
            const cached = Array.isArray(user.profileDescriptor) ? user.profileDescriptor : [user.profileDescriptor];
            const parsed = cached.map((d) => {
                const raw = d && typeof d === 'object' && d.descriptor ? d.descriptor : d;
                return faceAi_1.default.deserializeDescriptor(raw);
            }).filter((d) => d !== null);
            if (parsed.length > 0)
                return parsed;
        }
        catch (e) {
            console.warn(`[Profile Cache] Failed to deserialize for user ${user.id}, re-calculating...`);
        }
    }
    const urls = Array.isArray(user.profile_pictures) && user.profile_pictures.length > 0
        ? user.profile_pictures
        : (user.profile_picture ? [user.profile_picture] : []);
    if (urls.length === 0)
        return [];
    const descriptors = [];
    for (const url of urls) {
        const filename = url.split('/').pop();
        if (!filename)
            continue;
        const filePath = path.join(constants_1.UPLOADS_DIR, filename);
        if (!fs.existsSync(filePath))
            continue;
        const descriptor = await faceAi_1.default.getFaceDescriptor(filePath);
        if (descriptor)
            descriptors.push(descriptor);
    }
    if (descriptors.length > 0) {
        const serialized = descriptors.map(d => faceAi_1.default.serializeDescriptor(d));
        userRepository_1.default.updateById(user.id, {
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
async function buildLabeledDescriptors(users) {
    const allGalleryItems = await galleryRepository_1.default.findAll();
    const results = await Promise.all(users.map(async (user) => {
        const descriptors = [];
        // Step 1: Profile picture ground truth (multiple angles supported)
        const profileDescriptors = await getProfileDescriptorsWithCache(user);
        descriptors.push(...profileDescriptors);
        let groundTruth = profileDescriptors.length > 0 ? profileDescriptors[0] : null;
        // Step 2: Bootstrap from manually tagged photos (users with no profile pic)
        if (!groundTruth && descriptors.length === 0) {
            const taggedPhotos = allGalleryItems.filter(item => !item.isProfile &&
                Array.isArray(item.recognizedUserIds) &&
                item.recognizedUserIds.map(id => Number(id)).includes(Number(user.id)));
            for (const item of taggedPhotos.slice(0, 8)) {
                // Exact Face-to-ID fallback
                let foundExplicit = false;
                if (Array.isArray(item.faceDescriptors)) {
                    const faceDescs = item.faceDescriptors;
                    const explicitFaces = faceDescs.filter(d => d && Number(d.manuallyTaggedUserId) === Number(user.id));
                    if (explicitFaces.length > 0) {
                        for (const d of explicitFaces) {
                            if (d && d.descriptor) {
                                const deserialized = faceAi_1.default.deserializeDescriptor(d.descriptor);
                                if (deserialized)
                                    descriptors.push(deserialized);
                            }
                        }
                        foundExplicit = true;
                    }
                }
                if (foundExplicit) {
                    if (descriptors.length >= 3)
                        break;
                    continue;
                }
                // Generic fallback for backwards compatibility
                const detections = await detectFacesWithCache(item);
                for (const d of detections) {
                    descriptors.push(d.descriptor);
                }
                if (descriptors.length >= 3)
                    break; // enough bootstrap samples
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
        if (!descriptors.some(d => faceAi_1.default.cosineDistance(d, groundTruth) < 0.01)) {
            descriptors.push(groundTruth);
        }
        // Step 3: Collect additional confirmed training samples (better accuracy)
        const confirmedPhotos = allGalleryItems.filter(item => !item.isProfile &&
            Array.isArray(item.recognizedUserIds) &&
            item.recognizedUserIds.map(id => Number(id)).includes(Number(user.id)));
        for (const item of confirmedPhotos.slice(0, 30)) {
            // Check for explicitly tagged face first
            if (Array.isArray(item.faceDescriptors)) {
                const faceDescs = item.faceDescriptors;
                const explicitFace = faceDescs.find(d => d && Number(d.manuallyTaggedUserId) === Number(user.id));
                if (explicitFace && explicitFace.descriptor) {
                    const deserialized = faceAi_1.default.deserializeDescriptor(explicitFace.descriptor);
                    if (deserialized && !descriptors.includes(deserialized)) {
                        descriptors.push(deserialized);
                        continue; // Skip generic fallback distance check
                    }
                }
            }
            const detections = await detectFacesWithCache(item);
            // Pick the detection closest to ground truth (reject wrong faces from group shots)
            let best = null;
            let bestDist = Infinity;
            for (const det of detections) {
                const dist = faceAi_1.default.cosineDistance(groundTruth, det.descriptor);
                // Professional limit for memorizing diverse profile angles (cosine distance ~ 0.17)
                if (dist < bestDist && dist < 0.17) {
                    bestDist = dist;
                    best = det.descriptor;
                }
            }
            if (best && !descriptors.some(d => faceAi_1.default.cosineDistance(d, best) < 0.01)) {
                descriptors.push(best);
            }
        }
        console.log(`[AI Model] ✅ ${user.name} — ${descriptors.length} descriptor(s)`);
        return new LabeledFaceDescriptors(JSON.stringify({ id: user.id, name: user.name }), descriptors);
    }));
    const model = results.filter((r) => r !== null);
    console.log(`[AI Model] 🎯 Built for ${model.length} user(s)`);
    return model;
}
// ─── Helpers ──────────────────────────────────────────────────────────────────
function arraysEqual(a, b) {
    if (a.length !== b.length)
        return false;
    return a.every((v, i) => v === b[i]);
}
function parseUserId(label) {
    try {
        return Number(JSON.parse(label).id);
    }
    catch {
        return null;
    }
}
function parseUserFromLabel(label) {
    try {
        return JSON.parse(label);
    }
    catch {
        return null;
    }
}
async function getUserMapForSuggestions() {
    const allUsers = await userRepository_1.default.findAllForRecognition();
    const userMap = {};
    for (const u of allUsers)
        userMap[u.id] = u;
    return userMap;
}
async function recognizeImageWithSuggestions(imagePath) {
    const [labeledDescriptors, userMap] = await Promise.all([
        getCachedModel(),
        getUserMapForSuggestions(),
    ]);
    const suggestions = await faceAi_1.default.getFaceSuggestions(imagePath, labeledDescriptors);
    const enrichedFaces = suggestions.map((face) => {
        const enrichedSuggestions = face.allSuggestions.map((s) => {
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
        highConfidenceCount: enrichedFaces.filter((f) => f.isConfident).length,
        lowConfidenceCount: enrichedFaces.filter((f) => !f.isConfident).length,
    };
}
// ─── Gallery Service ──────────────────────────────────────────────────────────
const galleryService = {
    // ── List gallery ────────────────────────────────────────────────────────────
    // Pure DB query — NO AI calls here. Fast.
    async listGallery(userId = null, search = '') {
        const [galleryItems, allUsers] = await Promise.all([
            galleryRepository_1.default.findAllLight(),
            userRepository_1.default.findAllForRecognition(),
        ]);
        const q = search.toLowerCase().trim();
        // Build lookup map: userId → user (with profile_picture)
        const userMap = {};
        for (const u of allUsers)
            userMap[u.id] = u;
        // Synthetic profile items for users who have profile pictures
        const dynamicProfileItems = allUsers
            .filter((u) => u.profile_picture)
            .map((u) => ({
            id: `profile-${u.id}`,
            url: u.profile_picture,
            uploadedAt: new Date(0),
            label: `${u.name}'s Profile`,
            isProfile: true,
            userId: u.id,
            recognizedUserIds: [u.id],
            hashtags: [],
            metadata: null,
        }));
        const merged = [...galleryItems, ...dynamicProfileItems];
        const seenUrls = new Set();
        const uniqueItems = [];
        for (const item of merged) {
            if (!item.url || seenUrls.has(item.url))
                continue;
            // If it's a profile photo in the gallery, we only show it if it's the PRIMARY one for that user
            if (item.isProfile && item.userId) {
                const user = userMap[item.userId];
                if (user && user.profile_picture !== item.url)
                    continue;
            }
            const filename = item.url.split('/').pop();
            if (!filename || !fs.existsSync(path.join(constants_1.UPLOADS_DIR, filename)))
                continue;
            // ─── SEARCH FILTER ───
            if (q) {
                const i = item;
                const recognizedUsers = (Array.isArray(i.recognizedUserIds) ? i.recognizedUserIds : [])
                    .map((id) => userMap[Number(id)])
                    .filter(Boolean);
                const hashtagNames = Array.isArray(i.hashtags) ? i.hashtags.map((h) => h.name) : [];
                const tags = hashtagNames.join(' ').toLowerCase();
                const names = recognizedUsers.map((u) => u.name.toLowerCase()).join(' ');
                const metadataStr = JSON.stringify(i.metadata || {}).toLowerCase();
                const dateStr = new Date(i.uploadedAt).toDateString().toLowerCase();
                const matches = tags.includes(q) || names.includes(q) || metadataStr.includes(q) || dateStr.includes(q) || (i.label && i.label.toLowerCase().includes(q));
                if (!matches)
                    continue;
            }
            seenUrls.add(item.url);
            uniqueItems.push(item);
        }
        uniqueItems.sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());
        // Filter for personal view (if userId is provided)
        let visibleItems = uniqueItems;
        if (userId !== null && userId !== undefined && userId !== 'null') {
            const normalizedUserId = Number(userId);
            visibleItems = uniqueItems.filter((item) => {
                const ownerId = item.userId != null ? Number(item.userId) : null;
                const recIds = Array.isArray(item.recognizedUserIds)
                    ? item.recognizedUserIds.map((id) => Number(id))
                    : [];
                return ownerId === normalizedUserId || recIds.includes(normalizedUserId);
            });
        }
        // Enrich with user data (name + profilePicture)
        const enriched = visibleItems.map((item) => ({
            ...item,
            hashtags: Array.isArray(item.hashtags) ? item.hashtags.map((h) => h.name) : [],
            metadata: item.metadata ? (item.metadata.rawJson || item.metadata) : {},
            recognizedUsers: (Array.isArray(item.recognizedUserIds) ? item.recognizedUserIds : [])
                .map((id) => userMap[Number(id)])
                .filter(Boolean),
        }));
        return enriched.map(serializers_1.toGalleryResponse);
    },
    async getGalleryItem(id) {
        return getGalleryItemResponseById(id);
    },
    async deleteGalleryItem(id) {
        const item = await galleryRepository_1.default.findById(id);
        if (!item)
            throw (0, httpError_1.default)(404, 'Gallery item not found');
        if (item.isProfile)
            throw (0, httpError_1.default)(400, 'Profile photos cannot be deleted from the gallery.');
        const itemUrl = item.url;
        await galleryRepository_1.default.deleteById(id);
        const [remainingItems, users] = await Promise.all([
            galleryRepository_1.default.findAll(),
            userRepository_1.default.findAllForRecognition(),
        ]);
        const stillUsedInGallery = remainingItems.some((g) => g.url === itemUrl);
        const stillUsedAsProfile = users.some((u) => u.profile_picture === itemUrl);
        if (!stillUsedInGallery && !stillUsedAsProfile) {
            const filename = itemUrl?.split('/').pop();
            if (filename) {
                const filePath = path.join(constants_1.UPLOADS_DIR, filename);
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                }
            }
        }
        invalidateModelCache();
        return { message: 'Photo deleted successfully.' };
    },
    async setGalleryItemHashtags(id, hashtagsInput) {
        const item = await galleryRepository_1.default.findById(id);
        if (!item)
            throw (0, httpError_1.default)(404, 'Gallery item not found');
        if (item.isProfile)
            throw (0, httpError_1.default)(400, 'Cannot tag a profile item.');
        const hashtags = (0, hashtagUtils_1.normalizeHashtags)(hashtagsInput);
        // Fix 2: Explicitly preserve manual selections into internal metadata cache for AI isolation
        const existingMeta = item.metadata || {};
        const rawJson = existingMeta.rawJson || {};
        const updatedMeta = {
            ...rawJson,
            manualHashtags: hashtags // Track actual manual user assignments
        };
        await galleryRepository_1.default.updateById(id, {
            hashtags,
            metadata: updatedMeta
        });
        return getGalleryItemResponseById(id);
    },
    async setGalleryItemCustomMetadata(id, customLocation, customEvent) {
        const item = await galleryRepository_1.default.findById(id);
        if (!item)
            throw (0, httpError_1.default)(404, 'Gallery item not found');
        const currentMetadata = item.metadata || {};
        const rawJson = currentMetadata.rawJson || {};
        const updatedMetadata = {
            ...rawJson,
            customLocation: customLocation || '',
            customEvent: customEvent || '',
        };
        await galleryRepository_1.default.updateById(id, {
            metadata: updatedMetadata,
            objects: item.metadata?.objects || [],
            scenes: item.metadata?.scenes || [],
            ocrText: item.metadata?.ocrText || [],
        });
        return getGalleryItemResponseById(id);
    },
    async searchGalleryByHashtag(rawTag) {
        const tag = (0, hashtagUtils_1.normalizeTag)(rawTag);
        if (!tag)
            throw (0, httpError_1.default)(400, 'Valid hashtag is required.');
        const [items, userMap] = await Promise.all([
            galleryRepository_1.default.findByHashtag(tag),
            getUsersMap(),
        ]);
        const enriched = items.map((item) => ({
            ...item,
            recognizedUsers: (Array.isArray(item.recognizedUserIds) ? item.recognizedUserIds : [])
                .map((id) => userMap[Number(id)])
                .filter(Boolean),
        }));
        return enriched.map(serializers_1.toGalleryResponse);
    },
    // ── Upload gallery ──────────────────────────────────────────────────────────
    async uploadGallery(files = [], userId = null) {
        if (!files || files.length === 0)
            throw (0, httpError_1.default)(400, 'No files uploaded');
        invalidateModelCache();
        const uploaderId = userId ? Number(userId) : null;
        const itemsToSave = files.map(file => ({
            url: (0, urlUtils_1.buildUploadUrl)(file.filename),
            uploadedAt: new Date(),
            recognizedUserIds: [],
            userId: uploaderId,
            faceDescriptors: null,
            scanStatus: 'pending',
            metadataStatus: 'pending',
        }));
        await galleryRepository_1.default.createMany(itemsToSave);
        const urls = itemsToSave.map(i => i.url);
        const newItems = await prisma_1.default.galleryItem.findMany({
            where: { url: { in: urls } },
            include: { hashtags: true, metadata: true }
        });
        const pairs = files
            .map(file => ({
            file,
            item: newItems.find((i) => i.url && i.url.includes(file.filename))
        }))
            .filter(p => p.item);
        const itemIds = pairs.map((p) => Number(p.item?.id)).filter((id) => !isNaN(id));
        const queue = (0, galleryQueues_1.getGalleryPreprocessQueue)();
        const redis = (0, redis_1.getRedis)();
        if (queue && redis) {
            await (0, syncStateStore_1.setSyncState)(redis, { isScanning: true, stage: 'preprocess', message: 'Preparing images…', current: 0, total: itemIds.length });
            await queue.add('preprocess', { type: 'upload', itemIds }, { attempts: 3, backoff: { type: 'exponential', delay: 2000 }, removeOnComplete: true, removeOnFail: 50, priority: 1 });
        }
        else {
            // Backward-compatible fallback: route straight to concurrent-safe, in-memory job queue
            console.log(`[Upload] 🚀 Enqueueing ${itemIds.length} uploaded items into task queue...`);
            for (const id of itemIds) {
                imageQueue.enqueue(id).catch(() => { });
            }
        }
        const gallery = await this.listGallery(userId);
        return gallery;
    },
    async forceScanItem(galleryItemId) {
        const item = await galleryRepository_1.default.findById(galleryItemId);
        if (!item)
            throw (0, httpError_1.default)(404, 'Gallery item not found');
        if (item.isProfile)
            throw (0, httpError_1.default)(400, 'Profile pictures cannot be indexed in the analytical metadata stream.');
        if (!item.url)
            throw (0, httpError_1.default)(400, 'Gallery item has no image URL');
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
        }
        finally {
            _processingLock.delete(galleryItemId);
            console.log(`[Force Scan] 🔓 Lock released for image ${galleryItemId}.`);
        }
    },
    async identifyFacesInDetections(detections, labeledDescriptors, faceDescs, baseIds) {
        const aiIds = [];
        const descriptors = detections.map((det, fi) => {
            const cachedFace = faceDescs[fi] || {};
            const rejectedIds = Array.isArray(cachedFace.rejectedUserIds) ? cachedFace.rejectedUserIds : [];
            const manuallyTaggedUserId = cachedFace.manuallyTaggedUserId || null;
            const match = faceAi_1.default.findBestMatchWithMargin(det.descriptor, labeledDescriptors);
            if (match.label !== 'unknown') {
                const id = parseUserId(match.label);
                if (id !== null && !rejectedIds.includes(id)) {
                    aiIds.push(id);
                }
            }
            return {
                descriptor: faceAi_1.default.serializeDescriptor(det.descriptor),
                box: det.box,
                rejectedUserIds: rejectedIds,
                manuallyTaggedUserId,
                isIgnored: cachedFace.isIgnored || false
            };
        });
        return { aiIds: [...new Set(aiIds)], descriptors };
    },
    // ── Tag a face manually ────────────────────────────────────────────────────
    async tagUnknownFace(galleryItemId, userId, faceIndex) {
        const [item, user] = await Promise.all([
            galleryRepository_1.default.findById(galleryItemId),
            userRepository_1.default.findById(userId),
        ]);
        if (!item || !user)
            throw new Error('Item or User not found');
        if (item.isProfile)
            throw new Error('Cannot tag a profile photo directly.');
        const existingIds = (Array.isArray(item.recognizedUserIds)
            ? item.recognizedUserIds.map((id) => Number(id))
            : []);
        let updateData = {};
        if (!existingIds.includes(Number(userId))) {
            updateData.recognizedUserIds = [...existingIds, Number(userId)];
        }
        if (faceIndex !== undefined && Array.isArray(item.faceDescriptors)) {
            const newDescriptors = [...item.faceDescriptors];
            if (newDescriptors[faceIndex]) {
                newDescriptors[faceIndex].manuallyTaggedUserId = Number(userId);
                updateData.faceDescriptors = newDescriptors;
            }
        }
        await galleryRepository_1.default.updateById(galleryItemId, updateData);
        const profilePictureSet = !user.profile_picture;
        if (profilePictureSet && item.url) {
            await userRepository_1.default.updateById(userId, {
                profile_picture: item.url,
                profileDescriptor: null,
            });
        }
        invalidateModelCache();
        this.refreshGalleryRecognition().catch(err => console.error('[Tag] BG refresh failed:', err));
        return { message: `Tagged ${user.name} successfully`, profilePictureSet };
    },
    async untagFace(galleryItemId, userId, faceIndex) {
        const item = await galleryRepository_1.default.findById(galleryItemId);
        if (!item)
            throw new Error('Item not found');
        const existingIds = (Array.isArray(item.recognizedUserIds)
            ? item.recognizedUserIds.map((id) => Number(id))
            : []);
        let updateData = {
            recognizedUserIds: existingIds.filter(id => id !== Number(userId)),
        };
        if (faceIndex !== undefined && Array.isArray(item.faceDescriptors)) {
            const newDescriptors = [...item.faceDescriptors];
            if (newDescriptors[faceIndex] && Number(newDescriptors[faceIndex].manuallyTaggedUserId) === Number(userId)) {
                newDescriptors[faceIndex].manuallyTaggedUserId = null;
            }
            if (!newDescriptors[faceIndex].rejectedUserIds)
                newDescriptors[faceIndex].rejectedUserIds = [];
            newDescriptors[faceIndex].rejectedUserIds.push(Number(userId));
            updateData.faceDescriptors = newDescriptors;
        }
        await galleryRepository_1.default.updateById(galleryItemId, updateData);
        invalidateModelCache();
        this.refreshGalleryRecognition().catch(err => console.error('[Untag] BG refresh failed:', err));
        return { message: 'Tag removed successfully' };
    },
    syncState: { isScanning: false, total: 0, current: 0 },
    async refreshGalleryRecognition(forceRescan = false) {
        if (this.syncState.isScanning) {
            console.log('⚠️ AI Sync already running, ignoring parallel request.');
            return { message: 'Sync in progress' };
        }
        const queue = (0, galleryQueues_1.getGalleryRefreshQueue)();
        const redis = (0, redis_1.getRedis)();
        if (queue && redis) {
            await (0, syncStateStore_1.setSyncState)(redis, { isScanning: true, stage: 'preprocess', message: 'Preparing images…', current: 0, total: 0 });
            await queue.add('refresh', { forceRescan }, { jobId: `gallery:refresh:${forceRescan ? 'force' : 'soft'}`, attempts: 3, backoff: { type: 'exponential', delay: 2000 }, removeOnComplete: true, removeOnFail: 50, priority: 5 });
            return { message: 'Queued sync', forceRescan };
        }
        this.syncState = { isScanning: true, total: 0, current: 0 };
        console.log(`\n🚀 AI Sync starting... (forceRescan=${forceRescan})`);
        const startTime = Date.now();
        let allItems = await galleryRepository_1.default.findAll();
        invalidateModelCache();
        const labeledDescriptors = await getCachedModel();
        let updatedCount = 0;
        const realItems = allItems.filter(i => !i.isProfile && i.url);
        this.syncState.total = realItems.length;
        // Separate into cache hits (already have descriptors) and misses (need scan)
        const misses = forceRescan ? realItems : realItems.filter(item => !Array.isArray(item.faceDescriptors) || item.faceDescriptors.length === 0);
        const hits = forceRescan ? [] : realItems.filter(item => Array.isArray(item.faceDescriptors) && item.faceDescriptors.length > 0);
        console.log(`[AI Sync] ⚡ In-memory matching on ${hits.length} cached images, scanning ${misses.length} misses...`);
        // Process hits instantly in memory from DB cache
        for (const item of hits) {
            const faceDescs = item.faceDescriptors;
            const baseIds = faceDescs
                .map((fd) => fd.manuallyTaggedUserId)
                .filter((id) => id != null)
                .map((id) => Number(id))
                .filter((id) => !isNaN(id));
            const aiIds = [];
            const updatedFaceDescriptors = faceDescs.map((fd) => {
                const descriptor = faceAi_1.default.deserializeDescriptor(fd.descriptor);
                if (!descriptor)
                    return fd;
                const match = faceAi_1.default.findBestMatchWithMargin(descriptor, labeledDescriptors);
                // Source and Priority Logic
                let manuallyTaggedUserId = fd.manuallyTaggedUserId || null;
                let personId = manuallyTaggedUserId || fd.personId || null;
                let personName = fd.personName || null;
                let status = fd.status || 'unknown';
                let source = fd.source || 'auto_scan';
                let confidence = fd.confidence || 0;
                let sim = fd.similarity || 0.0;
                if (manuallyTaggedUserId) {
                    status = 'recognized';
                    source = 'manual_tag';
                    confidence = 100;
                    sim = 1.0;
                }
                else if (match.label !== 'unknown') {
                    const id = parseUserId(match.label);
                    if (id !== null && !fd.rejectedUserIds?.includes(id)) {
                        aiIds.push(id);
                        personId = id;
                        const userData = parseUserFromLabel(match.label);
                        if (userData)
                            personName = userData.name;
                        status = 'recognized';
                        source = 'rescan_match';
                        sim = match.confidence ? match.confidence / 100 : 0.0;
                        confidence = Math.round(sim * 100);
                    }
                }
                else if (personId) {
                    // Preserve previous correct automatic recognition
                    status = 'preserved_existing';
                    source = 'preserved_existing';
                    if (!confidence)
                        confidence = Math.round(sim * 100) || 70;
                }
                else {
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
                await galleryRepository_1.default.updateById(item.id, {
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
            const batches = Array.from({ length: Math.ceil(misses.length / CHUNK) }, (_, i) => misses.slice(i * CHUNK, i * CHUNK + CHUNK));
            for (const chunk of batches) {
                const filePaths = await Promise.all(chunk.map(i => pickScanPathAndOptimize(path.join(constants_1.UPLOADS_DIR, i.url?.split('/').pop() || ''))));
                const chunkResults = await faceAi_1.default.detectFacesBatch(filePaths);
                await Promise.all(chunk.map(async (item, chunkIdx) => {
                    const data = chunkResults[chunkIdx];
                    const detections = data.faces || [];
                    const metadata = data.metadata || {};
                    let scaleX = 1;
                    let scaleY = 1;
                    try {
                        const optPath = filePaths[chunkIdx];
                        const origPath = path.join(constants_1.UPLOADS_DIR, item.url?.split('/').pop() || '');
                        if (optPath !== origPath && fs.existsSync(optPath) && fs.existsSync(origPath)) {
                            const [origMeta, optMeta] = await Promise.all([
                                (0, sharp_1.default)(origPath).metadata(),
                                (0, sharp_1.default)(optPath).metadata()
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
                    }
                    catch (e) {
                        console.error('[Scale calculation failed]', e);
                    }
                    const faceDescs = Array.isArray(item.faceDescriptors) ? item.faceDescriptors : [];
                    const baseIds = faceDescs
                        .map((fd) => fd.manuallyTaggedUserId)
                        .filter((id) => id != null)
                        .map((id) => Number(id))
                        .filter((id) => !isNaN(id));
                    const aiIds = [];
                    const newFaceDescriptors = detections.map((det, fi) => {
                        const cachedFace = faceDescs[fi] || {};
                        const rejectedIds = Array.isArray(cachedFace.rejectedUserIds) ? cachedFace.rejectedUserIds : [];
                        const match = faceAi_1.default.findBestMatchWithMargin(det.descriptor, labeledDescriptors, forceRescan);
                        // Source and Priority Logic
                        let manuallyTaggedUserId = cachedFace.manuallyTaggedUserId || null;
                        let personId = manuallyTaggedUserId || cachedFace.personId || null;
                        let personName = cachedFace.personName || null;
                        let status = cachedFace.status || 'unknown';
                        let source = cachedFace.source || 'auto_scan';
                        let confidence = cachedFace.confidence || 0;
                        let sim = match.confidence ? match.confidence / 100 : 0.0;
                        if (manuallyTaggedUserId) {
                            status = 'recognized';
                            source = 'manual_tag';
                            confidence = 100;
                            personId = Number(manuallyTaggedUserId);
                        }
                        else if (match.label !== 'unknown') {
                            const id = parseUserId(match.label);
                            if (id !== null && !rejectedIds.includes(id)) {
                                aiIds.push(id);
                                personId = id;
                                const userData = parseUserFromLabel(match.label);
                                if (userData)
                                    personName = userData.name;
                                status = 'recognized';
                                source = 'rescan_match';
                                confidence = Math.round(sim * 100);
                            }
                        }
                        else if (personId) {
                            // Preserve previous correct automatic recognition
                            status = 'preserved_existing';
                            source = 'preserved_existing';
                            if (!confidence)
                                confidence = Math.round(sim * 100) || 70;
                        }
                        else {
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
                            descriptor: faceAi_1.default.serializeDescriptor(det.descriptor),
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
                    }).filter((fd) => fd !== null);
                    const previousRecognizedIds = Array.isArray(item.recognizedUserIds) ? item.recognizedUserIds.map(Number) : [];
                    const merged = [...new Set([...baseIds, ...aiIds, ...previousRecognizedIds])];
                    const currentTags = Array.isArray(item.hashtags) ? item.hashtags.map((h) => h.name) : [];
                    const newHashtags = new Set([...currentTags]);
                    if (metadata.person_count > 0) {
                        newHashtags.add(`${metadata.person_count}_people`);
                        if (metadata.person_count === 1)
                            newHashtags.add('portrait');
                        else
                            newHashtags.add('group_photo');
                    }
                    if (metadata.orientation)
                        newHashtags.add(metadata.orientation);
                    await galleryRepository_1.default.updateById(item.id, {
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
        const allItems = await galleryRepository_1.default.findAll();
        const labeledDescriptors = await getCachedModel();
        const realItems = allItems.filter(i => !i.isProfile && i.url);
        const CLUSTER_CHUNK = 10;
        const batches = Array.from({ length: Math.ceil(realItems.length / CLUSTER_CHUNK) }, (_, i) => realItems.slice(i * CLUSTER_CHUNK, i * CLUSTER_CHUNK + CLUSTER_CHUNK));
        const unknownPhotos = (await Promise.all(batches.map(async (chunk) => {
            const chunkDetections = await detectFacesWithCacheBatch(chunk);
            return chunk.map((item, chunkIdx) => {
                const detections = chunkDetections[chunkIdx];
                const faceDescs = Array.isArray(item.faceDescriptors) ? item.faceDescriptors : [];
                const recognizedIds = Array.isArray(item.recognizedUserIds)
                    ? item.recognizedUserIds.map((id) => Number(id))
                    : [];
                const unknownFacesInPhoto = detections
                    .map((det, i) => {
                    const cachedFace = faceDescs[i] || {};
                    if (cachedFace.manuallyTaggedUserId || cachedFace.isIgnored)
                        return null;
                    const box = det?.box || cachedFace.box;
                    if (!box)
                        return null;
                    let isUnknown = false;
                    if (cachedFace.status) {
                        isUnknown = (cachedFace.status === 'unknown' || cachedFace.status === 'possible' || cachedFace.status === 'ambiguous');
                    }
                    else {
                        const descriptor = det?.descriptor;
                        if (!descriptor)
                            return { itemId: item.id, faceIndex: i, box, descriptor: null };
                        const match = faceAi_1.default.findBestMatchWithMargin(descriptor, labeledDescriptors);
                        isUnknown = (match.label === 'unknown');
                    }
                    if (!isUnknown)
                        return null;
                    return {
                        itemId: item.id,
                        faceIndex: i,
                        box,
                        descriptor: det?.descriptor,
                        similarity: cachedFace.similarity || 0,
                        status: cachedFace.status || 'unknown',
                    };
                })
                    .filter((f) => f !== null);
                // Only show photos that have ACTUAL unknown faces with real bounding boxes.
                // Photos with zero detected faces should NOT appear in the People page.
                if (unknownFacesInPhoto.length === 0)
                    return null;
                return {
                    clusterId: `photo-${item.id}`,
                    faceCount: unknownFacesInPhoto.length,
                    anchorImage: (0, urlUtils_1.buildUploadUrl)(item.url?.split('/').pop() || ''),
                    anchorBox: unknownFacesInPhoto[0]?.box || null,
                    uploadedAt: new Date(item.uploadedAt).getTime(),
                    relatedPhotos: unknownFacesInPhoto.map((f) => ({
                        itemId: f.itemId,
                        faceIndex: f.faceIndex,
                        url: (0, urlUtils_1.buildUploadUrl)(item.url?.split('/').pop() || ''),
                        box: f.box,
                        similarity: f.similarity,
                        status: f.status,
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
    async getTagSuggestions(galleryItemId) {
        const item = await galleryRepository_1.default.findById(galleryItemId);
        if (!item)
            throw (0, httpError_1.default)(404, 'Gallery item not found');
        const filename = item.url.split('/').pop();
        if (!filename)
            throw (0, httpError_1.default)(400, 'Invalid image path');
        const filePath = path.join(constants_1.UPLOADS_DIR, filename);
        if (!fs.existsSync(filePath)) {
            const detections = await detectFacesWithCache(item);
            const userMap = await getUserMapForSuggestions();
            return {
                url: item.url,
                faces: detections.map((det, idx) => {
                    const cachedFace = (Array.isArray(item.faceDescriptors) ? item.faceDescriptors[idx] : null);
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
    async getSuggestionForUpload(filePath) {
        const result = await recognizeImageWithSuggestions(filePath);
        return result;
    },
    async mergeClusterFaces(userId, faces) {
        const allItems = await galleryRepository_1.default.findAll();
        let updateCount = 0;
        await Promise.all(faces.map(async (face) => {
            const item = allItems.find(i => i.id === face.itemId);
            if (!item)
                return;
            let updateData = {};
            const existingIds = Array.isArray(item.recognizedUserIds) ? item.recognizedUserIds.map((id) => Number(id)) : [];
            if (!existingIds.includes(userId)) {
                updateData.recognizedUserIds = [...existingIds, userId];
            }
            if (face.faceIndex >= 0 && Array.isArray(item.faceDescriptors)) {
                const newDescriptors = [...item.faceDescriptors];
                if (newDescriptors[face.faceIndex]) {
                    newDescriptors[face.faceIndex].manuallyTaggedUserId = userId;
                    updateData.faceDescriptors = newDescriptors;
                }
            }
            if (Object.keys(updateData).length > 0) {
                await galleryRepository_1.default.updateById(item.id, updateData);
                updateCount++;
            }
        }));
        // Manual Tag Learning Logic
        const user = await userRepository_1.default.findById(userId);
        if (user) {
            let currentDescriptors = Array.isArray(user.profileDescriptor) ? [...user.profileDescriptor] : (user.profileDescriptor ? [user.profileDescriptor] : []);
            let descriptorsChanged = false;
            for (const face of faces) {
                const item = allItems.find(i => i.id === face.itemId);
                if (item && face.faceIndex >= 0 && Array.isArray(item.faceDescriptors)) {
                    const fd = item.faceDescriptors[face.faceIndex];
                    if (fd && fd.descriptor) {
                        const incomingArr = faceAi_1.default.deserializeDescriptor(fd.descriptor);
                        if (incomingArr) {
                            let isDuplicate = false;
                            for (const cd of currentDescriptors) {
                                const rawCD = cd && typeof cd === 'object' && 'descriptor' in cd ? cd.descriptor : cd;
                                const cdArr = faceAi_1.default.deserializeDescriptor(rawCD);
                                if (cdArr) {
                                    const dist = faceAi_1.default.cosineDistance(incomingArr, cdArr);
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
                await userRepository_1.default.updateById(userId, { profileDescriptor: currentDescriptors });
            }
        }
        invalidateModelCache();
        return { message: `Successfully matched person to ${updateCount} unknown photo(s).`, updatedCount: updateCount };
    },
    async setProfilePictureFromGalleryItem(userId, galleryItemId) {
        const [user, item] = await Promise.all([
            userRepository_1.default.findById(userId),
            galleryRepository_1.default.findById(galleryItemId),
        ]);
        if (!user)
            throw (0, httpError_1.default)(404, 'User not found');
        if (!item || !item.url)
            throw (0, httpError_1.default)(404, 'Gallery item not found');
        if (item.isProfile)
            throw (0, httpError_1.default)(400, 'Cannot use a profile item as source.');
        if (user.profile_picture) {
            // User already has a profile picture — don't overwrite it automatically.
            return { updated: false, message: 'User already has a profile picture.' };
        }
        await userRepository_1.default.updateById(userId, {
            profile_picture: item.url,
            profileDescriptor: null,
        });
        invalidateModelCache();
        this.refreshGalleryRecognition().catch(err => console.error('[Profile Fallback] BG refresh failed:', err));
        return { updated: true, message: 'Profile picture set from selected photo.' };
    },
    async ignoreClusterFaces(faces) {
        const allItems = await galleryRepository_1.default.findAll();
        let updateCount = 0;
        await Promise.all(faces.map(async (face) => {
            const item = allItems.find(i => i.id === face.itemId);
            if (!item)
                return;
            if (Array.isArray(item.faceDescriptors)) {
                const newDescriptors = [...item.faceDescriptors];
                if (newDescriptors[face.faceIndex]) {
                    newDescriptors[face.faceIndex].isIgnored = true;
                    await galleryRepository_1.default.updateById(item.id, { faceDescriptors: newDescriptors });
                    updateCount++;
                }
            }
        }));
        invalidateModelCache();
        return { message: `Successfully ignored ${updateCount} face(s). Discovery list cleaned.`, updatedCount: updateCount };
    },
    async resetIgnoredFaces() {
        const allItems = await galleryRepository_1.default.findAll();
        let resetCount = 0;
        await Promise.all(allItems.map(async (item) => {
            if (Array.isArray(item.faceDescriptors)) {
                const newDescriptors = [...item.faceDescriptors];
                let itemChanged = false;
                newDescriptors.forEach(d => {
                    if (d && d.isIgnored) {
                        delete d.isIgnored;
                        itemChanged = true;
                        resetCount++;
                    }
                });
                if (itemChanged) {
                    await galleryRepository_1.default.updateById(item.id, { faceDescriptors: newDescriptors });
                }
            }
        }));
        if (resetCount > 0) {
            invalidateModelCache();
        }
        return { message: `Restored ${resetCount} faces to discovery.`, resetCount };
    },
    async getAllHashtags() {
        const hashtags = await galleryRepository_1.default.getAllUniqueHashtags();
        return hashtags.map(h => h.name);
    },
    async getSearchSuggestions(query) {
        const q = String(query || '').toLowerCase().trim();
        if (!q)
            return [];
        const [users, hashtags, gallery] = await Promise.all([
            userRepository_1.default.findAllForRecognition(),
            galleryRepository_1.default.getAllUniqueHashtags(),
            galleryRepository_1.default.findAll()
        ]);
        const suggestions = [];
        const seenValues = new Set();
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
            const meta = item.metadata ? (item.metadata.rawJson || item.metadata) : {};
            const objects = Array.isArray(meta.objects) ? meta.objects : [];
            const scenes = Array.isArray(meta.scenes) ? meta.scenes : [];
            const ocrText = Array.isArray(meta.ocrText) ? meta.ocrText : [];
            objects.forEach((obj) => {
                const rawName = String(typeof obj === 'string' ? obj : (obj.name || '')).toLowerCase();
                if (rawName.includes(q) && !seenValues.has(`obj-${rawName}`) && rawName.length > 1) {
                    seenValues.add(`obj-${rawName}`);
                    suggestions.push({ type: 'object', value: rawName });
                }
            });
            scenes.forEach((sc) => {
                const lab = String(sc?.label || '').toLowerCase();
                if (lab.includes(q) && !seenValues.has(`scene-${lab}`) && lab.length > 1) {
                    seenValues.add(`scene-${lab}`);
                    suggestions.push({ type: 'scene', value: lab });
                }
            });
            ocrText.forEach((txt) => {
                const val = String(txt || '').toLowerCase();
                if (val.includes(q) && !seenValues.has(`ocr-${val}`) && val.length > 2 && val.length < 25) {
                    seenValues.add(`ocr-${val}`);
                    suggestions.push({ type: 'ocr', value: val });
                }
            });
        });
        // Sort prioritized: People -> Tags -> Objects -> Scenes -> OCR
        const typeOrder = { person: 1, hashtag: 2, object: 3, scene: 4, ocr: 5 };
        suggestions.sort((a, b) => {
            if (typeOrder[a.type] !== typeOrder[b.type])
                return typeOrder[a.type] - typeOrder[b.type];
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
        currentImageId: null,
        startedAt: null,
        finishedAt: null,
    },
    async backfillMissingMetadata(force = false) {
        // ── Idempotency Lock ──────────────────────────────────────────────────────
        if (galleryService.backfillState.isRunning) {
            console.log('[Backfill] ⏭️ Already running — returning current progress.');
            return { running: true, message: 'Metadata backfill already running', ...galleryService.backfillState };
        }
        console.log(`[Backfill] 🚀 Starting metadata backfill (force=${force})...`);
        // Find candidate images
        const items = await prisma_1.default.galleryItem.findMany({
            where: { isProfile: false },
            include: { metadata: true, hashtags: true },
        });
        // Filter: Select any legacy metadata record missing the high-accuracy 'strictAIActive' flag (Requirement 8)
        const candidates = items.filter(item => {
            if (force)
                return true; // force=true → regenerate everything
            if (!item.metadata)
                return true; // no metadata record at all
            const raw = item.metadata.rawJson;
            // Already completed with high-accuracy strict-AI scans -> safe skip!
            if (raw && raw.strictAIActive === true)
                return false;
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
                    }
                    catch (err) {
                        console.error(`[Backfill] 🛑 Error correcting legacy ID ${item.id}:`, err.message);
                        galleryService.backfillState.failed++;
                    }
                }
            }
            finally {
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
    async processGalleryImage(imageId, isForceScan = false, isForceMeta = false) {
        // Channel through concurrent-safe, in-memory task queue
        await imageQueue.enqueue(imageId, isForceScan, isForceMeta);
        return getGalleryItemResponseById(imageId);
    },
    async processGalleryImageDirect(imageId, isForceScan = false, isForceMeta = false) {
        console.log(`[PROCESS] started ${imageId} (forceScan=${isForceScan}, forceMeta=${isForceMeta})`);
        const item = await galleryRepository_1.default.findById(imageId);
        if (!item) {
            console.warn(`[PROCESS] Image ${imageId} not found in repository.`);
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
        // 1. Update initial statuses immediately before picking up work (Requirement 2)
        const initialUpdate = {};
        if (runScan)
            initialUpdate.scanStatus = 'processing';
        if (runMeta)
            initialUpdate.metadataStatus = 'processing';
        await galleryRepository_1.default.updateById(imageId, initialUpdate);
        console.log(`[DB] updated statuses to processing for imageId ${imageId}`);
        let scanError = null;
        let metaError = null;
        // 2. Face Recognition (Requirement 3)
        if (runScan) {
            try {
                await this.scanAndRecognizeImage(imageId);
                console.log(`[FACE] completed ${imageId}`);
                await galleryRepository_1.default.updateById(imageId, { scanStatus: 'completed' });
            }
            catch (err) {
                scanError = err?.message || 'Face scan failed';
                console.error(`[FACE] failed ${imageId}:`, scanError);
                await galleryRepository_1.default.updateById(imageId, { scanStatus: 'failed' });
            }
        }
        else {
            console.log(`[FACE] skipped ${imageId} (already completed)`);
        }
        // 3. Metadata extraction (Requirement 4)
        if (runMeta) {
            try {
                await this.generateMetadataForImage(imageId, isForceMeta);
                console.log(`[META] completed ${imageId}`);
                await galleryRepository_1.default.updateById(imageId, { metadataStatus: 'completed' });
            }
            catch (err) {
                metaError = err?.message || 'Metadata extraction failed';
                console.error(`[META] failed ${imageId}:`, metaError);
                await galleryRepository_1.default.updateById(imageId, { metadataStatus: 'failed' });
            }
        }
        else {
            console.log(`[META] skipped ${imageId} (already completed)`);
        }
        // 4. Explicit error preservation in DB
        if (scanError || metaError) {
            try {
                const freshItem = await galleryRepository_1.default.findById(imageId);
                const currentRaw = freshItem?.metadata?.rawJson || {};
                const errorMeta = {
                    ...currentRaw,
                    ...(scanError ? { lastScanError: scanError } : {}),
                    ...(metaError ? { lastMetaError: metaError } : {}),
                };
                await galleryRepository_1.default.updateById(imageId, { metadata: errorMeta });
            }
            catch (e) {
                console.error(`[DB] Failed saving error info for ${imageId}:`, e.message);
            }
        }
        console.log(`[DB] updated statuses imageId ${imageId}`);
    },
    async generateMetadataForImage(imageId, forceRegenerateAI = false) {
        const item = await galleryRepository_1.default.findById(imageId);
        if (!item || !item.url) {
            throw new Error(`Image ${imageId} not found or has no URL`);
        }
        if (item.isProfile) {
            console.log(`[METADATA] Skipping profile item ${imageId}`);
            return null;
        }
        const existingMeta = item.metadata;
        // Check if rawJson inside ImageMetadata already has objects/scenes generated
        const rawJsonMeta = existingMeta?.rawJson;
        const isPopulated = existingMeta && ((Array.isArray(rawJsonMeta?.objects) && rawJsonMeta.objects.length > 0) ||
            (Array.isArray(existingMeta.objects) && existingMeta.objects.length > 0) ||
            rawJsonMeta?.metadataGenerated === true);
        if (isPopulated && !forceRegenerateAI) {
            console.log(`[METADATA] Image ${imageId} already has metadata — skipping.`);
            return existingMeta;
        }
        const filePath = path.join(constants_1.UPLOADS_DIR, item.url.split('/').pop() || '');
        if (!fs.existsSync(filePath)) {
            throw new Error(`Image file not found on disk for ID ${imageId}: ${filePath}`);
        }
        console.log(`[METADATA] Extracting metadata for image ${imageId}...`);
        // This will throw if AI service is unreachable — caught by processGalleryImage
        const aiMetadata = await faceAi_1.default.extractMetadata(filePath);
        const rawObjects = aiMetadata.objects || [];
        const rawScenes = aiMetadata.scenes || [];
        const rawOcr = aiMetadata.ocrText || [];
        console.log(`[METADATA] Image ${imageId}: objects=${rawObjects.length} scenes=${rawScenes.length} ocr=${rawOcr.length}`);
        const currentRaw = existingMeta ? (existingMeta.rawJson || {}) : {};
        // Preserve manual hashtags across regenerations
        const manualTags = Array.isArray(currentRaw.manualHashtags)
            ? currentRaw.manualHashtags
            : (Array.isArray(item.hashtags) ? item.hashtags.map((h) => h.name) : []);
        // When force regenerating, discard stale AI results; otherwise merge
        const prevObjects = forceRegenerateAI ? [] : (Array.isArray(existingMeta?.objects) ? existingMeta.objects : []);
        const prevScenes = forceRegenerateAI ? [] : (Array.isArray(existingMeta?.scenes) ? existingMeta.scenes : []);
        const prevOcr = forceRegenerateAI ? [] : (Array.isArray(existingMeta?.ocrText) ? existingMeta.ocrText : []);
        const cleaned = (0, hashtagUtils_1.cleanupAIPayload)({}, [...prevObjects, ...rawObjects], [...prevScenes, ...rawScenes], [...prevOcr, ...rawOcr]);
        const combinedHashtags = Array.from(new Set([...manualTags, ...cleaned.autoHashtags]));
        // ── Deep Folksomonic Enrichment Fallback (Requirement 2, 3 & 5) ─────────
        const currentPersonCount = aiMetadata.metadata?.person_count ?? rawObjects.filter((o) => (o?.name || o) === 'person').length;
        const fallbacks = (0, hashtagUtils_1.enrichMetadataWithHashtagFallbacks)(combinedHashtags, cleaned.cleanObjects, cleaned.cleanScenes, currentPersonCount, cleaned.caption || '');
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
        await galleryRepository_1.default.updateById(imageId, {
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
    async generateMetadata(imageId) {
        return this.generateMetadataForImage(imageId, false);
    },
    async scanAndRecognizeImage(imageId) {
        const item = await galleryRepository_1.default.findById(imageId);
        if (!item || !item.url)
            return;
        const filename = item.url.split('/').pop() || '';
        const filePath = path.join(constants_1.UPLOADS_DIR, filename);
        console.log(`[UPLOAD] imageId: ${imageId} sourceType: normal`);
        console.log(`[SCAN] verifying file exists at ${filePath}...`);
        if (!fs.existsSync(filePath)) {
            console.error(`[SCAN] file not found for ID ${imageId}`);
            return;
        }
        let width = 0, height = 0;
        try {
            const meta = await (0, sharp_1.default)(filePath).metadata();
            width = meta.width || 0;
            height = meta.height || 0;
        }
        catch (err) { }
        console.log(`[UPLOAD] imageId: ${imageId} original dimensions: ${width}x${height}`);
        const currentPath = await pickScanPathAndOptimize(filePath).catch(() => filePath);
        console.log(`[SCAN] scan image path: ${currentPath}`);
        let faceDescriptors = { status: 'failed', reason: 'Pending' };
        let recognizedUserIds = [];
        try {
            const data = await faceAi_1.default.detectFaces(currentPath);
            const detections = data.faces || [];
            console.log(`[SCAN] imageId: ${imageId} face count: ${detections.length}`);
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
            const existingFaceDescs = Array.isArray(item.faceDescriptors) ? item.faceDescriptors : [];
            const finalMergedFaceDescriptors = [];
            const finalUserIdsSet = new Set();
            console.log(`[SCAN-AUDIT] Start Match Process for ID ${imageId}. Detected Count: ${detections.length}. Previous Known Count: ${existingFaceDescs.length}`);
            // ITERATE AND RESOLVE EACH DETECTED FACE TO GUARANTEE SPATIAL CONSISTENCY
            const matchedPrevFaceIndices = new Set();
            detections.forEach((det, index) => {
                let bestPrevFace = null;
                let maxOverlap = 0;
                let bestPrevIndex = -1;
                // 1. Find best spatial match in previous history using intersection over union calculations
                existingFaceDescs.forEach((prevFace, pIdx) => {
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
                let autoUserId = null;
                let autoConfidence = 0;
                let bestMatchDetails = 'No usable embeddings';
                if (labeledDescriptors.length > 0) {
                    const match = faceAi_1.default.findBestMatchWithMargin(det.descriptor, labeledDescriptors);
                    autoConfidence = match.confidence ? match.confidence / 100 : 0;
                    if (match.label !== 'unknown') {
                        autoUserId = parseUserId(match.label);
                        const userNode = parseUserFromLabel(match.label);
                        bestMatchDetails = `${userNode?.name || 'User'} (${(autoConfidence * 100).toFixed(1)}% confidence)`;
                    }
                    else {
                        bestMatchDetails = `Unknown (Max confidence: ${(autoConfidence * 100).toFixed(1)}%)`;
                    }
                }
                console.log(`   [Face Index ${index}] Match attempt: ${bestMatchDetails}. Final CandidateID=${autoUserId}. ThreshMin=0.5`);
                // 3. Apply Absolute Source Priority Hierarchy:
                // Priority: manual_tag > auto_scan > preserved_existing
                let finalAssignedUserId = null;
                let finalStatus = 'unknown';
                let finalSource = 'auto_scan';
                if (bestPrevFace && bestPrevFace.manuallyTaggedUserId != null) {
                    // RULE: Manual tags supersede ALL automated findings permanently.
                    finalAssignedUserId = Number(bestPrevFace.manuallyTaggedUserId);
                    finalStatus = 'recognized';
                    finalSource = 'manual_tag';
                    console.log(`   -> Face Index ${index}: Preserved active manual tag (User ${finalAssignedUserId}) blocking automated drift.`);
                }
                else if (autoUserId !== null && autoConfidence >= 0.5) {
                    // RULE: Confident New Scans replace older weaker preserves
                    finalAssignedUserId = autoUserId;
                    finalStatus = 'recognized';
                    finalSource = 'auto_scan';
                    console.log(`   -> Face Index ${index}: Confident New Identification (User ${autoUserId}, conf=${autoConfidence.toFixed(2)}) implemented.`);
                }
                else if (bestPrevFace && (bestPrevFace.personId != null || bestPrevFace.userId != null)) {
                    // RULE: Fallback to existing preserved state only if correlation score passes overlap thresholds.
                    const prevId = Number(bestPrevFace.personId || bestPrevFace.userId);
                    if (!isNaN(prevId)) {
                        finalAssignedUserId = prevId;
                        finalStatus = 'recognized';
                        finalSource = 'preserved_existing';
                        console.log(`   -> Face Index ${index}: Reverting to historical spatial intersection capture (User ${finalAssignedUserId}).`);
                    }
                }
                else if (autoUserId !== null && autoConfidence >= 0.3) {
                    // 🔍 RULE: "Save possible_match if borderline" - Low Conf fallback
                    finalAssignedUserId = autoUserId;
                    finalStatus = 'possible_match';
                    finalSource = 'auto_scan_weak';
                    console.log(`   -> Face Index ${index}: Borderline candidate captured (${autoConfidence.toFixed(2)}). Saved as possible_match.`);
                }
                else {
                    finalStatus = 'unknown';
                    finalSource = 'auto_scan';
                }
                // Build the finalized high-fidelity descriptor payload
                const descriptorPackage = {
                    box: det.box,
                    descriptor: faceAi_1.default.serializeDescriptor(det.descriptor),
                    source: finalSource,
                    status: finalStatus,
                    isIgnored: bestPrevFace?.isIgnored === true,
                    confidence: autoConfidence,
                };
                // Attach unified mapping indicators
                if (finalSource === 'manual_tag') {
                    descriptorPackage.manuallyTaggedUserId = finalAssignedUserId;
                }
                else if (finalAssignedUserId !== null && !isNaN(finalAssignedUserId)) {
                    descriptorPackage.personId = finalAssignedUserId;
                }
                finalMergedFaceDescriptors.push(descriptorPackage);
                if (finalAssignedUserId !== null && !isNaN(finalAssignedUserId)) {
                    finalUserIdsSet.add(finalAssignedUserId);
                }
            });
            // 4. Strictly preserve any manual tags that weren't spatially captured by this scan (Requirement 8)
            existingFaceDescs.forEach((prevFace, pIdx) => {
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
            console.log(`[SCAN-SUCCESS] Commit State for ${imageId}: Derived Users=${JSON.stringify(finalRecognizedArray)} FacesSaved=${finalMergedFaceDescriptors.length}`);
            await galleryRepository_1.default.updateById(imageId, {
                faceDescriptors: finalMergedFaceDescriptors,
                recognizedUserIds: finalRecognizedArray,
            });
            // 5. Relational Synchro to discrete image_people table (Requirement 1)
            try {
                const users = await prisma_1.default.user.findMany({
                    where: { id: { in: finalRecognizedArray } },
                    select: { id: true, name: true }
                });
                const userNameMap = new Map(users.map(u => [u.id, u.name]));
                await prisma_1.default.imagePeople.deleteMany({
                    where: { galleryItemId: imageId }
                });
                await prisma_1.default.imagePeople.createMany({
                    data: finalMergedFaceDescriptors.map((face) => {
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
            }
            catch (relErr) {
                console.error(`[DB SAVE] relational mapping skipped for image_people:`, relErr.message);
            }
            console.log(`[SCAN] imageId: ${imageId} finalized persistence complete.`);
        }
        catch (err) {
            console.error(`[SCAN] AI failure for imageId ${imageId}:`, err.message);
            throw err; // Re-throw so processGalleryImage can record the failure
        }
    },
    async syncWithFileSystem() {
        console.log('[System] 📂 Starting File System Sync...');
        if (!fs.existsSync(constants_1.UPLOADS_DIR))
            fs.mkdirSync(constants_1.UPLOADS_DIR, { recursive: true });
        const files = fs.readdirSync(constants_1.UPLOADS_DIR)
            .filter(f => /\.(jpg|jpeg|png|webp|jfif|jpg)$/i.test(f));
        const existing = await prisma_1.default.galleryItem.findMany({ select: { url: true } });
        const existingFilenames = new Set(existing.map(e => e.url.split('/').pop()));
        const missing = files.filter(f => !existingFilenames.has(f));
        if (missing.length === 0) {
            console.log('[System] 📂 File system is in sync.');
            return { count: 0 };
        }
        console.log(`[System] 📂 Found ${missing.length} missing files. Importing...`);
        const newItems = await Promise.all(missing.map(async (filename) => {
            const url = (0, urlUtils_1.buildUploadUrl)(filename);
            return galleryRepository_1.default.createOne({
                url,
                uploadedAt: new Date(),
                recognizedUserIds: [],
            });
        }));
        console.log(`[System] 📂 Successfully imported ${newItems.length} photos.`);
        return { count: newItems.length };
    },
    async initializeQueue() {
        console.log('[System] ⚡ Booting ImageTaskQueue recovery & startup protocol...');
        try {
            // 1. Recovery: Reset stuck 'processing' items back to 'pending' (Requirement 7)
            const stuckItems = await prisma_1.default.galleryItem.findMany({
                where: {
                    OR: [
                        { scanStatus: 'processing' },
                        { metadataStatus: 'processing' }
                    ]
                },
                include: { metadata: true }
            });
            if (stuckItems.length > 0) {
                console.log(`[System] 🛠️ Found ${stuckItems.length} stuck processing items. Resetting to pending...`);
                for (const item of stuckItems) {
                    const currentRaw = item?.metadata?.rawJson || {};
                    const cleanedMeta = { ...currentRaw };
                    delete cleanedMeta.lastScanError;
                    delete cleanedMeta.lastMetaError;
                    await galleryRepository_1.default.updateById(item.id, {
                        scanStatus: item.scanStatus === 'processing' ? 'pending' : item.scanStatus,
                        metadataStatus: item.metadataStatus === 'processing' ? 'pending' : item.metadataStatus,
                        metadata: cleanedMeta
                    });
                }
                console.log('[System] 🛠️ Stuck items successfully recovered.');
            }
            // 2. Startup: Automatically load ALL pending items into the job queue
            const pendingItems = await prisma_1.default.galleryItem.findMany({
                where: {
                    AND: [
                        { isProfile: false },
                        {
                            OR: [
                                { scanStatus: 'pending' },
                                { metadataStatus: 'pending' }
                            ]
                        }
                    ]
                },
                select: { id: true }
            });
            if (pendingItems.length > 0) {
                console.log(`[System] ⚡ Enqueueing ${pendingItems.length} pending images for background processing...`);
                for (const item of pendingItems) {
                    // Pushes to queue instantly and triggers non-blocking concurrency manager
                    imageQueue.enqueue(item.id).catch(() => { });
                }
                console.log(`[System] 🚀 Enqueued ${pendingItems.length} items to the in-memory queue.`);
            }
            else {
                console.log('[System] ✨ All gallery images are fully resolved. Queue idle.');
            }
        }
        catch (err) {
            console.error('[System] 🛑 Gallery Queue Startup failed:', err.message);
        }
    }
};
exports.galleryService = galleryService;
exports.default = galleryService;
function calculateBoxArea(b) {
    if (!b)
        return 0;
    return Math.max(0, b._width || 0) * Math.max(0, b._height || 0);
}
function calculateIoU(a, b) {
    if (!a || !b)
        return 0;
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
    if (inter <= 0)
        return 0;
    const areaA = calculateBoxArea({ _width: aw, _height: ah });
    const areaB = calculateBoxArea({ _width: bw, _height: bh });
    return inter / (areaA + areaB - inter);
}
//# sourceMappingURL=galleryService.js.map