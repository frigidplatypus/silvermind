// Vite proxies /api → sbtask serve in dev; mobile and desktop use direct localhost:7433
const SBTASK_PORT = 7433;
const API_BASE = typeof window !== 'undefined' && ((window as any).go?.main?.App || (window as any).Capacitor)
  ? `http://127.0.0.1:${SBTASK_PORT}`
  : '/api';
const REQUEST_TIMEOUT_MS = 30_000;

let _activeSpace = '';

export function setApiSpace(name: string) { _activeSpace = name; }

interface ApiError {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

class ApiClientError extends Error {
  code: string;
  status: number;
  details?: Record<string, unknown>;

  constructor(status: number, body: any) {
    // sbtask serve sends {error: "message", code: "xxx"}
    // We normalize to {error: {code, message}} for consistency
    const errorBody = typeof body?.error === 'string'
      ? { code: body.code || 'UNKNOWN', message: body.error }
      : body?.error ?? { code: 'UNKNOWN', message: String(status) };
    super(errorBody.message);
    this.name = 'ApiClientError';
    this.code = errorBody.code;
    this.status = status;
    this.details = errorBody.details;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  let urlPath = path;
  const activeSpace = _activeSpace;
  if (activeSpace) {
    const sep = path.includes('?') ? '&' : '?';
    urlPath = `${path}${sep}space=${encodeURIComponent(activeSpace)}`;
  }
  const url = `${API_BASE}${urlPath}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: { ...headers, ...(options.headers as Record<string, string>) },
    });
    clearTimeout(timer);

    if (res.status === 204) {
      return undefined as T;
    }

    let body: any;
    try {
      body = await res.json();
    } catch {
      const text = await res.text().catch(() => '');
      throw new ApiClientError(res.status, {
        error: {
          code: 'PARSE_ERROR',
          message: text ? `Server returned: ${text.slice(0, 200)}` : `HTTP ${res.status} ${res.statusText}`,
        },
      });
    }

    if (!res.ok) {
      throw new ApiClientError(res.status, body);
    }

    return body as T;
  } catch (e) {
    clearTimeout(timer);
    if (e instanceof DOMException && e.name === 'AbortError') {
      const timeoutErr = new ApiClientError(0, {
        error: { code: 'TIMEOUT', message: 'Request timed out' },
      });
      console.error(`[api] ${url} — timed out after ${REQUEST_TIMEOUT_MS / 1000}s`);
      throw timeoutErr;
    }
    if (e instanceof ApiClientError) {
      console.error(`[api] ${url} — HTTP ${e.status} (${e.code}): ${e.message}`);
    } else {
      console.error(`[api] ${url} — network error:`, e);
    }
    throw e;
  }
}

export { API_BASE, ApiClientError };
export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PATCH', body: body ? JSON.stringify(body) : undefined }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
  put: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PUT', body: body ? JSON.stringify(body) : undefined }),
};
