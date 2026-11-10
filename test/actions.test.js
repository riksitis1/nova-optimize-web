'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { actions, getAction, getPublicActions } = require('../server/lib/actions');
const { makeSnapshot } = require('./fixtures');
const { getGamingCandidates, isGamingAction } = require('../server/lib/gaming');

function fakePs(handler) {
  const calls = [];
  const ps = async (op, args = {}) => {
    calls.push({ op, args });
    return handler(op, args, calls);
  };
  return { ps, calls };
}

test('every action is serializable and has the expected public shape', () => {
  const publicActions = getPublicActions(makeSnapshot(), { 'game-mode': new Date().toISOString() });
  assert.equal(publicActions.length, actions.length);
  assert.equal(new Set(publicActions.map((action) => action.id)).size, actions.length);
  for (const action of publicActions) {
    assert.ok(action.id && action.name && action.description, action.id);
    assert.ok(['low', 'medium', 'high'].includes(action.impact), action.id);
    assert.ok(['safe', 'caution', 'advanced'].includes(action.risk), action.id);
    assert.equal(typeof action.applicable, 'boolean');
    assert.equal(typeof action.optimized, 'boolean');
    assert.equal(typeof action.currentValue, 'string', action.id);
    assert.ok(action.currentValue.length > 0, action.id);
  }
  assert.equal(Boolean(publicActions.find((action) => action.id === 'game-mode').appliedByNexa || publicActions.find((action) => action.id === 'game-mode').appliedByNova), true);
  assert.equal(publicActions.find((action) => action.id === 'hags').requiresAdmin, true);
});

test('getAction resolves known ids and rejects unknown ids', () => {
  assert.equal(getAction('game-mode').id, 'game-mode');
  assert.equal(getAction('nope'), null);
});

test('registry actions back up every value before writing', async () => {
  const action = getAction('game-mode');
  const { ps, calls } = fakePs((op, args) => {
    if (op === 'registry.read') {
      return args.entries.map((entry) => ({ ...entry, exists: false, kind: 'DWord', value: null }));
    }
    if (op === 'registry.apply') return args.operations.map((operation) => ({ ok: true, name: operation.name }));
    throw new Error(`unexpected op ${op}`);
  });

  const backup = await action.apply({ ps, snapshot: makeSnapshot(), admin: false });
  assert.equal(backup.kind, 'registry');
  assert.equal(backup.entries.length, 2);
  assert.equal(calls[0].op, 'registry.read');
  assert.deepEqual(calls[0].args.entries.map((entry) => entry.name), ['AutoGameModeEnabled', 'AllowAutoGameMode']);
  assert.equal(calls[1].op, 'registry.apply');
  assert.equal(calls[1].args.operations.length, 2);
  assert.equal(calls[1].args.operations[0].value, 1);
});

test('registry revert restores existing values and deletes values that did not exist', async () => {
  const action = getAction('game-mode');
  let operations = null;
  const { ps } = fakePs((op, args) => {
    if (op !== 'registry.apply') throw new Error(`unexpected op ${op}`);
    operations = args.operations;
    return args.operations.map(() => ({ ok: true }));
  });

  await action.revert(
    { ps, snapshot: makeSnapshot() },
    {
      kind: 'registry',
      entries: [
        { hive: 'HKCU', path: 'Software\\Test', name: 'Existing', exists: true, kind: 'DWord', value: 0 },
        { hive: 'HKCU', path: 'Software\\Test', name: 'Missing', exists: false },
      ],
    },
  );

  assert.equal(operations.length, 2);
  assert.equal(operations[0].op, 'set');
  assert.equal(operations[0].value, 0);
  assert.equal(operations[0].kind, 'DWord');
  assert.equal(operations[1].op, 'delete');
  assert.equal(operations[1].name, 'Missing');
});

test('registry apply surfaces bridge failures', async () => {
  const action = getAction('game-mode');
  const { ps } = fakePs((op, args) => {
    if (op === 'registry.read') return args.entries.map((entry) => ({ ...entry, exists: false }));
    if (op === 'registry.apply') return [{ ok: false, name: 'AutoGameModeEnabled', error: 'Access denied' }];
    throw new Error(`unexpected op ${op}`);
  });
  await assert.rejects(
    action.apply({ ps, snapshot: makeSnapshot(), admin: false }),
    /AutoGameModeEnabled: Access denied/,
  );
});

