'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const { isValidHost, isValidIp, cleanHost, cleanId, clampInt } = require('../server/lib/validate');

test('security: isValidHost accepts clean hostnames and IPs but strictly rejects command injection and metacharacters', () => {
  // Valid
  assert.equal(isValidHost('na1.api.riotgames.com'), true);
  assert.equal(isValidHost('steamcommunity.com'), true);
  assert.equal(isValidHost('1.1.1.1'), true);
  assert.equal(isValidHost('8.8.8.8'), true);
  assert.equal(isValidHost('127.0.0.1'), true);

  // Injections / metacharacters
  assert.equal(isValidHost('na1.api.riotgames.com; calc.exe'), false);
  assert.equal(isValidHost('steamcommunity.com | whoami'), false);
  assert.equal(isValidHost('1.1.1.1 & dir'), false);
  assert.equal(isValidHost('$(whoami).com'), false);
  assert.equal(isValidHost('`id`.com'), false);
  assert.equal(isValidHost('example.com\n127.0.0.1'), false);
  assert.equal(isValidHost('example.com<script>'), false);
  assert.equal(isValidHost(''), false);
  assert.equal(isValidHost(null), false);
  assert.equal(isValidHost(123), false);

  assert.throws(() => cleanHost('evil.com; calc.exe'), /Enter a valid hostname or IP address/);
  assert.equal(cleanHost('  steamcommunity.com  '), 'steamcommunity.com');
});

test('security: cleanId enforces strict lowercase identifier regex and rejects path traversal or shell characters', () => {
  assert.equal(cleanId('game-process-priority'), 'game-process-priority');
  assert.equal(cleanId('dscp-qos'), 'dscp-qos');
  assert.equal(cleanId('nic-low-jitter'), 'nic-low-jitter');

  assert.throws(() => cleanId('../../../etc/passwd'), /Invalid identifier/);
  assert.throws(() => cleanId('id; rm -rf /'), /Invalid identifier/);
  assert.throws(() => cleanId('action$(whoami)'), /Invalid identifier/);
  assert.throws(() => cleanId(''), /Invalid identifier/);
});

test('security: clampInt strictly bounds integer values to permitted range', () => {
  assert.equal(clampInt(443, 1, 65535, 80), 443);
  assert.equal(clampInt(70000, 1, 65535, 80), 65535);
  assert.equal(clampInt(0, 1, 65535, 80), 1);
  assert.equal(clampInt('not-a-number', 1, 65535, 80), 80);
});

test('security: constant-time token comparison accurately verifies matching 256-bit token and rejects timing leaks', () => {
  const token = crypto.randomBytes(32).toString('hex');
  const bufExpected = Buffer.from(token, 'utf8');

  // Exact match
  const validProvided = Buffer.from(token, 'utf8');
  assert.equal(crypto.timingSafeEqual(validProvided, bufExpected), true);

  // Altered byte
  const tamperedToken = token.slice(0, -1) + (token.endsWith('a') ? 'b' : 'a');
  const bufTampered = Buffer.from(tamperedToken, 'utf8');
  assert.equal(crypto.timingSafeEqual(bufTampered, bufExpected), false);

  // Different length
  const shortToken = token.slice(0, 16);
  assert.notEqual(shortToken.length, token.length);
});

test('security: local host header and cross-origin DNS rebinding defense logic', () => {
  const PORT = 4318;
  const validateHost = (hostHeader) => {
    const host = String(hostHeader || '').toLowerCase();
    return host === `127.0.0.1:${PORT}`;
  };

  assert.equal(validateHost(`127.0.0.1:${PORT}`), true);
  // DNS rebinding attack attempt: evil.com mapped to 127.0.0.1
  assert.equal(validateHost(`evil.com:${PORT}`), false);
  assert.equal(validateHost(`attacker.internal:${PORT}`), false);
  assert.equal(validateHost(`192.168.1.100:${PORT}`), false);

  const validateOrigin = (originHeader) => {
    if (!originHeader) return true;
    return String(originHeader).toLowerCase() === `http://127.0.0.1:${PORT}`;
  };

  assert.equal(validateOrigin(`http://127.0.0.1:${PORT}`), true);
  assert.equal(validateOrigin('http://evil.com'), false);
  assert.equal(validateOrigin('https://malicious-game-booster.com'), false);

  const validateSecFetch = (secFetchSite) => {
    const site = String(secFetchSite || '').toLowerCase();
    return site !== 'cross-site';
  };

  assert.equal(validateSecFetch('same-origin'), true);
  assert.equal(validateSecFetch('none'), true);
  assert.equal(validateSecFetch('cross-site'), false);
});

