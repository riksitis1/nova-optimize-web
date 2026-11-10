'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const games = require('../server/lib/games');
const { cleanId } = require('../server/lib/validate');
const { cleanBoostApps } = require('../server/lib/boost');

function tmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'nova-games-'));
}

function memoryStore() {
  const data = {};
  return {
    get: (id) => (data[id] ? JSON.parse(JSON.stringify(data[id])) : null),
    set: (id, value) => {
      data[id] = JSON.parse(JSON.stringify(value));
    },
    clear: (id) => {
      delete data[id];
    },
    raw: data,
  };
}

function makeEnv(root, overrides = {}) {
  return {
    localAppData: path.join(root, 'Local'),
    appData: path.join(root, 'Roaming'),
    dataDir: path.join(root, 'data'),
    getSteamPath: async () => path.join(root, 'Steam'),
    findRunning: async () => [],
    store: memoryStore(),
    ...overrides,
  };
}

test('game catalog ids are unique, valid and well formed', () => {
  const settingIds = new Set();
  assert.ok(games.GAMES.length >= 3);
  for (const game of games.GAMES) {
    assert.doesNotThrow(() => cleanId(game.id), game.id);
    assert.ok(game.processes.length > 0, game.id);
    for (const setting of game.settings) {
      assert.doesNotThrow(() => cleanId(setting.id), setting.id);
      assert.equal(settingIds.has(setting.id), false, `duplicate ${setting.id}`);
      settingIds.add(setting.id);
      assert.ok(Object.keys(game.files).includes(setting.file), setting.id);
      assert.ok(['low', 'medium', 'high'].includes(setting.impact), setting.id);
      assert.ok(setting.pairs.length > 0, setting.id);
      for (const pair of setting.pairs) {
        assert.equal(typeof pair.key, 'string');
        assert.equal(typeof pair.value, 'string');
      }
    }
  }
  assert.ok(games.getGameDef('fortnite'));
  assert.ok(games.getGameDef('cs2'));
  assert.ok(games.getGameDef('minecraft'));
  assert.equal(games.getGameDef('nope'), null);
});

test('sameValue compares numbers numerically and text case-insensitively', () => {
  assert.equal(games.sameValue('0', '0.000000'), true);
  assert.equal(games.sameValue('"false"', 'False'), true);
  assert.equal(games.sameValue('3', '2'), false);
  assert.equal(games.sameValue(null, '0'), false);
});

test('patchIni edits, inserts, creates sections, removes keys and keeps line endings', () => {
  const text = '[ScalabilityGroups]\r\nsg.ShadowQuality=3\r\nsg.TextureQuality=2\r\n\r\n[Other]\r\nKeep=1\r\n';
  const out = games.patchIni(text, [
    { section: 'ScalabilityGroups', key: 'sg.ShadowQuality', value: '0' },
    { section: 'ScalabilityGroups', key: 'sg.EffectsQuality', value: '0' },
    { section: 'New.Section', key: 'bUseVSync', value: 'False' },
  ]);
  assert.match(out.text, /sg\.ShadowQuality=0\r\n/);
  assert.match(out.text, /sg\.EffectsQuality=0\r\n\r\n\[Other\]/);
  assert.match(out.text, /\[New\.Section\]\r\nbUseVSync=False/);
  assert.match(out.text, /Keep=1/);
  assert.equal(out.text.includes('\r\n'), true);
  assert.equal(out.text.replace(/\r\n/g, '').includes('\n'), false);
  assert.deepEqual(out.prior.map((p) => [p.key, p.existed, p.raw]), [
    ['sg.ShadowQuality', true, '3'],
    ['sg.EffectsQuality', false, null],
    ['bUseVSync', false, null],
  ]);

  const removed = games.patchIni(out.text, [{ section: 'ScalabilityGroups', key: 'sg.EffectsQuality', value: null }]);
  assert.equal(removed.text.includes('sg.EffectsQuality'), false);
  assert.equal(games.readIni(out.text, { section: 'scalabilitygroups', key: 'SG.SHADOWQUALITY' }), '0');
});

test('patchKv rewrites values and inserts missing keys before the closing brace', () => {
  const text = '"video.cfg"\n{\n\t"Version"\t\t"15"\n\t"setting.mat_vsync"\t\t"1"\n}\n';
  const out = games.patchKv(text, [
    { key: 'setting.mat_vsync', value: '0' },
    { key: 'setting.r_low_latency', value: '1' },
  ]);
  assert.equal(games.readKv(out.text, { key: 'setting.mat_vsync' }), '0');
  assert.equal(games.readKv(out.text, { key: 'setting.r_low_latency' }), '1');
  assert.match(out.text, /"setting\.r_low_latency"\t\t"1"\n}/);
  assert.throws(() => games.patchKv('no braces here', [{ key: 'a', value: '1' }]), /unexpected format/);
});

