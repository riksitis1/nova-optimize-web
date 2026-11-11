import {
  state,
  icon,
  escapeHtml,
  formatBytes,
  toast,
  openModal,
  elevate,
  api,
  requestRender,
} from '../core.js';
import { emptyState } from '../ui.js';
import { openBoostModal } from '../boost.js';

let memoryStatus = null;
let memoryComparison = null;
let memoryLoading = false;
let memoryError = '';

function renderMemory() {
  const sample = memoryStatus;
  return `<section class="card card-pad debloat-panel" aria-labelledby="memory-title">
    <div class="card-header">
      <div><h2 id="memory-title">Reduce RAM use</h2><p>Close unused apps now, disable unnecessary startup entries, or uninstall optional apps below.</p></div>
      <button class="button button-small" type="button" data-memory-scan ${memoryLoading ? 'disabled' : ''}>${icon('refresh')} ${memoryLoading ? 'Measuring…' : 'Measure RAM'}</button>
    </div>
    ${memoryError ? `<p role="alert">${escapeHtml(memoryError)}</p>` : ''}
    <div role="status">${sample ? `<strong>${formatBytes(sample.availableBytes)} available of ${formatBytes(sample.totalBytes)}</strong><p class="small muted">${sample.usagePercent}% in use · Measured ${escapeHtml(new Date(sample.measuredAt).toLocaleTimeString())}${sample.usagePercent >= 90 ? ' · High memory use. Review unused apps before launching a game.' : ''}</p>` : '<p class="small muted">Measure available system RAM before making changes.</p>'}</div>
    ${memoryComparison ? `<p class="small">Available RAM before ${formatBytes(memoryComparison.before.availableBytes)} → after ${formatBytes(memoryComparison.after.availableBytes)}. This is a system reading, not a measured FPS gain or guaranteed saving.</p>` : ''}
    <div class="debloat-actions">
      <button class="button button-primary" type="button" data-memory-close>${icon('zap')} Review running apps</button>
      <a class="button" href="#/startup">Review startup apps</a>
    </div>
    <p class="small muted">Removing an idle app may only free disk space. RAM use falls when background work stops. Windows manages cached memory automatically.</p>
  </section>`;
}

function recordMemory(result) {
  if (result.memory) {
    memoryComparison = result.memory;
    memoryStatus = result.memory.after;
    memoryError = '';
  }
  requestRender();
}

async function measureMemory() {
  if (memoryLoading) return;
  memoryLoading = true;
  memoryError = '';
  requestRender();
  try {
    memoryStatus = (await api('/api/memory')).memory;
  } catch (error) {
    memoryError = error.message;
  } finally {
    memoryLoading = false;
    requestRender();
  }
}

function riskBadge(risk) {
  if (risk === 'caution') return '<span class="badge amber">Caution</span>';
  return '<span class="badge green">Safe</span>';
}

function initializeSelection() {
  if (!state.cleanup || state.cleanupInitialized) return;
  state.cleanupSelected = new Set(
    state.cleanup
      .filter((category) => category.risk === 'safe' && category.bytes > 0 && (!category.requiresAdmin || state.snapshot?.admin))
      .map((category) => category.id),
  );
  state.cleanupInitialized = true;
}

function rowHtml(category) {
  const checked = state.cleanupSelected.has(category.id);
  const locked = category.requiresAdmin && !state.snapshot?.admin;
  return `
    <div class="cleanup-row ${checked ? 'checked' : ''} ${locked ? 'locked' : ''}" data-cleanup-row="${escapeHtml(category.id)}">
      <button class="check ${checked ? 'checked' : ''}" type="button" data-cleanup-toggle="${escapeHtml(category.id)}" ${locked ? 'disabled' : ''} aria-pressed="${checked}" aria-label="Select ${escapeHtml(category.label)}">${icon('check')}</button>
      <div class="target-avatar ${category.risk === 'caution' ? 'caution' : ''}">${icon(category.recycleBin ? 'trash' : category.id === 'browser-cache' ? 'globe' : category.id.includes('shader-cache') ? 'gpu' : 'folder', 16)}</div>
      <div class="cleanup-info"><strong>${escapeHtml(category.label)} ${riskBadge(category.risk)} ${locked ? '<span class="badge muted">Admin</span>' : ''}</strong><small>${escapeHtml(category.description)}</small></div>
      <div class="cleanup-size"><strong>${formatBytes(category.bytes)}</strong><small>${category.files.toLocaleString()} files</small></div>
    </div>`;
}

