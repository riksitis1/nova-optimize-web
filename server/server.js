'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawn, execFile } = require('node:child_process');
const { promisify } = require('node:util');

const { runBridge, runPowerShell } = require('./lib/ps');
const {
  ROOT,
  DATA_DIR,
  getSettings,
  updateSettings,
  addActivity,
  getActivity,
  clearActivity,
  getNetworkState,
  updateNetworkState,
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
} = require('./lib/store');
const { analyze } = require('./lib/analyze');
const { getAction, getPublicActions } = require('./lib/actions');
const {
  getSnapshot,
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
} = require('./lib/system');
const {
  getTargets,
  pingTarget,
  benchmarkDns,
  speedTest,
} = require('./lib/network');
const {
  cleanIdList,
  cleanId,
  cleanIpList,
  cleanIfIndexes,
  clampInt,
} = require('./lib/validate');
const { checkForUpdate, downloadAndStageUpdate } = require('./lib/updater');
const { listGames, describeGame, applyGameSettings, revertGameSettings } = require('./lib/games');
const { listBoostApps, runBoost } = require('./lib/boost');

const execFileAsync = promisify(execFile);
const VERSION = require('../package.json').version;
const PORT = clampInt(process.env.NEXA_PORT || process.env.NOVA_PORT, 1024, 65535, 4318);
const HOST = '127.0.0.1';
const PUBLIC_DIR = path.join(ROOT, 'public');
const tokenArg = process.argv.find((arg) => arg.startsWith('--token='));
const TOKEN = tokenArg ? tokenArg.slice('--token='.length) : process.env.NEXA_TOKEN || process.env.NOVA_TOKEN || crypto.randomBytes(32).toString('hex');
const NO_OPEN = process.argv.includes('--no-open') || process.env.NEXA_NO_OPEN || process.env.NOVA_NO_OPEN === '1';
const IS_ELEVATED = process.argv.includes('--elevated') || process.env.NOVA_ELEVATED === '1';

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// Local rate limiting: sliding window per IP
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW_MS = 10_000;
const RATE_LIMIT_MAX_REQUESTS = 120;

function checkRateLimit(req) {
  const ip = req.socket.remoteAddress || '127.0.0.1';
  const now = Date.now();
  let record = rateLimitMap.get(ip);
  if (!record || now - record.start > RATE_LIMIT_WINDOW_MS) {
    record = { start: now, count: 1 };
    rateLimitMap.set(ip, record);
    return;
  }
  record.count += 1;
  if (record.count > RATE_LIMIT_MAX_REQUESTS) {
    throw new HttpError(429, 'Too many requests. Please slow down.');
  }
}

// Periodic cleanup of stale rate-limit records
setInterval(() => {
  const now = Date.now();
  for (const [ip, record] of rateLimitMap.entries()) {
    if (now - record.start > RATE_LIMIT_WINDOW_MS * 2) {
      rateLimitMap.delete(ip);
    }
  }
}, 30_000).unref();

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
};

function securityHeaders(res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; font-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
  );
}

function sendJson(res, status, data) {
  securityHeaders(res);
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

function sendError(res, error) {
  const status = error.status || 500;
  const message = error.message || 'Something went wrong.';
  if (status >= 500) console.error(`[nexa] ${message}`);
  sendJson(res, status, { ok: false, error: message });
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > 64 * 1024) {
        reject(new HttpError(413, 'Request body exceeds 64 KB limit.'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (!chunks.length) return resolve({});
      try {
        const parsed = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        resolve(parsed && typeof parsed === 'object' ? parsed : {});
      } catch {
        reject(new HttpError(400, 'Invalid JSON request body.'));
      }
    });
    req.on('error', reject);
  });
}

function checkHost(req) {
  const host = String(req.headers.host || '').toLowerCase();
  const expectedHost = `127.0.0.1:${PORT}`;
  if (host !== expectedHost) {
    throw new HttpError(403, 'Forbidden: Invalid Host header (DNS rebinding protection).');
  }

  const origin = req.headers.origin;
  if (origin && String(origin).toLowerCase() !== `http://127.0.0.1:${PORT}`) {
    throw new HttpError(403, 'Forbidden: Cross-origin requests blocked.');
  }

  const referer = req.headers.referer;
  if (referer && !String(referer).toLowerCase().startsWith(`http://127.0.0.1:${PORT}/`)) {
    throw new HttpError(403, 'Forbidden: Cross-origin referer blocked.');
  }

  const secFetchSite = String(req.headers['sec-fetch-site'] || '').toLowerCase();
  if (secFetchSite === 'cross-site') {
    throw new HttpError(403, 'Forbidden: Cross-site requests blocked.');
  }
}

