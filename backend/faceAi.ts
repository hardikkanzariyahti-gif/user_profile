import * as fs from 'fs';
import * as path from 'path';

const AI_API_URL = 'http://localhost:8000/extract_faces';
const AI_BATCH_URL = 'http://localhost:8000/extract_faces_batch';

// For L2-normalized Facenet512 vectors, the standard Euclidean distance threshold is ~0.8.
// We set it to 1.30 to be perfectly strict and prevent any false positives between completely different people.
const MATCH_THRESHOLD = 1.30;
const AMBIGUITY_MARGIN = 0.05;

let isLoaded = false;

async function loadModels(): Promise<void> {
  // We dont load models to RAM in Node anymore! The Python server holds them.
  if (isLoaded) return;
  console.log('Smart Systems (DeepFace Microservice Mode) Loaded! 🚀');
  isLoaded = true;
}

function euclideanDistance(d1: Float32Array, d2: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < d1.length; i++) {
    const diff = d1[i] - d2[i];
    sum += diff * diff;
  }
  return Math.sqrt(sum);
}

function l2Normalize(d: Float32Array): Float32Array {
  let norm = 0;
  for (let i = 0; i < d.length; i++) norm += d[i] * d[i];
  norm = Math.sqrt(norm);
  if (norm === 0) return d;
  for (let i = 0; i < d.length; i++) d[i] = d[i] / norm;
  return d;
}

function serializeDescriptor(descriptor: Float32Array | number[]): number[] {
  return Array.from(descriptor);
}

function deserializeDescriptor(data: any): Float32Array | null {
  if (!Array.isArray(data)) return null;
  return l2Normalize(new Float32Array(data));
}

/**
 * Match a 512D face descriptor against all known users.
 * Contains safety check for mixed 128D/512D arrays.
 */
function findBestMatchWithMargin(descriptor: Float32Array, knownUsers: any[]) {
  const allMatches: any[] = [];

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
      if (d < minDistance) minDistance = d;
    }

    if (minDistance !== Infinity) {
      allMatches.push({ label: labeledDescriptors.label, distance: minDistance });
    }
  }

  const sorted = allMatches.sort((a, b) => a.distance - b.distance);
  const best = sorted[0];

  if (!best) return { label: 'unknown', distance: null };

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
 * Calls the Python Microservice for a SINGLE image.
 */
async function fetchFacesFromPython(imagePath: string): Promise<any[]> {
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

    const data: any = await res.json();
    return data.faces || [];
  } catch (err: any) {
    if (err.cause && err.cause.code === 'ECONNREFUSED') {
      console.error(`\n🚨 [CRITICAL AI ERROR] Could not reach the Python Background AI at ${AI_API_URL}.`);
      console.error(`🚨 Please make sure you have run 'python main.py' inside the 'ai_service' folder!\n`);
    } else {
      console.error('[AI Engine] Failed to fetch faces from microservice:', err.message);
    }
    return [];
  }
}

/**
 * Calls the Python Microservice for a BATCH of images simultaneously.
 * Sends up to `imagePaths.length` images in a single multipart POST.
 * Returns results in the same order as the input paths.
 *
 * Falls back to sequential single-image requests if the batch endpoint is
 * unavailable (e.g. older Python service version).
 */
async function fetchFacesFromPythonBatch(imagePaths: string[]): Promise<any[][]> {
  if (imagePaths.length === 0) return [];
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
      throw new Error(`Batch endpoint returned ${res.status}: ${res.statusText}`);
    }

    const batchResults = (await res.json()) as Array<{ filename: string; faces: any[]; backend?: string }>;

    // Results come back in the same order as files were appended
    return batchResults.map(r => r.faces || []);
  } catch (err: any) {
    console.warn('[AI Engine] Batch endpoint failed, falling back to sequential:', err.message);
    // Graceful fallback: run sequentially
    const results: any[][] = [];
    for (const imgPath of imagePaths) {
      results.push(await fetchFacesFromPython(imgPath));
    }
    return results;
  }
}

/**
 * Get the single best/largest face descriptor from an image (for profile pictures).
 */
async function getFaceDescriptor(imagePath: string): Promise<Float32Array | null> {
  const faces = await fetchFacesFromPython(imagePath);
  if (!faces || faces.length === 0) return null;

  // Pick the most prominent face by area size
  const best = faces.reduce((prev: any, cur: any) => {
    const area = cur.box._width * cur.box._height;
    return (!prev || area > prev.area) ? { det: cur, area } : prev;
  }, null);

  return l2Normalize(new Float32Array(best.det.descriptor));
}

async function identifyFace(targetImagePath: string, knownUsers: any[]) {
  const descriptor = await getFaceDescriptor(targetImagePath);
  if (!descriptor) return null;
  const best = findBestMatchWithMargin(descriptor, knownUsers);
  return best.label === 'unknown' ? null : best;
}

/**
 * Detect & identify ALL faces in an image
 */
async function identifyAllFaces(targetImagePath: string, knownUsers: any[]) {
  const faces = await fetchFacesFromPython(targetImagePath);
  if (!faces || faces.length === 0) return [];

  return faces.map((d: any) => {
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
async function getAllDescriptors(imagePath: string): Promise<Float32Array[]> {
  const faces = await fetchFacesFromPython(imagePath);
  return faces.map((d: any) => l2Normalize(new Float32Array(d.descriptor)));
}

/**
 * Core function for bulk gallery scanning — single image.
 */
async function detectFaces(imagePath: string) {
  const faces = await fetchFacesFromPython(imagePath);

  const filename = path.basename(imagePath);
  console.log(`[detectFaces] ${filename}: Python Engine found ${faces.length} high-quality face(s)`);

  return faces.map((d: any) => ({
    descriptor: l2Normalize(new Float32Array(d.descriptor)),
    box: d.box,
  }));
}

/**
 * Core function for bulk gallery scanning — PARALLEL BATCH.
 * Sends multiple images to Python in ONE request and processes them in parallel.
 * Returns results in same order as imagePaths.
 */
async function detectFacesBatch(imagePaths: string[]): Promise<Array<Array<{ descriptor: Float32Array; box: any }>>> {
  const rawResults = await fetchFacesFromPythonBatch(imagePaths);

  return rawResults.map((faces, idx) => {
    const filename = path.basename(imagePaths[idx]);
    console.log(`[detectFacesBatch] ${filename}: ${faces.length} face(s) found`);
    return faces.map((d: any) => ({
      descriptor: l2Normalize(new Float32Array(d.descriptor)),
      box: d.box,
    }));
  });
}

export default {
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
  MATCH_THRESHOLD,
  euclideanDistance,
};