function resultsHtml() {
  const result = state.cleanupResult;
  if (!result) return '';
  const freed = result.freed || 0;
  const failed = (result.results || []).filter((item) => item.skipped || (item.errors && item.errors.length));
  return `
    <div class="callout ${failed.length ? 'warn' : ''}" style="margin-top:14px">
      ${icon(failed.length ? 'alert' : 'check')}
      <div><strong>${formatBytes(freed)} freed.</strong> ${result.results?.length || 0} categories processed.${failed.length ? ` ${failed.length} category${failed.length === 1 ? '' : 'ies'} skipped or partially blocked.` : ''}
      ${failed.length ? `<div class="small" style="margin-top:5px">${failed.map((item) => escapeHtml(item.reason || item.errors?.[0] || item.id)).join(' · ')}</div>` : ''}</div>
    </div>`;
}


const debloatSelection = { apps: new Set(), tweaks: new Set(), preset: null };
let debloatInventory = null;
let debloatResult = null;
let debloatError = '';
let debloatScanning = false;

function canSelectTweak(tweak, inventory = debloatInventory) {
  return tweak.applicable !== false && !tweak.optimized && !tweak.appliedByNexa && (!tweak.requiresAdmin || inventory.admin);
}

function availablePresetTweaks(preset, inventory = debloatInventory) {
  return inventory.tweaks.filter((tweak) => preset.ids.includes(tweak.id) && canSelectTweak(tweak, inventory));
}

function updateDebloatInventory(inventory) {
  debloatInventory = inventory;
  const apps = new Set(inventory.apps.map((app) => app.id));
  const tweaks = new Set(inventory.tweaks.filter((tweak) => canSelectTweak(tweak, inventory)).map((tweak) => tweak.id));
  for (const id of debloatSelection.apps) if (!apps.has(id)) debloatSelection.apps.delete(id);
  for (const id of debloatSelection.tweaks) if (!tweaks.has(id)) debloatSelection.tweaks.delete(id);
  const preset = inventory.presets.find((item) => item.id === debloatSelection.preset);
  if (preset) {
    const eligible = availablePresetTweaks(preset, inventory);
    if (!eligible.length || eligible.length !== debloatSelection.tweaks.size ||
        eligible.some((tweak) => !debloatSelection.tweaks.has(tweak.id))) debloatSelection.preset = null;
  }
}

function presetHtml(preset) {
  const eligible = availablePresetTweaks(preset);
  return `
    <label class="debloat-preset">
      <input type="radio" name="debloat-preset" data-debloat-preset value="${escapeHtml(preset.id)}"
        ${debloatSelection.preset === preset.id ? 'checked' : ''} ${eligible.length ? '' : 'disabled'}>
      <span><strong>${escapeHtml(preset.name)}</strong><small>${escapeHtml(preset.description)}</small>
        <small>${eligible.length ? eligible.length + ' available' : 'No applicable tweaks'}</small></span>
    </label>`;
}

function tweakHtml(tweak) {
  const locked = tweak.requiresAdmin && !debloatInventory.admin;
  const status = tweak.appliedByNexa ? (locked ? 'Applied · Administrator required to undo' : 'Applied by Nexa')
    : tweak.optimized ? 'Already configured' : locked ? 'Administrator required' : '';
  return `
    <div class="debloat-tweak">
      <label class="debloat-option">
        <input type="checkbox" data-debloat-tweak value="${escapeHtml(tweak.id)}"
          ${debloatSelection.tweaks.has(tweak.id) ? 'checked' : ''} ${canSelectTweak(tweak) ? '' : 'disabled'}>
        <span><strong>${escapeHtml(tweak.name)}</strong><small>${escapeHtml(tweak.description)}</small>
          ${tweak.note ? `<small>${escapeHtml(tweak.note)}</small>` : ''}
          ${status ? `<small class="debloat-option-status">${status}</small>` : ''}</span>
      </label>
      ${tweak.appliedByNexa && !locked ? `
        <button class="button button-small button-ghost" type="button" data-debloat-undo="${escapeHtml(tweak.id)}"
          aria-label="Undo ${escapeHtml(tweak.name)}">${icon('undo')} Undo</button>` : ''}
    </div>`;
}

