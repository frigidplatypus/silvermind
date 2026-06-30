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
import Layout from './routes/+layout.svelte';

initPrivacy();
initCrashReporting();

initBackend().then(() => loadSpaces()).catch(() => {
  loadSpaces().catch(() => {});
});
initNotifications();

async function checkOnboarding() {
  if (isDesktopApp()) {
    try {
      const status = await getConfigStatusDesktop();
      if (!status.exists || status.space_count === 0) {
        startOnboarding('welcome');
      }
    } catch { /* silently skip onboarding if bridge fails */ }
    return;
  }

  await new Promise(r => setTimeout(r, 2000));
  await loadSpaces().catch(() => {});
  if (getSpacesList().length === 0) {
    startOnboarding('welcome');
  }
}

loadTheme();
loadDefaultView();
loadShowToday();
checkOnboarding();

function getActiveTab(): string {
  const hash = window.location.hash.slice(1);
  if (!hash) return getDefaultView();
  return hash.replace('/', '');
}

let app: ReturnType<typeof mount>;

function render() {
  const root = document.getElementById('app')!;
  if (app) unmount(app);
  app = mount(Layout, { target: root, props: { activeTab: getActiveTab() } });
}

render();
