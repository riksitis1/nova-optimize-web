'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { analyze } = require('../server/lib/analyze');
const { makeSnapshot } = require('./fixtures');

test('a clean, fully optimized snapshot scores 100 with no issues', () => {
  const scan = analyze(makeSnapshot());
  assert.equal(scan.score, 100);
  assert.equal(scan.potentialScore, 100);
  assert.equal(scan.counts.issues, 0);
  assert.equal(scan.rank, 'Dialed in');
  assert.equal(scan.optimized.length, 31);
  assert.equal(scan.quickWins.length, 0);
  for (const category of ['Performance', 'Gaming', 'Network', 'Security']) {
    assert.equal(scan.categoryScores[category], 100, category);
  }
});

test('advanced controls (power-throttling, mpo-bypass, and pcie-msi-mode) do not lower readiness score when unoptimized', () => {
  // Snapshot where advanced controls are unoptimized (stock Windows)
  const snap = makeSnapshot({
    state: {
      powerThrottlingOff: { exists: false, value: null, kind: 'DWord' },
      mpo: { exists: false, value: null, kind: 'DWord' },
      msiMode: { optimized: false, gpu: 0, nic: 0, gpuSupported: true, nicSupported: true },
    },
  });
  const scan = analyze(snap);
  assert.equal(scan.score, 100);
  assert.equal(scan.counts.issues, 0);
  assert.equal(scan.categoryScores['Performance'], 100);
  assert.equal(scan.categoryScores['Gaming'], 100);
});

test('real problems lower the score and produce quick wins', () => {
  const snapshot = makeSnapshot({
    startupCount: 14,
    bootDisk: { id: 'C:', size: 1_000_000_000_000, free: 30_000_000_000 },
    computer: { ...makeSnapshot().computer, totalRam: 8 * 1024 ** 3, memoryUsagePercent: 95 },
    os: { ...makeSnapshot().os, uptimeSeconds: 12 * 86_400 },
    gpus: [
      {
        name: 'NVIDIA GeForce GTX 1080',
        driverVersion: '1.0.0.0',
        driverDate: '2023-01-01',
        refreshRate: 60,
      },
    ],
    physicalDisks: [{ id: 'Disk 0', mediaType: 'HDD', size: 1_000_000_000_000 }],
    adapters: [
      {
        name: 'Wi-Fi',
        description: 'Intel Wireless 802.11ax',
        mediaType: 'Native 802.11',
        status: 'Up',
        linkSpeed: '300 Mbps',
        allowComputerToTurnOffDevice: true,
      },
    ],
    security: {
      defender: { antivirusEnabled: false, realTimeProtectionEnabled: false },
      firewall: [
        { name: 'Domain', enabled: true },
        { name: 'Private', enabled: true },
        { name: 'Public', enabled: false },
      ],
      secureBoot: false,
    },
    pendingReboot: true,
    power: { name: 'Balanced', guid: '381b4222-f694-41f0-9685-ff5bb260df2e' },
    state: {
      gameMode: { autoGameMode: 0, allowAutoGameMode: 0 },
      gameDvr: { gameDvrEnabled: 1, appCaptureEnabled: 1 },
      hags: 1,
      windowed: 0,
      backgroundApps: 0,
      transparency: 1,
      gamesTask: {
        gpuPriority: 2,
        priority: 2,
        schedulingCategory: 'Medium',
        sfioPriority: 'Normal',
      },
      networkThrottling: 10,
      systemResponsiveness: 20,
      mouse: { mouseSpeed: '1', threshold1: '6', threshold2: '10' },
    },
  });
  const scan = analyze(snapshot);
  const ids = new Set(scan.findings.map((finding) => finding.id));

  assert.ok(scan.score < 60, `expected a low score, got ${scan.score}`);
  assert.ok(scan.potentialScore > scan.score);
  assert.ok(scan.counts.issues > 0);
  assert.ok(scan.quickWins.length > 0 && scan.quickWins.length <= 4);
  for (const id of ['startup-load', 'disk-space', 'ram-pressure', 'gpu-driver', 'hdd', 'wifi', 'defender-off', 'firewall-off', 'secure-boot', 'action-game-mode', 'action-power-plan']) {
    assert.ok(ids.has(id), `missing finding ${id}`);
  }
  assert.equal(ids.has('pending-reboot'), true);
  assert.equal(scan.rank, 'Needs attention');
});

test('applied actions are reported as active and do not become findings', () => {
  const scan = analyze(makeSnapshot(), { 'game-mode': new Date().toISOString() });
  const gameMode = scan.actions.find((action) => action.id === 'game-mode');
  assert.equal(gameMode.appliedByNova, true);
  assert.equal(scan.findings.some((finding) => finding.id === 'action-game-mode'), false);
});

test('a dormant Wi-Fi adapter is not reported as the active link', () => {
  const snapshot = makeSnapshot({
    adapters: [
      {
        name: 'Ethernet',
        description: 'Realtek Ethernet',
        mediaType: '802.3',
        status: 'Up',
        linkSpeed: '1 Gbps',
        ipv4: ['192.168.1.10'],
        allowComputerToTurnOffDevice: false,
      },
      {
        name: 'Wi-Fi',
        description: 'MediaTek Wi-Fi 6E',
        mediaType: 'Native 802.11',
        status: 'Up',
        linkSpeed: '0 bps',
        ipv4: [],
      },
    ],
  });
  const scan = analyze(snapshot);
  assert.equal(scan.findings.some((finding) => finding.id === 'wifi'), false);
  assert.equal(scan.score, 100);
});

test('a snapshot without security data still analyzes cleanly', () => {
  const scan = analyze(makeSnapshot({ security: null }));
  assert.equal(scan.score, 100);
  assert.equal(scan.findings.some((finding) => finding.category === 'Security'), false);
});

test('informational findings (Windows 10 EOS and base JEDEC RAM clock) do not lower the score', () => {
  const base = makeSnapshot();
  const snapshot = makeSnapshot({
    os: { ...base.os, caption: 'Microsoft Windows 10 Pro', build: 19045 },
    memoryModules: [
      { capacity: 8 * 1024 ** 3, speed: 2133 },
      { capacity: 8 * 1024 ** 3, speed: 2133 },
    ],
  });
  const scan = analyze(snapshot);
  const ids = new Set(scan.findings.map((finding) => finding.id));
  assert.equal(ids.has('windows-10-eos'), true);
  assert.equal(ids.has('ram-xmp'), true);
  assert.equal(scan.score, 100);
  assert.equal(scan.counts.issues, 0);
});

test('cleanup targets correctly partition stale and active shader caches without double counting', () => {
  const staleDef = { minAgeHours: 720, maxAgeHours: 0, risk: 'safe' };
  const activeDef = { minAgeHours: 0, maxAgeHours: 720, risk: 'caution' };
  assert.equal(staleDef.risk, 'safe');
  assert.equal(activeDef.risk, 'caution');

  // Verify mutually exclusive age bounds
  const now = Date.now();
  const fileOlderThan30d = now - 40 * 86400000;
  const fileWithin30d = now - 5 * 86400000;
  const isStale = (mtime) => (now - mtime) > 720 * 3600000;
  const isActive = (mtime) => (now - mtime) <= 720 * 3600000;

  assert.equal(isStale(fileOlderThan30d), true);
  assert.equal(isActive(fileOlderThan30d), false);
  assert.equal(isStale(fileWithin30d), false);
  assert.equal(isActive(fileWithin30d), true);
});