function reinstallLink(storeUrl) {
  if (typeof storeUrl !== 'string' || !/^ms-windows-store:\/\/search\/\?query=[^\r\n]+$/i.test(storeUrl)) return '';
  return ` <a href="${escapeHtml(storeUrl)}">Find in Store</a>`;
}

function debloatResultHtml() {
  if (!debloatResult) return '';
  return `
    <section class="debloat-results" aria-labelledby="debloat-results-title">
      <h3 id="debloat-results-title" tabindex="-1">Debloat results</h3>
      ${debloatResult.refreshWarning ? `<p class="callout warn">${escapeHtml(debloatResult.refreshWarning)}</p>` : ''}
      <ul class="debloat-result-list">
        ${debloatResult.entries.map(({ name, status, error, storeUrl }) => `
          <li><strong>${escapeHtml(name)}</strong><span>${escapeHtml(status)}${error ? ` · ${escapeHtml(error)}` : ''}${reinstallLink(storeUrl)}</span></li>`).join('')}
      </ul>
      <p class="small muted">Undo Windows tweaks here or under <a href="#/optimize">Windows → Applied by Nexa</a>. Look for removed apps in the Microsoft Store to reinstall them. Reinstalling may not recover prior app data.</p>
    </section>`;
}

function selectionSummary() {
  const apps = debloatSelection.apps.size;
  const tweaks = debloatSelection.tweaks.size;
  return `${apps} app${apps === 1 ? '' : 's'} · ${tweaks} tweak${tweaks === 1 ? '' : 's'} selected`;
}

