/**
 * API client. The access token lives in memory only; the refresh token is an httpOnly cookie
 * scoped to /api/admin/auth. Any 401 triggers one silent refresh and a retry.
 */
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: { path: string; message: string }[] | unknown,
  ) {
    super(message);
  }
  /** Field → message map for validation errors. */
  get fieldErrors(): Record<string, string> {
    if (!Array.isArray(this.details)) return {};
    return Object.fromEntries((this.details as { path: string; message: string }[]).map((d) => [d.path, d.message]));
  }
}

let accessToken: string | null = null;
let refreshing: Promise<boolean> | null = null;
let onSessionExpired: (() => void) | null = null;

export const setAccessToken = (t: string | null) => (accessToken = t);
export const getToken = () => accessToken;
export const setSessionExpiredHandler = (fn: () => void) => (onSessionExpired = fn);

export async function refreshSession(): Promise<boolean> {
  refreshing ??= (async () => {
    try {
      const res = await fetch('/api/admin/auth/refresh', { method: 'POST', credentials: 'include' });
      if (!res.ok) return false;
      const body = await res.json();
      accessToken = body.accessToken;
      return true;
    } catch {
      return false;
    } finally {
      setTimeout(() => (refreshing = null), 0);
    }
  })();
  return refreshing;
}

async function request<T>(method: string, path: string, body?: unknown, retry = true): Promise<T> {
  const isForm = body instanceof FormData;
  const res = await fetch(`/api${path}`, {
    method,
    credentials: 'include',
    headers: {
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...(body !== undefined && !isForm ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
  });
  if (res.status === 401 && retry && !path.startsWith('/admin/auth/')) {
    if (await refreshSession()) return request<T>(method, path, body, false);
    onSessionExpired?.();
  }
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const e = data?.error ?? {};
    throw new ApiError(res.status, e.code ?? 'ERROR', e.message ?? `Request failed (${res.status})`, e.details);
  }
  return data as T;
}

export const api = {
  get: <T = any>(path: string) => request<T>('GET', path),
  post: <T = any>(path: string, body?: unknown) => request<T>('POST', path, body ?? {}),
  put: <T = any>(path: string, body: unknown) => request<T>('PUT', path, body),
  del: <T = any>(path: string) => request<T>('DELETE', path),
  upload: <T = any>(path: string, form: FormData) => request<T>('POST', path, form),
};

export const qs = (params: Record<string, unknown>) => {
  const s = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '') s.set(k, String(v));
  const str = s.toString();
  return str ? `?${str}` : '';
};

export interface Paged<T> {
  items: T[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
}
