import * as fs from 'fs';
import * as path from 'path';

const AI_API_URL = 'http://localhost:8000/extract_faces';
const AI_BATCH_URL = 'http://localhost:8000/extract_faces_batch';

const USE_MATCHER_V2 = process.env.FACE_MATCHER_V2 === 'true';

function numberFromEnv(key: string, fallback: number): number {
  const raw = process.env[key];
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

const MATCH_CONFIG = {
  // Legacy defaults preserved so existing behavior remains stable unless toggled/configured.
  matchThreshold: numberFromEnv('FACE_MATCH_THRESHOLD', 0.84),
  ambiguityMargin: numberFromEnv('FACE_AMBIGUITY_MARGIN', 0.22),
  confidentThreshold: numberFromEnv('FACE_CONFIDENT_DISTANCE', 0.4),
  robustTopK: Math.max(1, Math.floor(numberFromEnv('FACE_ROBUST_TOP_K', 3))),
  robustNearThreshold: numberFromEnv('FACE_ROBUST_NEAR_THRESHOLD', 0.92),
  robustMinSupport: Math.max(1, Math.floor(numberFromEnv('FACE_ROBUST_MIN_SUPPORT', 2))),
};

const MATCH_THRESHOLD = MATCH_CONFIG.matchThreshold;

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

type MatchDecisionReason = 'matched' | 'threshold' | 'ambiguous' | 'no_candidates';

type MatchResult = {
  label: string;
  distance: number | null;
  candidate?: string;
  secondCandidate?: string;
  secondDistance?: number | null;
  margin?: number | null;
  reason?: MatchDecisionReason;
  confidence?: number;
};

/**
 * Match a 512D face descriptor against all known users.
 * Contains safety check for mixed 128D/512D arrays.
 */
function findBestMatchWithMargin(descriptor: Float32Array, knownUsers: any[]): MatchResult {
  const allMatches: any[] = [];

  for (const labeledDescriptors of knownUsers) {
    let minDistance = Infinity;
    const distances: number[] = [];

    for (const reference of labeledDescriptors.descriptors) {
      const refArray = new Float32Array(reference);

      // Safety Check: Old Database vs New AI
      if (descriptor.length !== refArray.length) {
        console.warn(`[AI] Size mismatch! Old DB uses ${refArray.length}D vectors. The new AI uses ${descriptor.length}D. You must clear old tags.`);
        continue;
      }

      const d = euclideanDistance(descriptor, refArray);
      distances.push(d);
      if (d < minDistance) minDistance = d;
    }

    if (minDistance !== Infinity) {
      let rankingDistance = minDistance;
      let supportCount = 1;
      if (USE_MATCHER_V2 && distances.length > 0) {
        const sortedDistances = [...distances].sort((a, b) => a - b);
        const topK = sortedDistances.slice(0, Math.min(MATCH_CONFIG.robustTopK, sortedDistances.length));
        rankingDistance = topK.reduce((sum, v) => sum + v, 0) / topK.length;
        supportCount = distances.filter((d) => d <= MATCH_CONFIG.robustNearThreshold).length;
      }

      allMatches.push({
        label: labeledDescriptors.label,
        distance: rankingDistance,
        minDistance,
        supportCount,
      });
    }
  }

  const sorted = allMatches.sort((a, b) => a.distance - b.distance);
  const best = sorted[0];
  const second = sorted[1];

  if (!best) return { label: 'unknown', distance: null, reason: 'no_candidates' };

  // AI DEBUG: Log the distance scale
  if (best.distance > 2.0 || best.distance < 0) {
    console.log(`[AI DEBUG] ⚠️  Unusual distance detected: ${best.distance.toFixed(4)}. Target dim: ${descriptor.length}, Candidate: ${best.label}`);
  }

  // Hard threshold
  if (best.distance > MATCH_THRESHOLD) {
    console.log(`[AI] ❌ No match. Best=${best.label} dist=${best.distance?.toFixed(2)} > threshold=${MATCH_THRESHOLD}`);
    return {
      label: 'unknown',
      distance: best.distance,
      candidate: best.label,
      secondCandidate: second?.label,
      secondDistance: second?.distance ?? null,
      margin: second ? (second.distance - best.distance) : null,
      reason: 'threshold',
      confidence: 0,
    };
  }

  if (USE_MATCHER_V2) {
    const hasEnoughDescriptors = knownUsers.find((u: any) => u.label === best.label)?.descriptors?.length >= 3;
    if (hasEnoughDescriptors && best.supportCount < MATCH_CONFIG.robustMinSupport) {
      console.log(`[AI] ⚠️ Weak support: ${best.label} has support=${best.supportCount} (<${MATCH_CONFIG.robustMinSupport}) — unknown`);
      return {
        label: 'unknown',
        distance: best.distance,
        candidate: best.label,
        secondCandidate: second?.label,
        secondDistance: second?.distance ?? null,
        margin: second ? (second.distance - best.distance) : null,
        reason: 'ambiguous',
        confidence: _calculateConfidence(best.distance, second ? (second.distance - best.distance) : null, best.supportCount),
      };
    }
  }

  if (USE_MATCHER_V2 && sorted.length > 1) {
    const margin = second.distance - best.distance;
    if (margin < MATCH_CONFIG.ambiguityMargin && best.distance > MATCH_CONFIG.confidentThreshold) {
      console.log(`[AI] ⚠️ Ambiguous: ${best.label}(${best.distance?.toFixed(2)}) vs ${second.label}(${second.distance?.toFixed(2)}) — unknown`);
      return {
        label: 'unknown',
        distance: best.distance,
        candidate: best.label,
        secondCandidate: second.label,
        secondDistance: second.distance,
        margin,
        reason: 'ambiguous',
        confidence: _calculateConfidence(best.distance, margin, best.supportCount),
      };
    }
  }

  const margin = second ? (second.distance - best.distance) : null;
  const confidence = _calculateConfidence(best.distance, margin, best.supportCount);

  console.log(`[AI] ✅ Match → ${best.label} dist=${best.distance?.toFixed(2)} confidence=${confidence}%`);
  return {
    label: best.label,
    distance: best.distance,
    secondCandidate: second?.label,
    secondDistance: second?.distance ?? null,
    margin,
    reason: 'matched',
    confidence,
  };
}

function _calculateConfidence(distance: number, margin: number | null, supportCount: number): number {
  const distFactor = Math.max(0, 1 - (distance / MATCH_THRESHOLD));

  let marginFactor = 1;
  if (margin !== null && margin < MATCH_CONFIG.ambiguityMargin) {
    marginFactor = margin / MATCH_CONFIG.ambiguityMargin;
  }

  let supportFactor = 1;
  if (USE_MATCHER_V2 && supportCount > 0) {
    supportFactor = Math.min(1, supportCount / MATCH_CONFIG.robustMinSupport);
  }

  return Math.round(Math.max(0, Math.min(100, distFactor * marginFactor * supportFactor * 100)));
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
      secondDistance: match.secondDistance != null ? Number(match.secondDistance.toFixed(4)) : null,
      margin: match.margin != null ? Number(match.margin.toFixed(4)) : null,
      reason: match.reason || null,
      confidence: match.confidence ?? 0,
      box: d.box,
    };
  });
}

