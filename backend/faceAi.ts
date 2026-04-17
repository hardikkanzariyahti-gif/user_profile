import * as path from 'path';
import * as fs from 'fs';

import * as faceapi from '@vladmandic/face-api';
import * as canvas from 'canvas';
import sharp from 'sharp';

const { Canvas, Image, ImageData } = canvas;
faceapi.env.monkeyPatch({ Canvas: Canvas as any, Image: Image as any, ImageData: ImageData as any });

async function initializeFaceAPI() {
  // statically patched at top-level
}

const MODEL_PATH = path.join(__dirname, 'models');

// Matching threshold: distance below this = confident match.
// 0.65 is the professional maximum limit for the SSD model to capture extreme side-angles.
const MATCH_THRESHOLD = 0.65;

let isLoaded = false;

/**
 * Load the image and resize it so the longest edge is at most `maxEdge` px.
 * Using 1600px so group photos are processed at high enough resolution that
 * smaller background faces are also detectable by the model.
 */
async function getResizedCanvas(imagePath: string, maxEdge = 1600): Promise<{ canvas: canvas.Canvas, scale: number } | null> {
  try {
    const normalizedBuffer = await sharp(imagePath)
      .rotate() // auto-orient based on EXIF metadata perfectly
      .jpeg()
      .toBuffer();

    const img = await canvas.loadImage(normalizedBuffer);
    let { width, height } = img;
    let scale = 1;
    if (width > maxEdge || height > maxEdge) {
      scale = maxEdge / Math.max(width, height);
      width  = Math.round(width  * scale);
      height = Math.round(height * scale);
    }

    const c = canvas.createCanvas(width, height);
    c.getContext('2d').drawImage(img, 0, 0, width, height);
    return { canvas: c, scale };
  } catch (err) {
    console.error('Error loading image for AI:', err);
    return null;
  }
}

function computeIoU(box1: any, box2: any): number {
  const x1 = Math.max(box1.x, box2.x);
  const y1 = Math.max(box1.y, box2.y);
  const x2 = Math.min(box1.x + box1.width, box2.x + box2.width);
  const y2 = Math.min(box1.y + box1.height, box2.y + box2.height);
  const w  = Math.max(0, x2 - x1);
  const h  = Math.max(0, y2 - y1);
  const intersection = w * h;
  const area1 = box1.width * box1.height;
  const area2 = box2.width * box2.height;
  return intersection / (area1 + area2 - intersection);
}

async function loadModels(): Promise<void> {
  if (isLoaded) return;
  try {
    await initializeFaceAPI();
    await faceapi.nets.ssdMobilenetv1.loadFromDisk(MODEL_PATH);
    await faceapi.nets.faceLandmark68Net.loadFromDisk(MODEL_PATH);
    await faceapi.nets.faceRecognitionNet.loadFromDisk(MODEL_PATH);
    await faceapi.nets.tinyFaceDetector.loadFromDisk(MODEL_PATH);
    isLoaded = true;
    console.log('Smart Systems loaded successfully 🚀');
  } catch (err) {
    console.error('Error loading smart systems:', err);
  }
}

function euclideanDistance(d1: Float32Array, d2: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < d1.length; i++) {
    const diff = d1[i] - d2[i];
    sum += diff * diff;
  }
  return Math.sqrt(sum);
}

function serializeDescriptor(descriptor: Float32Array): number[] {
  return Array.from(descriptor);
}

