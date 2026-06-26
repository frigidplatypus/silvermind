import { isCrashReportingEnabled } from '$lib/stores/privacy.svelte';

const SBTASK_PORT = 7433;
const REPORT_PATH = '/report';
const MAX_BUFFER = 100;

// Mirror API_BASE logic from client.ts: direct localhost in production,
// Vite proxy path in dev mode.
const REPORT_URL = typeof window !== 'undefined' && ((window as any).go?.main?.App || (window as any).Capacitor)
  ? `http://127.0.0.1:${SBTASK_PORT}${REPORT_PATH}`
  : REPORT_PATH;

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

function sendToServer(entry: ErrorEntry) {
  try {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 3000);
    fetch(REPORT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: entry.message,
        stack: entry.stack,
        level: entry.level,
        timestamp: entry.timestamp,
        user_agent: entry.userAgent,
      }),
      signal: controller.signal,
    }).catch(() => {});
  } catch { /* don't fail if report fails */ }
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
    sendToServer(entry);
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
    if (event.filename?.includes(REPORT_PATH)) return;
    capture('error', event.message, event.error?.stack || event.filename);
  });
}
