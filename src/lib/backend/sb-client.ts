import { Capacitor, CapacitorHttp } from '@capacitor/core';
import { SbClientError, PreconditionFailedError } from './task-types';
import type { SilverBulletPage } from './task-types';
import { logDebug, logInfo, logWarn, logError } from '$lib/helpers/logger';

export interface SbClientConfig {
  spaceURL: string;
  authToken?: string;
}

export type Transport = (url: string, options: RequestInit) => Promise<Response>;

function detectTransport(): Transport {
  if (typeof window !== 'undefined' && (window as any).go?.main?.App?.ProxyFetch) {
    return goProxyTransport;
  }
  if (typeof window !== 'undefined' && Capacitor.isNativePlatform()) {
    return capacitorTransport;
  }
  return fetchTransport;
}

async function fetchTransport(url: string, options: RequestInit): Promise<Response> {
  return fetch(url, options);
}

async function goProxyTransport(url: string, options: RequestInit): Promise<Response> {
  const goApp = (window as any).go?.main?.App;
  const headersJSON = options.headers
    ? Object.entries(options.headers as Record<string, string>)
        .map(([k, v]) => `${k}: ${v}`)
        .join('\n')
    : '';
  const result = await goApp.ProxyFetch(
    url,
    options.method || 'GET',
    headersJSON,
    (options.body as string) || '',
  );
  if (result.error) {
    throw new Error(result.error);
  }
  return new Response(result.body, {
    status: result.status || 200,
    headers: result.headers || {},
  });
}

async function capacitorTransport(url: string, options: RequestInit): Promise<Response> {
  const result = await CapacitorHttp.request({
    url,
    method: (options.method || 'GET') as any,
    headers: (options.headers as Record<string, string>) || {},
    data: options.body,
  });
  return {
    ok: result.status >= 200 && result.status < 300,
    status: result.status,
    json: async () => result.data,
    text: async () => (typeof result.data === 'string' ? result.data : JSON.stringify(result.data)),
    headers: new Headers(result.headers as Record<string, string>),
  } as Response;
}

