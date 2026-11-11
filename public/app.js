import {
  state,
  api,
  icon,
  escapeHtml,
  hydrateIcons,
  navigate,
  toast,
  openModal,
  applyBodyPreferences,
  updateAdminUI,
  loadScan,
  cancelScan,
  ensureScan,
  elevate,
  quitNexa,
  checkForUpdates,
  promptAndInstallUpdate,
  syncUpdateBanner,
} from './js/core.js';
import {
  renderOverview,
  bindOverview,
  updateOverviewLive,
  updateOverviewProcesses,
} from './js/pages/overview.js';
import { renderOptimize, bindOptimize } from './js/pages/optimize.js';
import { renderNetwork, bindNetwork, stopNetworkLive } from './js/pages/network.js';
import { renderCleanup, bindCleanup } from './js/pages/cleanup.js';
import { renderStartup, bindStartup } from './js/pages/startup.js';
import { renderActivity, bindActivity } from './js/pages/activity.js';
import { renderSettings, bindSettings } from './js/pages/settings.js';
import { renderGames, bindGames, loadGames } from './js/pages/games.js';
import { renderBenchmark, bindBenchmark } from './js/pages/benchmark.js';

const PAGE_META = {
  dashboard: {
    title: 'Overview',
    eyebrow: 'GAMING WORKSPACE',
    render: renderOverview,
    bind: bindOverview,
    load: loadDashboard,
  },
  optimize: {
    title: 'Windows',
    eyebrow: 'GAMING SETUP',
    render: () => renderOptimize('safe'),
    bind: bindOptimize,
  },
  games: {
    title: 'Games',
    eyebrow: 'PER-GAME FPS PROFILES',
    render: renderGames,
    bind: bindGames,
    load: loadGamesPage,
  },
  benchmark: {
    title: 'Benchmark',
    eyebrow: 'FRAME-TIME COMPARISON',
    render: renderBenchmark,
    bind: bindBenchmark,
  },
  advanced: {
    title: 'Advanced',
    eyebrow: 'EXPERT CONTROLS',
    render: () => renderOptimize('advanced'),
    bind: bindOptimize,
    load: ensureScan,
  },
  network: {
    title: 'Network lab',
    eyebrow: 'LATENCY & ROUTING',
    render: renderNetwork,
    bind: bindNetwork,
    load: loadNetwork,
  },
  cleanup: {
    title: 'Debloat & Cleanup',
    eyebrow: 'WINDOWS MAINTENANCE',
    render: renderCleanup,
    bind: bindCleanup,
    load: loadCleanup,
  },
  startup: {
    title: 'Startup',
    eyebrow: 'SIGN-IN LOAD',
    render: renderStartup,
    bind: bindStartup,
    load: loadStartup,
  },
  activity: {
    title: 'Activity',
    eyebrow: 'LOCAL AUDIT TRAIL',
    render: renderActivity,
    bind: bindActivity,
    load: loadHistory,
  },
  settings: {
    title: 'Settings',
    eyebrow: 'APP & SAFETY',
    render: renderSettings,
    bind: bindSettings,
    load: ensureScan,
  },
};