test('a partial registry write rolls back the values that changed', async () => {
  const action = getAction('game-mode');
  const entry = { ...action.writes[0], exists: true, value: 0 };
  const calls = [];
  const ps = async (op, args) => {
    calls.push({ op, args });
    if (op === 'registry.read') return [entry, { ...action.writes[1], exists: false }];
    if (calls.length === 2) return [{ ok: true }, { ok: false, error: 'Denied' }];
    return [{ ok: true }];
  };

  await assert.rejects(action.apply({ ps }), /Denied/);
  assert.deepEqual(calls[2].args.operations, [{
    op: 'set', hive: entry.hive, path: entry.path, name: entry.name, kind: entry.kind, value: 0,
  }]);
});

test('the Nagle action writes both TCP values for every adapter', async () => {
  const action = getAction('nagle');
  const snapshot = makeSnapshot({
    nagle: [
      { guid: 'aaaaaaaa-1111-2222-3333-444444444444', name: 'Ethernet' },
      { guid: 'bbbbbbbb-1111-2222-3333-444444444444', name: 'Wi-Fi' },
    ],
  });
  let operations = null;
  const { ps } = fakePs((op, args) => {
    if (op === 'registry.read') return args.entries.map((entry) => ({ ...entry, exists: false }));
    if (op === 'registry.apply') {
      operations = args.operations;
      return args.operations.map(() => ({ ok: true }));
    }
    throw new Error(`unexpected op ${op}`);
  });

  const backup = await action.apply({ ps, snapshot, admin: true });
  assert.equal(backup.entries.length, 4);
  assert.equal(operations.length, 4);
  assert.ok(operations[0].path.includes('aaaaaaaa-1111-2222-3333-444444444444'));
  assert.deepEqual(operations.map((operation) => operation.name), [
    'TcpAckFrequency',
    'TCPNoDelay',
    'TcpAckFrequency',
    'TCPNoDelay',
  ]);
});

test('power plan apply remembers the original plan and revert restores it', async () => {
  const action = getAction('power-plan');
  const { ps, calls } = fakePs((op) => {
    if (op === 'power.activateNexa' || op === 'power.activateNova') {
      return {
        original: { guid: '381b4222-f694-41f0-9685-ff5bb260df2e', name: 'Balanced' },
        novaGuid: '99999999-9999-9999-9999-999999999999',
        created: true,
      };
    }
    if (op === 'power.setActive') return { guid: '381b4222-f694-41f0-9685-ff5bb260df2e', name: 'Balanced' };
    throw new Error(`unexpected op ${op}`);
  });

  const backup = await action.apply({ ps, snapshot: makeSnapshot(), admin: true });
  assert.equal(backup.kind, 'power');
  assert.equal(backup.originalGuid, '381b4222-f694-41f0-9685-ff5bb260df2e');
  assert.equal(backup.novaGuid, '99999999-9999-9999-9999-999999999999');

  await action.revert({ ps, snapshot: makeSnapshot() }, backup);
  const last = calls[calls.length - 1];
  assert.equal(last.op, 'power.setActive');
  assert.equal(last.args.guid, backup.originalGuid);
  assert.equal(last.args.deleteGuid, backup.novaGuid);
});

test('adapter power revert surfaces failure when no adapter could be restored', async () => {
  const action = getAction('adapter-power');
  const { ps } = fakePs((op) => {
    if (op === 'net.adapterPowerRestore') {
      return [{ name: 'Ethernet', ok: false, error: 'Driver denied request' }];
    }
    throw new Error(`unexpected op ${op}`);
  });
  await assert.rejects(
    action.revert({ ps, snapshot: makeSnapshot() }, { adapters: [{ name: 'Ethernet' }] }),
    /Ethernet: Driver denied request/,
  );
});

