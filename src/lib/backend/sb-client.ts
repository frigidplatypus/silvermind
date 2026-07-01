import { SbClientError, PreconditionFailedError } from './task-types';
import type { SilverBulletPage } from './task-types';
import { logDebug, logInfo, logWarn, logError } from '$lib/helpers/logger';

export interface SbClientConfig {
  spaceURL: string;
  authToken?: string;
}

export type Transport = (url: string, options: RequestInit) => Promise<Response>;

function detectTransport(): Transport {
  if (typeof window !== 'undefined' && (window as any).Capacitor) {
    return capacitorTransport;
  }
  return windowFetchTransport;
}

async function windowFetchTransport(url: string, options: RequestInit): Promise<Response> {
  return fetch(url, options);
}

async function capacitorTransport(url: string, options: RequestInit): Promise<Response> {
  const { CapacitorHttp } = await import('@capacitor/http');
  const { url: reqUrl, ...fetchOpts } = (() => {
    const { url: _u, ...rest } = { url, ...options };
    return { url: _u, ...rest };
  })();
  const result = await CapacitorHttp.request({
    url: reqUrl,
    method: (options.method || 'GET') as any,
    headers: options.headers as Record<string, string> || {},
    data: options.body,
  });
  return {
    ok: result.status >= 200 && result.status < 300,
    status: result.status,
    json: async () => result.data,
    text: async () => typeof result.data === 'string' ? result.data : JSON.stringify(result.data),
    headers: new Headers(result.headers as Record<string, string>),
  } as Response;
}

export function createSbClient(config: SbClientConfig) {
  const transport = detectTransport();
  const baseURL = config.spaceURL.replace(/\/+$/, '');
  const authToken = config.authToken;

  function authHeaders(): Record<string, string> {
    if (!authToken) return {};
    return { Authorization: `Bearer ${authToken}` };
  }

  async function readPage(path: string): Promise<SilverBulletPage> {
    const url = `${baseURL}/.fs/${encodeURIComponent(path)}`;
    logDebug(`SB GET ${url}`);
    const res = await transport(url, {
      method: 'GET',
      headers: { ...authHeaders() },
    });

    if (res.status === 404) {
      const urlMd = `${baseURL}/.fs/${encodeURIComponent(path)}.md`;
      logDebug(`SB GET ${urlMd} (fallback .md)`);
      const resMd = await transport(urlMd, {
        method: 'GET',
        headers: { ...authHeaders() },
      });
      if (resMd.status === 404) {
        logWarn(`SB page not found: ${path}`);
        return { content: '', lastModified: 0 };
      }
      if (!resMd.ok) {
        logError(`SB read error: ${path}.md HTTP ${resMd.status}`);
        throw new SbClientError(resMd.status, 'SB_READ_ERROR', `Failed to read page: HTTP ${resMd.status}`);
      }
      const content = await resMd.text();
      logDebug(`SB read OK: ${path}.md (${content.length} bytes)`);
      const lastModified = parseInt(resMd.headers.get('Last-Modified') || '0', 10) || Date.now();
      return { content, lastModified };
    }

    if (!res.ok) {
      logError(`SB read error: ${path} HTTP ${res.status}`);
      throw new SbClientError(res.status, 'SB_READ_ERROR', `Failed to read page: HTTP ${res.status}`);
    }

    const content = await res.text();
    logDebug(`SB read OK: ${path} (${content.length} bytes)`);
    const lastModified = parseInt(res.headers.get('Last-Modified') || '0', 10) || Date.now();
    return { content, lastModified };
  }

  async function writePage(path: string, content: string, lastModified?: number): Promise<void> {
    const url = `${baseURL}/.fs/${encodeURIComponent(path)}`;
    const headers: Record<string, string> = {
      'Content-Type': 'text/markdown',
      ...authHeaders(),
    };
    if (lastModified) {
      headers['If-Match'] = String(lastModified);
    }

    const res = await transport(url, {
      method: 'PUT',
      headers,
      body: content,
    });

    if (res.status === 412) {
      throw new PreconditionFailedError();
    }

    if (!res.ok) {
      throw new SbClientError(res.status, 'SB_WRITE_ERROR', `Failed to write page: HTTP ${res.status}`);
    }
  }

  async function readModifyWrite(
    path: string,
    fn: (content: string) => Promise<string>,
    maxRetries = 3,
  ): Promise<void> {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      const page = await readPage(path);
      const modified = await fn(page.content);
      try {
        await writePage(path, modified, page.lastModified);
        return;
      } catch (e) {
        if (e instanceof PreconditionFailedError && attempt < maxRetries) {
          continue;
        }
        throw e;
      }
    }
  }

  async function queryTasks(params: Record<string, string>): Promise<any[]> {
    const qs = new URLSearchParams(params).toString();
    const url = `${baseURL}/.runtime/objects/task${qs ? '?' + qs : ''}`;
    const res = await transport(url, {
      method: 'GET',
      headers: { ...authHeaders() },
    });

    if (res.status === 503) {
      throw new SbClientError(503, 'RUNTIME_UNAVAILABLE', 'SilverBullet Runtime API is not available');
    }

    if (!res.ok) {
      throw new SbClientError(res.status, 'SB_QUERY_ERROR', `Failed to query tasks: HTTP ${res.status}`);
    }

    return res.json();
  }

  async function getTask(ref: string): Promise<any | null> {
    const url = `${baseURL}/.runtime/objects/task/${encodeURIComponent(ref)}`;
    const res = await transport(url, {
      method: 'GET',
      headers: { ...authHeaders() },
    });

    if (res.status === 404) return null;

    if (!res.ok) {
      throw new SbClientError(res.status, 'SB_GET_ERROR', `Failed to get task: HTTP ${res.status}`);
    }

    return res.json();
  }

  async function findPagesByTag(tag: string): Promise<string[]> {
    const url = `${baseURL}/.runtime/objects/page?tag=${encodeURIComponent(tag)}`;
    const res = await transport(url, {
      method: 'GET',
      headers: { ...authHeaders() },
    });

    if (!res.ok) {
      throw new SbClientError(res.status, 'SB_FIND_ERROR', `Failed to find pages: HTTP ${res.status}`);
    }

    return res.json();
  }

  return {
    readPage,
    writePage,
    readModifyWrite,
    queryTasks,
    getTask,
    findPagesByTag,
    getBaseURL: () => baseURL,
  };
}

export type SbClient = ReturnType<typeof createSbClient>;