function renderDebloat() {
  const inventory = debloatInventory;
  return `
    <section id="debloat-panel" class="card card-pad debloat-panel" aria-labelledby="debloat-title" aria-busy="${debloatScanning}">
      <div class="card-header">
        <div><h2 id="debloat-title">Debloat Windows</h2><p>Choose a preset or individual tweaks, then review optional apps installed for this Windows account.</p></div>
        <div class="card-actions"><button class="button button-small" type="button" data-debloat-scan ${debloatScanning ? 'disabled' : ''}>
          ${icon('scan')} ${debloatScanning ? 'Scanning…' : inventory ? 'Rescan' : 'Scan apps &amp; tweaks'}
        </button></div>
      </div>
      ${debloatError ? `<p class="callout warn" role="alert">${escapeHtml(debloatError)}</p>` : ''}
      ${inventory ? `
        <div class="debloat-grid">
          <div class="debloat-column">
            <fieldset class="debloat-options" ${debloatScanning ? 'disabled' : ''}>
              <legend>Windows presets</legend>
              <p class="small muted">Presets select Windows tweaks. Choose apps separately.</p>
              <div class="debloat-preset-list">${inventory.presets.map(presetHtml).join('')}</div>
            </fieldset>
            <fieldset class="debloat-options" ${debloatScanning ? 'disabled' : ''}>
              <legend>Reversible Windows tweaks</legend>
              ${inventory.tweaks.some((tweak) => canSelectTweak(tweak)) ? '<div><button class="button button-small button-ghost" type="button" data-debloat-clear-tweaks>Clear tweak selection</button></div>' : ''}
              ${inventory.tweaks.length ? inventory.tweaks.map(tweakHtml).join('') : '<p class="small muted">No supported Windows tweaks are available.</p>'}
            </fieldset>
            ${!inventory.admin && inventory.tweaks.some((tweak) => tweak.requiresAdmin && (!tweak.optimized || tweak.appliedByNexa))
              ? '<button class="button button-small" type="button" data-action="elevate">Restart as administrator</button>' : ''}
          </div>
          <fieldset class="debloat-options" ${debloatScanning ? 'disabled' : ''}>
            <legend>Optional Windows apps</legend>
            <p class="small muted">App removal applies to this account. It can free disk space and may delete app data.</p>
            ${inventory.appScanWarning ? `<p class="callout warn" role="status">${escapeHtml(inventory.appScanWarning)}</p>` : ''}
            ${inventory.apps.length ? `
              <div class="debloat-actions">
                <button class="button button-small" type="button" data-debloat-select-apps>Select all apps</button>
                <button class="button button-small button-ghost" type="button" data-debloat-clear-apps>Clear app selection</button>
              </div>
              ${inventory.apps.map((app) => `
                <label class="debloat-option">
                  <input type="checkbox" data-debloat-app value="${escapeHtml(app.id)}" ${debloatSelection.apps.has(app.id) ? 'checked' : ''}>
                  <span><strong>${escapeHtml(app.name)}</strong>${app.category ? `<small>${escapeHtml(app.category)}</small>` : ''}</span>
                </label>`).join('')}`
              : inventory.appScanWarning ? '<p class="small muted">App inventory is unavailable. Rescan before choosing apps.</p>' : '<p class="small muted">No supported optional apps are installed for this account.</p>'}
          </fieldset>
        </div>
        <div class="debloat-footer">
          <div><strong id="debloat-count" role="status">${selectionSummary()}</strong><p class="small muted"><a href="#/optimize">Undo applied Windows tweaks</a></p></div>
          <button class="button button-primary" id="debloat-review" type="button" ${!debloatScanning && (debloatSelection.apps.size || debloatSelection.tweaks.size) ? '' : 'disabled'}>${icon('list')} Review selected changes</button>
        </div>`
        : '<p class="small muted">Scan to see the available tweaks and optional apps on this PC.</p>'}
      ${debloatResultHtml()}
    </section>`;
}

async function scanDebloat() {
  if (debloatScanning) return;
  debloatScanning = true;
  debloatError = '';
  requestRender();
  try {
    updateDebloatInventory(await api('/api/debloat'));
  } catch (error) {
    debloatError = error.message;
  } finally {
    debloatScanning = false;
    requestRender();
    document.querySelector('[data-debloat-scan]')?.focus();
  }
}

function updateDebloatControls(panel) {
  for (const input of panel.querySelectorAll('[data-debloat-app]')) input.checked = debloatSelection.apps.has(input.value);
  for (const input of panel.querySelectorAll('[data-debloat-tweak]')) input.checked = debloatSelection.tweaks.has(input.value);
  for (const input of panel.querySelectorAll('[data-debloat-preset]')) input.checked = debloatSelection.preset === input.value;
  panel.querySelector('#debloat-count').textContent = selectionSummary();
  panel.querySelector('#debloat-review').disabled = !debloatSelection.apps.size && !debloatSelection.tweaks.size;
}