let lastClientSeenAt = Date.now();
let windowCloseTimer = null;

function markClientAlive() {
  lastClientSeenAt = Date.now();
  if (windowCloseTimer) {
    clearTimeout(windowCloseTimer);
    windowCloseTimer = null;
  }
}

function checkToken(req, url) {
  const headerToken = req.headers['x-nexa-token'] || req.headers['x-nova-token'];
  const queryToken = url?.searchParams?.get('token');
  const provided = String(headerToken || queryToken || '');
  const expected = TOKEN;
  if (!provided || provided.length !== expected.length) {
    throw new HttpError(403, 'Forbidden: Invalid or missing Nexa session token.');
  }
  if (!crypto.timingSafeEqual(Buffer.from(provided, 'utf8'), Buffer.from(expected, 'utf8'))) {
    throw new HttpError(403, 'Forbidden: Invalid Nexa session token.');
  }
}

async function handleApi(req, res, url) {
  const method = req.method;
  const pathname = url.pathname;
  if (pathname === '/api/health') {
    sendJson(res, 200, { ok: true, app: 'nexa', legacyApp: 'nova', version: VERSION, port: PORT, token: TOKEN });
    return;
  }
  checkHost(req);
  checkToken(req, url);
  if (pathname !== '/api/app/window-closed') {
    markClientAlive();
  }

  if (method === 'GET' && pathname === '/api/bootstrap') {
    const applied = getApplied();
    const snapshot = await getSnapshot();
    const scan = analyze(snapshot, applied);
    sendJson(res, 200, {
      ok: true,
      version: VERSION,
      port: PORT,
      platform: process.platform,
      settings: getSettings(),
      applied,
      snapshot,
      scan,
      network: getNetworkState(),
      token: TOKEN,
      dataDir: DATA_DIR,
    });
    return;
  }

  if (method === 'GET' && pathname === '/api/system') {
    const snapshot = await getSnapshot();
    sendJson(res, 200, { ok: true, snapshot, applied: getApplied(), settings: getSettings() });
    return;
  }

  if (method === 'GET' && pathname === '/api/scan') {
    const snapshot = await getSnapshot(url.searchParams.get('force') === '1');
    const applied = getApplied();
    const scan = analyze(snapshot, applied);
    sendJson(res, 200, { ok: true, snapshot, scan, applied });
    return;
  }

  if (method === 'GET' && pathname === '/api/telemetry') {
    sendJson(res, 200, { ok: true, telemetry: await getTelemetry() });
    return;
  }

  if (method === 'GET' && pathname === '/api/actions') {
    const snapshot = await getSnapshot();
    sendJson(res, 200, { ok: true, actions: getPublicActions(snapshot, getApplied()), applied: getApplied() });
    return;
  }

  if (method === 'POST' && pathname === '/api/actions/apply') {
    const body = await readBody(req);
    const ids = cleanIdList(body.ids);
    const snapshot = await getSnapshot();
    if (!snapshot.admin) {
      const blocked = ids.map(getAction).filter((action) => action && action.requiresAdmin);
      if (blocked.length) throw new HttpError(403, 'Restart Nova as administrator to apply the selected changes.');
    }
    const settings = getSettings();
    const pending = ids.filter((id) => !getApplied()[id]);
    if (settings.autoRestorePoint === true && snapshot.admin && pending.length && !body.skipRestorePoint) {
      try {
        await createRestorePoint();
        addActivity({ type: 'system', title: 'Created a restore point before applying fixes' });
      } catch (error) {
        addActivity({ type: 'system', title: 'Automatic restore point was skipped', detail: error.message });
      }
    }
    const results = [];
    for (const id of ids) {
      const action = getAction(id);
      if (!action) {
        results.push({ id, ok: false, error: 'Unknown action.' });
        continue;
      }
      if (getApplied()[id] && action.isOptimized(snapshot)) {
        results.push({ id, ok: true, skipped: true, message: 'Already applied and optimized.' });
        continue;
      }
      try {
        const backup = await action.apply({ ps: runBridge, snapshot, admin: snapshot.admin });
        setBackup(id, backup);
        addActivity({
          type: 'apply',
          title: `Applied ${action.name}`,
          detail: action.description,
          actionId: id,
          category: action.category,
        });
        invalidateSnapshot();
        results.push({ id, ok: true });
      } catch (error) {
        results.push({ id, ok: false, error: error.message });
      }
    }
    const fresh = body.skipSnapshot ? snapshot : await getSnapshot(true);
    const applied = getApplied();
    sendJson(res, 200, { ok: results.every((result) => result.ok), results, snapshot: fresh, scan: analyze(fresh, applied), applied });
    return;
  }

  if (method === 'POST' && pathname === '/api/actions/revert') {
    const body = await readBody(req);
    const id = cleanId(body.id);
    const action = getAction(id);
    if (!action) throw new HttpError(404, 'Unknown action.');
    const backup = getBackup(id);
    if (!backup) throw new HttpError(404, 'Nova has no backup for that action.');
    const snapshot = await getSnapshot();
    if (!snapshot.admin && action.requiresAdmin) {
      throw new HttpError(403, 'Restart Nova as administrator to undo that change.');
    }
    await action.revert({ ps: runBridge, snapshot }, backup);
    clearApplied(id);
    clearBackup(id);
    addActivity({ type: 'revert', title: `Undid ${action.name}`, actionId: id, category: action.category });
    invalidateSnapshot();
    const fresh = await getSnapshot(true);
    const applied = getApplied();
    sendJson(res, 200, { ok: true, snapshot: fresh, scan: analyze(fresh, applied), applied });
    return;
  }

  if (method === 'POST' && pathname === '/api/actions/revert-all') {
    const snapshot = await getSnapshot();
    const applied = getApplied();
    const results = [];
    for (const id of Object.keys(applied).reverse()) {
      const action = getAction(id);
      const backup = getBackup(id);
      if (!action || !backup) continue;
      try {
        if (!snapshot.admin && action.requiresAdmin) {
          results.push({ id, ok: false, error: 'Administrator required.' });
          continue;
        }
        await action.revert({ ps: runBridge, snapshot }, backup);
        clearApplied(id);
        clearBackup(id);
        results.push({ id, ok: true });
      } catch (error) {
        results.push({ id, ok: false, error: error.message });
      }
    }
    if (results.some((result) => result.ok)) {
      addActivity({ type: 'revert', title: 'Undid Nova changes', detail: `${results.filter((result) => result.ok).length} changes restored.` });
      invalidateSnapshot();
    }
    const fresh = await getSnapshot(true);
    const nextApplied = getApplied();
    sendJson(res, 200, { ok: results.every((result) => result.ok), results, snapshot: fresh, scan: analyze(fresh, nextApplied), applied: nextApplied });
    return;
  }

  if (method === 'GET' && pathname === '/api/history') {
    sendJson(res, 200, { ok: true, activity: getActivity(), applied: getApplied() });
    return;
  }

  if (method === 'POST' && pathname === '/api/history/clear') {
    clearActivity();
    sendJson(res, 200, { ok: true, activity: [], applied: getApplied() });
    return;
  }

  if (method === 'GET' && pathname === '/api/startup') {
    sendJson(res, 200, { ok: true, startup: await getStartup() });
    return;
  }

  if (method === 'POST' && pathname === '/api/startup/toggle') {
    const body = await readBody(req);
    const id = cleanId(body.id, /^st_[a-f0-9]{14}$/);
    const enabled = body.enabled === true;
    const snapshot = await getSnapshot();
    if (!snapshot.admin) {
      const startup = await getStartup();
      const item = [...startup.active, ...startup.disabled].find((entry) => entry.id === id);
      if (item && (item.requiresAdmin || (item.type === 'registry' && item.hive === 'HKLM'))) {
        throw new HttpError(403, 'That startup item needs administrator rights.');
      }
    }
    const result = await toggleStartup(id, enabled);
    addActivity({
      type: 'startup',
      title: enabled ? 'Re-enabled a startup app' : 'Disabled a startup app',
      detail: result.name || 'Startup item changed.',
    });
    sendJson(res, 200, { ok: true, result, startup: await getStartup() });
    return;
  }

  if (method === 'POST' && pathname === '/api/startup/toggle-all') {
    const body = await readBody(req);
    const enabled = body.enabled === true;
    const snapshot = await getSnapshot();
    const result = await toggleAllStartup(enabled, Boolean(snapshot.admin));
    if (result.count > 0) {
      addActivity({
        type: 'startup',
        title: enabled ? `Re-enabled ${result.count} startup app${result.count === 1 ? '' : 's'}` : `Disabled ${result.count} startup app${result.count === 1 ? '' : 's'}`,
        detail: result.names.join(', '),
      });
    }
    sendJson(res, 200, { ok: true, result, startup: await getStartup() });
    return;
  }

  if (method === 'GET' && pathname === '/api/cleanup/scan') {
    const force = url.searchParams.get('force') === '1';
    sendJson(res, 200, { ok: true, categories: await getCleanupScan(force), admin: (await getSnapshot()).admin });
    return;
  }

  if (method === 'POST' && pathname === '/api/cleanup/run') {
    const body = await readBody(req);
    const ids = cleanIdList(body.ids);
    const snapshot = await getSnapshot();
    const result = await runCleanup(ids, snapshot);
    const freed = result.results.reduce((sum, item) => sum + (Number(item.bytes) || 0), 0);
    addActivity({
      type: 'cleanup',
      title: 'Cleaned temporary files',
      detail: `Freed ${(freed / 1024 ** 2).toFixed(1)} MB across ${result.results.length} categories.`,
      meta: { freed, results: result.results },
    });
    sendJson(res, 200, { ok: true, ...result, freed });
    return;
  }

  if (method === 'GET' && pathname === '/api/network/targets') {
    sendJson(res, 200, { ok: true, targets: getTargets() });
    return;
  }

  if (method === 'POST' && pathname === '/api/network/ping') {
    const body = await readBody(req);
    const result = await pingTarget({
      host: body.host,
      port: body.port,
      protocol: body.protocol,
      count: body.count,
    });
    const stamped = { ...result, testedAt: new Date().toISOString() };
    const targetKey = typeof body.targetId === 'string' && /^[a-z0-9-]{2,40}$/i.test(body.targetId) ? body.targetId : null;
    if (targetKey) {
      const netState = getNetworkState();
      updateNetworkState({
        pingResults: {
          ...(netState.pingResults || {}),
          [targetKey]: stamped,
        },
      });
    }
    sendJson(res, 200, { ok: true, result: stamped });
    return;
  }

  if (method === 'POST' && pathname === '/api/network/dns/benchmark') {
    const benchmark = await benchmarkDns();
    updateNetworkState({ dnsBenchmark: benchmark });
    addActivity({
      type: 'network',
      title: 'Ran a DNS resolver benchmark',
      detail: benchmark.best
        ? `Fastest resolver: ${benchmark.best.name} (${benchmark.best.median} ms median across ${benchmark.domains.length} domains)`
        : 'Benchmark completed.',
    });
    sendJson(res, 200, { ok: true, benchmark });
    return;
  }

  if (method === 'GET' && pathname === '/api/network/dns') {
    const snapshot = await getSnapshot();
    const adapters = await runBridge('dns.get', {}, { timeout: 20_000 });
    sendJson(res, 200, { ok: true, adapters, applied: getDnsApplied(), admin: snapshot.admin });
    return;
  }

  if (method === 'POST' && pathname === '/api/network/dns/apply') {
    const body = await readBody(req);
    const servers = cleanIpList(body.servers);
    const ifIndexes = cleanIfIndexes(body.ifIndexes);
    const snapshot = await getSnapshot();
    if (!snapshot.admin) throw new HttpError(403, 'Restart Nova as administrator to change DNS settings.');
    if (!getDnsBackup()) {
      const current = await runBridge('dns.get', {}, { timeout: 20_000 });
      const backup = current
        .filter((adapter) => ifIndexes.includes(adapter.ifIndex))
        .map((adapter) => ({
          ifIndex: adapter.ifIndex,
          name: adapter.name,
          mode: adapter.mode,
          servers: [...(adapter.dns4 || []), ...(adapter.dns6 || [])],
        }));
      setDnsBackup(backup);
    }
    const results = await runBridge('dns.apply', { servers, ifIndexes }, { timeout: 30_000 });
    const ok = results.every((result) => result.ok);
    if (!ok) {
      const error = results.find((result) => !result.ok);
      throw new HttpError(500, error?.error || 'Windows refused the DNS change.');
    }
    setDnsApplied({ servers, ifIndexes, at: new Date().toISOString(), provider: body.provider || 'Custom' });
    addActivity({ type: 'dns', title: 'Changed DNS servers', detail: `${body.provider || 'Custom'}: ${servers.join(', ')}` });
    sendJson(res, 200, { ok: true, results, applied: getDnsApplied() });
    return;
  }

  if (method === 'POST' && pathname === '/api/network/dns/reset') {
    const snapshot = await getSnapshot();
    if (!snapshot.admin) throw new HttpError(403, 'Restart Nova as administrator to reset DNS settings.');
    const backup = getDnsBackup();
    if (!backup || !backup.length) {
      const adapters = await runBridge('dns.get', {}, { timeout: 20_000 });
      const current = adapters.map((adapter) => ({ ifIndex: adapter.ifIndex, mode: 'dhcp', servers: [] }));
      await runBridge('dns.reset', { backups: current }, { timeout: 30_000 });
    } else {
      await runBridge('dns.reset', { backups: backup }, { timeout: 30_000 });
    }
    clearDnsApplied();
    addActivity({ type: 'dns', title: 'Reset DNS to the original configuration' });
    sendJson(res, 200, { ok: true });
    return;
  }

  if (method === 'POST' && pathname === '/api/network/flush') {
    await runBridge('dns.flush', {}, { timeout: 20_000 });
    addActivity({ type: 'network', title: 'Flushed the DNS cache' });
    sendJson(res, 200, { ok: true });
    return;
  }

  if (method === 'POST' && pathname === '/api/network/speedtest') {
    const result = await speedTest();
    updateNetworkState({ speedTest: result });
    addActivity({
      type: 'network',
      title: 'Ran a network speed test',
      detail: `${result.download.mbps} Mbps down / ${result.upload.mbps} Mbps up · bufferbloat ${result.latency.grade}`,
    });
    sendJson(res, 200, { ok: true, result });
    return;
  }

  if (method === 'GET' && pathname === '/api/processes') {
    sendJson(res, 200, { ok: true, processes: await getProcesses(url.searchParams.get('force') === '1') });
    return;
  }

  if (method === 'GET' && pathname === '/api/games') {
    sendJson(res, 200, { ok: true, games: await listGames() });
    return;
  }

  if (method === 'POST' && pathname === '/api/games/apply') {
    const body = await readBody(req);
    const gameId = cleanId(body.gameId);
    const settingIds = cleanIdList(body.settingIds);
    const result = await applyGameSettings(gameId, settingIds);
    addActivity({
      type: 'games',
      title: `Applied ${result.applied.length} ${result.name} performance setting${result.applied.length === 1 ? '' : 's'}`,
      detail: 'Backed up the original config. Restore any time from the Games page.',
    });
    sendJson(res, 200, { ok: true, result, game: await describeGame(gameId) });
    return;
  }

  if (method === 'POST' && pathname === '/api/games/revert') {
    const body = await readBody(req);
    const gameId = cleanId(body.gameId);
    const settingIds = Array.isArray(body.settingIds) && body.settingIds.length ? cleanIdList(body.settingIds) : null;
    const result = await revertGameSettings(gameId, settingIds);
    addActivity({
      type: 'games',
      title: settingIds
        ? `Restored ${settingIds.length} ${result.name} setting${settingIds.length === 1 ? '' : 's'} to original`
        : `Restored all ${result.name} settings to what they were before Nova`,
    });
    sendJson(res, 200, { ok: true, result, game: await describeGame(gameId) });
    return;
  }

  if (method === 'GET' && pathname === '/api/boost/apps') {
    sendJson(res, 200, { ok: true, apps: await listBoostApps() });
    return;
  }

  if (method === 'POST' && pathname === '/api/boost') {
    const body = await readBody(req);
    let closeApps;
    try {
      closeApps = body.closeApps;
      const { cleanBoostApps } = require('./lib/boost');
      cleanBoostApps(closeApps);
    } catch (error) {
      throw new HttpError(400, error.message);
    }
    const result = await runBoost(closeApps);
    const freedMb = Math.round(((Number(result.memory?.freedBytes) || 0) / 1024 ** 2) * 10) / 10;
    const closedCount = result.closed.reduce((sum, item) => sum + (Number(item.closed) || 0), 0);
    addActivity({
      type: 'system',
      title: 'Ran the pre-game boost',
      detail: `Closed ${closedCount} background process${closedCount === 1 ? '' : 'es'}, flushed DNS and reclaimed ${freedMb} MB of RAM.`,
    });
    sendJson(res, 200, { ok: true, result, telemetry: await getTelemetry() });
    return;
  }

  if (method === 'POST' && pathname === '/api/memory/trim') {
    const result = await trimMemory();
    const freedMb = Math.round(((Number(result.freedBytes) || 0) / 1024 ** 2) * 10) / 10;
    addActivity({
      type: 'system',
      title: 'Trimmed background working-set RAM',
      detail: freedMb > 0
        ? `Reclaimed ${freedMb} MB across ${result.trimmedProcesses || 0} background processes.`
        : `Trimmed ${result.trimmedProcesses || 0} background processes (memory already compact).`,
    });
    const telemetry = await getTelemetry();
    sendJson(res, 200, { ok: true, result, telemetry });
    return;
  }

  if (method === 'POST' && pathname === '/api/restore-point') {
    const snapshot = await getSnapshot();
    if (!snapshot.admin) throw new HttpError(403, 'Restart Nova as administrator to create a restore point.');
    const result = await createRestorePoint();
    addActivity({ type: 'system', title: 'Created a Windows restore point' });
    sendJson(res, 200, { ok: true, result });
    return;
  }

  if (method === 'POST' && pathname === '/api/settings') {
    const body = await readBody(req);
    const allowed = ['showAdvanced', 'autoRestorePoint', 'pingCount', 'reduceMotion', 'compactMode', 'runInBackground'];
    const patch = {};
    for (const key of allowed) {
      if (Object.prototype.hasOwnProperty.call(body, key)) patch[key] = body[key];
    }
    if (patch.pingCount !== undefined) patch.pingCount = clampInt(patch.pingCount, 3, 20, 10);
    for (const key of ['showAdvanced', 'autoRestorePoint', 'reduceMotion', 'compactMode', 'runInBackground']) {
      if (patch[key] !== undefined) patch[key] = patch[key] === true;
    }
    sendJson(res, 200, { ok: true, settings: updateSettings(patch) });
    return;
  }

  if (method === 'POST' && pathname === '/api/app/heartbeat') {
    sendJson(res, 200, { ok: true, runInBackground: getSettings().runInBackground !== false });
    return;
  }

  if (method === 'POST' && pathname === '/api/app/window-closed') {
    sendJson(res, 200, { ok: true });
    return;
  }

  if (method === 'POST' && pathname === '/api/system/elevate') {
    const snapshot = await getSnapshot();
    if (snapshot.admin) {
      sendJson(res, 200, { ok: true, alreadyAdmin: true });
      return;
    }
    await elevate();
    sendJson(res, 200, { ok: true, message: 'Nova is restarting with administrator rights.' });
    setTimeout(() => {
      server.close(() => process.exit(0));
    }, 900);
    return;
  }

  if (method === 'POST' && pathname === '/api/app/open-data') {
    spawn('explorer.exe', [DATA_DIR], { detached: true, stdio: 'ignore' }).unref();
    sendJson(res, 200, { ok: true });
    return;
  }

  if (method === 'POST' && pathname === '/api/app/quit') {
    sendJson(res, 200, { ok: true });
    setTimeout(() => {
      server.close(() => process.exit(0));
    }, 250);
    return;
  }

  if (method === 'GET' && pathname === '/api/update/check') {
    const info = await checkForUpdate(VERSION);
    sendJson(res, 200, { ok: true, ...info });
    return;
  }

  if (method === 'POST' && pathname === '/api/update/install') {
    const result = await downloadAndStageUpdate(VERSION);
    addActivity({
      type: 'system',
      title: `Updated Nexa Optimize to v${result.installedVersion}`,
      detail: `Verified SHA-256 checksum (${result.sha256.slice(0, 12)}…) and installed in place.`,
    });
    sendJson(res, 200, {
      ok: true,
      ...result,
      message: `Updated to v${result.installedVersion}. Restarting Nova…`,
    });
    setTimeout(() => {
      server.close(() => {
        restartSelf();
        process.exit(0);
      });
    }, 400);
    return;
  }

  throw new HttpError(404, 'API route not found.');
}

