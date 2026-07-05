import { SbClientError } from '$lib/backend/task-types';

export function formatError(e: unknown, spaceName?: string): string {
  const prefix = spaceName ? `[${spaceName}] ` : '';
  if (e instanceof SbClientError) {
    return `${prefix}HTTP ${e.status} (${e.code}): ${e.message}`;
  }
  if (e instanceof TypeError && e.message === 'Failed to fetch') {
    return `${prefix}Cannot reach SilverBullet server. Check your network connection.`;
  }
  return `${prefix}${e instanceof Error ? e.message : String(e)}`;
}