function reportDebloat(response, inventory, undo = false) {
  if (response.memory) {
    memoryComparison = response.memory;
    memoryStatus = response.memory.after;
  }
  if (response.snapshot) state.snapshot = response.snapshot;
  if (response.scan) state.scan = response.scan;
  if (response.applied) state.applied = response.applied;
  state.history = null;

  const appResults = response.apps || [];
  const removed = new Set(appResults.filter(({ status }) => status === 'removed' || status === 'absent').map(({ id }) => id));
  const changed = new Set(response.tweaks.filter((item) => item.ok && !item.skipped).map(({ id }) => id));
  const refreshed = new Map((response.scan?.actions || []).map((action) => [action.id, action]));
  if (!undo) debloatSelection.preset = null;
  updateDebloatInventory({
    ...inventory,
    apps: inventory.apps.filter(({ id }) => !removed.has(id)),
    tweaks: inventory.tweaks.map((item) => ({
      ...item,
      optimized: refreshed.get(item.id)?.optimized ?? (changed.has(item.id) ? !undo : item.optimized),
      appliedByNexa: refreshed.get(item.id)?.appliedByNexa ?? (changed.has(item.id) ? !undo : item.appliedByNexa),
    })),
  });

  const names = new Map(inventory.tweaks.map((item) => [item.id, item.name]));
  const appStates = { removed: 'Uninstalled', absent: 'Already absent', failed: 'Removal failed' };
  const entries = [
    ...appResults.map((item) => ({
      name: item.name || item.id,
      status: appStates[item.status] || 'Unknown status',
      error: item.error,
      storeUrl: item.status === 'removed' ? item.storeUrl : null,
    })),
    ...response.tweaks.map((item) => ({
      name: names.get(item.id) || item.id,
      status: item.ok ? item.skipped ? 'Skipped' : undo ? 'Restored' : 'Applied' : undo ? 'Could not restore' : 'Could not apply',
      error: item.error || (item.skipped ? item.message : ''),
    })),
  ];
  debloatResult = { entries, refreshWarning: response.refreshWarning };
  requestRender();
  requestAnimationFrame(() => document.getElementById('debloat-results-title')?.focus());
}

function reviewDebloatUndo(id) {
  const inventory = debloatInventory;
  const tweak = inventory.tweaks.find((item) => item.id === id);
  if (debloatScanning || !tweak?.appliedByNexa || (tweak.requiresAdmin && !inventory.admin)) return;
  openModal({
    title: 'Undo Windows tweak',
    body: `<p>Restore the original Windows setting for <strong>${escapeHtml(tweak.name)}</strong>?</p>`,
    confirmLabel: 'Restore setting',
    onConfirm: async () => {
      const response = await api('/api/debloat/undo', { method: 'POST', body: { ids: [id] } });
      reportDebloat(response, inventory, true);
    },
  });
}

function reviewDebloat() {
  if (debloatScanning) return;
  const inventory = debloatInventory;
  const apps = inventory.apps.filter((app) => debloatSelection.apps.has(app.id));
  const tweaks = inventory.tweaks.filter((tweak) => debloatSelection.tweaks.has(tweak.id) && canSelectTweak(tweak, inventory));
  if (!apps.length && !tweaks.length) return;
  openModal({
    title: 'Review debloat changes',
    body: `
      ${apps.length ? `<p><strong>Uninstall from your Windows account</strong></p><ul class="modal-list">
        ${apps.map((app) => `<li>${escapeHtml(app.name)}</li>`).join('')}
      </ul><p>Removing apps may delete their data. Look for them in the Microsoft Store if you want to reinstall them.</p>` : ''}
      ${tweaks.length ? `<p><strong>Apply Windows tweaks</strong></p><ul class="modal-list">
        ${tweaks.map((tweak) => `<li>${escapeHtml(tweak.name)}</li>`).join('')}
      </ul><p>Undo applied tweaks from Windows → Applied by Nexa.</p>` : ''}`,
    confirmLabel: apps.length && tweaks.length ? 'Remove apps and apply tweaks' : apps.length ? 'Uninstall selected apps' : 'Apply selected tweaks',
    danger: apps.length > 0,
    onConfirm: async () => {
      const response = await api('/api/debloat', {
        method: 'POST', body: { appIds: apps.map(({ id }) => id), tweakIds: tweaks.map(({ id }) => id) },
      });
      reportDebloat(response, inventory);
    },
  });
}

