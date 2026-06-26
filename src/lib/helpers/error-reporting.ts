const REPORT_ENDPOINT = '/report';

function sendReport(message: string, level: string = 'error', stack?: string, tags?: Record<string, string>) {
  try {
    const body = JSON.stringify({ message, level, stack, tags });
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 3000);
    fetch(REPORT_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      signal: controller.signal,
    }).catch(() => {});
  } catch { /* don't report errors from the error reporter */ }
}

export function initErrorReporting(): void {
  if (typeof window === 'undefined') return;

  // Unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    const message = event.reason?.message ?? String(event.reason);
    sendReport(message, 'error', event.reason?.stack);
  });

  // Global errors
  window.addEventListener('error', (event) => {
    if (event.filename?.includes('/report')) return;
    sendReport(event.message, 'error', event.error?.stack || event.filename);
  });
}
