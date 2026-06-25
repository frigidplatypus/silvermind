import { api } from './client';
import type { SpacesResponse } from '$lib/types/space';

export async function getSpaces(): Promise<SpacesResponse> {
  return api.get<SpacesResponse>('/spaces');
}

export interface AddSpaceRequest {
  name: string;
  url: string;
  default_page?: string;
  inbox_page?: string;
  auth_token?: string;
}

export async function addSpace(req: AddSpaceRequest): Promise<{ status: string; name: string }> {
  return api.post<{ status: string; name: string }>('/spaces', req);
}

export interface UpdateSpaceRequest {
  name?: string;
  url?: string;
  default_page?: string;
  inbox_page?: string;
  auth_token?: string;
}

export async function updateSpace(name: string, req: UpdateSpaceRequest): Promise<{ status: string; name: string }> {
  return api.put<{ status: string; name: string }>(`/spaces/${encodeURIComponent(name)}`, req);
}

export async function removeSpace(name: string): Promise<{ status: string; name: string }> {
  return api.delete<{ status: string; name: string }>(`/spaces/${encodeURIComponent(name)}`);
}

export async function setActiveSpaceApi(name: string): Promise<{ status: string; name: string }> {
  return api.put<{ status: string; name: string }>('/spaces/active', { name });
}

export interface VerifySpaceRequest {
  url: string;
  auth_token?: string;
}

export interface VerifySpaceResponse {
  ok: boolean;
  task_count?: number;
  error?: string;
}

export async function verifySpace(req: VerifySpaceRequest): Promise<VerifySpaceResponse> {
  return api.post<VerifySpaceResponse>('/spaces/verify', req);
}
