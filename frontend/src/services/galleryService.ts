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
