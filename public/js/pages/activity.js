import {
  state,
  icon,
  escapeHtml,
  formatDate,
  toast,
  openModal,
  undoAll,
  undoAction,
  api,
  requestRender,
} from '../core.js';
import { emptyState, sectionHead } from '../ui.js';

function appliedSection() {
  const applied = (state.scan?.actions || []).filter((action) => action.appliedByNexa);
  if (!applied.length) {
    return `
      <div class="card card-pad">
        ${emptyState('check', 'No Nexa changes are active', 'When you apply a fix, its backup and undo button appear here.')}
      </div>`;
  }
  return `
    <div class="card card-pad">
      <div class="card-header"><div><h2>Active changes</h2><p>Every item has a backup. Undo restores the previous Windows value.</p></div><div class="card-actions"><button class="button button-small button-danger" type="button" data-action="undo-all">${icon('undo')} Undo all</button></div></div>
      ${applied.map((action) => `
        <div class="applied-row">
          <span class="badge lime">${icon('check')} Active</span>
          <div class="applied-name"><strong>${escapeHtml(action.name)}</strong><small>${escapeHtml(action.category)} · ${escapeHtml(action.risk)}</small></div>
          <button class="button button-small" type="button" data-undo-action="${escapeHtml(action.id)}">${icon('undo')} Undo</button>
        </div>`).join('')}
    </div>`;
}

const FILTER_GROUPS = {
  all: () => true,
  changes: (item) => item.type === 'apply' || item.type === 'revert' || item.type === 'startup' || item.type === 'games',
  cleanup: (item) => item.type === 'cleanup',
  network: (item) => item.type === 'dns' || item.type === 'network',
  system: (item) => item.type === 'system',
};

function timeline() {
  const activity = state.history?.activity || [];
  const filter = state.activityFilter || 'all';
  const predicate = FILTER_GROUPS[filter] || FILTER_GROUPS.all;
  const filtered = activity.filter(predicate);
  const filterTabs = `
    <div class="card-header" style="margin-bottom:14px">
      <div><h2>Audit log</h2><p>${activity.length} recorded event${activity.length === 1 ? '' : 's'} on this PC.</p></div>
      <div class="card-actions">
        <button class="button button-small" type="button" data-action="refresh-activity">${icon('refresh')} Refresh</button>
        <button class="button button-small" type="button" data-action="export-report">${icon('download')} Export</button>
        ${activity.length ? `<button class="button button-small button-ghost" type="button" data-action="clear-activity">${icon('trash')} Clear</button>` : ''}
      </div>
    </div>
    ${activity.length ? `
      <div class="tabs" style="margin-bottom:16px">
        ${[
          ['all', 'All'],
          ['changes', 'Tweaks & startup'],
          ['cleanup', 'Cleanup'],
          ['network', 'Network & DNS'],
          ['system', 'System'],
        ].map(([key, label]) => `<button class="tab ${filter === key ? 'active' : ''}" type="button" data-activity-filter="${key}">${label}</button>`).join('')}
      </div>` : ''}
  `;
  if (!activity.length) {
    return `<div class="card card-pad">${filterTabs}${emptyState('history', 'No activity yet', 'Applied fixes, undos, startup toggles, cleanup runs, DNS changes, benchmarks and speed tests will appear here.')}</div>`;
  }
  if (!filtered.length) {
    return `<div class="card card-pad">${filterTabs}${emptyState('search', 'No matching events', 'No events match this category filter yet.')}</div>`;
  }
  return `
    <div class="card card-pad">
      ${filterTabs}
      <div class="timeline">
        ${filtered.map((item) => `
          <div class="timeline-item ${escapeHtml(item.type || '')}">
            <div class="timeline-head"><strong>${escapeHtml(item.title || 'Activity')}</strong><time>${formatDate(item.time)}</time></div>
            ${item.detail ? `<p>${escapeHtml(item.detail)}</p>` : ''}
          </div>`).join('')}
      </div>
    </div>`;
}

