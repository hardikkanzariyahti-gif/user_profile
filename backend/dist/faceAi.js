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
const faceapi = require('@vladmandic/face-api');
const canvas = require('canvas');
const { Canvas, Image, ImageData } = canvas;
faceapi.env.monkeyPatch({ Canvas, Image, ImageData });
const MODEL_PATH = path.join(__dirname, 'models');
const MATCH_THRESHOLD = 0.60;
const MATCH_MARGIN = 0.12;
let isLoaded = false;
async function loadModels() {
    if (isLoaded)
        return;
    try {
        await faceapi.nets.ssdMobilenetv1.loadFromDisk(MODEL_PATH);
        await faceapi.nets.faceLandmark68Net.loadFromDisk(MODEL_PATH);
        await faceapi.nets.faceRecognitionNet.loadFromDisk(MODEL_PATH);
        isLoaded = true;
        console.log('AI Models loaded successfully 🧠');
    }
    catch (err) {
        console.error('Error loading AI models:', err);
    }
}
function euclideanDistance(descriptor1, descriptor2) {
    let sum = 0;
    for (let i = 0; i < descriptor1.length; i += 1) {
        const diff = descriptor1[i] - descriptor2[i];
        sum += diff * diff;
    }
    return Math.sqrt(sum);
}
function findBestMatchWithMargin(descriptor, knownUsers) {
    const bestDistances = {};
    for (const labeledDescriptors of knownUsers) {
        const label = labeledDescriptors.label;
        for (const reference of labeledDescriptors.descriptors) {
            const distance = euclideanDistance(descriptor, reference);
            const existing = bestDistances[label];
            if (existing === undefined || distance < existing) {
                bestDistances[label] = distance;
            }
        }
    }
    const sorted = Object.entries(bestDistances)
        .map(([label, distance]) => ({ label, distance }))
        .sort((a, b) => a.distance - b.distance);
    if (sorted.length === 0) {
        return { label: 'unknown', distance: null };
    }
    const best = sorted[0];
    const second = sorted[1];
    if (best.distance > MATCH_THRESHOLD) {
        return { label: 'unknown', distance: best.distance };
    }
    if (second && second.distance - best.distance < MATCH_MARGIN) {
        return { label: 'unknown', distance: best.distance };
    }
    return best;
}
async function getFaceDescriptor(imagePath) {
    await loadModels();
    try {
        const img = await canvas.loadImage(imagePath);
        let detections = await faceapi
            .detectAllFaces(img, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 }))
            .withFaceLandmarks()
            .withFaceDescriptors();
        if (!detections || detections.length === 0) {
            detections = await faceapi
                .detectAllFaces(img, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.35 }))
                .withFaceLandmarks()
                .withFaceDescriptors();
        }
        if (!detections || detections.length === 0)
            return null;
        const bestDetection = detections.reduce((best, detection) => {
            const score = detection.detection.score || 0;
            const area = detection.detection.box.width * detection.detection.box.height;
            const quality = score * Math.sqrt(area);
            if (!best || quality > best.quality) {
                return { detection, quality };
            }
            return best;
        }, null);
        return bestDetection.detection.descriptor;
    }
    catch (err) {
        console.error('Error processing image:', err);
        return null;
    }
}
async function identifyFace(targetImagePath, knownUsers) {
    const targetDescriptor = await getFaceDescriptor(targetImagePath);
    if (!targetDescriptor)
        return null;
    const bestMatch = findBestMatchWithMargin(targetDescriptor, knownUsers);
    if (bestMatch.label === 'unknown')
        return null;
    return bestMatch;
}
async function identifyAllFaces(targetImagePath, knownUsers) {
    await loadModels();
    try {
        const img = await canvas.loadImage(targetImagePath);
        let detections = await faceapi
            .detectAllFaces(img, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 }))
            .withFaceLandmarks()
            .withFaceDescriptors();
        if (!detections || detections.length === 0) {
            detections = await faceapi
                .detectAllFaces(img, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.35 }))
                .withFaceLandmarks()
                .withFaceDescriptors();
        }
        if (!detections || detections.length === 0)
            return [];
        const results = detections.map((d) => {
            const match = findBestMatchWithMargin(d.descriptor, knownUsers);
            return {
                label: match.label,
                distance: match.distance != null ? Number(match.distance.toFixed(4)) : null,
            };
        });
        return results;
    }
    catch (err) {
        console.error('Error identifying multiple faces:', err);
        return [];
    }
}
exports.default = { getFaceDescriptor, identifyFace, identifyAllFaces, loadModels, MATCH_THRESHOLD };
//# sourceMappingURL=faceAi.js.map