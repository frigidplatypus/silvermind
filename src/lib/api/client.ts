import { setActiveSpace, getActiveSpaceName } from '$lib/backend/backend-context';

const API_BASE = typeof window !== 'undefined' && (!(window as any).go?.main?.App && !(window as any).Capacitor)
  ? '/api'
  : '';

export function setApiSpace(name: string) {
  setActiveSpace(name).catch(() => {});
}

export { API_BASE, getActiveSpaceName as getActiveSpace };