function serveStatic(req, res, url) {
  let pathname = decodeURIComponent(url.pathname);
  if (pathname === '/') pathname = '/index.html';
  const filePath = path.normalize(path.join(PUBLIC_DIR, pathname));
  const relative = path.relative(PUBLIC_DIR, filePath);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }
  fs.readFile(filePath, (error, data) => {
    if (error) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not found');
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    securityHeaders(res);
    res.setHeader('Content-Type', MIME[ext] || 'application/octet-stream');
    res.setHeader('Cache-Control', 'no-store');
    if (ext === '.html') {
      const html = data.toString('utf8').replaceAll('__NEXA_TOKEN__', TOKEN);
      res.writeHead(200);
      res.end(html);
      return;
    }
    res.writeHead(200);
    res.end(data);
  });
}

const server = http.createServer((req, res) => {
  try {
    checkHost(req);
    checkRateLimit(req);
  } catch (error) {
    sendError(res, error);
    return;
  }

  const url = new URL(req.url, `http://${HOST}:${PORT}`);
  if (url.pathname.startsWith('/api/')) {
    handleApi(req, res, url).catch((error) => sendError(res, error));
    return;
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405);
    res.end('Method not allowed');
    return;
  }
  serveStatic(req, res, url);
});

function findEdge() {
  const candidates = [
    // Microsoft Edge (Standard on Windows 10/11)
    path.join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'Microsoft\\Edge\\Application\\msedge.exe'),
    path.join(process.env.ProgramFiles || 'C:\\Program Files', 'Microsoft\\Edge\\Application\\msedge.exe'),
    path.join(process.env.ProgramW6432 || '', 'Microsoft\\Edge\\Application\\msedge.exe'),
    path.join(process.env.LOCALAPPDATA || '', 'Microsoft\\Edge\\Application\\msedge.exe'),
    // Chrome fallback (supports --app= window mode seamlessly)
    path.join(process.env.ProgramFiles || 'C:\\Program Files', 'Google\\Chrome\\Application\\chrome.exe'),
    path.join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'Google\\Chrome\\Application\\chrome.exe'),
    path.join(process.env.ProgramW6432 || '', 'Google\\Chrome\\Application\\chrome.exe'),
    path.join(process.env.LOCALAPPDATA || '', 'Google\\Chrome\\Application\\chrome.exe'),
    // Brave fallback (supports --app= window mode)
    path.join(process.env.ProgramFiles || 'C:\\Program Files', 'BraveSoftware\\Brave-Browser\\Application\\brave.exe'),
    path.join(process.env.LOCALAPPDATA || '', 'BraveSoftware\\Brave-Browser\\Application\\brave.exe'),
  ];
  return candidates.find((candidate) => candidate && fs.existsSync(candidate));
}

