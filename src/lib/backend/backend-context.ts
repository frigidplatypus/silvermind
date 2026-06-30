import { createSbClient, type SbClient, type SbClientConfig } from './sb-client';
import { createConfigManager, type ConfigManager } from './config-manager';
import type { SpaceConfig } from './task-types';

let _configManager: ConfigManager | null = null;
let _sbClient: SbClient | null = null;
let _activeSpaceName = '';

export function getConfigManager(): ConfigManager {
  if (!_configManager) {
    _configManager = createConfigManager();
  }
  return _configManager;
}

export async function initBackend(): Promise<SpaceConfig | null> {
  const cm = getConfigManager();
  await cm.load();
  const active = await cm.getActiveSpace();
  if (active) {
    _activeSpaceName = active.name;
    _sbClient = createSbClient({
      spaceURL: active.url,
      authToken: active.auth_token,
    });
  }
  return active;
}

export function getSbClient(): SbClient {
  if (!_sbClient) {
    throw new Error('No active SilverBullet space configured');
  }
  return _sbClient;
}

export function hasSbClient(): boolean {
  return !!_sbClient;
}

export async function ensureSbClient(): Promise<SbClient> {
  if (_sbClient) return _sbClient;
  await initBackend();
  if (!_sbClient) throw new Error('No active SilverBullet space configured');
  return _sbClient;
}

export async function getActiveSpace(): Promise<SpaceConfig | null> {
  const cm = getConfigManager();
  return cm.getActiveSpace();
}

export function getActiveSpaceName(): string {
  return _activeSpaceName;
}

export async function setActiveSpace(name: string): Promise<SpaceConfig | null> {
  const cm = getConfigManager();
  await cm.setActiveSpace(name);
  const spaces = await cm.getSpaces();
  const active = spaces.find(s => s.name === name) || null;
  if (active) {
    _activeSpaceName = active.name;
    _sbClient = createSbClient({
      spaceURL: active.url,
      authToken: active.auth_token,
    });
  }
  return active;
}

export async function getConfigStatus(): Promise<{
  exists: boolean;
  sbtask_exists: boolean;
  space_count: number;
  spaces: { name: string; url: string; default: boolean }[];
}> {
  const cm = getConfigManager();
  await cm.load();
  const spaces = await cm.getSpaces();
  const active = await cm.getActiveSpace();
  return {
    exists: spaces.length > 0,
    sbtask_exists: false,
    space_count: spaces.length,
    spaces: spaces.map(s => ({
      name: s.name,
      url: s.url,
      default: active?.name === s.name,
    })),
  };
}

export async function invalidateClient(): Promise<void> {
  _sbClient = null;
  const active = await getActiveSpace();
  if (active) {
    _sbClient = createSbClient({
      spaceURL: active.url,
      authToken: active.auth_token,
    });
  }
}