function routeFromHash() {
  const raw = window.location.hash.replace(/^#\/?/, '').split('?')[0].toLowerCase();
  return Object.prototype.hasOwnProperty.call(PAGE_META, raw) ? raw : 'dashboard';
}

let reconnectTimer = null;
function scheduleReconnect() {
  if (reconnectTimer) return;
  reconnectTimer = setInterval(async () => {
    try {
      const res = await fetch('/api/health');
      if (res.ok) {
        clearInterval(reconnectTimer);
        reconnectTimer = null;
        if (state.pageError) {
          state.pageError = null;
          handleRoute();
        }
      }
    } catch {}
  }, 2000);
}

function render() {
  const route = state.page;
  const meta = PAGE_META[route] || PAGE_META.dashboard;
  const view = document.getElementById('view');
  if (!view) return;

  const title = document.getElementById('page-title');
  const eyebrow = document.getElementById('page-eyebrow');
  if (title) title.textContent = meta.title;
  if (eyebrow) eyebrow.textContent = meta.eyebrow;
  document.title = `${meta.title} · Nexa Optimize`;

  document.querySelectorAll('.nav-link[data-route]').forEach((link) => {
    const active = link.dataset.route === route;
    link.classList.toggle('active', active);
    if (active) {
      link.setAttribute('aria-current', 'page');
      const group = link.closest('details');
      if (group) group.open = true;
    } else {
      link.removeAttribute('aria-current');
    }
  });
  const scanButton = document.getElementById('scan-btn');
  if (scanButton) scanButton.hidden = route !== 'dashboard' && route !== 'optimize';

  if (state.pageError && state.pageError.route === route) {
    view.innerHTML = `
      <div class="panel empty-state" style="text-align:center;padding:48px 24px;max-width:520px;margin:40px auto;border-radius:14px">
        <div style="font-size:36px;margin-bottom:14px">⚡</div>
        <h2 style="font-size:19px;font-weight:700;margin-bottom:8px">Connecting to Nexa Engine…</h2>
        <p style="color:var(--muted);font-size:13px;line-height:1.55;margin-bottom:22px">
          ${escapeHtml(state.pageError.message || 'Could not communicate with the local background service.')}
        </p>
        <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap">
          <button class="button button-primary" id="page-retry-btn" type="button" style="padding:9px 22px">
            ${icon('refresh')} Reconnect &amp; Retry
          </button>
          <button class="button button-ghost" id="page-home-btn" type="button" style="padding:9px 18px">
            Go to Overview
          </button>
        </div>
      </div>`;
    hydrateIcons(view);
    document.getElementById('page-retry-btn')?.addEventListener('click', () => {
      state.pageError = null;
      handleRoute();
    });
    document.getElementById('page-home-btn')?.addEventListener('click', () => {
      state.pageError = null;
      navigate('dashboard');
    });
    return;
  }

  view.innerHTML = meta.render();
  hydrateIcons(view);
  meta.bind?.();
  updateAdminUI();
  if (route === 'dashboard') {
    if (state.overviewDetails && state.telemetry) updateOverviewLive();
    if (state.overviewDetails && state.processes) updateOverviewProcesses();
    document.getElementById('overview-details')?.addEventListener('toggle', (event) => {
      state.overviewDetails = event.currentTarget.open;
      if (state.overviewDetails) loadDashboard();
    });
  }
}

let routeGeneration = 0;

async function handleRoute() {
  const generation = ++routeGeneration;
  const next = routeFromHash();
  if (state.page === 'network' && next !== 'network') stopNetworkLive();
  state.page = next;
  state.pageError = null;
  render();
  try {
    await PAGE_META[next].load?.();
    if (generation === routeGeneration) state.pageError = null;
  } catch (error) {
    if (generation === routeGeneration && error.name !== 'AbortError') {
      state.pageError = { route: next, message: error.message };
      toast('error', `Could not load ${PAGE_META[next].title}`, error.message);
      scheduleReconnect();
    }
  }
  if (generation !== routeGeneration) return;
  render();
}

let telemetryBusy = false;
let processesBusy = false;

async function loadTelemetry() {
  if (telemetryBusy) return;
  telemetryBusy = true;
  try {
    const data = await api('/api/telemetry');
    const telemetry = data.telemetry;
    state.telemetry = telemetry;
    const history = state.telemetryHistory;
    history.cpu = [...history.cpu, Number(telemetry.cpu?.usage) || 0].slice(-60);
    history.memory = [...history.memory, Number(telemetry.memory?.usagePercent) || 0].slice(-60);
    if (state.page === 'dashboard') updateOverviewLive();
  } catch {
    // Telemetry is a live extra; keep the page usable if one sample fails.
  } finally {
    telemetryBusy = false;
  }
}

async function loadProcesses(force = false) {
  if (processesBusy) return;
  processesBusy = true;
  try {
    const data = await api(`/api/processes${force ? '?force=1' : ''}`);
    state.processes = data.processes;
    if (state.page === 'dashboard') updateOverviewProcesses();
  } catch {
    // The manual refresh button reports errors. Background refresh stays quiet.
  } finally {
    processesBusy = false;
  }
}

function loadDashboard() {
  if (!state.scan || !state.overviewDetails || !isAppActivelyViewed()) return;
  loadTelemetry();
  loadProcesses();
}

async function loadNetwork() {
  await ensureScan();
  if (!state.targets?.length) {
    const data = await api('/api/network/targets');
    state.targets = data.targets || [];
  }
  if (!state.selectedTarget) state.selectedTarget = state.targets[0]?.id || null;
  if (!state.dns) {
    try {
      state.dns = await api('/api/network/dns');
    } catch {
      // DNS details are optional; the rest of the lab still works.
    }
  }
}

async function loadCleanup() {
  if (!state.cleanup) {
    try {
      const [data] = await Promise.all([api('/api/cleanup/scan'), ensureScan()]);
      state.cleanup = data.categories;
      state.cleanupError = null;
    } catch (error) {
      state.cleanupError = error.message;
    }
  }
}

async function loadStartup() {
  await ensureScan();
  if (!state.startup) {
    try {
      const data = await api('/api/startup');
      state.startup = data.startup;
      state.startupError = null;
    } catch (err) {
      state.startupError = err.message;
      throw err;
    }
  }
}

async function loadHistory() {
  await ensureScan();
  if (!state.history) {
    state.history = await api('/api/history');
  }
}

async function loadGamesPage() {
  try {
    await loadGames();
    state.gamesError = null;
  } catch (err) {
    state.gamesError = err.message;
    throw err;
  }
}

async function runGlobalScan(button) {
  if (state.scanLoading) {
    cancelScan();
    toast('info', 'Scan stopped');
    return;
  }
  const original = button.innerHTML;
  button.innerHTML = icon('stop') + ' Stop scan';
  hydrateIcons(button);
  try {
    await loadScan(true);
    toast('success', 'Scan complete', 'Windows recommendations are up to date.');
    render();
    if (state.page === 'dashboard') loadDashboard();
  } catch (error) {
    if (error.name !== 'AbortError') toast('error', 'Scan failed', error.message);
  } finally {
    button.innerHTML = original;
    hydrateIcons(button);
  }
}

function bindChrome() {
  hydrateIcons(document);
  document.getElementById('scan-btn')?.addEventListener('click', (event) => runGlobalScan(event.currentTarget));
  document.getElementById('update-btn')?.addEventListener('click', () => promptAndInstallUpdate());
  document.getElementById('quit-btn')?.addEventListener('click', quitNexa);
  const menu = document.getElementById('mobile-menu');
  const sidebar = document.getElementById('sidebar');
  const setMenuOpen = (open) => {
    sidebar?.classList.toggle('open', open);
    menu?.setAttribute('aria-expanded', String(open));
    menu?.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
  };
  menu?.addEventListener('click', () => setMenuOpen(!sidebar?.classList.contains('open')));
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && sidebar?.classList.contains('open')) {
      setMenuOpen(false);
      menu?.focus();
    }
  });
  document.getElementById('admin-pill')?.addEventListener('click', () => {
    if (state.snapshot?.admin) {
      navigate('settings');
      return;
    }
    openModal({
      title: 'Restart with administrator rights?',
      body: '<p>Windows will show a UAC prompt. Nexa reconnects automatically and keeps your session token.</p>',
      confirmLabel: 'Restart as administrator',
      onConfirm: elevate,
    });
  });

  document.addEventListener('click', (event) => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;
    const nav = target.closest('[data-nav]');
    if (nav) {
      event.preventDefault();
      navigate(nav.getAttribute('data-nav'));
      setMenuOpen(false);
      return;
    }
    if (sidebar?.classList.contains('open') &&
        (target.closest('[data-route]') || (!sidebar.contains(target) && !target.closest('#mobile-menu')))) {
      setMenuOpen(false);
    }
  });
}

