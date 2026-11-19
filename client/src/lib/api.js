const BASE_URL = import.meta.env.VITE_API_URL || '/api';

/** Error thrown for failed requests. Mirrors the server shape { error: { code, message, details? } }. */
export class ApiError extends Error {
  constructor(message, { status = 0, code = 'NETWORK_ERROR', details = null, cause } = {}) {
    super(message, { cause });
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details; // e.g. { username: ['Username is already taken'] }
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
    throw new ApiError('Network error: could not reach the server', { cause: err });
  }

  const isJson = res.headers.get('content-type')?.includes('application/json');
  const data = isJson ? await res.json().catch(() => null) : await res.text();

  if (!res.ok) {
    const error = data?.error ?? {};
    throw new ApiError(error.message ?? `Request failed with status ${res.status}`, {
      status: res.status,
      code: error.code ?? 'HTTP_ERROR',
      details: error.details ?? null,
    });
  }

  return data;
}

api.get = (path, options) => api(path, { ...options, method: 'GET' });
api.post = (path, body, options) => api(path, { ...options, method: 'POST', body });
api.put = (path, body, options) => api(path, { ...options, method: 'PUT', body });
api.patch = (path, body, options) => api(path, { ...options, method: 'PATCH', body });
api.delete = (path, options) => api(path, { ...options, method: 'DELETE' });