function deserializeDescriptor(data: any): Float32Array | null {
  if (!Array.isArray(data)) return null;
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
function findBestMatchWithMargin(descriptor: Float32Array, knownUsers: any[]) {
  const allMatches: any[] = [];

  for (const labeledDescriptors of knownUsers) {
    let minDistance = Infinity;
    for (const reference of labeledDescriptors.descriptors) {
      const d = euclideanDistance(descriptor, reference);
      if (d < minDistance) minDistance = d;
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

  // Ambiguity check: if top 2 matches are too close to each other.
  if (sorted.length > 1) {
    const margin = sorted[1].distance - best.distance;
    const AMBIGUITY_MARGIN = 0.02;
    const CONFIDENT_THRESHOLD = 0.45; // below this distance = very confident, skip ambiguity check

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
async function getFaceDescriptor(imagePath: string): Promise<Float32Array | null> {
  await loadModels();
  try {
    const resized = await getResizedCanvas(imagePath);
    if (!resized) return null;
    const { canvas: img } = resized;

    // Try SSD first
    let detections = await faceapi
      .detectAllFaces(img as any, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.30 }))
      .withFaceLandmarks()
      .withFaceDescriptors();

    // Tiny fallback for side/small faces
    if (!detections || detections.length === 0) {
      detections = await faceapi
        .detectAllFaces(img as any, new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.20 }))
        .withFaceLandmarks()
        .withFaceDescriptors();
    }

    if (!detections || detections.length === 0) return null;

    // Pick the most prominent face (largest area × confidence score)
    const best = detections.reduce((prev: any, cur: any) => {
      const score = cur.detection.score || 0;
      const area  = cur.detection.box.width * cur.detection.box.height;
      const q     = score * Math.sqrt(area);
      return (!prev || q > prev.q) ? { det: cur, q } : prev;
    }, null);

    return best.det.descriptor;
  } catch (err) {
    console.error('getFaceDescriptor error:', err);
    return null;
  }
}

async function identifyFace(targetImagePath: string, knownUsers: any[]) {
  const descriptor = await getFaceDescriptor(targetImagePath);
  if (!descriptor) return null;
  const best = findBestMatchWithMargin(descriptor, knownUsers);
  return best.label === 'unknown' ? null : best;
}

/**
 * Detect & identify ALL faces in an image (used for Identity Check feature).
 */
async function identifyAllFaces(targetImagePath: string, knownUsers: any[]) {
  await loadModels();
  try {
    const resized = await getResizedCanvas(targetImagePath);
    if (!resized) return [];
    const { canvas: img } = resized;

    const [ssd, tiny416, tiny832] = await Promise.all([
      faceapi.detectAllFaces(img as any, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.20 }))
        .withFaceLandmarks()
        .withFaceDescriptors(),
      faceapi.detectAllFaces(img as any, new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.20 }))
        .withFaceLandmarks()
        .withFaceDescriptors(),
      faceapi.detectAllFaces(img as any, new faceapi.TinyFaceDetectorOptions({ inputSize: 832, scoreThreshold: 0.15 }))
        .withFaceLandmarks()
        .withFaceDescriptors(),
    ]);

    // Merge, deduplicating by IoU overlap
    const all = [...ssd];
    for (const t of tiny416) {
      if (!all.some(s => computeIoU(t.detection.box, s.detection.box) > 0.40)) {
        all.push(t);
      }
    }
    for (const t of tiny832) {
      if (!all.some(s => computeIoU(t.detection.box, s.detection.box) > 0.40)) {
        all.push(t);
      }
    }

    return all.map((d: any) => {
      const match = findBestMatchWithMargin(d.descriptor, knownUsers);
      return {
        label: match.label,
        distance: match.distance != null ? Number(match.distance.toFixed(4)) : null,
        box: d.detection.box,
      };
    });
  } catch (err) {
    console.error('identifyAllFaces error:', err);
    return [];
  }
}

async function getAllDescriptors(imagePath: string): Promise<Float32Array[]> {
  await loadModels();
  try {
    const resized = await getResizedCanvas(imagePath);
    if (!resized) return [];
    const { canvas: img } = resized;

    const [ssd, tiny416, tiny832] = await Promise.all([
      faceapi.detectAllFaces(img as any, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.25 }))
        .withFaceLandmarks()
        .withFaceDescriptors(),
      faceapi.detectAllFaces(img as any, new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.20 }))
        .withFaceLandmarks()
        .withFaceDescriptors(),
      faceapi.detectAllFaces(img as any, new faceapi.TinyFaceDetectorOptions({ inputSize: 832, scoreThreshold: 0.15 }))
        .withFaceLandmarks()
        .withFaceDescriptors(),
    ]);

    const all = [...ssd];
    for (const t of tiny416) {
      if (!all.some(s => computeIoU(t.detection.box, s.detection.box) > 0.40)) all.push(t);
    }
    for (const t of tiny832) {
      if (!all.some(s => computeIoU(t.detection.box, s.detection.box) > 0.40)) all.push(t);
    }
    return all.map(d => d.descriptor);
  } catch (err) {
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
async function detectFaces(imagePath: string) {
  await loadModels();
  try {
    const resized = await getResizedCanvas(imagePath);
    if (!resized) return [];
    const { canvas: img, scale } = resized;

    // Pass 1, 2, and 3 run in parallel (captures large, medium, small, and side profiles)
    const [ssd, tiny416, tiny832] = await Promise.all([
      faceapi.detectAllFaces(img as any, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.20 }))
        .withFaceLandmarks()
        .withFaceDescriptors(),
      faceapi.detectAllFaces(img as any, new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.20 }))
        .withFaceLandmarks()
        .withFaceDescriptors(),
      faceapi.detectAllFaces(img as any, new faceapi.TinyFaceDetectorOptions({ inputSize: 832, scoreThreshold: 0.15 }))
        .withFaceLandmarks()
        .withFaceDescriptors(),
    ]);

    // Merge pass 1 + 2 + 3, dedup by IoU
    const merged = [...ssd];
    
    for (const t of tiny416) {
      if (!merged.some(s => computeIoU(t.detection.box, s.detection.box) > 0.40)) {
        merged.push(t);
      }
    }
    
    for (const t of tiny832) {
      if (!merged.some(s => computeIoU(t.detection.box, s.detection.box) > 0.40)) {
        merged.push(t);
      }
    }

    const filename = imagePath.split(/[/\\]/).pop();
    console.log(`[detectFaces] ${filename}: SSD=${ssd.length} T416=${tiny416.length} → total=${merged.length} face(s)`);

    return merged.map(d => ({
      descriptor: d.descriptor,
      box: {
        _x: d.detection.box.x / scale,
        _y: d.detection.box.y / scale,
        _width: d.detection.box.width / scale,
        _height: d.detection.box.height / scale,
      },
    }));
  } catch (err) {
    console.error('detectFaces error:', err);
    return [];
  }
}


export default {
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
