import * as path from 'path';
import * as fs from 'fs';

import * as faceapi from '@vladmandic/face-api';
import * as canvas from 'canvas';

const { Canvas, Image, ImageData } = canvas;
faceapi.env.monkeyPatch({ Canvas: Canvas as any, Image: Image as any, ImageData: ImageData as any });

async function initializeFaceAPI() {
  // statically patched at top-level
}

const MODEL_PATH = path.join(__dirname, 'models');
const MATCH_THRESHOLD = 0.60;
const MATCH_MARGIN = 0.12;

let isLoaded = false;

async function loadModels(): Promise<void> {
  if (isLoaded) return;
  try {
    await initializeFaceAPI();
    await faceapi.nets.ssdMobilenetv1.loadFromDisk(MODEL_PATH);
    await faceapi.nets.faceLandmark68Net.loadFromDisk(MODEL_PATH);
    await faceapi.nets.faceRecognitionNet.loadFromDisk(MODEL_PATH);
    isLoaded = true;
    console.log('AI Models loaded successfully 🧠');
  } catch (err) {
    console.error('Error loading AI models:', err);
  }
}

function euclideanDistance(descriptor1: Float32Array, descriptor2: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < descriptor1.length; i += 1) {
    const diff = descriptor1[i] - descriptor2[i];
    sum += diff * diff;
  }
  return Math.sqrt(sum);
}

function findBestMatchWithMargin(descriptor: Float32Array, knownUsers: any[]) {
  const bestDistances: any = {};

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
    .map(([label, distance]: [string, any]) => ({ label, distance }))
    .sort((a: any, b: any) => a.distance - b.distance);

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

async function getFaceDescriptor(imagePath: string): Promise<Float32Array | null> {
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

    if (!detections || detections.length === 0) return null;
    const bestDetection = detections.reduce((best: any, detection: any) => {
      const score = detection.detection.score || 0;
      const area = detection.detection.box.width * detection.detection.box.height;
      const quality = score * Math.sqrt(area);
      if (!best || quality > best.quality) {
        return { detection, quality };
      }
      return best;
    }, null);
    return bestDetection.detection.descriptor;
  } catch (err) {
    console.error('Error processing image:', err);
    return null;
  }
}

async function identifyFace(targetImagePath: string, knownUsers: any[]) {
  const targetDescriptor = await getFaceDescriptor(targetImagePath);
  if (!targetDescriptor) return null;

  const bestMatch = findBestMatchWithMargin(targetDescriptor, knownUsers);

  if (bestMatch.label === 'unknown') return null;
  return bestMatch;
}

async function identifyAllFaces(targetImagePath: string, knownUsers: any[]) {
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

    if (!detections || detections.length === 0) return [];

    const results = detections.map((d: any) => {
      const match = findBestMatchWithMargin(d.descriptor, knownUsers);
      return {
        label: match.label,
        distance: match.distance != null ? Number(match.distance.toFixed(4)) : null,
      };
    });
    return results;
  } catch (err) {
    console.error('Error identifying multiple faces:', err);
    return [];
  }
}

export default { getFaceDescriptor, identifyFace, identifyAllFaces, loadModels, MATCH_THRESHOLD };