function openApp(targetToken = TOKEN) {
  if (NO_OPEN) return;
  const url = `http://${HOST}:${PORT}/?token=${targetToken}`;
  const edge = findEdge();
  try {
    if (edge) {
      const child = spawn(
        edge,
        [
          `--app=${url}`,
          '--window-size=1500,980',
          '--no-first-run',
          '--disable-extensions',
          '--disable-background-networking',
          '--disable-sync',
          '--disable-features=msEdgeSidebarV2,TranslateUI',
        ],
        { detached: true, stdio: 'ignore' },
      );
      child.on('error', () => {
        try {
          const fallback = spawn('cmd.exe', ['/c', 'start', '', url], { detached: true, stdio: 'ignore', windowsHide: true });
          fallback.unref();
        } catch {}
      });
      child.unref();
    } else {
      const child = spawn('cmd.exe', ['/c', 'start', '', url], { detached: true, stdio: 'ignore', windowsHide: true });
      child.unref();
    }
  } catch (error) {
    console.error('[nexa] Could not open the app window:', error.message);
  }
}

async function elevate() {
  const node = process.execPath;
  const serverPath = path.join(__dirname, 'server.js');
  const psString = (value) => `'${String(value).replaceAll("'", "''")}'`;
  const args = [serverPath, '--no-open', '--elevated', `--token=${TOKEN}`];
  const argList = args.map(psString).join(',');
  const command = `Start-Process -FilePath ${psString(node)} -ArgumentList @(${argList}) -WorkingDirectory ${psString(ROOT)} -Verb RunAs -WindowStyle Hidden`;
  await runPowerShell(command, { timeout: 30_000 });
}

