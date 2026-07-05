type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  data?: unknown;
}

const MAX_BUFFER = 500;
const buffer: LogEntry[] = [];

function now(): string {
  return new Date().toISOString();
}

let logLevelSet = false;

function ensureLogLevel() {
  if (logLevelSet) return;
  logLevelSet = true;
  if (typeof window !== 'undefined') {
    const rt = (window as any).runtime;
    if (rt?.SetLogLevel) {
      rt.SetLogLevel('1');
    }
  }
}

function format(level: LogLevel, message: string, data?: unknown): string {
  const ts = now().slice(11, 23); // HH:MM:SS.mmm
  const prefix = `[${ts}] ${level.toUpperCase()}`;
  const suffix = data !== undefined ? ` ${JSON.stringify(data)}` : '';
  return `${prefix} ${message}${suffix}`;
}

function emit(level: LogLevel, message: string, data?: unknown) {
  ensureLogLevel();

  const entry: LogEntry = { timestamp: now(), level, message, data };
  buffer.push(entry);
  if (buffer.length > MAX_BUFFER) buffer.shift();

  const formatted = format(level, message, data);

  if (typeof window !== 'undefined') {
    const rt = (window as any).runtime;
    if (rt?.LogDebug) {
      switch (level) {
        case 'debug':
          rt.LogDebug(formatted);
          break;
        case 'info':
          rt.LogInfo(formatted);
          break;
        case 'warn':
          rt.LogWarning(formatted);
          break;
        case 'error':
          rt.LogError(formatted);
          break;
      }
    } else {
      const fn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
      fn(formatted);
    }
  }
}

export function logDebug(msg: string, data?: unknown) {
  emit('debug', msg, data);
}
export function logInfo(msg: string, data?: unknown) {
  emit('info', msg, data);
}
export function logWarn(msg: string, data?: unknown) {
  emit('warn', msg, data);
}
export function logError(msg: string, data?: unknown) {
  emit('error', msg, data);
}

export function getLogBuffer(): LogEntry[] {
  return [...buffer];
}

export function drainLogs(): string {
  return buffer.map((e) => format(e.level, e.message, e.data)).join('\n');
}
