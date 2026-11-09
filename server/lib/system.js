'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const { runBridge } = require('./ps');
const {
  STARTUP_BACKUP_DIR,
  addDisabledStartup,
  getDisabledStartup,
  removeDisabledStartup,
} = require('./store');

const execFileAsync = promisify(execFile);

let snapshotCache = null;
let snapshotCacheAt = 0;
let inFlightSnapshot = null;
const SNAPSHOT_TTL = 60_000;

function getCachedSnapshot() {
  return snapshotCache;
}

async function getSnapshot(force = false) {
  if (!force && snapshotCache && Date.now() - snapshotCacheAt < SNAPSHOT_TTL) {
    return snapshotCache;
  }
  if (!force && inFlightSnapshot) {
    return inFlightSnapshot;
  }
  const promise = runBridge('snapshot', {}, { timeout: 60_000 })
    .then((snapshot) => {
      snapshotCache = snapshot;
      snapshotCacheAt = Date.now();
      return snapshot;
    })
    .finally(() => {
      if (inFlightSnapshot === promise) inFlightSnapshot = null;
    });
  inFlightSnapshot = promise;
  return promise;
}

function invalidateSnapshot() {
  snapshotCache = null;
  snapshotCacheAt = 0;
}

function startupId(entry) {
  const key = entry.type === 'file'
    ? `file|${entry.filePath}`
    : `registry|${entry.hive}|${entry.path}|${entry.name}`;
  return `st_${crypto.createHash('sha1').update(key).digest('hex').slice(0, 14)}`;
}

const HIGH_IMPACT = /onedrive|teams|discord|steam|epic|adobe|spotify|skype|zoom|slack|dropbox|google drive|docker|vmware|virtualbox|wallpaper|razer|logitech|icue|corsair|origin|ubisoft|battle\.net|riot/i;
const LOW_IMPACT = /security|defender|antivirus|firewall|audio|realtek|synaptics|touchpad|input|driver|runtime|update|nvidia|amd|intel/i;
const PROTECTED = /securityhealth|windows defender|defender|antivirus|firewall|malwarebytes|kaspersky|bitdefender|norton|avast|avg|ctfmon|rtkauduservice|synaptics|elan|igfx|vanguard|vgtray/i;

function describeStartup(entry) {
  const text = `${entry.name || ''} ${entry.command || ''} ${entry.value || ''} ${entry.filePath || ''}`;
  const protectedEntry = PROTECTED.test(text);
  let impact = 'medium';
  if (HIGH_IMPACT.test(text)) impact = 'high';
  else if (LOW_IMPACT.test(text)) impact = 'low';
  const requiresAdmin =
    entry.requiresAdmin === true ||
    (entry.type === 'registry' && entry.hive === 'HKLM') ||
    /all users/i.test(entry.source || '');
  return {
    id: startupId(entry),
    type: entry.type,
    name: entry.name || 'Unnamed startup item',
    source: entry.source || 'Startup',
    command: entry.command || entry.filePath || '',
    path: entry.path || entry.filePath || '',
    hive: entry.hive || null,
    requiresAdmin,
    impact,
    protected: protectedEntry,
    enabled: true,
    entry,
  };
}

async function getStartup() {
  const snapshot = await getSnapshot();
  const active = (snapshot.startup || []).map(describeStartup);
  const disabled = getDisabledStartup().map((record) => {
    const entry = record.entry && record.entry.type ? record.entry : record.entry?.entry || {};
    const base = describeStartup(entry);
    return {
      ...base,
      id: record.id,
      enabled: false,
      disabledAt: record.disabledAt,
      backup: record.backup,
    };
  });
  return {
    active,
    disabled,
    total: active.length + disabled.length,
    activeCount: active.length,
    disabledCount: disabled.length,
    protectedCount: active.filter((item) => item.protected).length,
  };
}

