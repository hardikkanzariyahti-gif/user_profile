import { request } from './apiClient';

export function createAlbum(data: { title: string; description?: string; eventType?: string; date?: string; location?: string; userId?: number; itemIds?: number[]; isGlobal?: boolean }): Promise<any> {
  const query = `?userId=${encodeURIComponent(data.userId || 0)}`;
  return request(`/api/albums${query}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export function fetchAlbums(userId: number): Promise<any> {
    const query = `?userId=${encodeURIComponent(userId)}`;
    return request(`/api/albums${query}`);
}

export function fetchAlbumById(id: number, userId: number): Promise<any> {
    const query = `?userId=${encodeURIComponent(userId)}`;
    return request(`/api/albums/${id}${query}`);
}

export function fetchSharedAlbum(shareId: string): Promise<any> {
    return request(`/api/albums/shared/${shareId}`);
}

export function deleteAlbum(id: number, userId: number): Promise<any> {
    const query = `?userId=${encodeURIComponent(userId)}`;
    return request(`/api/albums/${id}${query}`, {
        method: 'DELETE',
    });
}

export function editAlbum(id: number, userId: number, data: { title?: string; description?: string; eventType?: string; date?: string; location?: string; itemIds?: number[] }): Promise<any> {
    const query = `?userId=${encodeURIComponent(userId)}`;
    return request(`/api/albums/${id}${query}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
}
