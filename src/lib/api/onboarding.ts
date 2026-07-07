import { verifySpace } from '$lib/backend/space-operations';

export interface ConfigStatus {
  exists: boolean;
  space_count: number;
  spaces: { name: string; url: string; default: boolean }[];
}

export interface VerifyResult {
  ok: boolean;
  task_count?: number;
  error?: string;
}

export async function getConfigStatus(): Promise<ConfigStatus> {
  const { getConfigStatus } = await import('$lib/backend/backend-context');
  return getConfigStatus();
}

export async function verifySpaceFn(url: string, authToken?: string): Promise<VerifyResult> {
  return verifySpace(url, authToken);
}
export { verifySpaceFn as verifySpace };