async function toggleStartup(id, enabled) {
  if (enabled) {
    const record = getDisabledStartup().find((item) => item.id === id);
    if (!record) throw new Error('That disabled startup item was not found.');
    const backup = record.backup || {};
    const entry = backup.type === 'file'
      ? { type: 'file', originalPath: backup.originalPath, backupPath: backup.backupPath }
      : { type: 'registry', entry: backup.entry || record.entry?.entry || record.entry };
    await runBridge('startup.enable', { entry }, { timeout: 20_000 });
    removeDisabledStartup(id);
    invalidateSnapshot();
    return { ok: true, enabled: true, name: record.name || record.entry?.name || 'Startup item' };
  }

  const startup = await getStartup();
  const active = startup.active.find((item) => item.id === id);
  if (!active) throw new Error('That startup item was not found.');
  if (active.protected) throw new Error('Nova protects security and core system startup entries.');
  const result = await runBridge(
    'startup.disable',
    { entry: active.entry, backupDir: STARTUP_BACKUP_DIR },
    { timeout: 20_000 },
  );
  addDisabledStartup({
    id,
    entry: active.entry,
    backup: result,
    disabledAt: new Date().toISOString(),
    name: active.name,
    source: active.source,
  });
  invalidateSnapshot();
  return { ok: true, enabled: false, name: active.name };
}

async function toggleAllStartup(enabled, isAdmin = false) {
  const names = [];
  let skippedAdmin = 0;
  if (enabled) {
    const disabledList = [...getDisabledStartup()];
    for (const record of disabledList) {
      const entryObj = record.entry && record.entry.type ? record.entry : record.entry?.entry || {};
      const desc = describeStartup(entryObj);
      if (!isAdmin && desc.requiresAdmin) {
        skippedAdmin += 1;
        continue;
      }
      const backup = record.backup || {};
      const entry = backup.type === 'file'
        ? { type: 'file', originalPath: backup.originalPath, backupPath: backup.backupPath }
        : { type: 'registry', entry: backup.entry || record.entry?.entry || record.entry };
      await runBridge('startup.enable', { entry }, { timeout: 20_000 });
      removeDisabledStartup(record.id);
      names.push(record.name || desc.name);
    }
    invalidateSnapshot();
    return { ok: true, enabled: true, count: names.length, skippedAdmin, names };
  }

  const startup = await getStartup();
  for (const item of startup.active) {
    if (item.protected) continue;
    if (!isAdmin && item.requiresAdmin) {
      skippedAdmin += 1;
      continue;
    }
    const result = await runBridge(
      'startup.disable',
      { entry: item.entry, backupDir: STARTUP_BACKUP_DIR },
      { timeout: 20_000 },
    );
    addDisabledStartup({
      id: item.id,
      entry: item.entry,
      backup: result,
      disabledAt: new Date().toISOString(),
      name: item.name,
      source: item.source,
    });
    names.push(item.name);
  }
  invalidateSnapshot();
  return { ok: true, enabled: false, count: names.length, skippedAdmin, names };
}

async function getCleanupScan() {
  return runBridge('cleanup.scan', {}, { timeout: 60_000 });
}

async function runCleanup(ids, snapshot) {
  if (!Array.isArray(ids) || !ids.length) throw new Error('Select at least one cleanup category.');
  const known = await getCleanupScan();
  const selected = known.filter((item) => ids.includes(item.id));
  if (!selected.length) throw new Error('No valid cleanup categories were selected.');
  if (!snapshot.admin && selected.some((item) => item.requiresAdmin)) {
    throw new Error('Run Nova as administrator to clean Windows system files.');
  }
  const results = await runBridge('cleanup.run', { ids: selected.map((item) => item.id) }, { timeout: 120_000 });
  return { results, selected };
}

async function getProcesses() {
  return runBridge('processes', {}, { timeout: 30_000 });
}

async function createRestorePoint() {
  return runBridge('restorePoint', {}, { timeout: 180_000 });
}

async function trimMemory() {
  return runBridge('memory.trim', {}, { timeout: 25_000 });
}

let lastCpuTimes = os.cpus().map((cpu) => ({ ...cpu.times }));
let lastCpuSample = Date.now();

