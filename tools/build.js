'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const STAGING = path.join(DIST, '_staging');
const WEB_ROOT = fs.existsSync(path.join(ROOT, 'version.json')) ? ROOT : path.join(ROOT, 'website');
const VERSION = require(path.join(ROOT, 'package.json')).version;
const syncInstalled = process.argv.includes('--sync-installed');

console.log(`==> Building Nexa Optimize v${VERSION} (Closed-Source Proprietary Freeware Release)...`);

// 1. Run syntax check and unit tests first
console.log('==> Step 1: Running check.js & test.js...');
execFileSync(process.execPath, [path.join(ROOT, 'tools', 'check.js')], { stdio: 'inherit', cwd: ROOT });
execFileSync(process.execPath, [path.join(ROOT, 'tools', 'test.js')], { stdio: 'inherit', cwd: ROOT });

// 2. Prepare staging directory
if (fs.existsSync(STAGING)) {
  fs.rmSync(STAGING, { recursive: true, force: true });
}
fs.mkdirSync(STAGING, { recursive: true });

const RUNTIME_FILES = [
  'Create Shortcut.ps1',
  'Install Nexa.bat',
  'Install Nova.bat',
  'LICENSE',
  'NexaOptimize.vbs',
  'NovaOptimize.vbs',
  'package.json',
  'README.md',
  'SECURITY.md',
  'Start Nexa.bat',
  'Start Nova.bat',
  'public/app.js',
  'public/index.html',
  'public/styles.css',
  'public/assets/logo.svg',
  'public/assets/nova.ico',
  'public/assets/nexa.ico',
  'public/js/boost.js',
  'public/js/core.js',
  'public/js/ui.js',
  'public/js/pages/activity.js',
  'public/js/pages/cleanup.js',
  'public/js/pages/games.js',
  'public/js/pages/network.js',
  'public/js/pages/optimize.js',
  'public/js/pages/overview.js',
  'public/js/pages/settings.js',
  'public/js/pages/startup.js',
  'server/server.js',
  'server/lib/actions.js',
  'server/lib/analyze.js',
  'server/lib/boost.js',
  'server/lib/games.js',
  'server/lib/network.js',
  'server/lib/ps.js',
  'server/lib/store.js',
  'server/lib/system.js',
  'server/lib/updater.js',
  'server/lib/validate.js',
  'server/scripts/bridge.ps1',
];

console.log('==> Step 2: Bundling the tested runtime files...');
const manifestFiles = {};

for (const rel of RUNTIME_FILES) {
  const content = fs.readFileSync(path.join(ROOT, rel));
  const dst = path.join(STAGING, rel);
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.writeFileSync(dst, content);
  manifestFiles[rel] = crypto.createHash('sha256').update(content).digest('hex');
}

