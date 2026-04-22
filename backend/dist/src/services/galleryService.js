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
const faceAi_1 = __importDefault(require("../../faceAi"));
const constants_1 = require("../config/constants");
const galleryRepository_1 = __importDefault(require("../repositories/galleryRepository"));
const userRepository_1 = __importDefault(require("../repositories/userRepository"));
const serializers_1 = require("../utils/serializers");
const httpError_1 = __importDefault(require("../utils/httpError"));
const urlUtils_1 = require("../utils/urlUtils");
const hashtagUtils_1 = require("../utils/hashtagUtils");
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
    const enriched = {
        ...item,
        recognizedUsers: (Array.isArray(item.recognizedUserIds) ? item.recognizedUserIds : [])
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
    console.log('[Model Cache] 🗑️  Invalidated');
}
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
    // MISS: run AI scan
    console.log(`[Face Cache] 🐢 MISS item ${item.id} — scanning...`);
    if (!item.url)
        return [];
    const filename = item.url.split('/').pop();
    if (!filename)
        return [];
    const filePath = path.join(constants_1.UPLOADS_DIR, filename);
    if (!fs.existsSync(filePath))
        return [];
    const detections = await faceAi_1.default.detectFaces(filePath);
    // Persist result to DB (background, non-blocking)
    const serialized = detections.map(d => ({
        descriptor: faceAi_1.default.serializeDescriptor(d.descriptor),
        box: d.box,
    }));
    galleryRepository_1.default.updateById(item.id, { faceDescriptors: serialized })
        .catch(err => console.error(`[Face Cache] Failed to save for item ${item.id}:`, err));
    return detections;
}
// ─── Profile Descriptor DB Cache ─────────────────────────────────────────────
async function getProfileDescriptorWithCache(user) {
    if (user.profileDescriptor) {
        return faceAi_1.default.deserializeDescriptor(user.profileDescriptor);
    }
    if (!user.profile_picture)
        return null;
    const filename = user.profile_picture.split('/').pop();
    const filePath = path.join(constants_1.UPLOADS_DIR, filename);
    if (!fs.existsSync(filePath))
        return null;
    const descriptor = await faceAi_1.default.getFaceDescriptor(filePath);
    if (descriptor) {
        userRepository_1.default.updateById(user.id, {
            profileDescriptor: faceAi_1.default.serializeDescriptor(descriptor),
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
async function buildLabeledDescriptors(users) {
    const allGalleryItems = await galleryRepository_1.default.findAll();
    const results = await Promise.all(users.map(async (user) => {
        const descriptors = [];
        // Step 1: Profile picture ground truth
        let groundTruth = await getProfileDescriptorWithCache(user);
        // Step 2: Bootstrap from manually tagged photos (users with no profile pic)
        if (!groundTruth) {
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
        if (!descriptors.some(d => faceAi_1.default.euclideanDistance(d, groundTruth) < 0.01)) {
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
                const dist = faceAi_1.default.euclideanDistance(groundTruth, det.descriptor);
                // Professional limit for memorizing diverse profile angles (0.68)
                if (dist < bestDist && dist < 0.68) {
                    bestDist = dist;
                    best = det.descriptor;
                }
            }
            if (best && !descriptors.some(d => faceAi_1.default.euclideanDistance(d, best) < 0.01)) {
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
// ─── Gallery Service ──────────────────────────────────────────────────────────
const galleryService = {
    // ── List gallery ────────────────────────────────────────────────────────────
    // Pure DB query — NO AI calls here. Fast.
    async listGallery(userId = null) {
        const [galleryItems, allUsers] = await Promise.all([
            galleryRepository_1.default.findAll(),
            userRepository_1.default.findAllForRecognition(),
        ]);
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
        }));
        const merged = [...galleryItems, ...dynamicProfileItems];
        const seenUrls = new Set();
        const uniqueItems = [];
        for (const item of merged) {
            if (!item.url || seenUrls.has(item.url))
                continue;
            const filename = item.url.split('/').pop();
            if (!filename)
                continue;
            if (!fs.existsSync(path.join(constants_1.UPLOADS_DIR, filename)))
                continue;
            seenUrls.add(item.url);
            uniqueItems.push(item);
        }
        uniqueItems.sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());
        // Filter for personal view
        let visibleItems = uniqueItems;
        if (userId !== null && userId !== undefined) {
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
        await galleryRepository_1.default.updateById(id, { hashtags });
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
        const labeledDescriptors = await getCachedModel();
        const uploaderId = userId ? Number(userId) : null;
        const items = await Promise.all(files.map(async (file) => {
            // Detect all faces in the uploaded image
            const detections = await faceAi_1.default.detectFaces(file.path);
            const faceDescriptors = detections.map(d => ({
                descriptor: faceAi_1.default.serializeDescriptor(d.descriptor),
                box: d.box,
            }));
            // Identify each detected face
            let recognizedUserIds = [];
            if (labeledDescriptors.length > 0 && detections.length > 0) {
                recognizedUserIds = detections
                    .map(det => {
                    const match = faceAi_1.default.findBestMatchWithMargin(det.descriptor, labeledDescriptors);
                    if (match.label === 'unknown')
                        return null;
                    return parseUserId(match.label);
                })
                    .filter((id) => id !== null);
            }
            return {
                url: (0, urlUtils_1.buildUploadUrl)(file.filename),
                uploadedAt: new Date(),
                recognizedUserIds: [...new Set(recognizedUserIds)],
                userId: uploaderId,
                faceDescriptors,
            };
        }));
        await galleryRepository_1.default.createMany(items);
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
    async tagUnknownFace(galleryItemId, userId, faceIndex) {
        const [allItems, user] = await Promise.all([
            galleryRepository_1.default.findAll(),
            userRepository_1.default.findById(userId),
        ]);
        const item = allItems.find(i => i.id === galleryItemId);
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
        else if (faceIndex === undefined) {
            // Old generic tag behaviour: clear cache so next sync recomputes
            updateData.faceDescriptors = null;
        }
        await galleryRepository_1.default.updateById(galleryItemId, updateData);
        const profilePictureSet = !user.profile_picture;
        if (profilePictureSet && item.url) {
            await userRepository_1.default.updateById(userId, {
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
    async untagFace(galleryItemId, userId, faceIndex) {
        const allItems = await galleryRepository_1.default.findAll();
        const item = allItems.find(i => i.id === galleryItemId);
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
        else if (Array.isArray(item.faceDescriptors)) {
            // Global untag from the whole photo (happens when clicking X on the tag)
            // Add this user to rejected lists for ALL faces in this photo so AI doesn't re-tag them!
            const newDescriptors = [...item.faceDescriptors];
            for (const d of newDescriptors) {
                if (d) {
                    if (Number(d.manuallyTaggedUserId) === Number(userId))
                        d.manuallyTaggedUserId = null;
                    if (!d.rejectedUserIds)
                        d.rejectedUserIds = [];
                    d.rejectedUserIds.push(Number(userId));
                }
            }
            updateData.faceDescriptors = newDescriptors;
        }
        await galleryRepository_1.default.updateById(galleryItemId, updateData);
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
        let allItems = await galleryRepository_1.default.findAll();
        // Intelligent Force Rescan (~0 seconds):
        // We only wipe cached faceDescriptors for photos that previously FAILED to detect any faces.
        // Photos that already have bounding boxes skip the heavy image processing, meaning 1,000s of photos 
        // finish recalculating identities instantly instead of waiting 30+ minutes!
        if (forceRescan) {
            console.log('[AI Sync] 🚨 FORCE RESCAN — Clearing ALL face descriptor caches...');
            const toWipe = allItems.filter(i => !i.isProfile && i.url);
            await Promise.all(toWipe.map(item => galleryRepository_1.default.updateById(item.id, { faceDescriptors: null }).catch(() => { })));
            allItems = await galleryRepository_1.default.findAll();
            console.log(`[AI Sync] ✅ Cleared ${toWipe.length} descriptor(s) for fresh scanning.`);
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
        // Process in batches of 3 (balance speed vs CPU)
        const CHUNK = 3;
        for (let i = 0; i < realItems.length; i += CHUNK) {
            const chunk = realItems.slice(i, i + CHUNK);
            await Promise.all(chunk.map(async (item) => {
                // Existing tags (never removed)
                const existingIds = (Array.isArray(item.recognizedUserIds)
                    ? item.recognizedUserIds.map(id => Number(id))
                    : []).sort((a, b) => a - b);
                // Detect faces (creates new bounding boxes and Apple-Vectors, enabling Manual Tagging!)
                const detections = await detectFacesWithCache(item);
                console.log(`  Item ${item.id}: ${detections.length} face(s) detected`);
                // Skip Identification if no users
                if (labeledDescriptors.length === 0)
                    return;
                // Identify each detected face
                const aiIds = detections
                    .map((det, i) => {
                    const faceDescs = item.faceDescriptors;
                    const cachedFace = Array.isArray(faceDescs) ? faceDescs[i] : null;
                    const rejectedIds = cachedFace?.rejectedUserIds || [];
                    const match = faceAi_1.default.findBestMatchWithMargin(det.descriptor, labeledDescriptors);
                    if (match.label === 'unknown')
                        return null;
                    const id = parseUserId(match.label);
                    if (id !== null && rejectedIds.includes(id)) {
                        console.log(`    → AI returned user ${id}, but skipping because it was manually rejected!`);
                        return null;
                    }
                    if (id !== null)
                        console.log(`    → matched user ${id} (dist=${match.distance?.toFixed(3)})`);
                    return id;
                })
                    .filter((id) => id !== null);
                // Merge without removing existing tags
                const merged = [...new Set([...existingIds, ...aiIds])].sort((a, b) => a - b);
                if (!arraysEqual(merged, existingIds)) {
                    await galleryRepository_1.default.updateById(item.id, { recognizedUserIds: merged });
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
    // ── People Clustering ────────────────────────────────────────────────────────
    async getUnknownFaceClusters() {
        console.log('[Clustering] Analyzing gallery for unknown people...');
        const allItems = await galleryRepository_1.default.findAll();
        const labeledDescriptors = await getCachedModel();
        const unknownPhotos = [];
        // Build one discovery card per photo, not one card per unknown face.
        for (const item of allItems) {
            if (item.isProfile || !item.url)
                continue;
            const detections = await detectFacesWithCache(item);
            const faceDescs = Array.isArray(item.faceDescriptors) ? item.faceDescriptors : [];
            const unknownFacesInPhoto = [];
            const recognizedIds = Array.isArray(item.recognizedUserIds)
                ? item.recognizedUserIds.map((id) => Number(id))
                : [];
            for (let i = 0; i < detections.length; i++) {
                const cachedFace = faceDescs[i] || {};
                if (cachedFace.manuallyTaggedUserId || cachedFace.isIgnored)
                    continue;
                const descriptor = detections[i]?.descriptor;
                const box = detections[i]?.box || cachedFace.box;
                if (!descriptor || !box)
                    continue;
                const match = faceAi_1.default.findBestMatchWithMargin(descriptor, labeledDescriptors);
                if (match.label === 'unknown') {
                    unknownFacesInPhoto.push({
                        itemId: item.id,
                        faceIndex: i,
                        box,
                        descriptor,
                    });
                }
            }
            // Safety fallback: if this photo has no detections at all and no matched users,
            // still surface it in People so the user can review and assign it manually.
            if (unknownFacesInPhoto.length === 0 && detections.length === 0 && recognizedIds.length === 0) {
                unknownFacesInPhoto.push({
                    itemId: item.id,
                    faceIndex: -1,
                    box: null,
                });
            }
            if (unknownFacesInPhoto.length > 0) {
                unknownPhotos.push({
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
                    })),
                });
            }
        }
        const cleanedClusters = unknownPhotos
            .sort((a, b) => b.uploadedAt - a.uploadedAt)
            .map(({ uploadedAt, ...photo }) => photo);
        console.log(`[Clustering] Found ${cleanedClusters.length} photo(s) containing unknown faces.`);
        return cleanedClusters;
    },
    async mergeClusterFaces(userId, faces) {
        const allItems = await galleryRepository_1.default.findAll();
        let updateCount = 0;
        for (const face of faces) {
            const item = allItems.find(i => i.id === face.itemId);
            if (!item)
                continue;
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
        }
        invalidateModelCache();
        // Removed automatic refreshGalleryRecognition to allow user full manual control over remaining photos.
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
        for (const face of faces) {
            const item = allItems.find(i => i.id === face.itemId);
            if (!item)
                continue;
            if (Array.isArray(item.faceDescriptors)) {
                const newDescriptors = [...item.faceDescriptors];
                if (newDescriptors[face.faceIndex]) {
                    newDescriptors[face.faceIndex].isIgnored = true;
                    await galleryRepository_1.default.updateById(item.id, { faceDescriptors: newDescriptors });
                    updateCount++;
                }
            }
        }
        return { message: `Successfully ignored ${updateCount} face(s). Discovery list cleaned.`, updatedCount: updateCount };
    },
    async resetIgnoredFaces() {
        const allItems = await galleryRepository_1.default.findAll();
        let resetCount = 0;
        for (const item of allItems) {
            if (Array.isArray(item.faceDescriptors)) {
                const newDescriptors = [...item.faceDescriptors];
                let itemChanged = false;
                for (const d of newDescriptors) {
                    if (d && d.isIgnored) {
                        delete d.isIgnored;
                        itemChanged = true;
                        resetCount++;
                    }
                }
                if (itemChanged) {
                    await galleryRepository_1.default.updateById(item.id, { faceDescriptors: newDescriptors });
                }
            }
        }
        return { message: `Restored ${resetCount} faces to discovery.`, resetCount };
    },
};
exports.galleryService = galleryService;
exports.default = galleryService;
//# sourceMappingURL=galleryService.js.map