function buildReport() {
  return {
    app: 'Nexa Optimize',
    version: state.version,
    exportedAt: new Date().toISOString(),
    system: state.snapshot,
    scan: state.scan,
    network: {
      pingResults: state.pingResults,
      dnsBenchmark: state.dnsBenchmark,
      speedTest: state.speedTest,
    },
    cleanup: state.cleanupResult,
    applied: state.history?.applied || state.applied,
    activity: state.history?.activity || [],
  };
}

export async function downloadReport() {
  if (!state.history) {
    try {
      state.history = await api('/api/history');
    } catch {
      // Export what is already in memory if the history request fails.
    }
  }
  const report = buildReport();
  const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `nexa-report-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
  toast('success', 'Report exported', 'A local JSON snapshot was saved to your Downloads folder.');
}

async function refreshHistory(button) {
  if (button) {
    button.disabled = true;
    button.innerHTML = `${icon('refresh')} Refreshing…`;
  }
  try {
    const data = await api('/api/history');
    state.history = data;
    requestRender();
  } catch (error) {
    toast('error', 'Could not refresh activity', error.message);
    if (button) {
      button.disabled = false;
      button.innerHTML = `${icon('refresh')} Refresh`;
    }
  }
}

async function reloadHistory() {
  try {
    state.history = await api('/api/history');
  } catch {
    // Keep the current timeline if the refresh fails.
  }
}

export function renderActivity() {
  if (!state.history) {
    return '<div class="page-loading"><div class="loading-orbit"></div><p>Loading activity…</p></div>';
  }
  return `
    <div class="grid-2" style="align-items:start">
      <div>${appliedSection()}</div>
      <div>${timeline()}</div>
    </div>
  `;
}

export function bindActivity() {
  document.querySelectorAll('[data-action="undo-all"]').forEach((button) => {
    button.addEventListener('click', () => {
      openModal({
        title: 'Undo every Nexa change?',
        body: '<p>Nexa will restore every backed-up setting. A reboot or reconnect may be needed for some changes.</p>',
        confirmLabel: 'Undo all changes',
        danger: true,
        onConfirm: async () => {
          const response = await undoAll();
          const failed = (response.results || []).filter((result) => !result.ok);
          if (failed.length) toast('warn', 'Some changes could not be undone', failed.map((item) => item.error).join(' · '));
          else toast('success', 'All Nexa changes undone');
          await reloadHistory();
          requestRender();
        },
      });
    });
  });
  document.querySelectorAll('[data-undo-action]').forEach((button) => {
    button.addEventListener('click', () => {
      const id = button.getAttribute('data-undo-action');
      const action = state.scan?.actions?.find((item) => item.id === id);
      openModal({
        title: `Undo ${action?.name || 'change'}?`,
        body: '<p>Nexa will restore the value it backed up before applying this change.</p>',
        confirmLabel: 'Undo change',
        danger: true,
        onConfirm: async () => {
          await undoAction(id);
          await reloadHistory();
          toast('success', 'Change undone');
          requestRender();
        },
      });
    });
  });
  document.querySelectorAll('[data-action="refresh-activity"]').forEach((button) => {
    button.addEventListener('click', () => refreshHistory(button));
  });
  document.querySelectorAll('[data-activity-filter]').forEach((button) => {
    button.addEventListener('click', () => {
      state.activityFilter = button.getAttribute('data-activity-filter') || 'all';
      requestRender();
    });
  });
  document.querySelectorAll('[data-action="clear-activity"]').forEach((button) => {
    button.addEventListener('click', () => {
      openModal({
        title: 'Clear the activity log?',
        body: '<p>This clears the timeline history. Active backups and undo buttons for your applied Windows changes are kept intact.</p>',
        confirmLabel: 'Clear log',
        danger: true,
        onConfirm: async () => {
          const data = await api('/api/history/clear', { method: 'POST', body: {} });
          state.history = data;
          toast('success', 'Activity log cleared');
          requestRender();
        },
      });
    });
  });
  document.querySelectorAll('[data-action="export-report"]').forEach((button) => {
    button.addEventListener('click', downloadReport);
  });
}
