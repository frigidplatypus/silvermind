import { mount, unmount } from 'svelte';
import './app.css';
import { initServiceListener } from '$lib/stores/service.svelte';
import { loadSpaces } from '$lib/stores/space.svelte';
import { loadTheme } from '$lib/stores/theme.svelte';
import { loadDefaultView, getDefaultView } from '$lib/stores/landing.svelte';
import Layout from './routes/+layout.svelte';

initServiceListener();
loadSpaces().catch(() => {});
loadTheme();
loadDefaultView();

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
window.addEventListener('hashchange', render);
