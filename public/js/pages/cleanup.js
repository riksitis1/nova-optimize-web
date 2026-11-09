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
import { emptyState, sectionHead } from '../ui.js';

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

export function renderCleanup() {
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
    <div class="panel" style="margin-bottom:14px;padding:14px 18px;display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap;background:rgba(255,255,255,0.02);border:1px solid var(--line);border-radius:12px">
      <div style="display:flex;align-items:center;gap:12px">
        <span style="font-size:22px">🧹</span>
        <div>
          <strong style="font-size:13px;font-weight:650;display:block">Safe Cache &amp; Shader Cleaner</strong>
          <small style="color:var(--muted);font-size:11px;display:block;margin-top:2px">
            Removes stale GPU shader files and DirectX logs that build up over time. Your personal files, photos, downloads, and game saves are 100% safe.
          </small>
        </div>
      </div>
    </div>
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
