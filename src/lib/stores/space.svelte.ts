import type { Space } from '$lib/types/space';
import { getSpaces } from '$lib/api/spaces';
import { setApiSpace } from '$lib/api/client';

const ACTIVE_SPACE_KEY = 'active_space_id';

let spacesVal = $state<Space[]>([]);
let activeIdVal = $state<string | null>(null);
let isLoadingVal = $state(false);
let errorVal = $state<string | null>(null);

function persist(key: string, value: string) {
  try { localStorage.setItem(key, value); } catch { /* noop */ }
}

function restore(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}

export function getSpacesList(): Space[] { return spacesVal; }
export function getActiveSpace(): Space | null { return spacesVal.find((s) => s.id === activeIdVal) ?? null; }
export function getActiveId(): string | null { return activeIdVal; }
export function getSpacesLoading(): boolean { return isLoadingVal; }
export function getSpacesError(): string | null { return errorVal; }

export function currentSpaceId(): string | null {
  return activeIdVal;
}

export async function loadSpaces(): Promise<void> {
  isLoadingVal = true;
  errorVal = null;
  try {
    const res = await getSpaces();
    const raw = Array.isArray(res) ? res : [];
    spacesVal = raw.map((s: any) => ({
        id: s.name || s.url,
        name: s.name || s.url,
        url: s.url,
        active: s.active ?? false,
        is_default: s.is_default ?? false,
      }));
    const value = restore(ACTIVE_SPACE_KEY);
    if (value && spacesVal.some((s) => s.id === value)) {
      activeIdVal = value;
    } else {
      activeIdVal = spacesVal.find((s) => s.active)?.id ?? spacesVal[0]?.id ?? null;
    }
    if (activeIdVal) setApiSpace(activeIdVal);
  } catch (e) {

    errorVal = e instanceof Error ? e.message : 'Failed to load spaces';
  } finally {
    isLoadingVal = false;
  }
}

export async function setActiveSpace(spaceId: string): Promise<void> {
  if (spacesVal.some((s) => s.id === spaceId)) {
    activeIdVal = spaceId;
    persist(ACTIVE_SPACE_KEY, spaceId);
    setApiSpace(spaceId);
    // Reload task lists with the new active space
    const { loadInbox, loadToday } = await import('./tasks.svelte');
    const { loadGlobalView } = await import('./global.svelte');
    Promise.all([loadInbox(), loadToday()]).catch(() => {});
    loadGlobalView();
  }
}