test('tcp-autotuning action backs up previous TCP global state and restores it on revert', async () => {
  const action = getAction('tcp-autotuning');
  assert.ok(action);
  const { ps, calls } = fakePs((op) => {
    if (op === 'net.tcpAutotune') {
      return {
        before: { autoTuning: 'Restricted', scalingHeuristics: 'Enabled', rss: 'Enabled' },
        after: { autoTuning: 'Normal', scalingHeuristics: 'Disabled', rss: 'Enabled' },
      };
    }
    throw new Error(`unexpected op ${op}`);
  });

  const backup = await action.apply({ ps, snapshot: makeSnapshot(), admin: true });
  assert.equal(backup.kind, 'tcp-autotune');
  assert.equal(backup.before.autoTuning, 'Restricted');
  assert.equal(calls[0].args.autoTuning, 'normal');
  assert.equal(calls[0].args.scalingHeuristics, 'disabled');
  assert.equal(calls[0].args.rss, 'enabled');

  await action.revert({ ps, snapshot: makeSnapshot() }, backup);
  assert.equal(calls[1].args.autoTuning, 'restricted');
  assert.equal(calls[1].args.scalingHeuristics, 'enabled');
});

test('adapter power actions only target adapters that are up', async () => {
  const action = getAction('adapter-power');
  const snapshot = makeSnapshot({
    adapters: [
      { name: 'Ethernet', status: 'Up', linkSpeed: '1 Gbps' },
      { name: 'Wi-Fi', status: 'Up', linkSpeed: '300 Mbps' },
      { name: 'Bluetooth', status: 'Disconnected' },
    ],
  });
  const { ps, calls } = fakePs((op) => {
    if (op === 'net.adapterPowerDisable') {
      return { adapters: [{ name: 'Ethernet', changed: true }, { name: 'Wi-Fi', changed: true }] };
    }
    if (op === 'net.adapterPowerRestore') return [{ name: 'Ethernet', ok: true }];
    throw new Error(`unexpected op ${op}`);
  });

  const backup = await action.apply({ ps, snapshot, admin: true });
  assert.deepEqual(calls[0].args.names, ['Ethernet', 'Wi-Fi']);
  assert.equal(backup.adapters.length, 2);

  await action.revert({ ps, snapshot }, backup);
  assert.deepEqual(calls[calls.length - 1].args.names, ['Ethernet', 'Wi-Fi']);
});

test('fast-udp and DSCP QoS configure expected registry entries', async () => {
  const udpAction = getAction('fast-udp');
  assert.ok(udpAction, 'fast-udp should exist');
  assert.equal(udpAction.category, 'Network');
  assert.equal(udpAction.impact, 'high');
  assert.equal(udpAction.risk, 'advanced');
  assert.deepEqual(
    udpAction.writes.map((w) => w.name),
    ['FastSendDatagramThreshold', 'DoNotUseFastDatagram'],
  );

  const qosAction = getAction('dscp-qos');
  assert.ok(qosAction, 'dscp-qos should exist');
  assert.equal(qosAction.category, 'Network');
  assert.equal(qosAction.writes[0].name, 'DisableUserTOSSetting');
  assert.equal(qosAction.writes[0].value, 0);
});

test('delivery-optimization writes the documented HKLM policy value', async () => {
  const action = getAction('delivery-optimization');
  assert.ok(action, 'delivery-optimization should exist');
  assert.equal(action.requiresAdmin, true);

  let operations = null;
  const { ps } = fakePs((op, args) => {
    if (op === 'registry.read') return args.entries.map((entry) => ({ ...entry, exists: false }));
    if (op === 'registry.apply') {
      operations = args.operations;
      return args.operations.map(() => ({ ok: true }));
    }
    throw new Error(`unexpected op ${op}`);
  });

  await action.apply({ ps, snapshot: makeSnapshot(), admin: true });
  assert.equal(operations.length, 1);
  assert.equal(operations[0].hive, 'HKLM');
  assert.equal(operations[0].path, 'SOFTWARE\\Policies\\Microsoft\\Windows\\DeliveryOptimization');
  assert.equal(operations[0].name, 'DODownloadMode');
  assert.equal(operations[0].value, 0);
});

