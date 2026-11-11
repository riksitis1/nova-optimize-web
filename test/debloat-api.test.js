'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');
const { spawn } = require('node:child_process');
const { once } = require('node:events');

function mockBridge() {
  const fs = require('node:fs');
  const path = require('node:path');
  const { makeSnapshot } = require(process.env.NEXA_TEST_FIXTURES);
  const registry = new Map();
  const absent = { exists: false };
  let removed = false;
  const ps = require(path.join(process.cwd(), 'server/lib/ps'));
  ps.runPowerShell = async () => { throw new Error('Unexpected PowerShell call in test'); };
  ps.runBridge = async (op, args) => {
    fs.appendFileSync('bridge-calls.jsonl', JSON.stringify({ op, args }) + '\n');
    if (op === 'snapshot') {
      const snapshot = makeSnapshot({ admin: true, os: { edition: 'Professional', build: 22631 } });
      snapshot.state.debloat = { 'advertising-id': registry.get('DisabledByGroupPolicy') || absent };
      return snapshot;
    }
    if (op === 'optionalApps.list') return removed ? [] : ['Microsoft.BingNews_8wekyb3d8bbwe'];
    if (op === 'optionalApps.removeBatch') {
      removed = true;
      return args.families.map((family) => ({ family, status: family.startsWith('Microsoft.BingNews_') ? 'removed' : 'failed', error: 'Mock package in use' }));
    }
    if (op === 'registry.read') return args.entries.map((entry) => ({ ...entry, ...(registry.get(entry.name) || absent) }));
    if (op === 'registry.apply') return args.operations.map((entry) => {
      if (entry.name === 'EnableActivityFeed') return { ok: false, error: 'Mock access denied' };
      if (entry.op === 'delete') registry.delete(entry.name);
      else registry.set(entry.name, { exists: true, value: entry.value, kind: entry.kind });
      return { ok: true };
    });
    if (op === 'apps.close') return args.names.map((name) => ({ name, closed: 0, stillRunning: 1 }));
    throw new Error('Unexpected mock operation ' + op);
  };
}

test('debloat API validates before mutation, reports partial results, preserves first backup, and restores it', { timeout: 30_000 }, async () => {
  const source = path.resolve(__dirname, '..');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nexa-debloat-api-'));
  fs.mkdirSync(path.join(root, 'server'), { recursive: true });
  for (const dir of ['lib', 'scripts']) fs.cpSync(path.join(source, 'server', dir), path.join(root, 'server', dir), { recursive: true });
  fs.copyFileSync(path.join(source, 'server/server.js'), path.join(root, 'server/server.js'));
  fs.copyFileSync(path.join(source, 'package.json'), path.join(root, 'package.json'));
  fs.writeFileSync(path.join(root, 'mock.cjs'), '(' + mockBridge.toString() + ')();');
  const reservation = net.createServer();
  reservation.listen(0, '127.0.0.1');
  await once(reservation, 'listening');
  const port = reservation.address().port;
  await new Promise((resolve) => reservation.close(resolve));
  const child = spawn(process.execPath, ['--require', './mock.cjs', 'server/server.js', '--no-open'], {
    cwd: root, windowsHide: true, stdio: 'ignore',
    env: { ...process.env, NEXA_PORT: String(port), NEXA_TEST_FIXTURES: path.join(__dirname, 'fixtures.js') },
  });
  const base = `http://127.0.0.1:${port}`;
  let token;
  const request = async (url, body) => {
    const response = await fetch(base + url, {
      method: body ? 'POST' : 'GET', headers: { 'x-nexa-token': token || '', 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(5000),
    });
    return { status: response.status, data: await response.json() };
  };
  const calls = () => fs.existsSync(path.join(root, 'bridge-calls.jsonl'))
    ? fs.readFileSync(path.join(root, 'bridge-calls.jsonl'), 'utf8').trim().split('\n').filter(Boolean).map(JSON.parse) : [];
  const saved = () => JSON.parse(fs.readFileSync(path.join(root, 'data/state.json')));
  try {
    for (let i = 0; i < 60 && !token; i++) {
      try { token = (await request('/api/health')).data.token; } catch { await new Promise((resolve) => setTimeout(resolve, 50)); }
    }
    assert.ok(token, 'isolated server started');
    const plan = (await request('/api/debloat')).data;
    assert.deepEqual(plan.apps.map(({ id }) => id), ['Microsoft.BingNews']);
    const beforeInvalid = calls().length;
    for (const body of [
      { appIds: ['Microsoft.WindowsStore'], tweakIds: ['advertising-id'] },
      { appIds: ['Microsoft.BingNews'], tweakIds: ['paging-executive'] },
      { appIds: [], tweakIds: [] },
    ]) assert.equal((await request('/api/debloat', body)).status, 400);
    assert.equal((await request('/api/memory/trim', {})).status, 410);
    assert.equal(calls().length, beforeInvalid, 'invalid input and retired RAM endpoint perform no bridge operations');
    const response = (await request('/api/debloat', {
      appIds: ['Microsoft.BingNews', 'MSTeams'], tweakIds: ['advertising-id', 'activity-feed'],
    })).data;
    assert.equal(response.ok, false);
    assert.deepEqual(response.apps.map(({ status }) => status), ['removed', 'failed']);
    assert.deepEqual(response.tweaks.map(({ ok }) => ok), [true, false]);
    assert.ok(response.memory.after.availableBytes >= 0);
    const first = saved().backups['advertising-id'];
    assert.ok(first);
    await request('/api/debloat', { appIds: [], tweakIds: ['advertising-id'] });
    assert.deepEqual(saved().backups['advertising-id'], first);
    const undo = (await request('/api/debloat/undo', { ids: ['advertising-id'] })).data;
    assert.equal(undo.ok, true);
    assert.equal(saved().backups['advertising-id'], undefined);
    assert.ok(calls().some(({ op, args }) => op === 'registry.apply' && args.operations.some((item) => item.name === 'DisabledByGroupPolicy' && item.op === 'delete')));
    const retired = (await request('/api/actions/apply', { ids: ['paging-executive'] })).data;
    assert.equal(retired.results[0].ok, false);
    assert.match(retired.results[0].error, /undo-only/);
    const boost = (await request('/api/boost', { closeApps: ['Discord'] })).data.result;
    assert.equal(boost.closed[0].stillRunning, 1);
    assert.ok(boost.memory.before.totalBytes > 0);
    assert.equal(calls().some(({ op }) => op === 'memory.trim'), false);
  } finally {
    const exited = once(child, 'exit');
    child.kill();
    await exited;
    const target = path.resolve(root);
    assert.ok(target.startsWith(path.resolve(os.tmpdir()) + path.sep) && path.basename(target).startsWith('nexa-debloat-api-'));
    fs.rmSync(target, { recursive: true, force: true });
  }
});