function bindDebloat() {
  const panel = document.getElementById('debloat-panel');
  if (!panel) return;
  panel.querySelector('[data-debloat-scan]').addEventListener('click', scanDebloat);
  if (!debloatInventory) return;
  panel.addEventListener('change', (event) => {
    const input = event.target;
    if (input.matches('[data-debloat-preset]')) {
      const preset = debloatInventory.presets.find(({ id }) => id === input.value);
      if (!preset) return;
      debloatSelection.preset = preset.id;
      debloatSelection.tweaks = new Set(availablePresetTweaks(preset).map(({ id }) => id));
    } else if (input.matches('[data-debloat-app], [data-debloat-tweak]')) {
      const app = input.matches('[data-debloat-app]');
      const selection = app ? debloatSelection.apps : debloatSelection.tweaks;
      if (!app) debloatSelection.preset = null;
      if (input.checked) selection.add(input.value);
      else selection.delete(input.value);
    } else return;
    updateDebloatControls(panel);
  });
  panel.querySelector('[data-debloat-select-apps]')?.addEventListener('click', () => {
    debloatSelection.apps = new Set(debloatInventory.apps.map(({ id }) => id));
    updateDebloatControls(panel);
  });
  panel.querySelector('[data-debloat-clear-apps]')?.addEventListener('click', () => {
    debloatSelection.apps.clear();
    updateDebloatControls(panel);
  });
  panel.querySelector('[data-debloat-clear-tweaks]')?.addEventListener('click', () => {
    debloatSelection.preset = null;
    debloatSelection.tweaks.clear();
    updateDebloatControls(panel);
  });
  panel.querySelector('#debloat-review').addEventListener('click', reviewDebloat);
  for (const button of panel.querySelectorAll('[data-debloat-undo]')) {
    button.addEventListener('click', () => reviewDebloatUndo(button.dataset.debloatUndo));
  }
}

export function renderCleanup() {
  return renderMemory() + renderDebloat() + renderTemporaryFiles();
}

function renderTemporaryFiles() {
  if (state.cleanupError) {
    return `
      <div class="empty-state" style="margin:40px auto;max-width:480px;text-align:center">
        <div class="empty-icon">${icon('alert', 24)}</div>
        <h3 style="margin:12px 0 6px">Could not measure temporary files</h3>
        <p style="color:var(--muted);font-size:13px;line-height:1.5;margin-bottom:18px">${escapeHtml(state.cleanupError)}</p>
        <button class="button button-primary" id="retry-cleanup-btn" type="button">${icon('refresh')} Retry scan</button>
      </div>`;
  }
  if (!state.cleanup) {
    return '<div class="page-loading"><div class="loading-orbit"></div><p>Measuring temporary files…</p></div>';
  }
  initializeSelection();
  const categories = state.cleanup;
  const selected = categories.filter((category) => state.cleanupSelected.has(category.id));
  const selectedSize = selected.reduce((sum, category) => sum + (Number(category.bytes) || 0), 0);
  const selectedFiles = selected.reduce((sum, category) => sum + (Number(category.files) || 0), 0);
  const totalSize = categories.reduce((sum, category) => sum + (Number(category.bytes) || 0), 0);
  const admin = state.snapshot?.admin === true;
  return `
    ${!admin ? `<div class="callout warn" style="margin-bottom:12px">${icon('lock')}<div><strong>System temp folders require administrator access.</strong> <button class="button button-small" type="button" data-action="elevate" style="margin-left:8px">Restart as admin</button></div></div>` : ''}
    <div class="card card-pad">
      <div class="card-header">
        <div>
          <h2>Temporary caches (${formatBytes(totalSize)} found)</h2>
          <p>${selectedFiles.toLocaleString()} files selected · Personal folders (Documents, Desktop, Downloads) are never touched.</p>
        </div>
        <div class="card-actions">
          <button class="button button-small" type="button" data-action="cleanup-scan">${icon('refresh')} Rescan</button>
          <button class="button button-small button-primary" type="button" data-action="cleanup-run" ${selected.length ? '' : 'disabled'}>${icon('broom')} Clean ${formatBytes(selectedSize)}</button>
        </div>
      </div>
      ${categories.length ? `<div class="cleanup-list">${categories.map(rowHtml).join('')}</div>` : emptyState('check', 'Nothing to clean', 'No temporary cache files found.')}
      ${resultsHtml()}
    </div>
  `;
}

