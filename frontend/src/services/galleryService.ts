import { request } from './apiClient';

// Client-side optimization cache (Requirement 1 & 2)
const GALLERY_CACHE = {
  data: null as any,
  timestamp: 0,
  key: '',
  TTL: 60 * 1000 // 60s duration for zero loading state transitions
};

export function invalidateGalleryCache() {
  GALLERY_CACHE.data = null;
  GALLERY_CACHE.timestamp = 0;
}

export function fetchGallery(userId?: number, search: string = '', page?: number, limit?: number): Promise<any> {
  const finalKey = `g-${userId || 'x'}-${search}-${page || 'n'}-${limit || 'n'}`;
  const isFresh = (Date.now() - GALLERY_CACHE.timestamp) < GALLERY_CACHE.TTL;

  if (GALLERY_CACHE.data && GALLERY_CACHE.key === finalKey && isFresh) {
    console.log('[Service Layer] ⚡ Serving fast cached data state.');
    // Background fetch refresh is managed implicitly by components or next render
    return Promise.resolve(GALLERY_CACHE.data);
  }

  const params = new URLSearchParams();
  if (userId) params.append('userId', String(userId));
  if (search) params.append('search', search);
  if (page) params.append('page', String(page));
  if (limit) params.append('limit', String(limit));

  const query = params.toString() ? `?${params.toString()}` : '';
  return request(`/api/gallery${query}`).then(res => {
    // Store valid result in cache
    GALLERY_CACHE.data = res;
    GALLERY_CACHE.key = finalKey;
    GALLERY_CACHE.timestamp = Date.now();
    return res;
  });
}

export function fetchGalleryItem(galleryItemId: number): Promise<any> {
  return request(`/api/gallery/${encodeURIComponent(String(galleryItemId))}`);
}

export function fetchImageStatus(galleryItemId: number): Promise<any> {
  return request(`/api/gallery/${encodeURIComponent(String(galleryItemId))}/status`);
}

export function deleteGalleryItem(galleryItemId: number): Promise<any> {
  return request(`/api/gallery/${encodeURIComponent(String(galleryItemId))}`, {
    method: 'DELETE',
  }).then(res => {
    invalidateGalleryCache();
    return res;
  });
}

export function setGalleryItemHashtags(galleryItemId: number, hashtags: string[]): Promise<any> {
  return request(`/api/gallery/${encodeURIComponent(String(galleryItemId))}/hashtags`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ hashtags }),
  });
}

export function searchGalleryByHashtag(tag: string): Promise<any> {
  const query = `?tag=${encodeURIComponent(tag)}`;
  return request(`/api/gallery/search${query}`);
}

export function uploadGallery(formData: FormData, userId?: number): Promise<any> {
  const query = userId ? `?userId=${encodeURIComponent(userId)}` : '';
  return request(`/api/gallery${query}`, {
    method: 'POST',
    body: formData,
  }).then(res => {
    invalidateGalleryCache();
    return res;
  });
}

export function refreshGallery(forceRescan = false): Promise<any> {
  const query = forceRescan ? '?forceRescan=true' : '';
  return request(`/api/gallery/refresh${query}`, {
    method: 'POST',
  });
}

export function getSyncStatus(): Promise<any> {
  return request(`/api/gallery/sync-status`);
}

export function openSyncEvents(onSync: (state: any) => void, onError?: (err: any) => void): EventSource | null {
  if (typeof window === 'undefined' || typeof (window as any).EventSource === 'undefined') return null;
  const es = new EventSource('/api/gallery/sync-events');
  es.addEventListener('sync', (evt: MessageEvent) => {
    try {
      const data = JSON.parse(String(evt.data || '{}'));
      onSync(data);
    } catch {
      // ignore bad frames
    }
  });
  es.onerror = (e) => {
    try { es.close(); } catch { }
    if (onError) onError(e);
  };
  return es;
}

export function tagFaceInPhoto(galleryItemId: number, userId: number, faceIndex?: number): Promise<any> {
  return request(`/api/gallery/tag-face`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ galleryItemId, userId, faceIndex }),
  });
}

export function untagFaceInPhoto(galleryItemId: number, userId: number, faceIndex?: number): Promise<any> {
  return request(`/api/gallery/untag-face`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ galleryItemId, userId, faceIndex }),
  });
}

export function setProfilePictureFromGalleryItem(galleryItemId: number, userId: number): Promise<any> {
  return request(`/api/gallery/profile-picture-from-gallery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ galleryItemId, userId }),
  });
}

export function getTagSuggestions(galleryItemId: number): Promise<any> {
  return request(`/api/gallery/suggest/${encodeURIComponent(String(galleryItemId))}`);
}

export function fetchAllHashtags(): Promise<string[]> {
  return request(`/api/gallery/hashtags`);
}

export function forceScanItem(galleryItemId: number, overwriteManualMetadata = false): Promise<any> {
  return request(`/api/gallery/${encodeURIComponent(String(galleryItemId))}/force-scan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ overwriteManualMetadata }),
  });
}

export function updateCustomMetadata(galleryItemId: number, updateData: any): Promise<any> {
  return request(`/api/gallery/${encodeURIComponent(String(galleryItemId))}/custom-metadata`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updateData),
  });
}

export function backfillMetadata(force = false): Promise<any> {
  return request('/api/gallery/metadata/backfill', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ force }),
  });
}

export function getBackfillStatus(): Promise<{
  running: boolean;
  total: number;
  processed: number;
  failed: number;
  remaining: number;
  currentImageId: number | null;
  startedAt: string | null;
  finishedAt: string | null;
}> {
  return request('/api/gallery/metadata/backfill/status');
}

export function retryMetadataExtraction(galleryItemId: number): Promise<any> {
  return request(`/api/gallery/${encodeURIComponent(String(galleryItemId))}/metadata/retry`, {
    method: 'POST',
  });
}
