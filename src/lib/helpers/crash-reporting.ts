import { isCrashReportingEnabled } from '$lib/stores/privacy.svelte';

const MAX_BUFFER = 100;

interface ErrorEntry {
  message: string;
  stack?: string;
  level: string;
  timestamp: number;
  userAgent: string;
}

let buffer: ErrorEntry[] = [];

function bufferError(entry: ErrorEntry) {
  buffer.push(entry);
  if (buffer.length > MAX_BUFFER) buffer.shift();
}

function capture(level: string, message: string, stack?: string) {
  const entry: ErrorEntry = {
    message,
    stack,
    level,
    timestamp: Date.now(),
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
  };
  bufferError(entry);

  if (isCrashReportingEnabled()) {
    console.debug('[silvermind] crash report:', entry.message);
  }
}

export function exportLogs(): string {
  return JSON.stringify(buffer, null, 2);
}

export function downloadLogs() {
  const json = exportLogs();
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `silvermind-crash-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function initCrashReporting(): void {
  if (typeof window === 'undefined') return;

  window.addEventListener('unhandledrejection', (event) => {
    const message = event.reason?.message ?? String(event.reason);
    capture('error', message, event.reason?.stack);
  });

  window.addEventListener('error', (event) => {
    capture('error', event.message, event.error?.stack || event.filename);
  });
}
