import { mount, unmount } from 'svelte';
import './app.css';
import { loadSpaces, getSpacesList, getSpacesLoading } from '$lib/stores/space.svelte';
import { loadTheme } from '$lib/stores/theme.svelte';
import { loadDefaultView, getDefaultView, loadShowToday } from '$lib/stores/landing.svelte';
import { isDesktopApp, getConfigStatusDesktop } from '$lib/desktop-bridge';
import { startOnboarding } from '$lib/stores/onboarding.svelte';
import { initBackend } from '$lib/backend/backend-context';
import { initCrashReporting } from '$lib/helpers/crash-reporting';
import { initPrivacy } from '$lib/stores/privacy.svelte';
import { initNotifications } from '$lib/stores/notifications.svelte';
import { logInfo, logDebug } from '$lib/helpers/logger';
import { initSafeArea } from '$lib/native/safe-area';
import Layout from './routes/+layout.svelte';

logInfo('[startup] main.ts loaded, beginning initialization');

initPrivacy();
initCrashReporting();
logDebug('[startup] privacy + crash reporting initialized');

initBackend()
  .then(() => {
    logInfo('[startup] backend initialized, loading spaces');
    loadSpaces();
  })
  .catch((e: any) => {
    logInfo(`[startup] backend init skipped: ${e?.message || e}`, { desktop: isDesktopApp() });
    loadSpaces().catch(() => {});
  });
initNotifications();
logDebug('[startup] notifications initialized');
initSafeArea().catch((e: any) => logInfo(`[startup] safe area init skipped: ${e?.message || e}`));

async function checkOnboarding() {
  if (isDesktopApp()) {
    try {
      const status = await getConfigStatusDesktop();
      logInfo(`[startup] config status: exists=${status.exists} spaces=${status.space_count}`);
      if (!status.exists || status.space_count === 0) {
        logInfo('[startup] no space configured — showing onboarding');
        startOnboarding('welcome');
      }
    } catch (e: any) {
      logInfo(`[startup] onboarding check skipped: ${e?.message || e}`);
    }
    return;
  }

  await new Promise((r) => setTimeout(r, 2000));
  await loadSpaces().catch(() => {});
  if (getSpacesList().length === 0) {
    startOnboarding('welcome');
  }
}

loadTheme();
loadDefaultView();
loadShowToday();
logDebug('[startup] theme + default view loaded');
checkOnboarding();

function getActiveTab(): string {
  const hash = window.location.hash.slice(1);
  if (!hash) return getDefaultView();
  return hash.replace('/', '');
}

let app: ReturnType<typeof mount>;

function render() {
  const root = document.getElementById('app')!;
  logInfo(`[startup] mounting Layout (tab=${getActiveTab()})`);
  if (app) unmount(app);
  app = mount(Layout, { target: root, props: { activeTab: getActiveTab() } });
  logInfo(`[startup] Layout mount() returned`);

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      const hasChildren = root.children.length > 0;
      const bodyW = document.body.clientWidth;
      const bodyH = document.body.clientHeight;
      const isDesktop = isDesktopApp();
      document.title = hasChildren ? 'Silvermind' : 'Silvermind (no render)';
      logInfo(
        `[startup] UI READY: hasChildren=${hasChildren} bodySize=${bodyW}x${bodyH} isDesktop=${isDesktop} title="${document.title}"`,
      );
      if (hasChildren) {
        const firstChild = root.children[0];
        logDebug(
          `[startup] root child: <${firstChild.tagName.toLowerCase()} class="${firstChild.className}">`,
        );
      } else {
        logInfo('[startup] WARNING: #app is empty — Svelte did not mount');
        document.body.style.background = '#ff4444';
      }
    });
  });
}

render();
logInfo('[startup] render() complete');

const beacon = document.getElementById('inline-beacon');
if (beacon) {
  beacon.textContent = 'SVELTE OK';
  beacon.style.color = '#0ff';
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      beacon.remove();
    });
  });
}
