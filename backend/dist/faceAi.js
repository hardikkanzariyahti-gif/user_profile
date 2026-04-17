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
const path = __importStar(require("path"));
const faceapi = __importStar(require("@vladmandic/face-api"));
const canvas = __importStar(require("canvas"));
const { Canvas, Image, ImageData } = canvas;
faceapi.env.monkeyPatch({ Canvas: Canvas, Image: Image, ImageData: ImageData });
async function initializeFaceAPI() {
    // statically patched at top-level
}
const MODEL_PATH = path.join(__dirname, 'models');
// Matching threshold: distance below this = confident match.
// 0.55 is the standard face-api default. Higher = more permissive (more matches).
// 0.60 is good for real-world photos with slight angle/lighting variations.
const MATCH_THRESHOLD = 0.60;
let isLoaded = false;
/**
 * Load the image and resize it so the longest edge is at most `maxEdge` px.
 * Using 1600px so group photos are processed at high enough resolution that
 * smaller background faces are also detectable by the model.
 */
async function getResizedCanvas(imagePath, maxEdge = 1600) {
    try {
        const img = await canvas.loadImage(imagePath);
        let { width, height } = img;
        if (width > maxEdge || height > maxEdge) {
            const scale = maxEdge / Math.max(width, height);
            width = Math.round(width * scale);
            height = Math.round(height * scale);
        }
        const c = canvas.createCanvas(width, height);
        c.getContext('2d').drawImage(img, 0, 0, width, height);
        return c;
    }
    catch (err) {
        console.error('Error loading image for AI:', err);
        return null;
    }
}
function computeIoU(box1, box2) {
    const x1 = Math.max(box1.x, box2.x);
    const y1 = Math.max(box1.y, box2.y);
    const x2 = Math.min(box1.x + box1.width, box2.x + box2.width);
    const y2 = Math.min(box1.y + box1.height, box2.y + box2.height);
    const w = Math.max(0, x2 - x1);
    const h = Math.max(0, y2 - y1);
    const intersection = w * h;
    const area1 = box1.width * box1.height;
    const area2 = box2.width * box2.height;
    return intersection / (area1 + area2 - intersection);
}
async function loadModels() {
    if (isLoaded)
        return;
    try {
        await initializeFaceAPI();
        await faceapi.nets.ssdMobilenetv1.loadFromDisk(MODEL_PATH);
        await faceapi.nets.faceLandmark68Net.loadFromDisk(MODEL_PATH);
        await faceapi.nets.faceRecognitionNet.loadFromDisk(MODEL_PATH);
        await faceapi.nets.tinyFaceDetector.loadFromDisk(MODEL_PATH);
        isLoaded = true;
        console.log('Smart Systems loaded successfully 🚀');
    }
    catch (err) {
        console.error('Error loading smart systems:', err);
    }
}
function euclideanDistance(d1, d2) {
    let sum = 0;
    for (let i = 0; i < d1.length; i++) {
        const diff = d1[i] - d2[i];
        sum += diff * diff;
    }
    return Math.sqrt(sum);
}
function serializeDescriptor(descriptor) {
    return Array.from(descriptor);
}
function deserializeDescriptor(data) {
    if (!Array.isArray(data))
        return null;
    return new Float32Array(data);
}
/**
 * Match a single face descriptor against all known users.
 *
 * KEY FIX: The old ambiguity margin of 0.01 was killing recognition.
 * Example: Rahul distance=0.42, Hardik distance=0.44 → margin=0.02 → BOTH dropped.
 * New rule: Only return unknown if margin < 0.02 AND the best distance is borderline (> 0.50).
 * If the best match is very confident (< 0.45), we always trust it regardless of margin.
 */
