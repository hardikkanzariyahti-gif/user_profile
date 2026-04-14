import { request } from './apiClient';

export function fetchGallery(userId) {
  const query = userId ? `?userId=${encodeURIComponent(userId)}` : '';
  return request(`/api/gallery${query}`);
}

export function uploadGallery(formData, userId) {
  const query = userId ? `?userId=${encodeURIComponent(userId)}` : '';
  return request(`/api/gallery${query}`, {
    method: 'POST',
    body: formData,
  });
}
