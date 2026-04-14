import { request } from './apiClient';

export function identifyFace(formData) {
  return request('/api/identify', {
    method: 'POST',
    body: formData,
  });
}