export function createSbClient(config: SbClientConfig) {
  const transport = detectTransport();
  const baseURL = config.spaceURL.replace(/\/+$/, '');
  logInfo(`SbClient created for ${baseURL}`);
  const authToken = config.authToken;

  function authHeaders(): Record<string, string> {
    if (!authToken) return {};
    return { Authorization: `Bearer ${authToken}` };
  }

  function encodePagePath(path: string): string {
    return path.split('/').map(encodeURIComponent).join('/');
  }

  async function readPage(path: string): Promise<SilverBulletPage> {
    // Try .md extension first, since that's the standard SilverBullet page format
    const urlMd = `${baseURL}/.fs/${encodePagePath(path)}.md`;
    logInfo(`SB GET ${urlMd}`);
    let res: Response;
    try {
      res = await transport(urlMd, {
        method: 'GET',
        headers: { ...authHeaders() },
      });
    } catch (e: any) {
      logError(`SB fetch failed: ${urlMd} — ${e.message || e}`);
      throw new SbClientError(0, 'NETWORK_ERROR', `Cannot reach SilverBullet: ${e.message || e}`);
    }

    if (res.status === 404) {
      // Fallback to path without extension
      const url = `${baseURL}/.fs/${encodePagePath(path)}`;
      logInfo(`SB GET ${url} (fallback without .md)`);
      let resMd: Response;
      try {
        resMd = await transport(urlMd, {
          method: 'GET',
          headers: { ...authHeaders() },
        });
      } catch (e: any) {
        logError(`SB fetch failed: ${urlMd} — ${e.message || e}`);
        throw new SbClientError(0, 'NETWORK_ERROR', `Cannot reach SilverBullet: ${e.message || e}`);
      }
      if (resMd.status === 404) {
        logWarn(`SB page not found: ${path}`);
        return { content: '', lastModified: 0 };
      }
      if (!resMd.ok) {
        logError(`SB read error: ${path}.md HTTP ${resMd.status}`);
        throw new SbClientError(
          resMd.status,
          'SB_READ_ERROR',
          `Failed to read page: HTTP ${resMd.status}`,
        );
      }
      const content = await resMd.text();
      logInfo(`SB read OK: ${path}.md (${content.length} bytes)`);
      const lastModified = parseInt(resMd.headers.get('Last-Modified') || '0', 10) || Date.now();
      return { content, lastModified };
    }

    if (!res.ok) {
      logError(`SB read error: ${path} HTTP ${res.status}`);
      throw new SbClientError(
        res.status,
        'SB_READ_ERROR',
        `Failed to read page: HTTP ${res.status}`,
      );
    }

    const content = await res.text();
    logInfo(`SB read OK: ${path} (${content.length} bytes)`);
    const lastModified = parseInt(res.headers.get('Last-Modified') || '0', 10) || Date.now();
    return { content, lastModified };
  }

  async function writePage(path: string, content: string, lastModified?: number): Promise<void> {
    // Always use .md extension for writing
    const writePath = path.endsWith('.md') ? path : `${path}.md`;
    const url = `${baseURL}/.fs/${encodePagePath(writePath)}`;
    const headers: Record<string, string> = {
      'Content-Type': 'text/markdown',
      ...authHeaders(),
    };
    if (lastModified) {
      headers['If-Match'] = String(lastModified);
    }

    logInfo(
      `SB PUT ${url} (${content.length} bytes, ifMatch=${lastModified ? String(lastModified) : 'none'})`,
    );
    const res = await transport(url, {
      method: 'PUT',
      headers,
      body: content,
    });

    if (res.status === 412) {
      logWarn(`SB write precondition failed: ${path} HTTP 412`);
      throw new PreconditionFailedError();
    }

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      logError(`SB write error: ${path} HTTP ${res.status} — ${body.slice(0, 300)}`);
      throw new SbClientError(
        res.status,
        'SB_WRITE_ERROR',
        `Failed to write page: HTTP ${res.status}`,
      );
    }
    logInfo(`SB write OK: ${path} HTTP ${res.status}`);
  }

  async function readModifyWrite(
    path: string,
    fn: (content: string) => Promise<string>,
    maxRetries = 3,
  ): Promise<void> {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      logInfo(`SB readModifyWrite start: ${path} attempt=${attempt + 1}/${maxRetries + 1}`);
      const page = await readPage(path);
      const modified = await fn(page.content);
      if (modified === page.content) {
        logWarn(`SB readModifyWrite unchanged content: ${path} attempt=${attempt + 1}`);
      }
      try {
        await writePage(path, modified, page.lastModified);
        logInfo(`SB readModifyWrite complete: ${path} attempt=${attempt + 1}`);
        return;
      } catch (e) {
        if (e instanceof PreconditionFailedError && attempt < maxRetries) {
          logWarn(`SB readModifyWrite retrying after conflict: ${path} attempt=${attempt + 1}`);
          continue;
        }
        throw e;
      }
    }
  }

  async function queryTasks(params: Record<string, string>): Promise<any[]> {
    const qs = new URLSearchParams(params).toString();
    const url = `${baseURL}/.runtime/objects/task${qs ? '?' + qs : ''}`;
    logInfo(`SB QUERY ${url}`);
    let res: Response;
    try {
      res = await transport(url, {
        method: 'GET',
        headers: { ...authHeaders() },
      });
    } catch (e: any) {
      logError(`SB query failed: ${url} — ${e.message || e}`);
      throw new SbClientError(0, 'NETWORK_ERROR', `Cannot reach SilverBullet: ${e.message || e}`);
    }

    if (res.status === 503) {
      logError(`SB Runtime API unavailable (503)`);
      throw new SbClientError(
        503,
        'RUNTIME_UNAVAILABLE',
        'SilverBullet Runtime API is not available',
      );
    }

    if (!res.ok) {
      logError(`SB query error: HTTP ${res.status}`);
      throw new SbClientError(
        res.status,
        'SB_QUERY_ERROR',
        `Failed to query tasks: HTTP ${res.status}`,
      );
    }

    const data = await res.json();
    logInfo(`SB query OK: ${data.length} tasks`);
    return data;
  }

  async function getTask(ref: string): Promise<any | null> {
    const url = `${baseURL}/.runtime/objects/task/${encodePagePath(ref)}`;
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
    const params = new URLSearchParams();
    params.set('where[tags][contains]', tag);
    params.set('limit', '100');
    const url = `${baseURL}/.runtime/objects/page?${params.toString()}`;
    logInfo(`SB FIND_PAGES: tag=${tag} url=${url}`);
    const res = await transport(url, {
      method: 'GET',
      headers: { ...authHeaders() },
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      logError(`SB FIND_PAGES failed: HTTP ${res.status} — ${body}`);
      throw new SbClientError(
        res.status,
        'SB_FIND_ERROR',
        `Failed to find pages: HTTP ${res.status}`,
      );
    }

    const raw = await res.json();
    logInfo(
      `SB FIND_PAGES OK: ${Array.isArray(raw) ? raw.length : 'non-array'} items, first: ${JSON.stringify(Array.isArray(raw) ? raw[0] : raw).slice(0, 200)}`,
    );
    const pages: { name: string }[] = Array.isArray(raw) ? raw : [];
    const names = pages.map((p) => p.name).filter(Boolean);
    logInfo(`SB FIND_PAGES result: ${names.length} page names: ${JSON.stringify(names)}`);
    return names;
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
