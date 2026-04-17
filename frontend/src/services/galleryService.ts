import { request } from './apiClient';

export function fetchGallery(userId?: number): Promise<any> {
  const query = userId ? `?userId=${encodeURIComponent(userId)}` : '';
  return request(`/api/gallery${query}`);
}

export function uploadGallery(formData: FormData, userId?: number): Promise<any> {
  const query = userId ? `?userId=${encodeURIComponent(userId)}` : '';
  return request(`/api/gallery${query}`, {
    method: 'POST',
    body: formData,
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


