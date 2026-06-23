import { api } from './client';

export interface ConfigStatus {
  exists: boolean;
  sbtask_exists: boolean;
  space_count: number;
  spaces: { name: string; url: string; default: boolean }[];
}

export interface VerifyResult {
  ok: boolean;
  task_count?: number;
  error?: string;
}

export async function getConfigStatus(): Promise<ConfigStatus> {
  return api.get<ConfigStatus>('/config/status');
}

export async function verifySpace(url: string, authToken?: string): Promise<VerifyResult> {
  return api.post<VerifyResult>('/spaces/verify', { url, auth_token: authToken ?? '' });
}
