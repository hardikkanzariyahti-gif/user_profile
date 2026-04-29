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
const AI_BATCH_URL = 'http://localhost:8000/extract_faces_batch';
const MATCH_THRESHOLD = 0.8;
const AMBIGUITY_MARGIN = 0.25;
const AUTO_TAG_THRESHOLD = 20;
let isLoaded = false;
async function loadModels() {
    if (isLoaded)
        return;
    console.log('Smart Systems (DeepFace Microservice Mode) Loaded!');
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
function parseLabelToUser(label) {
    if (!label || label === 'unknown')
        return null;
    try {
        const parsed = JSON.parse(label);
        if (parsed && typeof parsed.id === 'number' && typeof parsed.name === 'string') {
            return { id: parsed.id, name: parsed.name };
        }
        return null;
    }
    catch {
        return null;
    }
}
function findBestMatchWithMargin(descriptor, knownUsers) {
    const allMatches = [];
    for (const labeledDescriptors of knownUsers) {
        let minDistance = Infinity;
        for (const reference of labeledDescriptors.descriptors) {
            const refArray = new Float32Array(reference);
            if (descriptor.length !== refArray.length)
                continue;
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
    const second = sorted[1];
    console.log('[Match] Best:', best?.label, '=', best?.distance?.toFixed(3), 'Thresh:', MATCH_THRESHOLD);
    if (!best)
        return { label: 'unknown', distance: null };
    if (best.distance > MATCH_THRESHOLD) {
        return { label: 'unknown', distance: best.distance };
    }
    return {
        label: best.label,
        distance: best.distance,
        secondCandidate: second?.label,
        secondDistance: second?.distance ?? null,
        margin: second ? (second.distance - best.distance) : null,
        reason: 'matched',
        confidence: Math.round(Math.max(0, (1 - best.distance / MATCH_THRESHOLD) * 100)),
    };
}
function getFaceSuggestions(imagePath, labeledDescriptors) {
    return [];
}
async function getFaceSuggestionsBatch(imagePaths, knownUsers) {
    const rawResults = await fetchFacesFromPythonBatch(imagePaths);
    console.log('[Batch] Matching against', knownUsers.length, 'users');
    return rawResults.map((faces) => {
        return faces.map((d) => {
            const floatDescriptor = l2Normalize(new Float32Array(d.descriptor));
            const match = findBestMatchWithMargin(floatDescriptor, knownUsers);
            const userData = parseLabelToUser(match.label);
            const suggestions = [];
            if (userData && match.reason === 'matched') {
                suggestions.push({
                    id: userData.id,
                    name: userData.name,
                    label: match.label,
                    confidence: match.confidence ?? 0,
                    distance: match.distance != null ? Number(match.distance.toFixed(4)) : null,
                });
            }
            return {
                box: d.box,
                confidence: match.confidence ?? 0,
                isConfident: (match.confidence ?? 0) >= AUTO_TAG_THRESHOLD && match.reason === 'matched',
                topSuggestion: suggestions[0] || null,
                allSuggestions: suggestions.slice(0, 3),
                label: match.label,
                reason: match.reason || null,
            };
        });
    });
}
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
            console.error('[AI] Error:', res.statusText);
            return [];
        }
        const data = await res.json();
        return data.faces || [];
    }
    catch (err) {
        console.error('[AI] Failed:', err.message);
        return [];
    }
}
async function fetchFacesFromPythonBatch(imagePaths) {
    if (imagePaths.length === 0)
        return [];
    if (imagePaths.length === 1) {
        const faces = await fetchFacesFromPython(imagePaths[0]);
        return [faces];
    }
    try {
        const formData = new FormData();
        for (const imgPath of imagePaths) {
            const fileBuffer = fs.readFileSync(imgPath);
            const blob = new Blob([fileBuffer], { type: 'image/jpeg' });
            formData.append('files', blob, path.basename(imgPath));
        }
        const res = await fetch(AI_BATCH_URL, {
            method: 'POST',
            body: formData,
        });
        if (!res.ok) {
            throw new Error('Batch failed');
        }
        const batchResults = (await res.json());
        return batchResults.map(r => r.faces || []);
    }
    catch (err) {
        console.warn('[AI] Batch fallback:', err.message);
        const results = [];
        for (const imgPath of imagePaths) {
            results.push(await fetchFacesFromPython(imgPath));
        }
        return results;
    }
}
async function getFaceDescriptor(imagePath) {
    const faces = await fetchFacesFromPython(imagePath);
    if (!faces || faces.length === 0)
        return null;
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
async function getAllDescriptors(imagePath) {
    const faces = await fetchFacesFromPython(imagePath);
    return faces.map((d) => l2Normalize(new Float32Array(d.descriptor)));
}
async function detectFaces(imagePath) {
    const faces = await fetchFacesFromPython(imagePath);
    const filename = path.basename(imagePath);
    console.log(`[detectFaces] ${filename}: ${faces.length} face(s)`);
    return faces.map((d) => ({
        descriptor: l2Normalize(new Float32Array(d.descriptor)),
        box: d.box,
    }));
}
async function detectFacesBatch(imagePaths) {
    const rawResults = await fetchFacesFromPythonBatch(imagePaths);
    return rawResults.map((faces, idx) => {
        const filename = path.basename(imagePaths[idx]);
        console.log(`[detectFacesBatch] ${filename}: ${faces.length} face(s)`);
        return faces.map((d) => ({
            descriptor: l2Normalize(new Float32Array(d.descriptor)),
            box: d.box,
        }));
    });
}
exports.default = {
    getFaceDescriptor,
    identifyFace,
    identifyAllFaces,
    getAllDescriptors,
    detectFaces,
    detectFacesBatch,
    serializeDescriptor,
    deserializeDescriptor,
    findBestMatchWithMargin,
    loadModels,
    getFaceSuggestions,
    getFaceSuggestionsBatch,
    MATCH_THRESHOLD,
    AUTO_TAG_THRESHOLD,
    euclideanDistance,
    parseLabelToUser,
};
//# sourceMappingURL=faceAi.js.map