// 4. Generate runtime integrity manifest
const manifest = {
  name: 'nexa-optimize',
  version: VERSION,
  builtAt: new Date().toISOString(),
  distribution: 'Proprietary Freeware',
  files: manifestFiles,
};
fs.writeFileSync(path.join(STAGING, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');
console.log(`==> Step 3: Generated manifest.json with ${Object.keys(manifestFiles).length} audited integrity hashes.`);

// 5. Package ZIP using PowerShell System.IO.Compression
const zipPath = path.join(DIST, `Nexa-Optimize-v${VERSION}.zip`);
const setupPath = path.join(DIST, `Nexa-Optimize-Setup-v${VERSION}.cmd`);

if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);

console.log('==> Step 4: Compressing release ZIP...');
const zipScript = `
Add-Type -AssemblyName System.IO.Compression.FileSystem
[System.IO.Compression.ZipFile]::CreateFromDirectory('${STAGING.replace(/'/g, "''")}', '${zipPath.replace(/'/g, "''")}', [System.IO.Compression.CompressionLevel]::Optimal, $false)
`;
execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', zipScript], { stdio: 'inherit' });

const zipBytes = fs.readFileSync(zipPath);
const zipHash = crypto.createHash('sha256').update(zipBytes).digest('hex');
const zipSize = zipBytes.length;
const zipKb = (zipSize / 1024).toFixed(1);

// 6. Generate Self-Extracting CMD Setup
console.log('==> Step 5: Generating self-extracting installer (.cmd)...');
const b64 = zipBytes.toString('base64').replace(/(.{76})/g, '$1\r\n');

const cmdHeader = `@echo off
setlocal
title Nexa Optimize v${VERSION} - Quick Setup
echo.
echo  ========================================================
echo   NEXA OPTIMIZE v${VERSION} - SELF-EXTRACTING SETUP
echo   Proprietary Freeware - Freeware - All Rights Reserved
echo  ========================================================
echo.
set "NEXA_SETUP_FILE=%~f0"
set "INSTALL_DIR=%LOCALAPPDATA%\\Programs\\Nexa-Optimize"

echo  [1/4] Checking Node.js environment...
where node >nul 2>nul
if errorlevel 1 (
  if exist "%ProgramFiles%\\nodejs\\node.exe" set "PATH=%ProgramFiles%\\nodejs;%PATH%"
  if exist "%LOCALAPPDATA%\\Programs\\nodejs\\node.exe" set "PATH=%LOCALAPPDATA%\\Programs\\nodejs;%PATH%"
)
where node >nul 2>nul
if errorlevel 1 (
  where winget >nul 2>nul
  if not errorlevel 1 (
    echo        Node.js not detected. Auto-installing Node.js LTS via winget...
    winget install OpenJS.NodeJS.LTS --accept-package-agreements --accept-source-agreements --silent
    for /f "tokens=2*" %%A in ('reg query "HKLM\\System\\CurrentControlSet\\Control\\Session Manager\\Environment" /v Path 2^>nul') do set "SYS_PATH=%%B"
    for /f "tokens=2*" %%A in ('reg query "HKCU\\Environment" /v Path 2^>nul') do set "USR_PATH=%%B"
    set "PATH=%ProgramFiles%\\nodejs;%LOCALAPPDATA%\\Programs\\nodejs;%SYS_PATH%;%USR_PATH%;%PATH%"
  )
)

echo  [2/4] Extracting Nexa Optimize v${VERSION} to:
echo        %INSTALL_DIR%
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference = 'Stop'; $lines = Get-Content -LiteralPath $env:NEXA_SETUP_FILE; $idx = [Array]::IndexOf($lines, '::PAYLOAD_BEGIN::'); if ($idx -lt 0) { throw 'Payload marker not found' }; $b64 = ($lines[($idx + 1)..($lines.Length - 1)]) -join ''; $bytes = [Convert]::FromBase64String($b64); $tmpZip = Join-Path $env:TEMP ('Nexa-Optimize-Setup-' + [guid]::NewGuid().ToString('N') + '.zip'); [IO.File]::WriteAllBytes($tmpZip, $bytes); $dest = $env:INSTALL_DIR; if (!(Test-Path $dest)) { New-Item -ItemType Directory -Path $dest -Force | Out-Null }; Expand-Archive -LiteralPath $tmpZip -DestinationPath $dest -Force; Remove-Item -LiteralPath $tmpZip -Force"
if %ERRORLEVEL% NEQ 0 (
  echo  [ERROR] Extraction failed.
  pause
  exit /b 1
)
echo  [3/4] Creating NEXA Desktop and Start Menu shortcuts...
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%INSTALL_DIR%\\Create Shortcut.ps1"
echo  [4/4] Launching Nexa Optimize...
start "" wscript.exe "%INSTALL_DIR%\\NexaOptimize.vbs"
timeout /t 2 >nul 2>nul
exit /b 0
::PAYLOAD_BEGIN::
`;

fs.writeFileSync(setupPath, cmdHeader + b64, 'ascii');
const setupBytes = fs.readFileSync(setupPath);
const setupHash = crypto.createHash('sha256').update(setupBytes).digest('hex');
const setupSize = setupBytes.length;
const setupKb = (setupSize / 1024).toFixed(1);

console.log(`ZIP: ${zipSize} bytes (${zipKb} KB) | SHA256: ${zipHash}`);
console.log(`CMD: ${setupSize} bytes (${setupKb} KB) | SHA256: ${setupHash}`);

// 7. Copy to website/downloads
const webDownloads = path.join(WEB_ROOT, 'downloads');
fs.mkdirSync(webDownloads, { recursive: true });
fs.copyFileSync(zipPath, path.join(webDownloads, `Nexa-Optimize-v${VERSION}.zip`));
fs.copyFileSync(setupPath, path.join(webDownloads, `Nexa-Optimize-Setup-v${VERSION}.cmd`));
fs.copyFileSync(zipPath, path.join(webDownloads, `Nova-Optimize-v${VERSION}.zip`));
fs.copyFileSync(setupPath, path.join(webDownloads, `Nova-Optimize-Setup-v${VERSION}.cmd`));
console.log('==> Step 6: Copied release packages to website/downloads');

// 8. Update website/version.json
const versionJsonPath = path.join(WEB_ROOT, 'version.json');
if (fs.existsSync(versionJsonPath)) {
  const vJson = JSON.parse(fs.readFileSync(versionJsonPath, 'utf8'));
  vJson.version = VERSION;
  vJson.releasedAt = new Date().toISOString().slice(0, 10);
  vJson.downloadUrl = `https://raw.githubusercontent.com/riksitis1/nova-optimize-web/main/downloads/Nexa-Optimize-v${VERSION}.zip`;
  vJson.sha256 = zipHash;
  vJson.notes = [
    'Preview and apply Max FPS profiles for Fortnite, Counter-Strike 2, and Minecraft Java.',
    'Fortnite lowers render scale and quality. CS2 reduces graphics detail and anti-aliasing. Minecraft reduces render and simulation load.',
    'Profiles preserve original settings for restore and skip options absent from your game configuration.',
    'Games links to Windows graphics preferences for dual-GPU PCs.',
  ];
  fs.writeFileSync(versionJsonPath, JSON.stringify(vJson, null, 4), 'utf8');
  console.log(`==> Step 7: Updated website/version.json with new zip SHA-256 and v${VERSION}`);
}

// 9. Update website/index.html with hashes, sizes, and version
const webIndexPath = path.join(WEB_ROOT, 'index.html');
if (fs.existsSync(webIndexPath)) {
  let html = fs.readFileSync(webIndexPath, 'utf8');

  // Update version strings only where they are actual v-prefixed release
  // tokens. Never rewrite arbitrary dotted numbers such as IP addresses or
  // SVG path coordinates.
  html = html.replace(/\bv1\.\d+\.\d+\b/g, `v${VERSION}`);

  html = html.replace(/<span>[\d.]+\s*KB\s*·\s*Self-Extracting Setup<\/span>/, '<span>' + setupKb + ' KB · Self-Extracting Setup</span>');
  html = html.replace(/Self-extracting installer · [\d.]+ KB/, 'Self-extracting installer · ' + setupKb + ' KB');
  html = html.replace(/<span>[\d.]+\s*KB\s*·\s*Portable Archive<\/span>/, '<span>' + zipKb + ' KB · Portable Archive</span>');
  html = html.replace(/Portable archive · [\d.]+ KB/, 'Portable archive · ' + zipKb + ' KB');
  for (const [kind, hash] of [['setup', setupHash], ['zip', zipHash]]) {
    const checksum = new RegExp('(id="hash-' + kind + '">)[a-f0-9]{64}(<\\/code>\\s*<button[^>]+data-copy=")[a-f0-9]{64}');
    html = html.replace(checksum, (_, label, button) => label + hash + button + hash);
  }

  fs.writeFileSync(webIndexPath, html, 'utf8');
  console.log(`==> Step 8: Updated website/index.html with exact hashes, file sizes, and v${VERSION}.`);
}

// Publish the same bytes to the source manifest and local installs.
fs.copyFileSync(path.join(STAGING, 'manifest.json'), path.join(ROOT, 'manifest.json'));
if (syncInstalled) {
  if (!process.env.LOCALAPPDATA) throw new Error('LOCALAPPDATA is required to sync local installs.');
  for (const name of ['Nexa-Optimize', 'Nova-Optimize']) {
    const target = path.join(process.env.LOCALAPPDATA, 'Programs', name);
    if (name === 'Nova-Optimize' && !fs.existsSync(target)) continue;
    for (const rel of [...RUNTIME_FILES, 'manifest.json']) {
      const dest = path.join(target, rel);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.copyFileSync(path.join(STAGING, rel), dest);
    }
    console.log('==> Synced release to ' + target);
  }
}

console.log('==> Production build completed successfully!');
