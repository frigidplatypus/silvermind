import { createSbClient, type SbClient, type SbClientConfig } from './sb-client';
import { createConfigManager, type ConfigManager } from './config-manager';
import type { SpaceConfig, SpaceConfigRemote } from './task-types';
import { readSpaceConfig, readJournalPrefix } from './space-config';
import { logInfo, logWarn, logError } from '$lib/helpers/logger';

let _configManager: ConfigManager | null = null;
let _sbClient: SbClient | null = null;
let _activeSpaceName = '';
let _spaceConfig: SpaceConfigRemote = {};
let _journalPrefix = 'Journal/';
let _initPromise: Promise<SpaceConfig | null> | null = null;

export function getConfigManager(): ConfigManager {
  if (!_configManager) {
    _configManager = createConfigManager();
  }
  return _configManager;
}

export function getSpaceConfig(): SpaceConfigRemote {
  return _spaceConfig;
}

export function setSpaceConfig(config: SpaceConfigRemote) {
  _spaceConfig = config;
}

export function getJournalPrefix(): string {
  return _journalPrefix;
}

export async function initBackend(): Promise<SpaceConfig | null> {
  if (_initPromise) return _initPromise;
  _initPromise = (async () => {
    const cm = getConfigManager();
    logInfo('Loading config...');
    await cm.load();
    const active = await cm.getActiveSpace();
    if (active) {
      logInfo(`Active space: ${active.name} → ${active.url}`);
      _activeSpaceName = active.name;
      _sbClient = createSbClient({
        spaceURL: active.url,
        authToken: active.auth_token,
      });
      _spaceConfig = await readSpaceConfig(_sbClient);
      if (_spaceConfig.inbox_mode === 'journal') {
        _journalPrefix = await readJournalPrefix(_sbClient);
        logInfo(`Journal prefix: ${_journalPrefix}`);
      }
    } else {
      logWarn('No active space configured');
    }
    return active;
  })();
  return _initPromise;
}

export async function getSbClient(): Promise<SbClient> {
  if (_sbClient) return _sbClient;
  await initBackend();
  if (!_sbClient) {
    throw new Error('No active SilverBullet space configured');
  }
  return _sbClient;
}

export function getActiveSpaceName(): string {
  return _activeSpaceName;
}

export async function getActiveSpace(): Promise<SpaceConfig | null> {
  const cm = getConfigManager();
  await cm.load();
  return cm.getActiveSpace();
}

export async function setActiveSpace(name: string): Promise<SpaceConfig | null> {
  const cm = getConfigManager();
  await cm.setActiveSpace(name);
  const spaces = await cm.getSpaces();
  const active = spaces.find((s) => s.name === name) || null;
  if (active) {
    _activeSpaceName = active.name;
    _initPromise = Promise.resolve(active);
    _sbClient = createSbClient({
      spaceURL: active.url,
      authToken: active.auth_token,
    });
    _spaceConfig = await readSpaceConfig(_sbClient);
    if (_spaceConfig.inbox_mode === 'journal') {
      _journalPrefix = await readJournalPrefix(_sbClient);
      logInfo(`Journal prefix: ${_journalPrefix}`);
    }
  }
  return active;
}

export async function getConfigStatus(): Promise<{
  exists: boolean;
  space_count: number;
  spaces: { name: string; url: string; default: boolean }[];
}> {
  const cm = getConfigManager();
  await cm.load();
  const spaces = await cm.getSpaces();
  const active = await cm.getActiveSpace();
  return {
    exists: spaces.length > 0,
    space_count: spaces.length,
    spaces: spaces.map((s) => ({
      name: s.name,
      url: s.url,
      default: active?.name === s.name,
    })),
  };
}

export async function invalidateClient(): Promise<void> {
  _sbClient = null;
  _initPromise = null;
  const active = await getActiveSpace();
  if (active) {
    _sbClient = createSbClient({
      spaceURL: active.url,
      authToken: active.auth_token,
    });
  }
}
