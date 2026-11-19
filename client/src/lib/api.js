const BASE_URL = import.meta.env.VITE_API_URL || '/api';

export class ApiError extends Error {
  constructor(message, { status = 0, data = null, cause } = {}) {
    super(message, { cause });
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

/**
 * Small fetch wrapper: JSON in/out, cookies included, throws ApiError on
 * network failures and non-2xx responses.
 */
export async function api(path, { body, headers, ...options } = {}) {
  let res;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      credentials: 'include',
      ...options,
      headers: {
        Accept: 'application/json',
        ...(body !== undefined && { 'Content-Type': 'application/json' }),
        ...headers,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    throw new ApiError('Network error: could not reach the API', { cause: err });
  }

  const isJson = res.headers.get('content-type')?.includes('application/json');
  const data = isJson ? await res.json().catch(() => null) : await res.text();

  if (!res.ok) {
    const message = data?.error?.message ?? `Request failed with status ${res.status}`;
    throw new ApiError(message, { status: res.status, data });
  }

  return data;
}

api.get = (path, options) => api(path, { ...options, method: 'GET' });
api.post = (path, body, options) => api(path, { ...options, method: 'POST', body });
api.put = (path, body, options) => api(path, { ...options, method: 'PUT', body });
api.patch = (path, body, options) => api(path, { ...options, method: 'PATCH', body });
api.delete = (path, options) => api(path, { ...options, method: 'DELETE' });