test('windowed-optimizations parses and preserves existing DirectXUserGlobalSettings tokens', async () => {
  const action = getAction('windowed-optimizations');
  assert.ok(action, 'windowed-optimizations should exist');

  let appliedOps = null;
  const { ps } = fakePs((op, args) => {
    if (op === 'registry.read') {
      return [
        {
          hive: 'HKCU',
          path: 'Software\\Microsoft\\DirectX\\UserGpuPreferences',
          name: 'DirectXUserGlobalSettings',
          exists: true,
          kind: 'String',
          value: 'VRROptimizeEnable=1;AutoHDR=1;',
        },
        {
          hive: 'HKCU',
          path: 'Software\\Microsoft\\DirectX\\GraphicsSettings',
          name: 'SwapEffectUpgradeEnable',
          exists: false,
        },
      ];
    }
    if (op === 'registry.apply') {
      appliedOps = args.operations;
      return args.operations.map(() => ({ ok: true }));
    }
    throw new Error(`unexpected op ${op}`);
  });

  const backup = await action.apply({ ps, snapshot: makeSnapshot(), admin: false });
  assert.equal(backup.kind, 'registry');
  assert.equal(appliedOps.length, 2);

  // Verify DirectXUserGlobalSettings preserved existing tokens and added SwapEffectUpgradeEnable=1;
  const globalOp = appliedOps.find((o) => o.name === 'DirectXUserGlobalSettings');
  assert.ok(globalOp);
  assert.match(globalOp.value, /VRROptimizeEnable=1/);
  assert.match(globalOp.value, /AutoHDR=1/);
  assert.match(globalOp.value, /SwapEffectUpgradeEnable=1/);

  // Now verify revert restores the exact prior string
  let revertOps = null;
  const revertPs = fakePs((op, args) => {
    if (op === 'registry.apply') {
      revertOps = args.operations;
      return args.operations.map(() => ({ ok: true }));
    }
    throw new Error(`unexpected op ${op}`);
  }).ps;

  await action.revert({ ps: revertPs, snapshot: makeSnapshot() }, backup);
  assert.equal(revertOps.length, 2);
  const revertedGlobal = revertOps.find((o) => o.name === 'DirectXUserGlobalSettings');
  assert.equal(revertedGlobal.op, 'set');
  assert.equal(revertedGlobal.value, 'VRROptimizeEnable=1;AutoHDR=1;');

  const revertedLegacy = revertOps.find((o) => o.name === 'SwapEffectUpgradeEnable');
  assert.equal(revertedLegacy.op, 'delete');
});

test('mpo-bypass deletes OverlayTestMode registry property on revert when missing prior', async () => {
  const action = getAction('mpo-bypass');
  assert.ok(action, 'mpo-bypass action should exist');

  let revertOps = null;
  const { ps } = fakePs((op, args) => {
    if (op === 'registry.apply') {
      revertOps = args.operations;
      return args.operations.map(() => ({ ok: true }));
    }
    throw new Error(`unexpected op ${op}`);
  });

  // Reverting with backup where OverlayTestMode did not exist originally
  await action.revert(
    { ps, snapshot: makeSnapshot() },
    {
      kind: 'registry',
      entries: [
        {
          hive: 'HKLM',
          path: 'SOFTWARE\\Microsoft\\Windows\\Dwm',
          name: 'OverlayTestMode',
          exists: false,
        },
      ],
    },
  );

  assert.equal(revertOps.length, 1);
  assert.equal(revertOps[0].op, 'delete');
  assert.equal(revertOps[0].name, 'OverlayTestMode');
});

test('removed tweaks remain resolvable as hidden undo-only legacy actions', () => {
  const legacyIds = [
    'game-process-priority',
    'gpu-priority',
    'usb-polling',
    'tdr-delay',
    'nic-low-jitter',
    'audio-priority',
    'pcie-msi-mode',
  ];
  for (const id of legacyIds) {
    assert.equal(actions.some((action) => action.id === id), false, `${id} must not be in the public set`);
    const action = getAction(id);
    assert.ok(action, `${id} should remain resolvable for undo`);
    assert.equal(action.legacy, true, `${id} should be marked legacy`);
  }

  const action = getAction('game-process-priority');
  const exes = [
    'cs2.exe',
    'FortniteClient-Win64-Shipping.exe',
    'RobloxPlayerBeta.exe',
    'javaw.exe',
    'VALORANT-Win64-Shipping.exe',
    'r5apex.exe',
    'cod.exe',
  ];
  for (const exe of exes) {
    const cpuWrite = action.writes.find(
      (w) => w.path.includes(exe) && w.name === 'CpuPriorityClass',
    );
    const ioWrite = action.writes.find(
      (w) => w.path.includes(exe) && w.name === 'IoPriority',
    );
    assert.ok(cpuWrite, `missing CpuPriorityClass write for ${exe}`);
    assert.equal(cpuWrite.value, 3);
    assert.ok(ioWrite, `missing IoPriority write for ${exe}`);
    assert.equal(ioWrite.value, 3);
  }
});

