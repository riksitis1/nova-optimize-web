'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  isValidIp,
  isValidHost,
  cleanHost,
  clampInt,
  cleanId,
  cleanIdList,
  cleanIpList,
  cleanIfIndexes,
} = require('../server/lib/validate');

test('isValidIp accepts real IPv4 and IPv6 addresses', () => {
  for (const value of ['1.1.1.1', '8.8.8.8', '192.168.1.20', '::1', '2001:db8::1', 'fe80::1']) {
    assert.equal(isValidIp(value), true, value);
  }
});

test('isValidIp rejects malformed or out-of-range addresses', () => {
  for (const value of ['', '1.1.1', '1.1.1.256', '999.1.1.1', 'not-an-ip', 'example.com', '12345::1', null, 42]) {
    assert.equal(isValidIp(value), false, String(value));
  }
});

test('isValidHost accepts hostnames and addresses, not URLs or spaces', () => {
  for (const value of ['example.com', 'mc.hypixel.net', 'localhost', '1.1.1.1', '2001:db8::1', '[::1]']) {
    assert.equal(isValidHost(value), true, value);
  }
  for (const value of ['', 'bad host', 'http://example.com', '-leading.example.com', 'example..com', null]) {
    assert.equal(isValidHost(value), false, String(value));
  }
});

test('cleanHost trims input and removes IPv6 brackets', () => {
  assert.equal(cleanHost('  example.com  '), 'example.com');
  assert.equal(cleanHost('[::1]'), '::1');
  assert.throws(() => cleanHost('bad host'), /valid hostname or IP/i);
});

test('clampInt keeps values inside the requested range', () => {
  assert.equal(clampInt('7', 3, 20, 10), 7);
  assert.equal(clampInt(1, 3, 20, 10), 3);
  assert.equal(clampInt(99, 3, 20, 10), 20);
  assert.equal(clampInt('nope', 3, 20, 10), 10);
  assert.equal(clampInt(undefined, 3, 20, 10), 10);
});

test('cleanId only accepts lowercase safe identifiers', () => {
  assert.equal(cleanId('game-mode'), 'game-mode');
  assert.equal(cleanId('st_0123456789abcd', /^st_[a-f0-9]{14}$/), 'st_0123456789abcd');
  for (const value of ['Game Mode', 'GAME-MODE', '../etc', '', 'a', null]) {
    assert.throws(() => cleanId(value), /Invalid identifier/i, String(value));
  }
});

test('cleanIdList validates arrays and caps the list length', () => {
  assert.deepEqual(cleanIdList(['game-mode', 'hags']), ['game-mode', 'hags']);
  assert.throws(() => cleanIdList('game-mode'), /list of identifiers/i);
  assert.throws(() => cleanIdList(['bad id']), /Invalid identifier/i);
  assert.equal(cleanIdList(Array.from({ length: 80 }, () => 'game-mode'), 50).length, 50);
});

test('cleanIpList rejects empty, oversized and invalid lists', () => {
  assert.deepEqual(cleanIpList(['1.1.1.1', '1.0.0.1']), ['1.1.1.1', '1.0.0.1']);
  assert.throws(() => cleanIpList([]), /DNS server addresses/i);
  assert.throws(() => cleanIpList(['1.1.1.1', '1.0.0.1', '8.8.8.8', '8.8.4.4', '9.9.9.9', '149.112.112.112', '94.140.14.14', '94.140.15.15', '1.1.1.2']), /DNS server addresses/i);
  assert.throws(() => cleanIpList(['not-an-ip']), /Invalid DNS server address/i);
});

test('cleanIfIndexes requires positive integer adapter indexes', () => {
  assert.deepEqual(cleanIfIndexes([1, 12]), [1, 12]);
  assert.deepEqual(cleanIfIndexes(['4']), [4]);
  for (const value of [[], [-1], ['x'], [1.5], null]) {
    assert.throws(() => cleanIfIndexes(value), /network adapter|Select at least one/i, String(value));
  }
});
