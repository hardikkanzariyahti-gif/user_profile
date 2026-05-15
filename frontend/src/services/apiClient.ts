const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string) || '';

async function request(path: string, options: RequestInit = {}): Promise<any> {
  const fetchOptions: RequestInit = {
    ...options,
    headers: {
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache',
      ...(options.headers || {}),
    },
    cache: 'no-store',
  };

  const response = await fetch(`${API_BASE_URL}${path}`, fetchOptions);

  if (response.status === 304) {
    return {};
  }

  let payload: any = '';
  const contentType = response.headers.get('content-type') || '';
  try {
    if (contentType.includes('application/json') && response.status !== 204) {
      payload = await response.json();
    } else {
      payload = await response.text();
    }
  } catch {
    payload = '';
  }

  if (!response.ok) {
    const message = (payload as any)?.error || (payload as any)?.message || (typeof payload === 'string' && payload.trim() ? payload : 'Request failed');
    throw new Error(message);
  }

  return payload;
}

export { API_BASE_URL, request };
