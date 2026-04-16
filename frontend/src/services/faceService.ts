import { request } from './apiClient';

export function identifyFace(formData: FormData): Promise<any> {
  return request('/api/identify', {
    method: 'POST',
    body: formData,
  });
}
