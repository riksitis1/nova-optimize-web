'use strict';

const net = require('node:net');

const HOSTNAME = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)*[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i;
const SAFE_HOST_CHARS = /^[a-zA-Z0-9.:-]+$/;

function isValidIp(value) {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 45 || trimmed.includes('%') || !SAFE_HOST_CHARS.test(trimmed)) return false;
  return net.isIP(trimmed) !== 0;
}

function isValidHost(value) {
  if (typeof value !== 'string') return false;
  const host = value.trim().replace(/^\[|\]$/g, '');
  if (!host || host.length > 253 || !SAFE_HOST_CHARS.test(host)) return false;
  if (isValidIp(host)) return true;
  return HOSTNAME.test(host);
}

function cleanHost(value) {
  if (!isValidHost(value)) throw new Error('Enter a valid hostname or IP address.');
  return value.trim().replace(/^\[|\]$/g, '');
}

function clampInt(value, min, max, fallback) {
  const number = Number.parseInt(value, 10);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
}

function cleanId(value, pattern = /^[a-z0-9][a-z0-9-]{1,64}$/) {
  if (typeof value !== 'string' || !pattern.test(value)) throw new Error('Invalid identifier.');
  return value;
}

function cleanIdList(value, max = 50) {
  if (!Array.isArray(value)) throw new Error('Expected a list of identifiers.');
  return value.slice(0, max).map((id) => cleanId(id));
}

function cleanIpList(value, max = 8) {
  if (!Array.isArray(value) || value.length === 0 || value.length > max) {
    throw new Error('Expected a list of DNS server addresses.');
  }
  return value.map((ip) => {
    if (!isValidIp(ip)) throw new Error(`Invalid DNS server address: ${String(ip).slice(0, 60)}`);
    return ip.trim();
  });
}

function cleanIfIndexes(value) {
  if (!Array.isArray(value) || value.length === 0 || value.length > 20) {
    throw new Error('Select at least one network adapter.');
  }
  return value.map((index) => {
    const number = Number(index);
    if (!Number.isInteger(number) || number < 0 || number > 1_000_000) {
      throw new Error('Invalid network adapter.');
    }
    return number;
  });
}

module.exports = {
  isValidIp,
  isValidHost,
  cleanHost,
  clampInt,
  cleanId,
  cleanIdList,
  cleanIpList,
  cleanIfIndexes,
};