function restartSelf() {
  const node = process.execPath;
  const serverPath = path.join(__dirname, 'server.js');
  const args = [serverPath, '--no-open', `--token=${TOKEN}`, '--restarted'];
  if (IS_ELEVATED) args.push('--elevated');
  const child = spawn(node, args, {
    cwd: ROOT,
    detached: true,
    stdio: 'ignore',
    windowsHide: true,
  });
  child.unref();
}

async function healthCheck() {
  try {
    const response = await fetch(`http://${HOST}:${PORT}/api/health`, { signal: AbortSignal.timeout(900) });
    const data = await response.json();
    return data && (data.app === 'nexa' || data.app === 'nova' || data.ok) ? data : null;
  } catch {
    return null;
  }
}

function startBackgroundService() {
  setInterval(async () => {
    try {
      const telemetry = await getTelemetry();
      if (Number(telemetry?.memory?.usagePercent) >= 82) {
        await trimMemory();
      }
    } catch {
      // Background maintenance stays silent if a single sample fails.
    }
  }, 180_000).unref();
}

function checkIntegrity() {
  const manifestPath = path.join(ROOT, 'manifest.json');
  if (!fs.existsSync(manifestPath)) return { ok: true, verified: false };
  try {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    let valid = true;
    for (const [relPath, expectedHash] of Object.entries(manifest.files || {})) {
      const fullPath = path.join(ROOT, relPath);
      if (!fs.existsSync(fullPath)) {
        valid = false;
        break;
      }
      const data = fs.readFileSync(fullPath);
      const hash = crypto.createHash('sha256').update(data).digest('hex');
      if (hash !== expectedHash) {
        valid = false;
        break;
      }
    }
    return { ok: valid, verified: true };
  } catch {
    return { ok: false, verified: true };
  }
}