test('patchOptions handles old/new boolean styles, quotes and onlyIfPresent', () => {
  const text = 'renderDistance:12\nao:2\nrenderClouds:"true"\nkey_key.jump:key.keyboard.space\n';
  const out = games.patchOptions(text, [
    { key: 'renderDistance', value: '8' },
    { key: 'ao', value: 'false', boolish: true },
    { key: 'renderClouds', value: 'false' },
    { key: 'simulationDistance', value: '6', onlyIfPresent: true },
    { key: 'maxFps', value: '260' },
  ]);
  assert.match(out.text, /renderDistance:8\n/);
  assert.match(out.text, /ao:0\n/);
  assert.match(out.text, /renderClouds:"false"\n/);
  assert.equal(out.text.includes('simulationDistance'), false);
  assert.match(out.text, /maxFps:260\n$/);
  assert.match(out.text, /key_key\.jump:key\.keyboard\.space/);
  assert.equal(out.prior.some((p) => p.key === 'simulationDistance'), false);
});

test('minecraft: apply backs up, changes only chosen settings, and restore keeps later edits', async () => {
  const root = tmpDir();
  const env = makeEnv(root);
  const dir = path.join(env.appData, '.minecraft');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, 'options.txt');
  fs.writeFileSync(file, 'renderDistance:16\nsimulationDistance:12\nenableVsync:true\nparticles:0\nkey_key.jump:key.keyboard.space\n');
  const service = games.createGameService(env);

  let listed = (await service.list()).find((g) => g.id === 'minecraft');
  assert.equal(listed.installed, true);
  assert.equal(listed.settings.find((s) => s.id === 'mc-render').current, '16');
  assert.equal(listed.settings.find((s) => s.id === 'mc-render').optimized, false);

  const result = await service.apply('minecraft', ['mc-render', 'mc-vsync']);
  assert.deepEqual(result.applied, ['mc-render', 'mc-vsync']);
  const after = fs.readFileSync(file, 'utf8');
  assert.match(after, /renderDistance:8/);
  assert.match(after, /enableVsync:false/);
  assert.match(after, /simulationDistance:12/);
  assert.match(after, /particles:0/);

  const state = env.store.get('minecraft');
  const backupPath = state.files[file].backupPath;
  assert.ok(fs.existsSync(backupPath));
  assert.match(fs.readFileSync(backupPath, 'utf8'), /renderDistance:16/);

  listed = (await service.list()).find((g) => g.id === 'minecraft');
  assert.equal(listed.settings.find((s) => s.id === 'mc-render').optimized, true);
  assert.equal(listed.applied.settingIds.length, 2);

  // The user changes something else in-game afterwards.
  fs.appendFileSync(file, 'key_key.sprint:key.keyboard.left.control\n');
  await service.apply('minecraft', ['mc-render']);

  // Restore a single setting first ('mc-vsync') while keeping 'mc-render' applied
  await service.revert('minecraft', ['mc-vsync']);
  const partialRestored = fs.readFileSync(file, 'utf8');
  assert.match(partialRestored, /enableVsync:true/);
  assert.match(partialRestored, /renderDistance:8/);
  assert.deepEqual(env.store.get('minecraft').settingIds, ['mc-render']);

  // Restore the remaining settings
  const reverted = await service.revert('minecraft');
  assert.equal(reverted.restored.length, 1);
  const restored = fs.readFileSync(file, 'utf8');
  assert.match(restored, /renderDistance:16/);
  assert.match(restored, /enableVsync:true/);
  assert.match(restored, /key_key\.sprint:key\.keyboard\.left\.control/);
  assert.equal(env.store.get('minecraft'), null);
  await assert.rejects(service.revert('minecraft'), /nothing to restore/);
});

test('apply refuses while the game is running and when the config does not exist', async () => {
  const root = tmpDir();
  const running = makeEnv(root, { findRunning: async (names) => names.slice(0, 1) });
  const dir = path.join(running.appData, '.minecraft');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'options.txt'), 'renderDistance:12\n');
  await assert.rejects(games.createGameService(running).apply('minecraft', ['mc-render']), /Close Minecraft/);
  assert.match(fs.readFileSync(path.join(dir, 'options.txt'), 'utf8'), /renderDistance:12/);

  const empty = makeEnv(tmpDir());
  await assert.rejects(games.createGameService(empty).apply('fortnite', ['fn-shadows']), /Launch the game once/);
  await assert.rejects(games.createGameService(empty).apply('fortnite', []), /at least one/);
  await assert.rejects(games.createGameService(empty).apply('nope', ['x']), /Unknown game/);
});

