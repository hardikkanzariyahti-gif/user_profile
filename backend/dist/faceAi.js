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
Object.defineProperty(exports, "__esModule", { value: true });
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const canvas = __importStar(require("canvas"));
const faceapi = __importStar(require("@vladmandic/face-api"));
const { Canvas, Image, ImageData } = canvas;
faceapi.env.monkeyPatch({ Canvas, Image, ImageData });
const MODEL_PATH = path.join(process.cwd(), 'models');
// Cosine distance threshold (0 = perfect match, higher = worse match).
// If your descriptors are L2-normalized (we do this), cosine similarity is dot-product,
// and cosine distance = 1 - cosineSimilarity.
const MATCH_THRESHOLD = numberFromEnv('FACE_MATCH_THRESHOLD', 0.18);
const AMBIGUITY_MARGIN = numberFromEnv('FACE_AMBIGUITY_MARGIN', 0.035);
const CONFIDENT_DISTANCE = numberFromEnv('FACE_CONFIDENT_DISTANCE', 0.14);
const GROUP_MIN_FACE_SIZE = numberFromEnv('FACE_MIN_SIZE_PX', 10);
const ROBUST_TOP_K = Math.max(1, Math.floor(numberFromEnv('FACE_ROBUST_TOP_K', 3)));
let isLoaded = false;
let hasSsdFallback = false;
function numberFromEnv(key, fallback) {
    const raw = process.env[key];
    if (!raw)
        return fallback;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : fallback;
}
async function loadModels() {
    if (isLoaded)
        return;
    await faceapi.nets.tinyFaceDetector.loadFromDisk(MODEL_PATH);
    await faceapi.nets.faceLandmark68TinyNet.loadFromDisk(MODEL_PATH);
    await faceapi.nets.faceRecognitionNet.loadFromDisk(MODEL_PATH);
    const ssdManifest = path.join(MODEL_PATH, 'ssd_mobilenetv1_model-weights_manifest.json');
    hasSsdFallback = fs.existsSync(ssdManifest);
    if (hasSsdFallback) {
        await faceapi.nets.ssdMobilenetv1.loadFromDisk(MODEL_PATH);
    }
    isLoaded = true;
    console.log(`[Face API] tinyFaceDetector + landmark68Tiny + recognition loaded${hasSsdFallback ? ' (+ssd fallback)' : ''}`);
}
function euclideanDistance(d1, d2) {
    let sum = 0;
    for (let i = 0; i < d1.length; i++) {
        const diff = d1[i] - d2[i];
        sum += diff * diff;
    }
    return Math.sqrt(sum);
}
function dotProduct(d1, d2) {
    let sum = 0;
    for (let i = 0; i < d1.length; i++)
        sum += d1[i] * d2[i];
    return sum;
}
function cosineDistance(d1, d2) {
    // With L2-normalized descriptors: cosineSimilarity = dot(d1,d2)
    const cosSimRaw = dotProduct(d1, d2);
    const cosSim = Math.max(-1, Math.min(1, cosSimRaw));
    return 1 - cosSim;
}
function l2Normalize(d) {
    let norm = 0;
    for (let i = 0; i < d.length; i++)
        norm += d[i] * d[i];
    norm = Math.sqrt(norm);
    if (!norm)
        return d;
    const out = new Float32Array(d.length);
    for (let i = 0; i < d.length; i++)
        out[i] = d[i] / norm;
    return out;
}
function serializeDescriptor(descriptor) {
    return Array.from(descriptor);
}
function deserializeDescriptor(data) {
    if (!Array.isArray(data))
        return null;
    return l2Normalize(new Float32Array(data));
}
function parseUserId(label) {
    try {
        return Number(JSON.parse(label).id);
    }
    catch {
        return null;
    }
}
function findBestMatchWithMargin(descriptor, knownUsers, isForcedRescan = false) {
    const isLocalFaceApi = descriptor.length === 128;
    const FACE_MATCH_THRESHOLD = isLocalFaceApi ? 0.90 : Number(process.env.FACE_MATCH_THRESHOLD || 0.58);
    const FACE_AUTO_TAG_THRESHOLD = isForcedRescan
        ? FACE_MATCH_THRESHOLD
        : (isLocalFaceApi ? 0.94 : Number(process.env.FACE_AUTO_TAG_THRESHOLD || 0.68));
    const matches = [];
    for (const user of knownUsers) {
        let maxSimilarity = -1;
        let minDistance = 2;
        for (const ref of user.descriptors || []) {
            const arr = new Float32Array(ref);
            if (arr.length !== descriptor.length)
                continue;
            const dist = cosineDistance(descriptor, arr);
            const sim = 1 - dist;
            if (sim > maxSimilarity) {
                maxSimilarity = sim;
                minDistance = dist;
            }
        }
        if (maxSimilarity === -1)
            continue;
        matches.push({ label: user.label, similarity: maxSimilarity, distance: minDistance });
    }
    matches.sort((a, b) => b.similarity - a.similarity);
    const best = matches[0];
    const second = matches[1];
    if (!best) {
        return { label: 'unknown', distance: null, reason: 'no_candidates', confidence: 0 };
    }
    const margin = second ? best.similarity - second.similarity : null;
    const bestSimilarity = best.similarity;
    const faceId = `face_${Math.round(Math.abs(descriptor[0] * 100000))}`;
    let decision = 'UNKNOWN';
    let finalLabel = 'unknown';
    let reason = 'threshold';
    const marginThreshold = isLocalFaceApi ? 0.04 : Number(process.env.FACE_MARGIN_THRESHOLD || 0.04);
    if (bestSimilarity >= FACE_AUTO_TAG_THRESHOLD) {
        if (margin !== null && margin < marginThreshold) {
            decision = bestSimilarity >= FACE_MATCH_THRESHOLD ? 'POSSIBLE_MATCH' : 'UNKNOWN';
            finalLabel = 'unknown';
            reason = 'ambiguous';
        }
        else {
            decision = 'AUTO_TAG';
            finalLabel = best.label;
            reason = 'matched';
        }
    }
    else if (bestSimilarity >= FACE_MATCH_THRESHOLD) {
        decision = 'POSSIBLE_MATCH';
        finalLabel = 'unknown';
        reason = margin !== null && margin < marginThreshold ? 'ambiguous' : 'threshold';
    }
    else {
        decision = 'UNKNOWN';
        finalLabel = 'unknown';
        reason = 'threshold';
    }
    const bestUserLabel = best ? best.label : 'none';
    const secondUserLabel = second ? second.label : 'none';
    console.log(`[Face Recognition] 🔍 faceId: ${faceId}, bestUser: ${bestUserLabel}, secondUser: ${secondUserLabel}, similarity: ${bestSimilarity.toFixed(4)}, margin: ${margin !== null ? margin.toFixed(4) : 'none'}, threshold: ${FACE_AUTO_TAG_THRESHOLD}, decision: ${decision}`);
    return {
        label: finalLabel,
        distance: best.distance,
        secondCandidate: second?.label,
        secondDistance: second?.distance ?? null,
        margin,
        reason: reason,
        confidence: Math.round(bestSimilarity * 100),
    };
}
async function loadImageCanvas(imagePath) {
    await loadModels();
    return canvas.loadImage(imagePath);
}
function buildMetadata(img, count) {
    const width = img.width || 0;
    const height = img.height || 0;
    return {
        person_count: count,
        aspect_ratio: height ? Number((width / height).toFixed(2)) : 1,
        orientation: width > height ? 'landscape' : 'portrait',
    };
}
function boxArea(b) {
    return Math.max(0, b._width) * Math.max(0, b._height);
}
function iou(a, b) {
    const ax2 = a._x + a._width;
    const ay2 = a._y + a._height;
    const bx2 = b._x + b._width;
    const by2 = b._y + b._height;
    const ix1 = Math.max(a._x, b._x);
    const iy1 = Math.max(a._y, b._y);
    const ix2 = Math.min(ax2, bx2);
    const iy2 = Math.min(ay2, by2);
    const iw = Math.max(0, ix2 - ix1);
    const ih = Math.max(0, iy2 - iy1);
    const inter = iw * ih;
    if (inter <= 0)
        return 0;
    return inter / (boxArea(a) + boxArea(b) - inter);
}
function dedupeByIoU(faces, threshold = 0.4) {
    const sorted = [...faces].sort((a, b) => boxArea(b.box) - boxArea(a.box));
    const kept = [];
    for (const f of sorted) {
        if (f.box._width < GROUP_MIN_FACE_SIZE || f.box._height < GROUP_MIN_FACE_SIZE)
            continue;
        const overlaps = kept.some((k) => iou(k.box, f.box) >= threshold);
        if (!overlaps)
            kept.push(f);
    }
    return kept;
}
async function runTinyPasses(image) {
    const options = [
        new faceapi.TinyFaceDetectorOptions({ inputSize: 800, scoreThreshold: 0.35 }),
        new faceapi.TinyFaceDetectorOptions({ inputSize: 608, scoreThreshold: 0.3 }),
        new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.25 }),
        new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.2 }),
    ];
    const all = [];
    for (const opt of options) {
        const pass = await faceapi
            .detectAllFaces(image, opt)
            .withFaceLandmarks(true)
            .withFaceDescriptors();
        all.push(...pass);
    }
    return all;
}
async function runSsdFallback(image) {
    if (!hasSsdFallback)
        return [];
    return faceapi
        .detectAllFaces(image, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.2, maxResults: 150 }))
        .withFaceLandmarks(true)
        .withFaceDescriptors();
}
async function detectWithDescriptors(imagePath) {
    const fileBuffer = fs.readFileSync(imagePath);
    const blob = new Blob([fileBuffer], { type: 'image/jpeg' });
    const formData = new FormData();
    formData.append('file', blob, path.basename(imagePath));
    const baseUrl = process.env.FACE_AI_BASE_URL || 'http://localhost:8000';
    let res = null;
    const attempts = 3;
    for (let i = 0; i < attempts; i++) {
        try {
            res = await fetch(`${baseUrl}/extract_faces`, {
                method: 'POST',
                body: formData,
            });
            if (res && res.ok)
                break;
        }
        catch (err) {
            if (i === attempts - 1) {
                console.warn('[Face AI] Python AI Service failed, falling back to local face-api:', err.message);
            }
            else {
                console.log(`[Face AI] Connection to Python AI Service busy or booting, retrying in 1.5s... (Attempt ${i + 1}/${attempts})`);
                await new Promise(resolve => setTimeout(resolve, 1500));
            }
        }
    }
    if (res && res.ok) {
        try {
            const data = await res.json();
            if (data && Array.isArray(data.faces)) {
                const faces = data.faces.map((f) => ({
                    descriptor: l2Normalize(new Float32Array(f.descriptor)),
                    box: {
                        _x: Math.round(f.box._x),
                        _y: Math.round(f.box._y),
                        _width: Math.round(f.box._width),
                        _height: Math.round(f.box._height),
                    },
                }));
                return { faces, metadata: data.metadata };
            }
        }
        catch (jsonErr) {
            console.warn('[Face AI] Failed to parse Python AI response:', jsonErr.message);
        }
    }
    const image = await loadImageCanvas(imagePath);
    const imageWidth = image.width || 0;
    const imageHeight = image.height || 0;
    const imageArea = imageWidth * imageHeight;
    const tinyDetections = await runTinyPasses(image);
    // For large group photos, run SSD fallback even when tiny finds some faces.
    const shouldRunSsd = tinyDetections.length <= 6 ||
        imageArea >= 1280 * 720 ||
        (imageWidth >= 1200 || imageHeight >= 1200);
    const ssdDetections = shouldRunSsd ? await runSsdFallback(image) : [];
    const detections = [...tinyDetections, ...ssdDetections];
    const merged = detections.map((d) => ({
        descriptor: l2Normalize(new Float32Array(d.descriptor)),
        box: {
            _x: Math.round(d.detection.box.x),
            _y: Math.round(d.detection.box.y),
            _width: Math.round(d.detection.box.width),
            _height: Math.round(d.detection.box.height),
        },
    }));
    const faces = dedupeByIoU(merged, 0.4);
    return { faces, metadata: buildMetadata(image, faces.length) };
}
async function getFaceDescriptor(imagePath) {
    const data = await detectWithDescriptors(imagePath);
    if (!data.faces.length)
        return null;
    const best = data.faces.reduce((acc, cur) => cur.box._width * cur.box._height > acc.box._width * acc.box._height ? cur : acc);
    return best.descriptor;
}
async function identifyFace(targetImagePath, knownUsers) {
    const descriptor = await getFaceDescriptor(targetImagePath);
    if (!descriptor)
        return null;
    const best = findBestMatchWithMargin(descriptor, knownUsers);
    return best.label === 'unknown' ? null : best;
}
async function identifyAllFaces(targetImagePath, knownUsers) {
    const data = await detectWithDescriptors(targetImagePath);
    return data.faces.map((d) => {
        const match = findBestMatchWithMargin(d.descriptor, knownUsers);
        return {
            label: match.label,
            distance: match.distance != null ? Number(match.distance.toFixed(4)) : null,
            secondDistance: match.secondDistance != null ? Number(match.secondDistance.toFixed(4)) : null,
            margin: match.margin != null ? Number(match.margin.toFixed(4)) : null,
            reason: match.reason || null,
            confidence: match.confidence ?? 0,
            box: d.box,
        };
    });
}
async function getFaceSuggestions(targetImagePath, knownUsers) {
    const faces = await identifyAllFaces(targetImagePath, knownUsers);
    return faces.map((face) => ({
        box: face.box,
        confidence: face.confidence ?? 0,
        isConfident: (face.confidence ?? 0) >= 85 && face.label !== 'unknown',
        topSuggestion: face.label !== 'unknown' ? {
            label: face.label,
            confidence: face.confidence ?? 0,
            distance: face.distance,
        } : null,
        allSuggestions: face.label !== 'unknown' ? [{
                label: face.label,
                confidence: face.confidence ?? 0,
                distance: face.distance,
            }] : [],
        label: face.label,
        reason: face.reason ?? null,
    }));
}
async function getAllDescriptors(imagePath) {
    const data = await detectWithDescriptors(imagePath);
    return data.faces.map((f) => f.descriptor);
}
async function detectFaces(imagePath) {
    return detectWithDescriptors(imagePath);
}
async function detectFacesBatch(imagePaths) {
    return Promise.all(imagePaths.map((p) => detectWithDescriptors(p)));
}
async function extractMetadata(imagePath) {
    const fileBuffer = fs.readFileSync(imagePath);
    const blob = new Blob([fileBuffer], { type: 'image/jpeg' });
    const formData = new FormData();
    formData.append('file', blob, path.basename(imagePath));
    const baseUrl = process.env.FACE_AI_BASE_URL || 'http://localhost:8000';
    try {
        const res = await fetch(`${baseUrl}/extract_metadata`, {
            method: 'POST',
            body: formData,
        });
        if (res && res.ok) {
            return await res.json();
        }
    }
    catch (err) {
        console.warn('[AI Metadata] Failed to call Python AI metadata service:', err.message);
    }
    return { objects: [], ocrText: [], scenes: [] };
}
exports.default = {
    getFaceDescriptor,
    identifyFace,
    identifyAllFaces,
    getAllDescriptors,
    detectFaces,
    detectFacesBatch,
    extractMetadata,
    getFaceSuggestions,
    serializeDescriptor,
    deserializeDescriptor,
    findBestMatchWithMargin,
    loadModels,
    MATCH_THRESHOLD,
    euclideanDistance,
    cosineDistance,
};
//# sourceMappingURL=faceAi.js.map