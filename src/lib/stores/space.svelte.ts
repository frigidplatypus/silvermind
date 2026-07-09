import type { Space } from '$lib/types/space';
import { getSpaces } from '$lib/api/spaces';
import { setApiSpace } from '$lib/api/client';
import { isDesktopApp, listSpacesDesktop, setActiveSpaceDesktop } from '$lib/desktop-bridge';
import { logError, logInfo, logWarn } from '$lib/helpers/logger';

const ACTIVE_SPACE_KEY = 'active_space_id';

let spacesVal = $state<Space[]>([]);
let activeIdVal = $state<string | null>(null);
let isLoadingVal = $state(false);
let errorVal = $state<string | null>(null);

function persist(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* noop */
  }
}

function restore(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function getSpacesList(): Space[] {
  return spacesVal;
}
export function getActiveSpace(): Space | null {
  return spacesVal.find((s) => s.id === activeIdVal) ?? null;
}
export function getActiveId(): string | null {
  return activeIdVal;
}
export function getSpacesLoading(): boolean {
  return isLoadingVal;
}
export function getSpacesError(): string | null {
  return errorVal;
}

export function currentSpaceId(): string | null {
  return activeIdVal;
}

export async function loadSpaces(): Promise<void> {
  isLoadingVal = true;
  errorVal = null;
  try {
    const res = isDesktopApp() ? await listSpacesDesktop() : await getSpaces();
    const raw = Array.isArray(res) ? res : [];
    const nextSpaces = raw.map((s: any) => ({
      id: s.name || s.url,
      name: s.name || s.url,
      url: s.url || s.space,
      inbox_page: s.inbox_page || 'Inbox',
      default_exclude_tags: s.default_exclude_tags || [],
      active: s.active ?? false,
      is_default: s.is_default ?? false,
    }));
    if (nextSpaces.length === 0 && spacesVal.length > 0) {
      logWarn('[spaces] load returned no spaces; preserving previous list');
      errorVal = 'No spaces returned from config';
      return;
    }
    spacesVal = nextSpaces;
    const configuredActive = spacesVal.find((s) => s.active)?.id ?? null;
    const restoredActive = restore(ACTIVE_SPACE_KEY);
    if (configuredActive) {
      activeIdVal = configuredActive;
    } else if (restoredActive && spacesVal.some((s) => s.id === restoredActive)) {
      activeIdVal = restoredActive;
    } else {
      activeIdVal = spacesVal[0]?.id ?? null;
    }
    if (activeIdVal) {
      persist(ACTIVE_SPACE_KEY, activeIdVal);
      await setApiSpace(activeIdVal);
    }
    logInfo(`[spaces] loaded ${spacesVal.length} spaces; active="${activeIdVal ?? ''}"`);
  } catch (e) {
    errorVal = e instanceof Error ? e.message : 'Failed to load spaces';
    logError(`[spaces] load failed: ${errorVal}`);
  } finally {
    isLoadingVal = false;
  }
}

export async function setActiveSpace(spaceId: string): Promise<void> {
  const target = spacesVal.find((s) => s.id === spaceId || s.name === spaceId);
  if (!target) {
    logWarn(`[spaces] ignored active-space switch for unknown space "${spaceId}"`);
    return;
  }

  errorVal = null;
  logInfo(`[spaces] switching active space to "${target.name}" (${target.url})`);
  if (isDesktopApp()) {
    const updated = await setActiveSpaceDesktop(target.name);
    const nextSpaces = Array.isArray(updated)
      ? updated.map((s: any) => ({
          id: s.name || s.url,
          name: s.name || s.url,
          url: s.url || s.space,
          inbox_page: s.inbox_page || 'Inbox',
          default_exclude_tags: s.default_exclude_tags || [],
          active: s.active ?? false,
          is_default: s.is_default ?? false,
        }))
      : [];
    if (nextSpaces.length > 0) spacesVal = nextSpaces;
  }

  await setApiSpace(target.name);
  activeIdVal = target.id;
  persist(ACTIVE_SPACE_KEY, target.id);

  const refreshedActive = spacesVal.find((s) => s.id === target.id);
  spacesVal = spacesVal.map((s) => ({ ...s, active: s.id === target.id }));
  if (!refreshedActive) await loadSpaces();

  const { loadInbox, loadToday } = await import('./tasks.svelte');
  const { loadGlobalView } = await import('./global.svelte');
  await Promise.allSettled([loadInbox(), loadToday(), loadGlobalView()]);
  logInfo(`[spaces] active space switched to "${target.name}"`);
}
