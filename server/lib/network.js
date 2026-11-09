'use strict';

const dns = require('node:dns');
const net = require('node:net');
const { performance } = require('node:perf_hooks');
const { setTimeout: delay } = require('node:timers/promises');
const { runBridge } = require('./ps');
const { clampInt, cleanHost, isValidIp } = require('./validate');

const TARGETS = [
  {
    id: 'riot-na',
    game: 'Riot Games',
    region: 'NA',
    host: 'na1.api.riotgames.com',
    port: 443,
    protocol: 'tcp',
    note: 'Valorant / League service route',
  },
  {
    id: 'riot-euw',
    game: 'Riot Games',
    region: 'EUW',
    host: 'euw1.api.riotgames.com',
    port: 443,
    protocol: 'tcp',
    note: 'Valorant / League service route',
  },
  {
    id: 'riot-kr',
    game: 'Riot Games',
    region: 'KR',
    host: 'kr.api.riotgames.com',
    port: 443,
    protocol: 'tcp',
    note: 'Valorant / League service route',
  },
  {
    id: 'epic',
    game: 'Fortnite / Epic',
    region: 'Global',
    host: 'matchmaking.epicgames.com',
    port: 443,
    protocol: 'tcp',
    note: 'Epic matchmaking route',
  },
  {
    id: 'steam',
    game: 'CS2 / Steam',
    region: 'Global',
    host: 'steamcommunity.com',
    port: 443,
    protocol: 'tcp',
    note: 'Steam network route',
  },
  {
    id: 'minecraft-hypixel',
    game: 'Minecraft',
    region: 'Hypixel',
    host: 'mc.hypixel.net',
    port: 25565,
    protocol: 'tcp',
    note: 'Actual Hypixel game port',
  },
  {
    id: 'ea',
    game: 'Apex / EA',
    region: 'Global',
    host: 'ea.com',
    port: 443,
    protocol: 'tcp',
    note: 'EA service route',
  },
  {
    id: 'call-of-duty',
    game: 'Call of Duty',
    region: 'Global',
    host: 'callofduty.com',
    port: 443,
    protocol: 'tcp',
    note: 'Activision service route',
  },
  {
    id: 'blizzard',
    game: 'Overwatch / Blizzard',
    region: 'Global',
    host: 'blizzard.com',
    port: 443,
    protocol: 'tcp',
    note: 'Blizzard service route',
  },
  {
    id: 'roblox',
    game: 'Roblox',
    region: 'Global',
    host: 'roblox.com',
    port: 443,
    protocol: 'tcp',
    note: 'Roblox service route',
  },
  {
    id: 'discord',
    game: 'Discord',
    region: 'Global',
    host: 'discord.com',
    port: 443,
    protocol: 'tcp',
    note: 'Voice chat service route',
  },
  {
    id: 'cloudflare',
    game: 'Cloudflare',
    region: 'Internet',
    host: '1.1.1.1',
    port: 443,
    protocol: 'icmp',
    note: 'Global internet baseline',
  },
  {
    id: 'google',
    game: 'Google',
    region: 'Internet',
    host: '8.8.8.8',
    port: 443,
    protocol: 'icmp',
    note: 'Global internet baseline',
  },
  {
    id: 'quad9',
    game: 'Quad9',
    region: 'Internet',
    host: '9.9.9.9',
    port: 443,
    protocol: 'icmp',
    note: 'Global internet baseline',
  },
];

const DNS_PROVIDERS = [
  { id: 'current', name: 'Current / ISP', servers: null, description: 'The DNS server Windows is using now' },
  { id: 'cloudflare', name: 'Cloudflare', servers: ['1.1.1.1', '1.0.0.1'], description: 'Fast, privacy-focused public DNS' },
  { id: 'google', name: 'Google Public DNS', servers: ['8.8.8.8', '8.8.4.4'], description: 'Very reliable global public DNS' },
  { id: 'quad9', name: 'Quad9', servers: ['9.9.9.9', '149.112.112.112'], description: 'Security-focused public DNS' },
  { id: 'adguard', name: 'AdGuard DNS', servers: ['94.140.14.14', '94.140.15.15'], description: 'Blocks some ads and trackers at DNS level' },
];

function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function percentile(values, p) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[index];
}

function summarizeTimes(host, address, times, protocol, extra = {}) {
  const successful = times.filter((value) => Number.isFinite(value));
  const sent = times.length;
  const received = successful.length;
  const loss = sent ? Math.round(((sent - received) / sent) * 1000) / 10 : 100;
  if (!received) {
    return {
      host,
      address,
      protocol,
      sent,
      received: 0,
      loss: 100,
      min: null,
      avg: null,
      max: null,
      jitter: null,
      times,
      ...extra,
    };
  }
  const min = Math.min(...successful);
  const max = Math.max(...successful);
  const avg = Math.round((successful.reduce((sum, value) => sum + value, 0) / received) * 10) / 10;
  const diffs = [];
  for (let index = 1; index < successful.length; index += 1) {
    diffs.push(Math.abs(successful[index] - successful[index - 1]));
  }
  const jitter = diffs.length
    ? Math.round((diffs.reduce((sum, value) => sum + value, 0) / diffs.length) * 10) / 10
    : 0;
  return { host, address, protocol, sent, received, loss, min, avg, max, jitter, times, ...extra };
}

