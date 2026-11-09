import {
  state,
  icon,
  escapeHtml,
  toast,
  openModal,
  elevate,
  api,
  requestRender,
} from '../core.js';
import { emptyState } from '../ui.js';

function impactBadge(impact) {
  if (impact === 'high') return '<span class="badge amber">High</span>';
  if (impact === 'low') return '<span class="badge muted">Low</span>';
  return '<span class="badge cyan">Medium</span>';
}

function initials(name) {
  return String(name || '?').replace(/[^a-z0-9]/gi, ' ').trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || '?';
}

function shortCommand(cmd) {
  const raw = String(cmd || '').trim();
  if (!raw) return '';
  const quoted = raw.match(/^"([^"]+)"/);
  const target = quoted ? quoted[1] : raw.split(/\s+/)[0];
  const base = target.split(/[\\/]/).pop();
  return base || raw;
}

const STARTUP_LOOKUP = [
  { test: /\butorrent|\but\b/i, name: 'uTorrent' },
  { test: /\bgoogleupdater|googleupdate/i, name: 'Google Updater' },
  { test: /\bsecurityhealth/i, name: 'Windows Security Health' },
  { test: /\bdiscord/i, name: 'Discord' },
  { test: /\bspotify/i, name: 'Spotify' },
  { test: /\bsteam/i, name: 'Steam' },
  { test: /\bepicgameslauncher/i, name: 'Epic Games Launcher' },
  { test: /\broblox/i, name: 'Roblox' },
  { test: /\bsteelseries/i, name: 'SteelSeries GG' },
  { test: /\brazer/i, name: 'Razer Synapse' },
  { test: /\blogitech|lghub/i, name: 'Logitech G HUB' },
  { test: /\bcorsair|icue/i, name: 'Corsair iCUE' },
  { test: /\bonedrive/i, name: 'Microsoft OneDrive' },
  { test: /\bteams/i, name: 'Microsoft Teams' },
  { test: /\bplayit/i, name: 'Playit.gg' },
  { test: /\bgemini/i, name: 'Gemini' },
  { test: /\briotclient/i, name: 'Riot Client' },
  { test: /\bbattlenet/i, name: 'Battle.net' },
  { test: /\bvmware/i, name: 'VMware' },
];

function friendlyStartupName(item) {
  let name = String(item.name || '').trim();
  // Strip .lnk or .exe extension from display title
  name = name.replace(/\.(lnk|exe)$/i, '');

  const cmd = String(item.command || '').toLowerCase();
  const rawName = String(item.name || '').toLowerCase();

  for (const entry of STARTUP_LOOKUP) {
    if (entry.test.test(rawName) || entry.test.test(cmd)) {
      return entry.name;
    }
  }

  if (/^[a-z0-9_-]+\.exe$/i.test(item.name)) {
    return item.name.replace(/\.exe$/i, '');
  }

  return name || 'Unknown Program';
}

function startupRow(item) {
  const needsAdmin = item.requiresAdmin || (item.type === 'registry' && item.hive === 'HKLM');
  const locked = item.protected || (!state.snapshot?.admin && needsAdmin);
  const shortCmd = shortCommand(item.command);
  const friendlyName = friendlyStartupName(item);
  return `
    <div class="startup-row ${item.enabled ? '' : 'disabled'}" data-startup-name="${escapeHtml(`${friendlyName} ${item.name} ${item.command}`.toLowerCase())}">
      <div class="startup-avatar">${escapeHtml(initials(friendlyName))}</div>
      <div class="startup-info">
        <strong>
          ${escapeHtml(friendlyName)}
          ${item.protected ? '<span class="badge muted">Protected</span>' : ''}
          ${!state.snapshot?.admin && needsAdmin ? '<span class="badge muted">Admin</span>' : ''}
          ${item.enabled ? '' : '<span class="badge amber">Disabled</span>'}
        </strong>
        <small title="${escapeHtml(item.command)}">${escapeHtml(item.name !== friendlyName ? `${item.name} · ` : '')}${escapeHtml(item.source)}${shortCmd ? ` · ${escapeHtml(shortCmd)}` : ''}</small>
      </div>
      <div class="chip-row" style="flex:0 0 auto">${impactBadge(item.impact)}</div>
      <button class="switch ${item.enabled ? 'on' : ''}" type="button" role="switch" aria-checked="${item.enabled}" data-startup-toggle="${escapeHtml(item.id)}" data-enabled="${item.enabled ? 'true' : 'false'}" aria-label="${item.enabled ? 'Disable' : 'Enable'} ${escapeHtml(friendlyName)}" ${locked ? 'disabled' : ''}></button>
    </div>`;
}

