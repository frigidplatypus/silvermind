import * as yaml from 'js-yaml';
import type { SilvermindConfig, SpaceConfig } from './task-types';
import { logInfo, logWarn } from '$lib/helpers/logger';

export interface ConfigStore {
  read(): Promise<string | null>;
  write(raw: string): Promise<void>;
}

function createBrowserStore(): ConfigStore {
  const key = 'silvermind_config';
  return {
    async read(): Promise<string | null> {
      return localStorage.getItem(key);
    },
    async write(raw: string): Promise<void> {
      localStorage.setItem(key, raw);
    },
  };
}

function createWailsStore(): ConfigStore {
  return {
    async read(): Promise<string | null> {
      const go = (window as any).go?.main?.App;
      if (!go?.ReadConfig) return null;
      try {
        return await go.ReadConfig();
      } catch {
        return null;
      }
    },
    async write(raw: string): Promise<void> {
      const go = (window as any).go?.main?.App;
      if (go?.WriteConfig) {
        await go.WriteConfig(raw);
      }
    },
  };
}

function createCapacitorStore(): ConfigStore {
  const key = 'silvermind_config';

  return {
    async read(): Promise<string | null> {
      try {
        const { Preferences } = await import('@capacitor/preferences');
        const stored = await Preferences.get({ key });
        return stored.value;
      } catch {
        return null;
      }
    },
    async write(raw: string): Promise<void> {
      const { Preferences } = await import('@capacitor/preferences');
      await Preferences.set({ key, value: raw });
    },
  };
}

function detectStore(): ConfigStore {
  if (typeof window !== 'undefined' && (window as any).go?.main?.App) {
    return createWailsStore();
  }
  if (typeof window !== 'undefined' && (window as any).Capacitor) {
    return createCapacitorStore();
  }
  return createBrowserStore();
}

function emptyConfig(): SilvermindConfig {
  return {
    spaces: {},
    active_space: '',
  };
}

export function createConfigManager() {
  const store = detectStore();
  let cache: SilvermindConfig | null = null;

  async function load(): Promise<SilvermindConfig> {
    const raw = await store.read();
    if (!raw) {
      cache = emptyConfig();
      return cache;
    }
    try {
      const parsed = yaml.load(raw) as any;
      const rawSpaces: Record<string, any> = parsed?.spaces || {};
      const normalized: Record<string, SpaceConfig> = {};
      for (const [name, sp] of Object.entries(rawSpaces)) {
        normalized[name] = {
          name,
          url: (sp as any).space || (sp as any).url || '',
          default_page: (sp as any).default_page || 'Tasks',
          auth_token: (sp as any).auth_token || '',
        };
      }
      cache = {
        spaces: normalized,
        active_space: parsed?.active_space || '',
      };
      return cache;
    } catch {
      cache = emptyConfig();
      return cache;
    }
  }

  async function save(): Promise<void> {
    if (!cache) return;
    const rawSpaces: Record<string, any> = {};
    for (const [name, sp] of Object.entries(cache.spaces)) {
      rawSpaces[name] = {
        space: sp.url,
        default_page: sp.default_page,
        auth_token: sp.auth_token || '',
      };
    }
    const raw = yaml.dump({
      spaces: rawSpaces,
      active_space: cache.active_space,
    });
    await store.write(raw);
  }

  async function getSpaces(): Promise<SpaceConfig[]> {
    const config = cache || (await load());
    return Object.entries(config.spaces).map(([name, sp]) => ({
      name,
      url: sp.url,
      default_page: sp.default_page || 'Tasks',
      auth_token: sp.auth_token,
    }));
  }

  async function getActiveSpace(): Promise<SpaceConfig | null> {
    const config = cache || (await load());
    if (!config.active_space) return null;
    const sp = config.spaces[config.active_space];
    if (!sp) return null;
    return {
      name: config.active_space,
      url: sp.url,
      default_page: sp.default_page || 'Tasks',
      auth_token: sp.auth_token,
    };
  }

  async function addSpace(
    name: string,
    url: string,
    defaultPage?: string,
    _inboxPage?: string,
    authToken?: string,
    _excludeTags?: string[],
  ): Promise<SpaceConfig[]> {
    const config = cache || (await load());
    const nameLower = name.toLowerCase();
    for (const existingName of Object.keys(config.spaces)) {
      if (existingName.toLowerCase() === nameLower) {
        throw new Error(`Space "${name}" already exists (as "${existingName}")`);
      }
    }
    config.spaces[name] = {
      name,
      url,
      default_page: defaultPage || 'Tasks',
      auth_token: authToken || '',
    };
    if (!config.active_space) {
      config.active_space = name;
    }
    await save();
    return getSpaces();
  }

  async function updateSpace(
    name: string,
    newName: string,
    url: string,
    defaultPage?: string,
    _inboxPage?: string,
    authToken?: string,
    _excludeTags?: string[],
  ): Promise<SpaceConfig[]> {
    const config = cache || (await load());
    const sp = config.spaces[name];
    if (!sp) {
      throw new Error(`Space "${name}" not found`);
    }
    if (url) sp.url = url;
    if (defaultPage) sp.default_page = defaultPage;
    if (authToken !== undefined) sp.auth_token = authToken;
    const effectiveName = newName || name;
    if (effectiveName.toLowerCase() !== name.toLowerCase()) {
      for (const existingName of Object.keys(config.spaces)) {
        if (existingName.toLowerCase() === effectiveName.toLowerCase()) {
          throw new Error(`Space "${effectiveName}" already exists`);
        }
      }
    }
    delete config.spaces[name];
    config.spaces[effectiveName] = sp;
    if (config.active_space === name) {
      config.active_space = effectiveName;
    }
    await save();
    return getSpaces();
  }

  async function removeSpace(name: string): Promise<SpaceConfig[]> {
    const config = cache || (await load());
    if (!config.spaces[name]) {
      throw new Error(`Space "${name}" not found`);
    }
    delete config.spaces[name];
    if (config.active_space === name) {
      config.active_space = '';
      for (const n of Object.keys(config.spaces)) {
        config.active_space = n;
        break;
      }
    }
    await save();
    return getSpaces();
  }

  async function setActiveSpace(name: string): Promise<SpaceConfig[]> {
    const config = cache || (await load());
    if (!config.spaces[name]) {
      throw new Error(`Space "${name}" not found`);
    }
    config.active_space = name;
    await save();
    return getSpaces();
  }

  return {
    load,
    save,
    getSpaces,
    getActiveSpace,
    addSpace,
    updateSpace,
    removeSpace,
    setActiveSpace,
  };
}

export type ConfigManager = ReturnType<typeof createConfigManager>;
