'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { getAction, getPublicActions, serializeAction } = require('../server/lib/actions');
const { getDebloatPlan } = require('../server/lib/debloat');
const { makeSnapshot } = require('./fixtures');

function snapshot(edition, build = 22631) {
  return makeSnapshot({ os: { edition, build }, state: { debloat: {} } });
}

test('debloat policies honor edition and build, and presets never select app removal or background restrictions', () => {
  const home = getDebloatPlan(snapshot('Core'));
  assert.equal(home.tweaks.some((item) => item.id === 'advertising-id'), false);
  assert.equal(home.tweaks.some((item) => item.id === 'store-background-policy'), false);
  const pro = getDebloatPlan(snapshot('Professional'));
  assert.ok(pro.tweaks.some((item) => item.id === 'store-background-policy'));
  assert.equal(pro.tweaks.some((item) => item.id === 'consumer-suggestions'), false);
  assert.ok(getDebloatPlan(snapshot('Enterprise')).tweaks.some((item) => item.id === 'consumer-suggestions'));
  assert.equal(getDebloatPlan(snapshot('Professional', 19045)).tweaks.some((item) => item.id === 'windows-widgets'), false);
  for (const preset of pro.presets) {
    assert.ok(preset.ids.every((id) => pro.tweaks.some((item) => item.id === id && item.applicable)));
    assert.ok(!preset.ids.includes('store-background-policy'));
  }
});

test('applied debloat policies remain undoable after an edition change and backups do not prove current state', () => {
  const applied = { 'consumer-suggestions': { at: 'test' } };
  const plan = getDebloatPlan(snapshot('Core'), applied);
  const entry = plan.tweaks.find((item) => item.id === 'consumer-suggestions');
  assert.equal(entry.applicable, false);
  assert.equal(entry.appliedByNexa, true);
  assert.equal(entry.optimized, false);
  assert.ok(getPublicActions(snapshot('Core'), applied).some((item) => item.id === entry.id));
  const actual = serializeAction(getAction('advertising-id'), snapshot('Professional'), { 'advertising-id': true });
  assert.equal(actual.optimized, false);
});

test('every debloat policy restores the exact original value or removes a newly created value', async () => {
  const policies = getDebloatPlan(snapshot('Enterprise')).tweaks.filter((item) => getAction(item.id).writes?.length === 1);
  for (const { id } of policies) {
    const action = getAction(id);
    for (const exists of [true, false]) {
      let saved;
      let writes;
      const ps = async (op, args) => {
        if (op === 'registry.read') return args.entries.map((entry) => (saved = { ...entry, exists, kind: 'DWord', value: 7 }));
        writes = args.operations;
        return writes.map(() => ({ ok: true }));
      };
      const backup = await action.apply({ ps });
      await action.revert({ ps }, backup);
      assert.equal(writes[0].op, exists ? 'set' : 'delete', id);
      if (exists) assert.equal(writes[0].value, saved.value, id);
    }
  }
});

test('incomplete backup prevents writes, incomplete restoration preserves failure', async () => {
  const action = getAction('game-mode');
  const calls = [];
  await assert.rejects(action.apply({ ps: async (op) => { calls.push(op); return []; } }), /complete registry backup/);
  assert.deepEqual(calls, ['registry.read']);
  await assert.rejects(action.revert({ ps: async () => [] }, {
    entries: [{ hive: 'HKCU', path: 'test', name: 'value', exists: false }],
  }), /Backup retained/);
  await assert.rejects(getAction('adapter-power').revert({ ps: async () => [{ ok: true }, { ok: false }] }, {
    adapters: [{ name: 'Ethernet' }, { name: 'Wi-Fi' }],
  }), /Backup retained/);
});

test('retired global overrides are hidden but still resolve for undo', () => {
  const ids = ['system-responsiveness', 'paging-executive', 'fast-udp', 'dscp-qos',
    'win32-priority', 'power-throttling', 'fullscreen-optimizations', 'background-apps'];
  const normal = getPublicActions(snapshot('Professional'));
  for (const id of ids) {
    assert.equal(getAction(id).legacy, true);
    assert.ok(!normal.some((item) => item.id === id));
    const applied = getPublicActions(snapshot('Professional'), { [id]: true }).find((item) => item.id === id);
    assert.ok(applied.appliedByNexa && applied.legacy);
  }
});
