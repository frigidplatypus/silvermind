import {
  listSpaces,
  addSpace,
  removeSpace,
  setActive,
  verifySpace,
} from '$lib/backend/space-operations';
import { getConfigManager, getSpaceConfig, getSbClient } from '$lib/backend/backend-context';
import { readSpaceConfig, writeSpaceConfig, ensureSpaceConfig } from '$lib/backend/space-config';
import type { SpaceConfigRemote, FavoriteQuery } from '$lib/backend/task-types';
import type { SpacesResponse } from '$lib/types/space';

export async function getSpaces(): Promise<SpacesResponse> {
  const cm = getConfigManager();
  await cm.load();
  const active = await cm.getActiveSpace();
  const spaces = await listSpaces();
  return spaces.map((s) => ({
    id: s.name,
    name: s.name,
    url: s.url,
    active: active?.name === s.name,
    is_default: s.name === 'main',
  }));
}

export interface AddSpaceRequest {
  name: string;
  url: string;
  default_page?: string;
  auth_token?: string;
}

export async function addSpaceFn(req: AddSpaceRequest): Promise<{ status: string; name: string }> {
  await addSpace(req.name, req.url, req.default_page, undefined, req.auth_token, undefined);
  return { status: 'ok', name: req.name };
}
export { addSpaceFn as addSpace };

export interface UpdateSpaceRequest {
  name?: string;
  url?: string;
  default_page?: string;
  auth_token?: string;
}

export async function updateSpace(
  name: string,
  req: UpdateSpaceRequest,
): Promise<{ status: string; name: string }> {
  const cm = getConfigManager();
  await cm.load();
  await cm.updateSpace(
    name,
    req.name || name,
    req.url || '',
    req.default_page,
    undefined,
    req.auth_token,
    undefined,
  );
  return { status: 'ok', name: req.name || name };
}

export async function removeSpaceFn(name: string): Promise<{ status: string; name: string }> {
  await removeSpace(name);
  return { status: 'ok', name };
}
export { removeSpaceFn as removeSpace };

export async function setActiveSpaceApi(name: string): Promise<{ status: string; name: string }> {
  await setActive(name);
  return { status: 'ok', name };
}

export async function getSpaceConfigFn(): Promise<SpaceConfigRemote> {
  const sbClient = await getSbClient();
  return readSpaceConfig(sbClient);
}
export { getSpaceConfigFn as getSpaceConfig };

export interface UpdateSpaceConfigRequest {
  inbox_mode?: string;
  inbox_page?: string;
  exclude_tags?: string[];
  default_sort_by?: string;
  default_sort_order?: string;
  favorites?: FavoriteQuery[];
}

export async function updateSpaceConfigFn(req: UpdateSpaceConfigRequest): Promise<void> {
  const sbClient = await getSbClient();
  const current = await readSpaceConfig(sbClient);
  const updated: SpaceConfigRemote = {
    inbox_mode: req.inbox_mode ?? current.inbox_mode,
    inbox_page: req.inbox_page ?? current.inbox_page,
    exclude_tags: req.exclude_tags ?? current.exclude_tags,
    default_sort_by: req.default_sort_by ?? current.default_sort_by,
    default_sort_order: req.default_sort_order ?? current.default_sort_order,
    favorites: req.favorites ?? current.favorites,
  };
  await writeSpaceConfig(sbClient, updated);
}
export { updateSpaceConfigFn as updateSpaceConfig };

export async function deploySpaceConfig(): Promise<{ created: boolean }> {
  const sbClient = await getSbClient();
  const result = await ensureSpaceConfig(sbClient);
  return { created: result.created };
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

export async function verifySpaceFn(req: VerifySpaceRequest): Promise<VerifySpaceResponse> {
  return verifySpace(req.url, req.auth_token);
}
export { verifySpaceFn as verifySpace };