test('fortnite: UTF-16 config round-trips and restore removes inserted keys', async () => {
  const root = tmpDir();
  const env = makeEnv(root);
  const dir = path.join(env.localAppData, 'FortniteGame', 'Saved', 'Config', 'WindowsClient');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, 'GameUserSettings.ini');
  const original = '[ScalabilityGroups]\r\nsg.ShadowQuality=3\r\n';
  fs.writeFileSync(file, Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(original, 'utf16le')]));
  const service = games.createGameService(env);

  await service.apply('fortnite', ['fn-shadows', 'fn-vsync']);
  const buffer = fs.readFileSync(file);
  assert.equal(buffer[0], 0xff);
  assert.equal(buffer[1], 0xfe);
  const text = buffer.slice(2).toString('utf16le');
  assert.match(text, /sg\.ShadowQuality=0/);
  assert.match(text, /\[\/Script\/FortniteGame\.FortGameUserSettings\]\r\nbUseVSync=False/);

  await service.revert('fortnite');
  const back = fs.readFileSync(file).slice(2).toString('utf16le');
  assert.match(back, /sg\.ShadowQuality=3/);
  assert.equal(back.includes('bUseVSync'), false);
});

test('cs2: finds every Steam account video config', async () => {
  const root = tmpDir();
  const env = makeEnv(root);
  for (const id of ['1111', '2222']) {
    const dir = path.join(root, 'Steam', 'userdata', id, '730', 'local', 'cfg');
    fs.mkdirSync(dir, { recursive: true });
    if (id === '1111') {
      fs.writeFileSync(path.join(dir, 'cs2_video.txt'), '"video.cfg"\n{\n\t"setting.mat_vsync"\t\t"1"\n}\n');
    }
  }
  const service = games.createGameService(env);
  const listed = (await service.list()).find((g) => g.id === 'cs2');
  assert.equal(listed.installed, true);
  assert.equal(listed.files.length, 1);
  await service.apply('cs2', ['cs2-vsync', 'cs2-aa']);
  const text = fs.readFileSync(listed.files[0], 'utf8');
  assert.match(text, /"setting\.mat_vsync"\t\t"0"/);
  assert.match(text, /"setting\.r_csgo_cmaa_enable"\t\t"1"/);
});

test('handles read-only config files gracefully on apply and revert', async () => {
  const root = tmpDir();
  const env = makeEnv(root);
  const dir = path.join(root, 'Roaming', '.minecraft');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, 'options.txt');
  fs.writeFileSync(file, 'renderClouds:true\nenableVsync:true\n', 'utf8');
  // Mark read-only
  fs.chmodSync(file, 0o444);

  const service = games.createGameService(env);
  // Apply should temporarily clear read-only flag, write changes, and restore read-only flag
  await assert.doesNotReject(async () => {
    await service.apply('minecraft', ['mc-clouds', 'mc-vsync']);
  });

  const updatedText = fs.readFileSync(file, 'utf8');
  assert.match(updatedText, /renderClouds:false/);
  assert.match(updatedText, /enableVsync:false/);
  // Verify it is restored to read-only
  const statAfterApply = fs.statSync(file);
  assert.equal((statAfterApply.mode & 0o200) === 0, true, 'File should remain read-only after apply');

  // Revert should also work seamlessly on the read-only file
  await assert.doesNotReject(async () => {
    await service.revert('minecraft');
  });

  const revertedText = fs.readFileSync(file, 'utf8');
  assert.match(revertedText, /renderClouds:true/);
  assert.match(revertedText, /enableVsync:true/);
  const statAfterRevert = fs.statSync(file);
  assert.equal((statAfterRevert.mode & 0o200) === 0, true, 'File should remain read-only after revert');
  // Clean up read-only permission so tmp cleanup doesn't fail
  fs.chmodSync(file, 0o666);
});

test('pre-game boost only accepts apps from the fixed allowlist', () => {
  assert.deepEqual(cleanBoostApps(['onedrive', 'Chrome', 'chrome']), ['OneDrive', 'chrome']);
  assert.deepEqual(cleanBoostApps(undefined), []);
  assert.throws(() => cleanBoostApps(['lsass']), /not on the Nexa pre-game list/);
  assert.throws(() => cleanBoostApps(['steam']), /not on the Nexa pre-game list/);
  assert.throws(() => cleanBoostApps(['msedge']), /not on the Nexa pre-game list/);
  assert.throws(() => cleanBoostApps('chrome'), /list of app names/);
});

