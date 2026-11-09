'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { runPowerShell } = require('./ps');
const { ROOT } = require('./store');

const DEFAULT_MANIFEST_URL =
  process.env.NOVA_UPDATE_URL ||
  'https://raw.githubusercontent.com/riksitis1/nova-optimize-web/main/version.json';

function parseSemver(version) {
  const clean = String(version || '')
    .trim()
    .replace(/^v/i, '')
    .split('-')[0];
  const parts = clean.split('.').map((n) => Number.parseInt(n, 10));
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n) || n < 0)) return null;
  return parts;
}

function compareSemver(a, b) {
  const pa = parseSemver(a);
  const pb = parseSemver(b);
  if (!pa || !pb) return 0;
  for (let i = 0; i < 3; i += 1) {
    if (pa[i] > pb[i]) return 1;
    if (pa[i] < pb[i]) return -1;
  }
  return 0;
}

async function fetchManifest(manifestUrl = DEFAULT_MANIFEST_URL) {
  const url = new URL(manifestUrl);
  if (url.protocol !== 'https:') {
    throw new Error('Update manifest must use HTTPS.');
  }
  const response = await fetch(url.toString(), {
    headers: {
      'User-Agent': 'Nova-Optimize-Updater/1.0',
      'Cache-Control': 'no-cache',
    },
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) {
    throw new Error(`Update server returned HTTP ${response.status}.`);
  }
  const data = await response.json();
  if (!data || typeof data !== 'object' || !parseSemver(data.version)) {
    throw new Error('Update manifest is missing a valid semantic version.');
  }
  if (typeof data.downloadUrl !== 'string' || !data.downloadUrl.startsWith('https://')) {
    throw new Error('Update manifest is missing a valid HTTPS download URL.');
  }
  if (typeof data.sha256 !== 'string' || !/^[a-f0-9]{64}$/i.test(data.sha256)) {
    throw new Error('Update manifest is missing a valid SHA-256 checksum.');
  }
  return {
    version: String(data.version).replace(/^v/i, ''),
    releasedAt: data.releasedAt || null,
    downloadUrl: data.downloadUrl,
    sha256: data.sha256.toLowerCase(),
    notes: Array.isArray(data.notes) ? data.notes.slice(0, 10).map(String) : [],
  };
}

async function checkForUpdate(currentVersion) {
  const manifest = await fetchManifest();
  const updateAvailable = compareSemver(manifest.version, currentVersion) > 0;
  return {
    currentVersion,
    latestVersion: manifest.version,
    updateAvailable,
    releasedAt: manifest.releasedAt,
    notes: manifest.notes,
    sha256: manifest.sha256,
    checkedAt: new Date().toISOString(),
  };
}

async function downloadAndStageUpdate(currentVersion) {
  const manifest = await fetchManifest();
  if (compareSemver(manifest.version, currentVersion) <= 0) {
    throw new Error(`You are already running the latest version (v${currentVersion}).`);
  }

  const response = await fetch(manifest.downloadUrl, {
    headers: { 'User-Agent': 'Nova-Optimize-Updater/1.0' },
    signal: AbortSignal.timeout(60_000),
  });
  if (!response.ok) {
    throw new Error(`Could not download update package (HTTP ${response.status}).`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  if (buffer.length < 1024 || buffer.length > 50 * 1024 * 1024) {
    throw new Error('Downloaded update package has an unexpected file size.');
  }

  const actualHash = crypto.createHash('sha256').update(buffer).digest('hex').toLowerCase();
  if (actualHash !== manifest.sha256) {
    throw new Error('Update SHA-256 checksum verification failed. Installation aborted for your safety.');
  }

  const stamp = `${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  const tempZip = path.join(os.tmpdir(), `nova-update-${stamp}.zip`);
  const stageDir = path.join(os.tmpdir(), `nova-stage-${stamp}`);

  fs.writeFileSync(tempZip, buffer);

  const psQuote = (val) => `'${String(val).replaceAll("'", "''")}'`;
  const applyScript = `
    $ErrorActionPreference = 'Stop'
    $zip = ${psQuote(tempZip)}
    $stage = ${psQuote(stageDir)}
    $dest = ${psQuote(ROOT)}
    New-Item -ItemType Directory -Path $stage -Force | Out-Null
    Expand-Archive -LiteralPath $zip -DestinationPath $stage -Force
    $inner = Join-Path $stage 'Nova-Optimize'
    $sourceRoot = if (Test-Path -LiteralPath $inner) { $inner } else { $stage }
    Get-ChildItem -LiteralPath $sourceRoot -Force | ForEach-Object {
      if ($_.Name -eq 'data' -or $_.Name -eq '.git' -or $_.Name -eq 'website') { return }
      $target = Join-Path $dest $_.Name
      Copy-Item -LiteralPath $_.FullName -Destination $target -Recurse -Force
    }
    Remove-Item -LiteralPath $zip -Force -ErrorAction SilentlyContinue
    Remove-Item -LiteralPath $stage -Recurse -Force -ErrorAction SilentlyContinue
    $shortcutScript = Join-Path $dest 'Create Shortcut.ps1'
    if (Test-Path -LiteralPath $shortcutScript) {
      & $shortcutScript | Out-Null
    }
  `;

  await runPowerShell(applyScript, { timeout: 60_000 });
  return {
    ok: true,
    previousVersion: currentVersion,
    installedVersion: manifest.version,
    sha256: actualHash,
  };
}

module.exports = {
  parseSemver,
  compareSemver,
  checkForUpdate,
  downloadAndStageUpdate,
};