/**
 * Instant recognition for upload - gets top suggestions per face with confidence
 */
async function getFaceSuggestions(targetImagePath: string, knownUsers: any[]): Promise<any[]> {
  const faces = await fetchFacesFromPython(targetImagePath);
  if (!faces || faces.length === 0) return [];

  return faces.map((d: any) => {
    const floatDescriptor = l2Normalize(new Float32Array(d.descriptor));
    const match = findBestMatchWithMargin(floatDescriptor, knownUsers);

    const suggestions: any[] = [];
    if (match.label !== 'unknown') {
      suggestions.push({
        label: match.label,
        confidence: match.confidence ?? 0,
        distance: match.distance != null ? Number(match.distance.toFixed(4)) : null,
      });
    }
    if (match.secondCandidate && match.secondDistance !== null && match.margin !== null) {
      const marginValue = match.margin ?? 0;
      suggestions.push({
        label: match.secondCandidate,
        confidence: Math.max(0, (match.confidence ?? 0) - Math.round((marginValue / MATCH_CONFIG.ambiguityMargin) * 30)),
        distance: match.secondDistance,
      });
    }

    return {
      box: d.box,
      confidence: match.confidence ?? 0,
      isConfident: (match.confidence ?? 0) >= 80 && match.reason === 'matched',
      topSuggestion: suggestions[0] || null,
      allSuggestions: suggestions.slice(0, 3),
      label: match.label,
      reason: match.reason || null,
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
  getFaceSuggestions,
  serializeDescriptor,
  deserializeDescriptor,
  findBestMatchWithMargin,
  loadModels,
  MATCH_THRESHOLD,
  euclideanDistance,
};