async function scanCleanup(button) {
  if (button) {
    button.disabled = true;
    button.innerHTML = `${icon('refresh')} Scanning…`;
  }
  try {
    const data = await api('/api/cleanup/scan');
    state.cleanup = data.categories;
    state.cleanupError = null;
    state.cleanupInitialized = false;
    state.cleanupResult = null;
    state.cleanupSelected = new Set();
    toast('success', 'Cleanup scan complete');
    requestRender();
  } catch (error) {
    toast('error', 'Cleanup scan failed', error.message);
    if (button) {
      button.disabled = false;
      button.innerHTML = `${icon('refresh')} Scan again`;
    }
  }
}

function runCleanup() {
  const selected = (state.cleanup || []).filter((category) => state.cleanupSelected.has(category.id));
  if (!selected.length) {
    toast('warn', 'Nothing selected', 'Choose at least one category to clean.');
    return;
  }
  if (selected.some((category) => category.requiresAdmin) && !state.snapshot?.admin) {
    openModal({
      title: 'Administrator access needed',
      body: '<p>One or more selected categories require administrator rights. Restart Nexa with administrator access and try again.</p>',
      confirmLabel: 'Restart as administrator',
      onConfirm: elevate,
    });
    return;
  }
  const recycle = selected.some((category) => category.recycleBin);
  openModal({
    title: `Free ${formatBytes(selected.reduce((sum, category) => sum + (Number(category.bytes) || 0), 0))}?`,
    body: `<p>Nexa will remove temp and cache data from the selected categories. Files in use are skipped. This cannot be undone.</p><ul class="modal-list">${selected.map((category) => `<li>${escapeHtml(category.label)} — ${formatBytes(category.bytes)}</li>`).join('')}</ul>${recycle ? '<p class="small" style="margin-top:10px;color:var(--amber)">The Recycle Bin will be emptied. Deleted files cannot be recovered.</p>' : ''}`,
    confirmLabel: 'Clean now',
    danger: true,
    onConfirm: async () => {
      const data = await api('/api/cleanup/run', {
        method: 'POST',
        body: { ids: selected.map((category) => category.id) },
      });
      state.cleanupResult = data;
      const fresh = await api('/api/cleanup/scan');
      state.cleanup = fresh.categories;
      state.cleanupInitialized = false;
      state.cleanupSelected = new Set();
      state.history = null;
      toast('success', 'Cleanup complete', `${formatBytes(data.freed || 0)} freed.`);
      requestRender();
    },
  });
}

function toggleCategory(id) {
  const category = (state.cleanup || []).find((item) => item.id === id);
  if (!category) return;
  if (category.requiresAdmin && !state.snapshot?.admin) return;
  if (state.cleanupSelected.has(id)) state.cleanupSelected.delete(id);
  else state.cleanupSelected.add(id);
  requestRender();
}

export function bindCleanup() {
  document.querySelector('[data-memory-scan]')?.addEventListener('click', measureMemory);
  document.querySelector('[data-memory-close]')?.addEventListener('click', (event) => openBoostModal(event.currentTarget, recordMemory));
  bindDebloat();
  document.getElementById('retry-cleanup-btn')?.addEventListener('click', async () => {
    state.cleanupError = null;
    state.cleanup = null;
    requestRender();
    try {
      const fresh = await api('/api/cleanup/scan');
      state.cleanup = fresh.categories;
    } catch (err) {
      state.cleanupError = err.message;
    }
    requestRender();
  });
  document.querySelectorAll('[data-cleanup-toggle]').forEach((button) => {
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      toggleCategory(button.getAttribute('data-cleanup-toggle'));
    });
  });
  document.querySelectorAll('[data-cleanup-row]').forEach((row) => {
    row.addEventListener('click', (event) => {
      if (event.target.closest('button')) return;
      toggleCategory(row.getAttribute('data-cleanup-row'));
    });
  });
  document.querySelectorAll('[data-action="cleanup-scan"]').forEach((button) => {
    button.addEventListener('click', () => scanCleanup(button));
  });
  document.querySelectorAll('[data-action="cleanup-run"]').forEach((button) => {
    button.addEventListener('click', runCleanup);
  });
  document.querySelectorAll('[data-action="elevate"]').forEach((button) => {
    button.addEventListener('click', elevate);
  });
}