function findBestMatchWithMargin(descriptor, knownUsers) {
    const allMatches = [];
    for (const labeledDescriptors of knownUsers) {
        let minDistance = Infinity;
        for (const reference of labeledDescriptors.descriptors) {
            const d = euclideanDistance(descriptor, reference);
            if (d < minDistance)
                minDistance = d;
        }
        if (minDistance !== Infinity) {
            allMatches.push({ label: labeledDescriptors.label, distance: minDistance });
        }
    }
    const sorted = allMatches.sort((a, b) => a.distance - b.distance);
    if (sorted.length === 0) {
        return { label: 'unknown', distance: null };
    }
    const best = sorted[0];
    // Hard threshold — if best match is too far away, return unknown
    if (best.distance > MATCH_THRESHOLD) {
        console.log(`[AI] ❌ No match. Best=${best.label} dist=${best.distance?.toFixed(3)} > threshold=${MATCH_THRESHOLD}`);
        return { label: 'unknown', distance: best.distance };
    }
    // Ambiguity check — only reject if:
    //   1. Two users are extremely close in distance (margin < 0.02), AND
    //   2. The best distance is not confidently low (i.e., > 0.48)
    // This prevents dropping Rahul when Hardik is slightly closer but both are valid.
    if (sorted.length > 1) {
        const margin = sorted[1].distance - best.distance;
        const AMBIGUITY_MARGIN = 0.02;
        const CONFIDENT_THRESHOLD = 0.48; // below this distance = very confident, skip ambiguity check
        if (margin < AMBIGUITY_MARGIN && best.distance > CONFIDENT_THRESHOLD) {
            console.log(`[AI] ⚠️  Ambiguous: ${best.label}(${best.distance?.toFixed(3)}) vs ${sorted[1].label}(${sorted[1].distance?.toFixed(3)}), margin=${margin.toFixed(3)} — returning unknown`);
            return { label: 'unknown', distance: best.distance };
        }
    }
    console.log(`[AI] ✅ Match → ${best.label} dist=${best.distance?.toFixed(3)}`);
    return best;
}
/**
 * Get the single best face descriptor from an image (used for profile pictures).
 * Picks the largest/most prominent face.
 */
async function getFaceDescriptor(imagePath) {
    await loadModels();
    try {
        const img = await getResizedCanvas(imagePath);
        if (!img)
            return null;
        // Try SSD first
        let detections = await faceapi
            .detectAllFaces(img, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.30 }))
            .withFaceLandmarks()
            .withFaceDescriptors();
        // Tiny fallback for side/small faces
        if (!detections || detections.length === 0) {
            detections = await faceapi
                .detectAllFaces(img, new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.20 }))
                .withFaceLandmarks()
                .withFaceDescriptors();
        }
        if (!detections || detections.length === 0)
            return null;
        // Pick the most prominent face (largest area × confidence score)
        const best = detections.reduce((prev, cur) => {
            const score = cur.detection.score || 0;
            const area = cur.detection.box.width * cur.detection.box.height;
            const q = score * Math.sqrt(area);
            return (!prev || q > prev.q) ? { det: cur, q } : prev;
        }, null);
        return best.det.descriptor;
    }
    catch (err) {
        console.error('getFaceDescriptor error:', err);
        return null;
    }
}
async function identifyFace(targetImagePath, knownUsers) {
    const descriptor = await getFaceDescriptor(targetImagePath);
    if (!descriptor)
        return null;
    const best = findBestMatchWithMargin(descriptor, knownUsers);
    return best.label === 'unknown' ? null : best;
}
/**
 * Detect & identify ALL faces in an image (used for Identity Check feature).
 */