export function renderStartup() {
  if (!state.startup) {
    return '<div class="page-loading"><div class="loading-orbit"></div><p>Reading startup apps…</p></div>';
  }
  const isAdmin = Boolean(state.snapshot?.admin);
  const filter = state.startupFilter || 'all';
  const query = (state.startupQuery || '').toLowerCase();
  const activeList = state.startup.active || [];
  const disabledList = state.startup.disabled || [];
  const all = [...activeList, ...disabledList];

  const disableableCount = activeList.filter((item) => !item.protected && (isAdmin || !item.requiresAdmin)).length;
  const restorableCount = disabledList.filter((item) => isAdmin || !item.requiresAdmin).length;

  const filtered = all.filter((item) => {
    if (filter === 'active' && !item.enabled) return false;
    if (filter === 'disabled' && item.enabled) return false;
    if (filter === 'protected' && !item.protected) return false;
    if (query && !`${item.name} ${item.command} ${item.source}`.toLowerCase().includes(query)) return false;
    return true;
  });

  const filterCounts = {
    all: all.length,
    active: state.startup.activeCount || 0,
    disabled: state.startup.disabledCount || 0,
    protected: state.startup.protectedCount || 0,
  };

  return `
    ${!isAdmin ? `<div class="callout warn" style="margin-bottom:12px">${icon('lock')}<div><strong>System-wide startup items require administrator access.</strong> <button class="button button-small" type="button" data-action="elevate" style="margin-left:8px">Restart as admin</button></div></div>` : ''}
    <div class="card card-pad">
      <div class="startup-toolbar">
        <div class="tabs">
          ${['all', 'active', 'disabled', 'protected'].map((value) => `<button class="tab ${filter === value ? 'active' : ''}" type="button" data-startup-filter="${value}">${value[0].toUpperCase() + value.slice(1)} (${filterCounts[value]})</button>`).join('')}
        </div>
        <input class="input" id="startup-search" placeholder="Search startup apps…" value="${escapeHtml(state.startupQuery || '')}" autocomplete="off" style="max-width:240px">
        <div style="display:flex;gap:8px;margin-left:auto;flex-wrap:wrap">
          <button class="button button-small button-primary" type="button" data-action="startup-disable-all" ${disableableCount ? '' : 'disabled'} title="Disable all non-protected startup apps">${icon('slash')} Disable all${disableableCount ? ` (${disableableCount})` : ''}</button>
          ${restorableCount ? `<button class="button button-small" type="button" data-action="startup-enable-all" title="Re-enable all startup apps disabled by Nova">${icon('undo')} Enable all (${restorableCount})</button>` : ''}
          <button class="button button-small" type="button" data-action="startup-refresh">${icon('refresh')} Refresh</button>
        </div>
      </div>
      ${filtered.length ? `<div class="startup-list">${filtered.map(startupRow).join('')}</div>` : emptyState('search', 'No matching startup apps', 'Try a different filter or search term.')}
    </div>
  `;
}

