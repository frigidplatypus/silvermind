import { ApiClientError } from '$lib/api/client';

export function formatError(e: unknown, spaceName?: string): string {
  const prefix = spaceName ? `[${spaceName}] ` : '';
  if (e instanceof ApiClientError) {
    const detail = e.details ? ` — ${JSON.stringify(e.details)}` : '';
    return `${prefix}HTTP ${e.status}${e.code ? ` (${e.code})` : ''}: ${e.message}${detail}`;
  }
  if (e instanceof TypeError && e.message === 'Failed to fetch') {
    return `${prefix}Cannot reach server at localhost:7433. Is sbtask running?`;
  }
  return `${prefix}${e instanceof Error ? e.message : String(e)}`;
}
