'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..', '..');
const DATA_DIR = path.join(ROOT, 'data');
const STATE_FILE = path.join(DATA_DIR, 'state.json');
const STARTUP_BACKUP_DIR = path.join(DATA_DIR, 'startup-backup');

const DEFAULT_SETTINGS = {
  showAdvanced: true,
  autoRestorePoint: false,
  pingCount: 10,
  reduceMotion: false,
  compactMode: false,
  runInBackground: true,
};

function defaultState() {
  return {
    version: 1,
    createdAt: new Date().toISOString(),
    settings: { ...DEFAULT_SETTINGS },
    applied: {},
    backups: {},
    disabledStartup: [],
    dnsBackup: null,
    dnsApplied: null,
    network: {
      pingResults: {},
      dnsBenchmark: null,
      speedTest: null,
    },
    games: {},
    activity: [],
  };
}

function ensureDirs() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.mkdirSync(STARTUP_BACKUP_DIR, { recursive: true });
}

let state = null;

function load() {
  ensureDirs();
  if (!state) {
    try {
      const raw = fs.readFileSync(STATE_FILE, 'utf8');
      state = { ...defaultState(), ...JSON.parse(raw) };
      state.settings = { ...DEFAULT_SETTINGS, ...(state.settings || {}) };
      state.applied = state.applied || {};
      state.backups = state.backups || {};
      state.disabledStartup = Array.isArray(state.disabledStartup) ? state.disabledStartup : [];
      state.network = {
        pingResults: {},
        dnsBenchmark: null,
        speedTest: null,
        ...(state.network || {}),
      };
      state.games = state.games && typeof state.games === 'object' ? state.games : {};
      state.activity = Array.isArray(state.activity) ? state.activity : [];
    } catch {
      state = defaultState();
    }
  }
  return state;
}

function save() {
  ensureDirs();
  const current = load();
  const tmp = `${STATE_FILE}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(current, null, 2), 'utf8');
  fs.renameSync(tmp, STATE_FILE);
}

function getState() {
  return load();
}

function getSettings() {
  return { ...DEFAULT_SETTINGS, ...(load().settings || {}) };
}

const ALLOWED_SETTINGS = new Set(Object.keys(DEFAULT_SETTINGS));

function updateSettings(patch) {
  const current = load();
  const next = { ...current.settings };
  for (const [key, value] of Object.entries(patch || {})) {
    if (ALLOWED_SETTINGS.has(key)) next[key] = value;
  }
  current.settings = next;
  save();
  return { ...next };
}

function addActivity(entry) {
  const current = load();
  const item = {
    id: `act_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    time: new Date().toISOString(),
    ...entry,
  };
  current.activity.unshift(item);
  current.activity = current.activity.slice(0, 250);
  save();
  return item;
}

function getActivity() {
  return load().activity.slice();
}

function clearActivity() {
  const current = load();
  current.activity = [];
  save();
  return [];
}

function getNetworkState() {
  const net = load().network || {};
  return {
    pingResults: { ...(net.pingResults || {}) },
    dnsBenchmark: net.dnsBenchmark || null,
    speedTest: net.speedTest || null,
  };
}

function updateNetworkState(patch = {}) {
  const current = load();
  current.network = {
    ...getNetworkState(),
    ...patch,
  };
  save();
  return getNetworkState();
}

function getGameState(gameId) {
  return load().games[gameId] || null;
}

function setGameState(gameId, value) {
  const current = load();
  current.games[gameId] = value;
  save();
}

function clearGameState(gameId) {
  const current = load();
  delete current.games[gameId];
  save();
}

function setBackup(actionId, backup) {
  const current = load();
  current.backups[actionId] = { ...backup, createdAt: new Date().toISOString() };
  current.applied[actionId] = new Date().toISOString();
  save();
}

function getBackup(actionId) {
  return load().backups[actionId] || null;
}

function clearApplied(actionId) {
  const current = load();
  delete current.applied[actionId];
  save();
}

function clearBackup(actionId) {
  const current = load();
  delete current.backups[actionId];
  save();
}

function getApplied() {
  return { ...load().applied };
}

function setDnsBackup(backup) {
  const current = load();
  current.dnsBackup = backup;
  save();
}

function getDnsBackup() {
  return load().dnsBackup;
}

function setDnsApplied(info) {
  const current = load();
  current.dnsApplied = info;
  save();
}

function getDnsApplied() {
  return load().dnsApplied;
}

function clearDnsApplied() {
  const current = load();
  current.dnsApplied = null;
  save();
}

function addDisabledStartup(entry) {
  const current = load();
  current.disabledStartup.push(entry);
  save();
}

function removeDisabledStartup(id) {
  const current = load();
  const index = current.disabledStartup.findIndex((item) => item.id === id);
  if (index === -1) return null;
  const [entry] = current.disabledStartup.splice(index, 1);
  save();
  return entry;
}

function getDisabledStartup() {
  return load().disabledStartup.slice();
}

module.exports = {
  ROOT,
  DATA_DIR,
  STARTUP_BACKUP_DIR,
  DEFAULT_SETTINGS,
  getState,
  save,
  getSettings,
  updateSettings,
  addActivity,
  getActivity,
  clearActivity,
  getNetworkState,
  updateNetworkState,
  getGameState,
  setGameState,
  clearGameState,
  setBackup,
  getBackup,
  clearApplied,
  clearBackup,
  getApplied,
  setDnsBackup,
  getDnsBackup,
  setDnsApplied,
  getDnsApplied,
  clearDnsApplied,
  addDisabledStartup,
  removeDisabledStartup,
  getDisabledStartup,
};