function tcpConnect(host, port, timeoutMs = 1500) {
  return new Promise((resolve) => {
    const started = performance.now();
    const socket = net.connect({ host, port });
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(value);
    };
    socket.setTimeout(timeoutMs);
    socket.once('connect', () => finish(performance.now() - started));
    socket.once('timeout', () => finish(null));
    socket.once('error', () => finish(null));
  });
}

async function tcpPing(host, port, count) {
  let address = null;
  try {
    const found = await dns.promises.lookup(host, { family: 0 });
    address = found.address;
  } catch {
    // The connect attempts below will report the failure.
  }
  const times = [];
  for (let index = 0; index < count; index += 1) {
    const value = await tcpConnect(host, port, 1500);
    times.push(value === null ? null : Math.round(value * 10) / 10);
    if (index < count - 1) await delay(120);
  }
  return summarizeTimes(host, address, times, 'tcp', { port });
}

async function pingTarget(request) {
  const host = cleanHost(request.host);
  const protocol = request.protocol === 'tcp' ? 'tcp' : 'icmp';
  const count = clampInt(request.count, 3, 20, 10);
  if (protocol === 'tcp') {
    const port = clampInt(request.port, 1, 65535, 443);
    return tcpPing(host, port, count);
  }
  const result = await runBridge('ping', { host, count }, { timeout: 30_000 });
  return { ...result, sent: Number(result.sent ?? result.count) || 0, protocol: 'icmp' };
}

function getTargets() {
  return TARGETS;
}

async function getDnsServers() {
  try {
    const servers = dns.getServers().filter(Boolean);
    return servers.length ? servers : ['1.1.1.1'];
  } catch {
    return ['1.1.1.1'];
  }
}

async function queryDns(server, domain, timeoutMs = 1500) {
  const resolver = new dns.promises.Resolver();
  try {
    resolver.setServers([server]);
  } catch {
    return { ok: false, ms: timeoutMs, error: 'invalid server' };
  }
  const started = performance.now();
  let timer = null;
  try {
    const addresses = await Promise.race([
      resolver.resolve4(domain),
      new Promise((_, reject) => {
        timer = setTimeout(() => {
          try {
            resolver.cancel();
          } catch {
            // ignore
          }
          reject(new Error('timeout'));
        }, timeoutMs);
      }),
    ]);
    return {
      ok: Array.isArray(addresses) && addresses.length > 0,
      ms: Math.round((performance.now() - started) * 10) / 10,
      error: null,
    };
  } catch (error) {
    return {
      ok: false,
      ms: Math.round((performance.now() - started) * 10) / 10,
      error: error.code || error.message,
    };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function benchmarkDns() {
  const current = await getDnsServers();
  const domains = [
    'google.com',
    'youtube.com',
    'discord.com',
    'steamcommunity.com',
    'cloudflare.com',
    'github.com',
    'wikipedia.org',
    'reddit.com',
  ];
  const providers = DNS_PROVIDERS.map((provider) => ({
    ...provider,
    servers: provider.id === 'current' ? current : provider.servers,
  }));
  const unique = [];
  const seen = new Set();
  for (const provider of providers) {
    const key = provider.servers.join(',');
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(provider);
  }

  const results = [];
  for (const provider of unique) {
    const primary = provider.servers[0];
    const samples = [];
    let success = 0;
    let attempts = 0;
    await queryDns(primary, 'example.com', 1200);
    for (let round = 0; round < 2; round += 1) {
      for (const domain of domains) {
        const result = await queryDns(primary, domain, 1500);
        attempts += 1;
        if (result.ok) {
          success += 1;
          samples.push(result.ms);
        }
      }
    }
    const avg = samples.length
      ? Math.round((samples.reduce((sum, value) => sum + value, 0) / samples.length) * 10) / 10
      : null;
    results.push({
      id: provider.id,
      name: provider.name,
      description: provider.description,
      servers: provider.servers,
      primary,
      avg,
      median: median(samples) === null ? null : Math.round(median(samples) * 10) / 10,
      p95: percentile(samples, 95) === null ? null : Math.round(percentile(samples, 95) * 10) / 10,
      min: samples.length ? Math.min(...samples) : null,
      max: samples.length ? Math.max(...samples) : null,
      successRate: attempts ? Math.round((success / attempts) * 100) : 0,
      samples: samples.length,
    });
  }
  const ranked = results
    .filter((result) => result.successRate >= 70 && result.median !== null)
    .sort((a, b) => a.median - b.median || b.successRate - a.successRate);
  return {
    testedAt: new Date().toISOString(),
    domains,
    current,
    results,
    bestId: ranked[0] ? ranked[0].id : null,
    best: ranked[0] || null,
  };
}

function tcpLatencySamples(host, port, count, gapMs = 250) {
  return (async () => {
    const values = [];
    for (let index = 0; index < count; index += 1) {
      const value = await tcpConnect(host, port, 1500);
      if (value !== null) values.push(value);
      if (index < count - 1) await delay(gapMs);
    }
    return values;
  })();
}

async function sampleWhileActive(taskPromise, maxSamples = 14, gapMs = 130) {
  let active = true;
  taskPromise.finally(() => {
    active = false;
  });
  const values = [];
  await delay(60);
  while ((active || values.length < 2) && values.length < maxSamples) {
    const value = await tcpConnect('1.1.1.1', 443, 1400);
    if (value !== null) values.push(value);
    if (!active && values.length >= 2) break;
    await delay(gapMs);
  }
  return values;
}

async function downloadChunk(bytes, signal) {
  const response = await fetch(`https://speed.cloudflare.com/__down?bytes=${bytes}`, {
    signal,
    headers: { 'Cache-Control': 'no-store' },
  });
  if (!response.ok || !response.body) throw new Error(`Download test failed (HTTP ${response.status}).`);
  const reader = response.body.getReader();
  let received = 0;
  const started = performance.now();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.byteLength;
  }
  const seconds = (performance.now() - started) / 1000;
  return { received, seconds };
}

async function downloadTest(bytes = 25_000_000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 45_000);
  try {
    let { received, seconds } = await downloadChunk(bytes, controller.signal);
    if (seconds < 0.75) {
      const extra = await downloadChunk(35_000_000, controller.signal);
      received += extra.received;
      seconds += extra.seconds;
    }
    if (seconds <= 0 || received <= 0) throw new Error('Download test returned no data.');
    return {
      bytes: received,
      seconds: Math.round(seconds * 100) / 100,
      mbps: Math.round(((received * 8) / 1_000_000 / seconds) * 10) / 10,
    };
  } finally {
    clearTimeout(timer);
  }
}