function renderFatal(error) {
  const view = document.getElementById('view');
  if (!view) return;
  view.innerHTML = `
    <div class="fatal">
      <div class="card card-pad" style="max-width:560px">
        <h2>Could not connect to Nexa</h2>
        <p>${escapeHtml(error.message || 'The local PowerShell bridge did not respond.')}</p>
        <p class="small muted">Make sure the local Nexa server is running, then try again.</p>
        <button class="button button-primary" type="button" id="boot-retry">${icon('refresh')} Try again</button>
      </div>
    </div>`;
  hydrateIcons(view);
  document.getElementById('boot-retry')?.addEventListener('click', () => window.location.reload());
}

let pollingStarted = false;

function isAppActivelyViewed() {
  return document.visibilityState === 'visible' && document.hasFocus();
}

function startPolling() {
  if (pollingStarted) return;
  pollingStarted = true;
  window.setInterval(() => {
    if (state.page === 'dashboard' && state.overviewDetails && state.scan && isAppActivelyViewed()) loadTelemetry();
  }, 3000);
  window.setInterval(() => {
    if (state.page === 'dashboard' && state.overviewDetails && state.scan && isAppActivelyViewed()) loadProcesses();
  }, 15_000);
  window.setInterval(() => {
    api('/api/app/heartbeat', { method: 'POST', body: {} }).catch(() => {});
  }, 12_000);
  window.addEventListener('focus', () => {
    if (state.page === 'dashboard') loadDashboard();
  });
  window.addEventListener('pagehide', () => {
    if (state.settings.runInBackground === false && state.token && navigator.sendBeacon) {
      navigator.sendBeacon(`/api/app/window-closed?token=${encodeURIComponent(state.token)}`, '{}');
    }
  });
}

async function boot() {
  try {
    const data = await api('/api/bootstrap?cached=1', { signal: AbortSignal.timeout(12_000) });
    state.version = data.version || state.version;
    state.port = data.port || null;
    state.dataDir = data.dataDir || '';
    state.settings = data.settings || {};
    if (data.network) {
      state.pingResults = data.network.pingResults || {};
      state.dnsBenchmark = data.network.dnsBenchmark || null;
      state.speedTest = data.network.speedTest || null;
    }
    if (data.token) state.token = data.token;
    if (data.applied) state.applied = data.applied;
    if (data.snapshot) state.snapshot = data.snapshot;
    if (data.scan) state.scan = data.scan;
    const versionLabel = document.getElementById('version-label');
    if (versionLabel) versionLabel.textContent = state.version;
    applyBodyPreferences();
    updateAdminUI();
    syncUpdateBanner();
    startPolling();
    setTimeout(() => {
      checkForUpdates({ silent: true });
    }, 2500);
    await handleRoute();
  } catch (error) {
    renderFatal(error);
  }
}

state.render = render;
bindChrome();
if (!window.location.hash) {
  window.history.replaceState(null, '', '#/dashboard');
}
window.addEventListener('hashchange', handleRoute);
boot();