test('the active action set is 26 actions with only Game Mode eligible for bulk apply', () => {
  assert.equal(actions.length, 26);
  const counts = actions.reduce((acc, action) => {
    acc[action.risk] = (acc[action.risk] || 0) + 1;
    return acc;
  }, {});
  assert.deepEqual(counts, { safe: 1, caution: 15, advanced: 10 });
  assert.deepEqual(actions.filter((action) => action.risk === 'safe').map((action) => action.id), ['game-mode']);
  const laptop = makeSnapshot({ computer: { isLaptop: true } });
  assert.equal(getPublicActions(laptop).find((action) => action.id === 'power-plan').applicable, false);
});

test('background capture is reversible without writing the manual capture settings', async () => {
  const action = getAction('capture-history');
  assert.equal(action.appliesTo(makeSnapshot()), false);
  const snapshot = makeSnapshot();
  snapshot.state.gameDvr.history = { exists: true, value: 1, kind: 'DWord' };
  assert.equal(action.appliesTo(snapshot), true);
  const { ps, calls } = fakePs((op, args) => {
    if (op === 'registry.read') return args.entries.map((entry) => ({ ...entry, ...snapshot.state.gameDvr.history }));
    return [{ ok: true }];
  });
  const backup = await action.apply({ ps });
  await action.revert({ ps }, backup);
  assert.deepEqual(calls.slice(1).map(({ args }) => args.operations.map(({ name, value }) => [name, value])), [
    [['HistoricalCaptureEnabled', 0]],
    [['HistoricalCaptureEnabled', 1]],
  ]);
});

test('the desktop High performance plan is excluded on dual-CCD Ryzen X3D models', () => {
  const action = getAction('power-plan');
  for (const model of ['7900X3D', '7950X3D', '9900X3D', '9950X3D']) {
    assert.equal(action.appliesTo(makeSnapshot({ cpu: { name: 'AMD Ryzen ' + model } })), false);
  }
  assert.equal(action.appliesTo(makeSnapshot({ cpu: { name: 'AMD Ryzen 7 7800X3D' } })), true);
});

test('Optimize PC previews the recommended settings and keeps situational changes opt-in', () => {
  const snapshot = makeSnapshot();
  const flag = (value) => ({ exists: true, value, kind: 'DWord' });
  snapshot.state.gameMode = { autoGameMode: flag(0), allowAutoGameMode: flag(0) };
  snapshot.state.gameDvr.history = flag(1);
  snapshot.state.windowed = flag(0);
  snapshot.state.deliveryOptimization = flag(1);
  snapshot.power = { name: 'Balanced', guid: '381b4222-f694-41f0-9685-ff5bb260df2e' };
  const diagnostics = { powerLine: 'Online', highPerformanceAvailable: true };

  const profile = getGamingCandidates(snapshot, {}, diagnostics);
  assert.deepEqual(profile.filter((action) => action.recommended).map((action) => action.id), [
    'game-mode', 'windowed-optimizations',
  ]);
  assert.deepEqual(profile.filter((action) => !action.recommended).map((action) => action.id), [
    'capture-history', 'power-plan', 'delivery-optimization',
  ]);
  assert.equal(profile.find((action) => action.id === 'power-plan').requiresAdmin, true);
  assert.equal(isGamingAction('hags'), false);

  snapshot.os.build = 19045;
  const reduced = getGamingCandidates(snapshot, { 'game-mode': 'already applied' }, {
    ...diagnostics, powerLine: 'Offline',
  });
  assert.deepEqual(reduced.map((action) => action.id), ['capture-history', 'delivery-optimization']);
});

test('applied legacy actions appear in the public list only when they have a backup', () => {
  const without = getPublicActions(makeSnapshot(), {});
  assert.equal(without.length, 26);
  assert.equal(without.some((action) => action.legacy), false);

  const withLegacy = getPublicActions(makeSnapshot(), {
    'game-process-priority': new Date().toISOString(),
  });
  assert.equal(withLegacy.length, 27);
  const legacy = withLegacy.find((action) => action.id === 'game-process-priority');
  assert.ok(legacy);
  assert.equal(legacy.legacy, true);
  assert.equal(legacy.appliedByNexa, true);
});