async function uploadTest(bytes = 8_000_000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 45_000);
  const body = Buffer.alloc(bytes, 0x61);
  try {
    const started = performance.now();
    const response = await fetch('https://speed.cloudflare.com/__up', {
      method: 'POST',
      body,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/octet-stream',
        'Cache-Control': 'no-store',
      },
    });
    const seconds = (performance.now() - started) / 1000;
    if (!response.ok) throw new Error(`Upload test failed (HTTP ${response.status}).`);
    return {
      bytes,
      seconds: Math.round(seconds * 100) / 100,
      mbps: Math.round(((bytes * 8) / 1_000_000 / seconds) * 10) / 10,
    };
  } finally {
    clearTimeout(timer);
  }
}

function bufferbloatGrade(increase) {
  if (increase === null) return '—';
  if (increase <= 5) return 'A+';
  if (increase <= 30) return 'A';
  if (increase <= 60) return 'B';
  if (increase <= 100) return 'C';
  if (increase <= 200) return 'D';
  return 'F';
}

async function speedTest() {
  const idleSamples = await tcpLatencySamples('1.1.1.1', 443, 6, 160);
  const idle = idleSamples.length ? median(idleSamples) : null;

  const downloadPromise = downloadTest();
  const downLoadedPromise = sampleWhileActive(downloadPromise, 12, 130);
  const [download, downLoadedSamples] = await Promise.all([downloadPromise, downLoadedPromise]);

  const uploadPromise = uploadTest();
  const upLoadedPromise = sampleWhileActive(uploadPromise, 10, 140);
  const [upload, upLoadedSamples] = await Promise.all([uploadPromise, upLoadedPromise]);

  const loadedSamples = [...downLoadedSamples, ...upLoadedSamples];
  const downLoaded = downLoadedSamples.length ? median(downLoadedSamples) : null;
  const upLoaded = upLoadedSamples.length ? median(upLoadedSamples) : null;
  const loaded = loadedSamples.length ? median(loadedSamples) : null;
  const increase = idle !== null && loaded !== null ? Math.max(0, Math.round((loaded - idle) * 10) / 10) : null;
  return {
    testedAt: new Date().toISOString(),
    server: 'Cloudflare',
    download,
    upload,
    latency: {
      idle: idle === null ? null : Math.round(idle * 10) / 10,
      loaded: loaded === null ? null : Math.round(loaded * 10) / 10,
      downloadLoaded: downLoaded === null ? null : Math.round(downLoaded * 10) / 10,
      uploadLoaded: upLoaded === null ? null : Math.round(upLoaded * 10) / 10,
      increase,
      grade: bufferbloatGrade(increase),
      idleSamples: idleSamples.map((value) => Math.round(value * 10) / 10),
      loadedSamples: loadedSamples.map((value) => Math.round(value * 10) / 10),
      downloadSamples: downLoadedSamples.map((value) => Math.round(value * 10) / 10),
      uploadSamples: upLoadedSamples.map((value) => Math.round(value * 10) / 10),
    },
  };
}

module.exports = {
  TARGETS,
  DNS_PROVIDERS,
  getTargets,
  pingTarget,
  benchmarkDns,
  speedTest,
  bufferbloatGrade,
  isValidIp,
};
