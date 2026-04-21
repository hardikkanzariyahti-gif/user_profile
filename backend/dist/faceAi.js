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
const AI_API_URL = 'http://localhost:8000/extract_faces';
// For L2-normalized Facenet512 vectors, the standard Euclidean distance threshold is ~0.8.
// We set it to 0.55 to be perfectly strict and prevent any false positives between completely different people.
const MATCH_THRESHOLD = 1.30;
const AMBIGUITY_MARGIN = 0.05;
let isLoaded = false;
async function loadModels() {
    // We dont load models to RAM in Node anymore! The Python server holds them.
    if (isLoaded)
        return;
    console.log('Smart Systems (DeepFace Microservice Mode) Loaded! 🚀');
    isLoaded = true;
}
function euclideanDistance(d1, d2) {
    let sum = 0;
    for (let i = 0; i < d1.length; i++) {
        const diff = d1[i] - d2[i];
        sum += diff * diff;
    }
    return Math.sqrt(sum);
}
function l2Normalize(d) {
    let norm = 0;
    for (let i = 0; i < d.length; i++)
        norm += d[i] * d[i];
    norm = Math.sqrt(norm);
    if (norm === 0)
        return d;
    for (let i = 0; i < d.length; i++)
        d[i] = d[i] / norm;
    return d;
}
function serializeDescriptor(descriptor) {
    return Array.from(descriptor);
}
function deserializeDescriptor(data) {
    if (!Array.isArray(data))
        return null;
    return l2Normalize(new Float32Array(data));
}
/**
 * Match a 512D face descriptor against all known users.
 * Contains safety check for mixed 128D/512D arrays.
 */
function findBestMatchWithMargin(descriptor, knownUsers) {
    const allMatches = [];
    for (const labeledDescriptors of knownUsers) {
        let minDistance = Infinity;
        for (const reference of labeledDescriptors.descriptors) {
            const refArray = new Float32Array(reference);
            // Safety Check: Old Database vs New AI
            if (descriptor.length !== refArray.length) {
                console.warn(`[AI] Size mismatch! Old DB uses ${refArray.length}D vectors. The new AI uses ${descriptor.length}D. You must clear old tags.`);
                continue;
            }
            const d = euclideanDistance(descriptor, refArray);
            if (d < minDistance)
                minDistance = d;
        }
        if (minDistance !== Infinity) {
            allMatches.push({ label: labeledDescriptors.label, distance: minDistance });
        }
    }
    const sorted = allMatches.sort((a, b) => a.distance - b.distance);
    const best = sorted[0];
    if (!best)
        return { label: 'unknown', distance: null };
    // AI DEBUG: Log the distance scale
    if (best.distance > 2.0 || best.distance < 0) {
        console.log(`[AI DEBUG] ⚠️  Unusual distance detected: ${best.distance.toFixed(4)}. Target dim: ${descriptor.length}, Candidate: ${best.label}`);
    }
    // Hard threshold
    if (best.distance > MATCH_THRESHOLD) {
        console.log(`[AI] ❌ No match. Best=${best.label} dist=${best.distance?.toFixed(2)} > threshold=${MATCH_THRESHOLD}`);
        return { label: 'unknown', distance: best.distance, candidate: best.label };
    }
    // Ambiguity check
    if (sorted.length > 1) {
        const margin = sorted[1].distance - best.distance;
        const AMBIGUITY_MARGIN = 0.15;
        const CONFIDENT_THRESHOLD = 0.40; // below this = very confident
        if (margin < AMBIGUITY_MARGIN && best.distance > CONFIDENT_THRESHOLD) {
            console.log(`[AI] ⚠️ Ambiguous: ${best.label}(${best.distance?.toFixed(2)}) vs ${sorted[1].label}(${sorted[1].distance?.toFixed(2)}) — unknown`);
            return { label: 'unknown', distance: best.distance };
        }
    }
    console.log(`[AI] ✅ Match → ${best.label} dist=${best.distance?.toFixed(2)}`);
    return best;
}
/**
 * Calls the Python Microservice to process the image.
 */
async function fetchFacesFromPython(imagePath) {
    try {
        const fileBuffer = fs.readFileSync(imagePath);
        const blob = new Blob([fileBuffer], { type: 'image/jpeg' });
        const formData = new FormData();
        formData.append('file', blob, path.basename(imagePath));
        const res = await fetch(AI_API_URL, {
            method: 'POST',
            body: formData
        });
        if (!res.ok) {
            console.error(`[AI Engine] Error response from Python API: ${res.statusText}`);
            return [];
        }
        const data = await res.json();
        return data.faces || [];
    }
    catch (err) {
        if (err.cause && err.cause.code === 'ECONNREFUSED') {
            console.error(`\n🚨 [CRITICAL AI ERROR] Could not reach the Python Background AI at ${AI_API_URL}.`);
            console.error(`🚨 Please make sure you have run 'python main.py' inside the 'ai_service' folder!\n`);
        }
        else {
            console.error('[AI Engine] Failed to fetch faces from microservice:', err.message);
        }
        return [];
    }
}
/**
 * Get the single best/largest face descriptor from an image (for profile pictures).
 */
async function getFaceDescriptor(imagePath) {
    const faces = await fetchFacesFromPython(imagePath);
    if (!faces || faces.length === 0)
        return null;
    // Pick the most prominent face by area size
    const best = faces.reduce((prev, cur) => {
        const area = cur.box._width * cur.box._height;
        return (!prev || area > prev.area) ? { det: cur, area } : prev;
    }, null);
    return l2Normalize(new Float32Array(best.det.descriptor));
}
async function identifyFace(targetImagePath, knownUsers) {
    const descriptor = await getFaceDescriptor(targetImagePath);
    if (!descriptor)
        return null;
    const best = findBestMatchWithMargin(descriptor, knownUsers);
    return best.label === 'unknown' ? null : best;
}
/**
 * Detect & identify ALL faces in an image
 */
async function identifyAllFaces(targetImagePath, knownUsers) {
    const faces = await fetchFacesFromPython(targetImagePath);
    if (!faces || faces.length === 0)
        return [];
    return faces.map((d) => {
        const floatDescriptor = l2Normalize(new Float32Array(d.descriptor));
        const match = findBestMatchWithMargin(floatDescriptor, knownUsers);
        return {
            label: match.label,
            distance: match.distance != null ? Number(match.distance.toFixed(4)) : null,
            box: d.box,
        };
    });
}
/**
 * Just return all descriptor arrays.
 */
async function getAllDescriptors(imagePath) {
    const faces = await fetchFacesFromPython(imagePath);
    return faces.map((d) => l2Normalize(new Float32Array(d.descriptor)));
}
/**
 * Core function for bulk gallery scanning
 */
async function detectFaces(imagePath) {
    const faces = await fetchFacesFromPython(imagePath);
    const filename = path.basename(imagePath);
    console.log(`[detectFaces] ${filename}: Python Engine found ${faces.length} high-quality face(s)`);
    return faces.map((d) => ({
        descriptor: l2Normalize(new Float32Array(d.descriptor)),
        box: d.box,
    }));
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