test('dscp-qos configures DSCP 46 expedited forwarding policies for competitive games and removes reserved bandwidth', () => {
  const action = getAction('dscp-qos');
  assert.ok(action, 'dscp-qos action should exist');
  assert.equal(action.category, 'Network');

  const psched = action.writes.find((w) => w.name === 'NonBestEffortLimit');
  assert.ok(psched, 'missing NonBestEffortLimit write');
  assert.equal(psched.value, 0);

  const qosPolicies = ['NexaQoS_CS2', 'NexaQoS_Fortnite', 'NexaQoS_Roblox', 'NexaQoS_Minecraft', 'NexaQoS_Valorant', 'NexaQoS_Apex'];
  for (const policy of qosPolicies) {
    const dscp = action.writes.find((w) => w.path.includes(policy) && w.name === 'DSCP Value');
    const throttle = action.writes.find((w) => w.path.includes(policy) && w.name === 'Throttle Rate');
    assert.ok(dscp, `missing DSCP Value for ${policy}`);
    assert.equal(dscp.value, '46');
    assert.ok(throttle, `missing Throttle Rate for ${policy}`);
    assert.equal(throttle.value, '-1');
  }
});

test('legacy nic-low-jitter still restores its recorded adapter backup', async () => {
  const action = getAction('nic-low-jitter');
  assert.ok(action, 'nic-low-jitter should exist for undo');
  assert.equal(action.legacy, true);
  assert.equal(action.category, 'Network');
  assert.equal(action.risk, 'safe');
  assert.equal(action.requiresReboot, true);

  let disableCalled = false;
  let restoreBackup = null;

  const { ps } = fakePs((op, args) => {
    if (op === 'net.nicDejitterDisable') {
      disableCalled = true;
      return {
        adapters: [
          {
            name: 'Ethernet',
            driverPath: 'SYSTEM\\CurrentControlSet\\Control\\Class\\{4d36e972-e325-11ce-bfc1-08002be10318}\\0001',
            previous: [{ name: '*EEE', exists: false }],
          },
        ],
      };
    }
    if (op === 'net.nicDejitterRestore') {
      restoreBackup = args.backup;
      return { ok: true };
    }
    throw new Error(`unexpected op ${op}`);
  });

  const backup = await action.apply({ ps, snapshot: makeSnapshot(), admin: true });
  assert.equal(disableCalled, true);
  assert.equal(backup.kind, 'nic-low-jitter');
  assert.ok(backup.backup);

  await action.revert({ ps, snapshot: makeSnapshot() }, backup);
  assert.ok(restoreBackup);
  assert.equal(restoreBackup.adapters[0].name, 'Ethernet');
});

test('legacy pcie-msi-mode still restores its recorded device backup', async () => {
  const action = getAction('pcie-msi-mode');
  assert.ok(action, 'pcie-msi-mode should exist for undo');
  assert.equal(action.legacy, true);
  assert.equal(action.risk, 'advanced');
  assert.equal(action.requiresReboot, true);

  let enableCalled = false;
  let restoreBackup = null;

  const { ps } = fakePs((op, args) => {
    if (op === 'pcie.msiEnable') {
      enableCalled = true;
      return {
        devices: [
          {
            device: 'gpu',
            name: 'NVIDIA GeForce RTX 4070',
            pnp: 'PCI\\VEN_10DE&DEV_2786',
            path: 'SYSTEM\\CurrentControlSet\\Enum\\...\\MessageSignaledInterruptProperties',
            previous: { exists: true, value: 0 },
          },
        ],
      };
    }
    if (op === 'pcie.msiRestore') {
      restoreBackup = args.backup;
      return { ok: true };
    }
    throw new Error(`unexpected op ${op}`);
  });

  const backup = await action.apply({ ps, snapshot: makeSnapshot(), admin: true });
  assert.equal(enableCalled, true);
  assert.equal(backup.kind, 'pcie-msi');

  await action.revert({ ps, snapshot: makeSnapshot() }, backup);
  assert.ok(restoreBackup);
  assert.equal(restoreBackup.devices[0].device, 'gpu');
});