let isPrimaryServer = false;

function getStoredToken() {
  try {
    const raw = fs.readFileSync(path.join(DATA_DIR, 'session.token'), 'utf8').trim();
    if (raw.includes(':')) return raw.split(':')[1];
    return raw;
  } catch {
    return null;
  }
}

async function listen(attempt = 0) {
  try {
    fs.appendFileSync(path.join(DATA_DIR, 'server.log'), `[${new Date().toISOString()}] PID ${process.pid} Starting listen (attempt ${attempt}, args: ${process.argv.slice(2).join(' ')})\n`);
  } catch {}
  try {
    await new Promise((resolve, reject) => {
      const onError = (error) => {
        server.off('listening', onListening);
        reject(error);
      };
      const onListening = () => {
        server.off('error', onError);
        resolve();
      };
      server.once('error', onError);
      server.once('listening', onListening);
      server.listen(PORT, HOST);
    });
    isPrimaryServer = true;
    const banner = `Nexa Optimize ${VERSION} · http://${HOST}:${PORT}`;
    console.log(banner);
    if (IS_ELEVATED) console.log('Administrator mode');
    try {
      fs.writeFileSync(path.join(DATA_DIR, 'session.token'), `${process.pid}:${TOKEN}`, 'utf8');
      fs.appendFileSync(path.join(DATA_DIR, 'server.log'), `[${new Date().toISOString()}] PID ${process.pid} Listening on http://${HOST}:${PORT}\n`);
    } catch {}
    const integrity = checkIntegrity();
    if (integrity.verified) {
      if (integrity.ok) {
        console.log('[nexa] Package integrity verified (SHA-256 self-check passed).');
      } else {
        console.warn('[nexa] WARNING: Package integrity check failed. Some core files have been modified.');
      }
    }
    getSnapshot().catch(() => {});
    getProcesses().catch(() => {});
    startBackgroundService();
    openApp();
  } catch (error) {
    try {
      fs.appendFileSync(path.join(DATA_DIR, 'server.log'), `[${new Date().toISOString()}] PID ${process.pid} Error: ${error.code} - ${error.message}\n`);
    } catch {}
    if (error.code === 'EADDRINUSE') {
      const isRestarted = process.argv.includes('--restarted');
      const health = await healthCheck();
      if (!isRestarted && !IS_ELEVATED && attempt === 0 && health) {
        console.log('Nexa is already running. Opening the existing window.');
        try {
          fs.appendFileSync(path.join(DATA_DIR, 'server.log'), `[${new Date().toISOString()}] PID ${process.pid} Nexa already running. Reusing window and exiting.\n`);
        } catch {}
        const activeToken = health.token || getStoredToken() || TOKEN;
        openApp(activeToken);
        setTimeout(() => process.exit(0), 500);
        return;
      }
      if (attempt < 40) {
        await new Promise((resolve) => setTimeout(resolve, 350));
        return listen(attempt + 1);
      }
      console.error(`Port ${PORT} is already in use. Set NOVA_PORT to a different port and try again.`);
      process.exit(1);
      return;
    }
    console.error('[nexa] Server failed to start:', error.message);
    process.exit(1);
  }
}

process.on('SIGINT', () => {
  if (isPrimaryServer) {
    try { fs.unlinkSync(path.join(DATA_DIR, 'session.token')); } catch {}
  }
  server.close(() => process.exit(0));
});

process.on('exit', (code) => {
  try {
    fs.appendFileSync(path.join(DATA_DIR, 'server.log'), `[${new Date().toISOString()}] PID ${process.pid} Exit with code ${code}\n`);
    if (isPrimaryServer) {
      fs.unlinkSync(path.join(DATA_DIR, 'session.token'));
    }
  } catch {}
});

process.on('uncaughtException', (err) => {
  try {
    fs.appendFileSync(path.join(DATA_DIR, 'server.log'), `[${new Date().toISOString()}] Uncaught Exception: ${err?.stack || err}\n`);
  } catch {}
});

process.on('unhandledRejection', (reason) => {
  try {
    fs.appendFileSync(path.join(DATA_DIR, 'server.log'), `[${new Date().toISOString()}] Unhandled Rejection: ${reason?.stack || reason}\n`);
  } catch {}
});

listen();
