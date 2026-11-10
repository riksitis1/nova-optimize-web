'use strict';

const { runBridge } = require('./ps');
const { getState, save } = require('./store');
const { getPublicActions } = require('./actions');

const GAMING_ACTIONS = new Map([
  ['game-mode', true],
  ['windowed-optimizations', true],
  ['capture-history', false],
  ['power-plan', false],
  ['delivery-optimization', false],
]);

function isGamingAction(id) {
  return GAMING_ACTIONS.has(id);
}

function gamingPowerAvailable(diagnostics) {
  return diagnostics?.powerLine === 'Online' && diagnostics.highPerformanceAvailable === true;
}

function getGamingCandidates(snapshot, applied, diagnostics) {
  return getPublicActions(snapshot, applied)
    .filter((action) => isGamingAction(action.id) && action.applicable && !action.optimized &&
      !action.appliedByNexa && (action.id !== 'power-plan' || gamingPowerAvailable(diagnostics)))
    .map((action) => ({ ...action, recommended: GAMING_ACTIONS.get(action.id) }));
}

const SYNC_APPS = new Map([
  ['onedrive', 'OneDrive'],
  ['dropbox', 'Dropbox'],
  ['googledrivefs', 'Google Drive'],
]);

function syncAppName(name) {
  return typeof name === 'string' ? name.toLowerCase() : '';
}

function validProcess(process) {
  return Number.isInteger(process?.id) && process.id > 0 &&
    SYNC_APPS.has(syncAppName(process.name)) && typeof process.started === 'string' && /^\d{15,20}$/.test(process.started);
}

function processKey(process) {
  return [process.id, syncAppName(process.name), process.started].join('/');
}

function loadSyncPriority() {
  const records = getState().syncPriority;
  return Array.isArray(records) ? records.filter(validProcess) : [];
}

function saveSyncPriority(records) {
  const state = getState();
  const previous = state.syncPriority;
  state.syncPriority = records;
  try {
    save();
  } catch (error) {
    state.syncPriority = previous;
    throw error;
  }
}

async function listSyncProcesses() {
  const rows = await runBridge('apps.syncPriority.list');
  return rows.filter(validProcess);
}

function getWindowsGamingDiagnostics() {
  return runBridge('gaming.diagnostics', {}, { timeout: 15_000 });
}

async function getGamingDiagnostics() {
  const [diagnostics, processes] = await Promise.all([
    getWindowsGamingDiagnostics(),
    listSyncProcesses(),
  ]);
  const tracked = new Set(loadSyncPriority().map(processKey));
  return {
    ...diagnostics,
    syncApps: Array.from(SYNC_APPS, ([name, label]) => ({
      name,
      label,
      eligible: processes.filter((row) => syncAppName(row.name) === name && row.priority === 'Normal').length,
      lowered: processes.filter((row) => syncAppName(row.name) === name && row.priority === 'BelowNormal' && tracked.has(processKey(row))).length,
    })).filter(({ eligible, lowered }) => eligible || lowered),
  };
}

function cleanSyncApps(value) {
  if (!Array.isArray(value) || !value.length || value.length > SYNC_APPS.size) {
    throw new Error('Choose at least one listed cloud-sync app.');
  }
  const names = value.map(syncAppName);
  if (names.some((name) => !SYNC_APPS.has(name))) throw new Error('Unknown cloud-sync app.');
  return new Set(names);
}

async function setSyncPriority(names, restore) {
  const selected = cleanSyncApps(names);
  const records = new Map(loadSyncPriority().map((row) => [processKey(row), row]));
  const targets = restore
    ? [...records.values()].filter((row) => selected.has(syncAppName(row.name)))
    : (await listSyncProcesses()).filter((row) => row.priority === 'Normal' && selected.has(syncAppName(row.name)));

  if (!targets.length) return { changed: 0, failed: 0 };
  if (!restore) {
    for (const row of targets) records.set(processKey(row), row);
    saveSyncPriority([...records.values()]);
  }
  const results = await runBridge('apps.syncPriority.set', { targets, restore });
  const statuses = new Map(results.map(({ id, started, status }) => [[id, started].join('/'), status]));
  let changed = 0;
  let failed = 0;
  for (const row of targets) {
    const status = statuses.get([row.id, row.started].join('/'));
    if (status === 'changed') changed += 1;
    if (!status || status === 'failed') {
      failed += 1;
      continue;
    }
    if (restore || status !== 'changed') records.delete(processKey(row));
  }
  saveSyncPriority([...records.values()]);
  return { changed, failed };
}

module.exports = {
  cleanSyncApps,
  getGamingDiagnostics,
  getWindowsGamingDiagnostics,
  getGamingCandidates,
  gamingPowerAvailable,
  isGamingAction,
  setSyncPriority,
};