async function identifyAllFaces(targetImagePath, knownUsers) {
    await loadModels();
    try {
        const img = await getResizedCanvas(targetImagePath);
        if (!img)
            return [];
        const [ssd, tiny] = await Promise.all([
            faceapi.detectAllFaces(img, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.20 }))
                .withFaceLandmarks()
                .withFaceDescriptors(),
            faceapi.detectAllFaces(img, new faceapi.TinyFaceDetectorOptions({ inputSize: 832, scoreThreshold: 0.15 }))
                .withFaceLandmarks()
                .withFaceDescriptors(),
        ]);
        // Merge, deduplicating by IoU overlap
        const all = [...ssd];
        for (const t of tiny) {
            if (!all.some(s => computeIoU(t.detection.box, s.detection.box) > 0.40)) {
                all.push(t);
            }
        }
        return all.map((d) => {
            const match = findBestMatchWithMargin(d.descriptor, knownUsers);
            return {
                label: match.label,
                distance: match.distance != null ? Number(match.distance.toFixed(4)) : null,
                box: d.detection.box,
            };
        });
    }
    catch (err) {
        console.error('identifyAllFaces error:', err);
        return [];
    }
}
async function getAllDescriptors(imagePath) {
    await loadModels();
    try {
        const img = await getResizedCanvas(imagePath);
        if (!img)
            return [];
        const [ssd, tiny] = await Promise.all([
            faceapi.detectAllFaces(img, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.30 }))
                .withFaceLandmarks()
                .withFaceDescriptors(),
            faceapi.detectAllFaces(img, new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.25 }))
                .withFaceLandmarks()
                .withFaceDescriptors(),
        ]);
        const all = [...ssd];
        for (const t of tiny) {
            if (!all.some(s => computeIoU(t.detection.box, s.detection.box) > 0.40))
                all.push(t);
        }
        return all.map(d => d.descriptor);
    }
    catch (err) {
        return [];
    }
}
/**
 * Detect ALL faces in an image and return their descriptors + bounding boxes.
 * Core function for gallery scanning.
 *
 * Strategy:
 *  Pass 1 — SSD at minConfidence 0.20 (catches clear, prominent faces fast)
 *  Pass 2 — TinyFace inputSize 416 (catches medium/side faces SSD may miss)
 *  Pass 3 — TinyFace inputSize 608 ONLY if pass 1+2 together found < 2 faces
 *            (expensive, only worth it for group photos where we expect more)
 *
 * All results are merged with IoU deduplication.
 */
async function detectFaces(imagePath) {
    await loadModels();
    try {
        const img = await getResizedCanvas(imagePath);
        if (!img)
            return [];
        // Pass 1 + Pass 2 run in parallel (both are relatively fast)
        const [ssd, tiny416] = await Promise.all([
            faceapi.detectAllFaces(img, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.20 }))
                .withFaceLandmarks()
                .withFaceDescriptors(),
            faceapi.detectAllFaces(img, new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.20 }))
                .withFaceLandmarks()
                .withFaceDescriptors(),
        ]);
        // Merge pass 1 + 2, dedup by IoU
        const merged = [...ssd];
        for (const t of tiny416) {
            if (!merged.some(s => computeIoU(t.detection.box, s.detection.box) > 0.40)) {
                merged.push(t);
            }
        }
        // Pass 3 — expensive, only run if we found < 2 faces (could be group photo where small faces were missed)
        if (merged.length < 2) {
            const tiny608 = await faceapi
                .detectAllFaces(img, new faceapi.TinyFaceDetectorOptions({ inputSize: 608, scoreThreshold: 0.15 }))
                .withFaceLandmarks()
                .withFaceDescriptors();
            for (const t of tiny608) {
                if (!merged.some(s => computeIoU(t.detection.box, s.detection.box) > 0.40)) {
                    merged.push(t);
                }
            }
        }
        const filename = imagePath.split(/[/\\]/).pop();
        console.log(`[detectFaces] ${filename}: SSD=${ssd.length} T416=${tiny416.length} → total=${merged.length} face(s)`);
        return merged.map(d => ({
            descriptor: d.descriptor,
            box: d.detection.box,
        }));
    }
    catch (err) {
        console.error('detectFaces error:', err);
        return [];
    }
}
exports.default = {
    getFaceDescriptor,
    identifyFace,
    identifyAllFaces,
    getAllDescriptors,
    detectFaces,
    serializeDescriptor,
    deserializeDescriptor,
    findBestMatchWithMargin,
    loadModels,
    MATCH_THRESHOLD,
    euclideanDistance,
};
//# sourceMappingURL=faceAi.js.map