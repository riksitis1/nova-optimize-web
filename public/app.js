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
  quitNova,
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
import { openBoostModal } from './js/boost.js';

const PAGE_META = {
  dashboard: {
    title: 'Overview',
    eyebrow: 'SYSTEM READINESS',
    render: renderOverview,
    bind: bindOverview,
    load: loadDashboard,
  },
  optimize: {
    title: 'Optimize',
    eyebrow: 'SAFE TWEAKS',
    render: () => renderOptimize('safe'),
    bind: bindOptimize,
    load: ensureScan,
  },
  games: {
    title: 'Game settings',
    eyebrow: 'PER-GAME FPS PROFILES',
    render: renderGames,
    bind: bindGames,
    load: loadGamesPage,
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
    title: 'Cleanup',
    eyebrow: 'DISK HYGIENE',
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
    link.classList.toggle('active', link.getAttribute('data-route') === route);
  });

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
    if (state.telemetry) updateOverviewLive();
    if (state.processes) updateOverviewProcesses();
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
    await PAGE_META[next].load();
    state.pageError = null;
  } catch (error) {
    if (generation === routeGeneration) {
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

async function loadDashboard() {
  await ensureScan();
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
  await ensureScan();
  if (!state.cleanup) {
    try {
      const data = await api('/api/cleanup/scan');
      state.cleanup = data.categories;
      state.cleanupError = null;
    } catch (err) {
      state.cleanupError = err.message;
      throw err;
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
  await ensureScan();
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
    toast('info', 'Scan stopped', 'Cancelled in-progress system scan.');
    render();
    return;
  }
  const scanButton = document.getElementById('scan-btn');
  const rescanButton = document.getElementById('rescan-btn');
  const original = scanButton ? scanButton.innerHTML : '';
  if (scanButton) {
    scanButton.innerHTML = `${icon('stop')} Stop scan`;
    scanButton.classList.add('button-ghost');
    scanButton.classList.remove('button-primary');
    hydrateIcons(scanButton);
  }
  if (rescanButton) {
    rescanButton.innerHTML = `${icon('stop')} Stop scan`;
    hydrateIcons(rescanButton);
  }
  if (button && button !== scanButton) button.classList.add('spinning');
  try {
    await loadScan(true);
    toast('success', 'Scan complete', 'Your readiness score and recommendations are up to date.');
    render();
    await PAGE_META[state.page].load();
    render();
  } catch (error) {
    if (error.name !== 'AbortError') {
      toast('error', 'Scan failed', error.message);
    }
  } finally {
    if (scanButton) {
      scanButton.disabled = false;
      scanButton.classList.remove('spinning', 'button-ghost');
      scanButton.classList.add('button-primary');
      scanButton.innerHTML = original;
      hydrateIcons(scanButton);
    }
    if (rescanButton) {
      rescanButton.disabled = false;
      rescanButton.innerHTML = `${icon('scan')} Rescan`;
      hydrateIcons(rescanButton);
    }
    if (button) button.classList.remove('spinning');
  }
}

async function runRamTrim(button) {
  if (!button || button.disabled) return;
  const original = button.innerHTML;
  button.disabled = true;
  button.innerHTML = `${icon('refresh')} Trimming…`;
  try {
    const data = await api('/api/memory/trim', { method: 'POST', body: {} });
    if (data.telemetry) {
      state.telemetry = data.telemetry;
      if (state.page === 'dashboard') updateOverviewLive();
    }
    const freedMb = Math.round(((Number(data.result?.freedBytes) || 0) / 1024 ** 2) * 10) / 10;
    const count = data.result?.trimmedProcesses || 0;
    toast(
      'success',
      freedMb > 0 ? `Freed ${freedMb} MB of RAM` : 'RAM working sets trimmed',
      `Compacted ${count} idle background processes for gaming headroom.`,
    );
  } catch (error) {
    toast('error', 'Could not trim RAM', error.message);
  } finally {
    button.disabled = false;
    button.innerHTML = original;
    hydrateIcons(button);
  }
}

function bindChrome() {
  hydrateIcons(document);
  document.getElementById('scan-btn')?.addEventListener('click', (event) => runGlobalScan(event.currentTarget));
  document.getElementById('rescan-btn')?.addEventListener('click', (event) => runGlobalScan(event.currentTarget));
  document.getElementById('trim-ram-btn')?.addEventListener('click', () => openBoostModal());
  document.getElementById('update-btn')?.addEventListener('click', () => promptAndInstallUpdate());
  document.getElementById('quit-btn')?.addEventListener('click', quitNexa);
  document.getElementById('bg-mode-toggle')?.addEventListener('click', async () => {
    const next = state.settings.runInBackground === false;
    state.settings.runInBackground = next;
    applyBodyPreferences();
    if (state.page === 'settings' || state.page === 'dashboard') render();
    try {
      const data = await api('/api/settings', { method: 'POST', body: { runInBackground: next } });
      state.settings = data.settings;
      applyBodyPreferences();
      toast(
        'info',
        next ? 'Background mode enabled' : 'Background mode disabled',
        next
          ? 'Nova keeps running in the background and auto-trims idle RAM under load.'
          : 'Nova pauses when unfocused and stops completely when you close the window.',
      );
    } catch (error) {
      state.settings.runInBackground = !next;
      applyBodyPreferences();
      toast('error', 'Could not update background mode', error.message);
    }
  });
  document.getElementById('mobile-menu')?.addEventListener('click', (event) => {
    event.stopPropagation();
    document.getElementById('sidebar')?.classList.toggle('open');
  });
  document.getElementById('admin-pill')?.addEventListener('click', () => {
    if (state.snapshot?.admin) {
      navigate('settings');
      return;
    }
    openModal({
      title: 'Restart with administrator rights?',
      body: '<p>Windows will show a UAC prompt. Nova reconnects automatically and keeps your session token.</p>',
      confirmLabel: 'Restart as administrator',
      onConfirm: elevate,
    });
  });

  document.addEventListener('click', (event) => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;
    const cancelBtn = target.closest('#cancel-scan-btn, [data-action="cancel-scan"]');
    if (cancelBtn) {
      event.preventDefault();
      if (!bootCompleted) {
        stopInitialBoot();
      } else {
        cancelScan();
        render();
        toast('info', 'Scan stopped', 'Cancelled current system scan.');
      }
      return;
    }
    const nav = target.closest('[data-nav]');
    if (nav) {
      event.preventDefault();
      navigate(nav.getAttribute('data-nav'));
      document.getElementById('sidebar')?.classList.remove('open');
      return;
    }
    const sidebar = document.getElementById('sidebar');
    if (
      sidebar?.classList.contains('open')
      && !sidebar.contains(target)
      && !target.closest('#mobile-menu')
    ) {
      sidebar.classList.remove('open');
    }
  });
}

function renderFatal(error) {
  const view = document.getElementById('view');
  if (!view) return;
  view.innerHTML = `
    <div class="fatal">
      <div class="card card-pad" style="max-width:560px">
        <h2>Nova could not read this PC</h2>
        <p>${escapeHtml(error.message || 'The local PowerShell bridge did not respond.')}</p>
        <p class="small muted">Nova never makes changes while it is failing. Check that PowerShell is available and try again.</p>
        <button class="button button-primary" type="button" id="boot-retry">${icon('refresh')} Try again</button>
      </div>
    </div>`;
  hydrateIcons(view);
  document.getElementById('boot-retry')?.addEventListener('click', () => window.location.reload());
}

let pollingStarted = false;

function isAppActivelyViewed() {
  if (state.settings.runInBackground !== false) {
    return document.visibilityState !== 'hidden';
  }
  return document.visibilityState === 'visible' && document.hasFocus();
}

function startPolling() {
  if (pollingStarted) return;
  pollingStarted = true;
  window.setInterval(() => {
    if (state.page === 'dashboard' && isAppActivelyViewed()) loadTelemetry();
  }, 3000);
  window.setInterval(() => {
    if (state.page === 'dashboard' && isAppActivelyViewed()) loadProcesses();
  }, 15_000);
  window.setInterval(() => {
    api('/api/app/heartbeat', { method: 'POST', body: {} }).catch(() => {});
  }, 12_000);
  window.addEventListener('focus', () => {
    if (state.page === 'dashboard') {
      loadTelemetry();
    }
  });
  window.addEventListener('pagehide', () => {
    if (state.settings.runInBackground === false && state.token && navigator.sendBeacon) {
      navigator.sendBeacon(`/api/app/window-closed?token=${encodeURIComponent(state.token)}`, '{}');
    }
  });
}

let bootAbortController = null;
let bootCompleted = false;

function stopInitialBoot() {
  if (bootCompleted) return;
  bootCompleted = true;
  if (bootAbortController) {
    try { bootAbortController.abort(); } catch {}
    bootAbortController = null;
  }
  cancelScan();
  render();
  toast('info', 'Scan stopped', 'Loaded dashboard. You can click "Run scan" anytime.');
}

async function boot() {
  bootAbortController = new AbortController();
  const fallbackTimer = setTimeout(() => {
    if (!bootCompleted && !state.scan) {
      console.warn('[nexa] Initial reading exceeded 3.5s; continuing to dashboard.');
      stopInitialBoot();
    }
  }, 3500);

  try {
    const data = await api('/api/bootstrap', { signal: bootAbortController.signal });
    clearTimeout(fallbackTimer);
    if (bootCompleted) return;
    bootCompleted = true;
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
    if (data.scan) {
      state.scan = data.scan;
      const badge = document.getElementById('nav-issues');
      if (badge) {
        const issues = data.scan.counts?.issues || 0;
        badge.textContent = String(issues);
        badge.classList.toggle('visible', issues > 0);
      }
    }
    const versionLabel = document.getElementById('version-label');
    if (versionLabel) versionLabel.textContent = state.version;
    applyBodyPreferences();
    updateAdminUI();
    syncUpdateBanner();
    if (!state.scan) {
      await loadScan();
    }
    await handleRoute();
    startPolling();
    setTimeout(() => {
      checkForUpdates({ silent: true });
    }, 2500);
  } catch (error) {
    clearTimeout(fallbackTimer);
    if (bootCompleted) return;
    if (error.name === 'AbortError') {
      stopInitialBoot();
      return;
    }
    renderFatal(error);
  }
}

state.render = render;
bindChrome();
if (!window.location.hash) {
  window.history.replaceState(null, '', '#/dashboard');
}
boot().finally(() => {
  window.addEventListener('hashchange', handleRoute);
});
