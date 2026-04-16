const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string) || 'http://localhost:4000';

async function request(path: string, options: RequestInit = {}): Promise<any> {
  const response = await fetch(`${API_BASE_URL}${path}`, options);
  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json')
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    const message = (payload as any)?.error || (payload as any)?.message || 'Request failed';
    throw new Error(message);
  }

  return payload;
}

export { API_BASE_URL, request };
