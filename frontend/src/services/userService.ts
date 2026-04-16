import { request } from './apiClient';

interface User {
  id: number;
  name: string;
  email: string;
  profilePicture?: string;
  'profile picture'?: string;
}

export function fetchUsers(): Promise<User[]> {
  return request('/api/users');
}

export function fetchUserById(id: number): Promise<User> {
  return request(`/api/users/${id}`);
}

export function createUser(payload: any): Promise<User> {
  return request('/api/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export function updateUser(id: number, formData: FormData): Promise<any> {
  return request(`/api/users/${id}`, {
    method: 'PUT',
    body: formData,
  });
}

export function deleteUser(id: number): Promise<any> {
  return request(`/api/users/${id}`, {
    method: 'DELETE',
  });
}
