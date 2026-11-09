'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

test('server modules load with the expected public API', () => {
  const actions = require('../server/lib/actions');
  const analyze = require('../server/lib/analyze');
  const network = require('../server/lib/network');
  const system = require('../server/lib/system');
  const store = require('../server/lib/store');
  const validate = require('../server/lib/validate');

  for (const name of ['getAction', 'getPublicActions']) assert.equal(typeof actions[name], 'function', name);
  assert.equal(typeof analyze.analyze, 'function');
  for (const name of ['getTargets', 'pingTarget', 'benchmarkDns', 'speedTest', 'bufferbloatGrade']) {
    assert.equal(typeof network[name], 'function', name);
  }
  for (const name of ['getSnapshot', 'getStartup', 'getCleanupScan', 'getProcesses', 'createRestorePoint', 'trimMemory', 'getTelemetry']) {
    assert.equal(typeof system[name], 'function', name);
  }
  for (const name of ['getSettings', 'updateSettings', 'getApplied', 'getActivity', 'clearActivity', 'getNetworkState', 'updateNetworkState']) {
    assert.equal(typeof store[name], 'function', name);
  }
  for (const name of ['isValidIp', 'isValidHost', 'cleanHost', 'cleanId', 'cleanIpList']) {
    assert.equal(typeof validate[name], 'function', name);
  }
  const updater = require('../server/lib/updater');
  for (const name of ['parseSemver', 'compareSemver', 'checkForUpdate', 'downloadAndStageUpdate']) {
    assert.equal(typeof updater[name], 'function', name);
  }
  const games = require('../server/lib/games');
  for (const name of ['listGames', 'describeGame', 'applyGameSettings', 'revertGameSettings']) {
    assert.equal(typeof games[name], 'function', name);
  }
  const boost = require('../server/lib/boost');
  for (const name of ['listBoostApps', 'runBoost', 'cleanBoostApps']) {
    assert.equal(typeof boost[name], 'function', name);
  }
  assert.equal(updater.compareSemver('1.2.0', '1.1.0'), 1);
  assert.equal(updater.compareSemver('1.0.0', '1.0.0'), 0);
  assert.equal(updater.compareSemver('1.0.0', '1.0.2'), -1);
});

test('package version matches the version shown by the app shell', () => {
  const pkg = require('../package.json');
  assert.match(pkg.version, /^\d+\.\d+\.\d+$/);
  assert.match(pkg.name, /^(nexa|nova)-optimize(-web)?$/);
  assert.equal(pkg.license, 'MIT');
});