function readCpuUsage() {
  const cpus = os.cpus();
  const now = Date.now();
  const elapsed = Math.max(1, now - lastCpuSample);
  const perCore = [];
  let totalIdle = 0;
  let totalTick = 0;
  cpus.forEach((cpu, index) => {
    const previous = lastCpuTimes[index] || { user: 0, nice: 0, sys: 0, idle: 0, irq: 0 };
    const current = cpu.times;
    const idle = current.idle - previous.idle;
    const total = Object.keys(current).reduce((sum, key) => sum + (current[key] - (previous[key] || 0)), 0);
    totalIdle += idle;
    totalTick += total;
    perCore.push({
      core: index,
      usage: total > 0 ? Math.round(((total - idle) / total) * 100) : 0,
    });
  });
  lastCpuTimes = cpus.map((cpu) => ({ ...cpu.times }));
  lastCpuSample = now;
  return {
    usage: totalTick > 0 ? Math.round(((totalTick - totalIdle) / totalTick) * 100) : 0,
    perCore,
    cores: cpus.length,
    model: cpus[0]?.model?.trim() || 'Unknown CPU',
    speedMhz: cpus[0]?.speed || 0,
    sampleMs: elapsed,
  };
}

let nvidiaSmiChecked = false;
let nvidiaSmiPath = null;
let gpuCache = null;
let gpuCacheAt = 0;

async function findNvidiaSmi() {
  if (nvidiaSmiChecked) return nvidiaSmiPath;
  nvidiaSmiChecked = true;
  const candidates = [
    'nvidia-smi.exe',
    'C:\\Windows\\System32\\nvidia-smi.exe',
    'C:\\Program Files\\NVIDIA Corporation\\NVSMI\\nvidia-smi.exe',
  ];
  for (const candidate of candidates) {
    try {
      await execFileAsync(candidate, ['--query-gpu=name', '--format=csv,noheader'], { timeout: 2500, windowsHide: true });
      nvidiaSmiPath = candidate;
      return candidate;
    } catch {
      // try the next candidate
    }
  }
  return null;
}

async function readGpuUsage() {
  if (gpuCache && Date.now() - gpuCacheAt < 8000) return gpuCache;
  const smi = await findNvidiaSmi();
  if (!smi) {
    gpuCache = null;
    gpuCacheAt = Date.now();
    return null;
  }
  try {
    const { stdout } = await execFileAsync(
      smi,
      ['--query-gpu=name,utilization.gpu,memory.used,memory.total,temperature.gpu', '--format=csv,noheader,nounits'],
      { timeout: 3000, windowsHide: true },
    );
    const line = stdout.trim().split(/\r?\n/)[0] || '';
    const [name, usage, memoryUsed, memoryTotal, temperature] = line.split(',').map((part) => part.trim());
    gpuCache = {
      name,
      usage: Number(usage),
      memoryUsedMb: Number(memoryUsed),
      memoryTotalMb: Number(memoryTotal),
      temperature: Number(temperature),
    };
  } catch {
    gpuCache = null;
  }
  gpuCacheAt = Date.now();
  return gpuCache;
}

function readDisk() {
  try {
    const root = process.env.SystemDrive || 'C:';
    const stats = fs.statfsSync(`${root}\\`);
    const total = stats.blocks * stats.bsize;
    const free = stats.bavail * stats.bsize;
    return {
      drive: root,
      total,
      free,
      used: total - free,
      usedPercent: total > 0 ? Math.round(((total - free) / total) * 1000) / 10 : 0,
    };
  } catch {
    return null;
  }
}

async function getTelemetry() {
  const cpu = readCpuUsage();
  const total = os.totalmem();
  const free = os.freemem();
  const gpu = await readGpuUsage();
  return {
    time: new Date().toISOString(),
    cpu,
    memory: {
      total,
      free,
      used: total - free,
      usagePercent: total > 0 ? Math.round(((total - free) / total) * 1000) / 10 : 0,
    },
    disk: readDisk(),
    gpu,
    uptimeSeconds: Math.round(os.uptime()),
    load: os.loadavg(),
  };
}

module.exports = {
  getSnapshot,
  getCachedSnapshot,
  invalidateSnapshot,
  getStartup,
  toggleStartup,
  toggleAllStartup,
  getCleanupScan,
  runCleanup,
  getProcesses,
  createRestorePoint,
  trimMemory,
  getTelemetry,
};
