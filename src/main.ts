import { mount } from 'svelte';
import './app.css';
import { initServiceListener } from '$lib/stores/service.svelte';
import { loadSpaces } from '$lib/stores/space.svelte';
import { loadTheme } from '$lib/stores/theme.svelte';
import Layout from './routes/+layout.svelte';

initServiceListener();
loadSpaces().catch(() => {});
loadTheme();

let app: any = null;

function getActiveTab(): string {
  const hash = window.location.hash.slice(1) || '/inbox';
  return hash.replace('/', '');
}

function render() {
  const root = document.getElementById('app')!;
  if (app) {
    app.$set({ activeTab: getActiveTab() });
  } else {
    app = mount(Layout, { target: root, props: { activeTab: getActiveTab() } });
  }
}

render();
window.addEventListener('hashchange', render);
