#!/usr/bin/env node
// Dev proxy — forwards requests to live sbtask instances
// Spaces are proxied to their respective sbtask serve URLs

import { createServer, IncomingMessage, ServerResponse } from 'node:http';
import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';

const PORT = 7433;

interface SpaceConfig {
  id: string;
  name: string;
  is_default: boolean;
  url: string;
}

const SPACES: SpaceConfig[] = [
  { id: 'spc_notes', name: 'Notes', is_default: true, url: 'https://notes.fluffy-rooster.ts.net' },
  { id: 'spc_household', name: 'Household', is_default: false, url: 'https://household.fluffy-rooster.ts.net' },
];

function getSpaceUrl(spaceId: string): string | null {
  return SPACES.find((s) => s.id === spaceId)?.url ?? null;
}

function proxy(req: IncomingMessage, res: ServerResponse, targetUrl: string) {
  const parsed = new URL(req.url || '/', targetUrl);
  const isHttps = targetUrl.startsWith('https');

  const options = {
    hostname: parsed.hostname,
    port: parsed.port || (isHttps ? 443 : 80),
    path: parsed.pathname + parsed.search,
    method: req.method,
    headers: { ...req.headers, host: parsed.hostname },
    rejectUnauthorized: false,
  };

  const proxyReq = (isHttps ? httpsRequest : httpRequest)(options, (proxyRes) => {
    const headers = {
      ...proxyRes.headers,
      'access-control-allow-origin': '*',
    };
    res.writeHead(proxyRes.statusCode || 200, headers);
    proxyRes.pipe(res);
  });

  proxyReq.on('error', () => {
    res.writeHead(502);
    res.end(JSON.stringify({ error: { code: 'proxy_error', message: 'Failed to reach upstream' } }));
  });

  req.pipe(proxyReq);
}

function json(res: ServerResponse, data: unknown, status = 200) {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
  res.end(JSON.stringify(data));
}

const server = createServer((req, res) => {
  // CORS preflight
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Space-Id');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  const url = new URL(req.url || '/', `http://localhost:${PORT}`);
  const spaceId = (req.headers['x-space-id'] as string) || url.searchParams.get('space_id') || 'spc_notes';
  const targetUrl = getSpaceUrl(spaceId);

  // /spaces — return space config
  if (url.pathname === '/spaces') {
    return json(res, {
      spaces: SPACES.map(({ id, name, is_default }) => ({
        id, name, is_default,
        created_at: '2025-01-01T00:00:00Z',
      })),
    });
  }

  // /health — check upstream
  if (url.pathname === '/health') {
    if (!targetUrl) return json(res, { status: 'error', version: 'proxy', uptime_seconds: 0 }, 503);
    return proxy(req, res, `${targetUrl}/health`);
  }

  // All other requests — proxy to the correct instance
  if (!targetUrl) {
    return json(res, { error: { code: 'unknown_space', message: `Unknown space: ${spaceId}` } }, 400);
  }

  proxy(req, res, targetUrl + url.pathname + url.search);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[proxy] Dev proxy listening on http://0.0.0.0:${PORT}`);
  for (const s of SPACES) {
    console.log(`[proxy]   ${s.name} → ${s.url}`);
  }
});