async function performStartupToggle(item, currentlyEnabled, button) {
  if (button) button.disabled = true;
  try {
    const data = await api('/api/startup/toggle', {
      method: 'POST',
      body: { id: item.id, enabled: !currentlyEnabled },
    });
    state.startup = data.startup;
    state.history = null;
    toast('success', currentlyEnabled ? 'Disabled at startup' : 'Enabled at startup', item.name);
    requestRender();
  } catch (error) {
    toast('error', 'Could not update startup item', error.message);
    if (button) button.disabled = false;
  }
}

async function toggleStartup(button) {
  const id = button.getAttribute('data-startup-toggle');
  const currentlyEnabled = button.getAttribute('data-enabled') === 'true';
  const item = [...(state.startup?.active || []), ...(state.startup?.disabled || [])].find((entry) => entry.id === id);
  if (!item) return;
  if (item.protected) {
    toast('warn', 'Protected entry', 'Core security and input startup entries stay enabled.');
    return;
  }
  const needsAdmin = item.requiresAdmin || (item.type === 'registry' && item.hive === 'HKLM');
  if (!state.snapshot?.admin && needsAdmin) {
    openModal({
      title: 'Administrator access needed',
      body: '<p>This is a system-wide startup entry. Restart Nova with administrator rights to change it.</p>',
      confirmLabel: 'Restart as administrator',
      onConfirm: elevate,
    });
    return;
  }
  await performStartupToggle(item, currentlyEnabled, button);
}

async function toggleAll(enabled, button) {
  if (button) button.disabled = true;
  try {
    const data = await api('/api/startup/toggle-all', {
      method: 'POST',
      body: { enabled },
    });
    state.startup = data.startup;
    state.history = null;
    const count = data.result?.count || 0;
    toast(
      'success',
      enabled ? `Re-enabled ${count} startup app${count === 1 ? '' : 's'}` : `Disabled ${count} startup app${count === 1 ? '' : 's'}`,
      enabled ? 'Selected apps will launch at sign-in again.' : 'Protected security entries were kept active.',
    );
    requestRender();
  } catch (error) {
    toast('error', 'Could not update startup apps', error.message);
    if (button) button.disabled = false;
  }
}

async function refreshStartup(button) {
  if (button) {
    button.disabled = true;
    button.innerHTML = `${icon('refresh')} Reading…`;
  }
  try {
    const data = await api('/api/startup');
    state.startup = data.startup;
    toast('success', 'Startup list refreshed');
    requestRender();
  } catch (error) {
    toast('error', 'Could not read startup apps', error.message);
    if (button) {
      button.disabled = false;
      button.innerHTML = `${icon('refresh')} Refresh`;
    }
  }
}

export function bindStartup() {
  document.querySelectorAll('[data-startup-toggle]').forEach((button) => {
    button.addEventListener('click', () => toggleStartup(button));
  });
  document.querySelectorAll('[data-startup-filter]').forEach((button) => {
    button.addEventListener('click', () => {
      state.startupFilter = button.getAttribute('data-startup-filter');
      requestRender();
    });
  });
  document.querySelectorAll('[data-action="startup-disable-all"]').forEach((button) => {
    button.addEventListener('click', () => toggleAll(false, button));
  });
  document.querySelectorAll('[data-action="startup-enable-all"]').forEach((button) => {
    button.addEventListener('click', () => toggleAll(true, button));
  });
  document.querySelectorAll('[data-action="startup-refresh"]').forEach((button) => {
    button.addEventListener('click', () => refreshStartup(button));
  });
  document.querySelectorAll('[data-action="elevate"]').forEach((button) => {
    button.addEventListener('click', elevate);
  });
  const search = document.getElementById('startup-search');
  if (search) {
    search.addEventListener('input', () => {
      state.startupQuery = search.value;
      const query = search.value.toLowerCase();
      document.querySelectorAll('[data-startup-name]').forEach((row) => {
        row.style.display = row.getAttribute('data-startup-name').includes(query) ? '' : 'none';
      });
    });
  }
}
