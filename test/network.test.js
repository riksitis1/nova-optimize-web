'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  TARGETS,
  DNS_PROVIDERS,
  getTargets,
  bufferbloatGrade,
  isValidIp,
} = require('../server/lib/network');

test('bufferbloat grades follow the documented thresholds', () => {
  assert.equal(bufferbloatGrade(null), '—');
  assert.equal(bufferbloatGrade(0), 'A+');
  assert.equal(bufferbloatGrade(5), 'A+');
  assert.equal(bufferbloatGrade(6), 'A');
  assert.equal(bufferbloatGrade(30), 'A');
  assert.equal(bufferbloatGrade(31), 'B');
  assert.equal(bufferbloatGrade(60), 'B');
  assert.equal(bufferbloatGrade(61), 'C');
  assert.equal(bufferbloatGrade(100), 'C');
  assert.equal(bufferbloatGrade(101), 'D');
  assert.equal(bufferbloatGrade(200), 'D');
  assert.equal(bufferbloatGrade(201), 'F');
});

test('game targets are unique, valid and use supported protocols', () => {
  const ids = new Set();
  for (const target of TARGETS) {
    assert.equal(ids.has(target.id), false, `duplicate target ${target.id}`);
    ids.add(target.id);
    assert.ok(target.game, `${target.id} needs a game label`);
    assert.ok(target.region, `${target.id} needs a region`);
    assert.ok(['tcp', 'icmp'].includes(target.protocol), `${target.id} protocol`);
    assert.ok(Number.isInteger(target.port) && target.port > 0 && target.port <= 65535, `${target.id} port`);
    assert.equal(isValidIp(target.host) || /^[a-z0-9.-]+$/i.test(target.host), true, `${target.id} host`);
  }
  assert.equal(getTargets(), TARGETS);
});

test('DNS providers are unique and every fixed server is a valid IP', () => {
  const ids = new Set();
  for (const provider of DNS_PROVIDERS) {
    assert.equal(ids.has(provider.id), false, `duplicate provider ${provider.id}`);
    ids.add(provider.id);
    if (provider.id === 'current') {
      assert.equal(provider.servers, null);
      continue;
    }
    assert.ok(Array.isArray(provider.servers) && provider.servers.length >= 2, `${provider.id} servers`);
    for (const server of provider.servers) assert.equal(isValidIp(server), true, `${provider.id}: ${server}`);
  }
  assert.equal(DNS_PROVIDERS.length, 5);
});
