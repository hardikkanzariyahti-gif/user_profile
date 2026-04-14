import { request } from './apiClient';

export function fetchUsers() {
  return request('/api/users');
}

export function fetchUserById(id) {
  return request(`/api/users/${id}`);
}

export function createUser(payload) {
  return request('/api/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export function updateUser(id, formData) {
  return request(`/api/users/${id}`, {
    method: 'PUT',
    body: formData,
  });
}

export function deleteUser(id) {
  return request(`/api/users/${id}`, {
    method: 'DELETE',
  });
}
