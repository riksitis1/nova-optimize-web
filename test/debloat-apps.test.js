'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const ps = require('../server/lib/ps');

let bridge;
const originalBridge = ps.runBridge;
ps.runBridge = (...args) => bridge(...args);
const { cleanOptionalAppIds, listOptionalApps, removeOptionalApp, removeOptionalApps } = require('../server/lib/system');
ps.runBridge = originalBridge;

const news = 'Microsoft.BingNews';
const clipchamp = 'Clipchamp.Clipchamp';
const teams = 'MSTeams';

test('optional app selection accepts exact allowlisted IDs and preserves order', () => {
  assert.deepEqual(cleanOptionalAppIds([teams, news, teams, clipchamp]), [teams, news, clipchamp]);
  for (const protectedId of [
    'Microsoft.WindowsStore',
    'Microsoft.XboxGamingOverlay',
    'Microsoft.GamingServices',
    'Microsoft.VCLibs.140.00',
    'Microsoft.Windows.SecHealthUI',
    'NVIDIACorp.NVIDIAControlPanel',
    'Microsoft.*',
  ]) {
    assert.throws(() => cleanOptionalAppIds([protectedId]), /optional Windows apps list/);
  }
});

test('optional app inventory requires the expected package publisher', async () => {
  bridge = async (op, { families }) => {
    assert.equal(op, 'optionalApps.list');
    assert.ok(families.includes(clipchamp + '_yxz26nhyzhsrt'));
    assert.ok(!families.includes(clipchamp + '_8wekyb3d8bbwe'));
    return [news + '_8wekyb3d8bbwe', clipchamp + '_8wekyb3d8bbwe', 'Microsoft.WindowsStore_8wekyb3d8bbwe'];
  };
  const apps = await listOptionalApps();
  assert.deepEqual(apps.map(({ id }) => id), [news]);
  assert.match(apps[0].storeUrl, /^ms-windows-store:\/\/search\/\?query=/);
});

test('batch and legacy removal report confirmed outcomes without losing item failures', async () => {
  bridge = async (op, { families }) => {
    assert.equal(op, 'optionalApps.removeBatch');
    assert.deepEqual(families, [news + '_8wekyb3d8bbwe', clipchamp + '_yxz26nhyzhsrt', teams + '_8wekyb3d8bbwe']);
    return [
      { family: families[2], status: 'absent' },
      { family: families[0], status: 'removed' },
      { family: families[1], status: 'failed', error: 'Package in use.' },
    ];
  };
  assert.deepEqual((await removeOptionalApps([news, clipchamp, teams])).map(({ id, status, error }) => [id, status, error]), [
    [news, 'removed', undefined],
    [clipchamp, 'failed', 'Package in use.'],
    [teams, 'absent', undefined],
  ]);
  assert.deepEqual(await removeOptionalApps([]), []);

  bridge = async (op, { families }) => [{ family: families[0], status: 'removed' }];
  assert.equal(await removeOptionalApp(news), true);
  bridge = async (op, { families }) => [{ family: families[0], status: 'absent' }];
  assert.equal(await removeOptionalApp(news), false);
  bridge = async () => { throw new Error('Appx unavailable.'); };
  await assert.rejects(removeOptionalApp(news), /Could not confirm removal/);
});

test('PowerShell batch prefers bundles, skips protected packages and continues after failures', {
  skip: process.platform !== 'win32',
}, () => {
  const names = [news, clipchamp, teams, 'Microsoft.BingWeather', 'Microsoft.Getstarted'];
  const families = names.map((id) => id + (id === clipchamp ? '_yxz26nhyzhsrt' : '_8wekyb3d8bbwe'));
  const script = String.raw`
$ErrorActionPreference = 'Stop'
$families = @(($env:NEXA_TEST_FAMILIES | ConvertFrom-Json))
function New-MockPackage([string]$Family, [string]$FullName, [bool]$Bundle, [bool]$Protected = $false) {
  [pscustomobject]@{
    PackageFamilyName = $Family
    PackageFullName = $FullName
    IsBundle = $Bundle
    NonRemovable = $Protected
    IsFramework = $false
    IsResourcePackage = $false
  }
}
function Get-AppxPackage {
  [CmdletBinding()]
  param([string[]]$PackageTypeFilter)
  if ($PackageTypeFilter -join ',' -ne 'Main,Bundle') { throw 'Expected main and bundle package types.' }
  if ($env:NEXA_TEST_KEEP_NEWS -eq '1' -or -not $recordedRemovals.Contains('news_bundle')) {
    New-MockPackage $families[0] 'news_main' $false
    New-MockPackage $families[0] 'news_bundle' $true
  }
  New-MockPackage 'Clipchamp.Clipchamp_8wekyb3d8bbwe' 'clipchamp_wrong_publisher' $true
  New-MockPackage $families[2] 'teams_ok' $true
  New-MockPackage $families[2] 'teams_busy' $true
  if (-not $recordedRemovals.Contains('weather_bundle')) { New-MockPackage $families[3] 'weather_bundle' $true }
  New-MockPackage $families[4] 'tips_main' $false
  New-MockPackage $families[4] 'tips_bundle' $true $true
}
$recordedRemovals = New-Object 'System.Collections.Generic.List[string]'
function Remove-AppxPackage {
  [CmdletBinding()]
  param([string]$Package)
  $recordedRemovals.Add($Package)
  if ($Package -eq 'teams_busy') { throw 'Package in use.' }
}
& $env:NEXA_TEST_BRIDGE -Payload $env:NEXA_TEST_PAYLOAD
if ($recordedRemovals -join ',' -ne 'news_bundle,teams_ok,teams_busy,weather_bundle') { throw ('Unexpected targets: ' + ($recordedRemovals -join ', ')) }
`;
  const payload = Buffer.from(JSON.stringify({ op: 'optionalApps.removeBatch', args: { families } })).toString('base64');
  const result = spawnSync('powershell.exe', [
    '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand',
    Buffer.from(script, 'utf16le').toString('base64'),
  ], {
    encoding: 'utf8',
    timeout: 15_000,
    windowsHide: true,
    env: {
      ...process.env,
      NEXA_TEST_FAMILIES: JSON.stringify(families),
      NEXA_TEST_PAYLOAD: payload,
      NEXA_TEST_BRIDGE: path.resolve(__dirname, '../server/scripts/bridge.ps1'),
    },
  });
  assert.equal(result.status, 0, [result.stdout, result.stderr, result.error?.message].filter(Boolean).join(String.fromCharCode(10)));
  const line = result.stdout.split(/\r?\n/).find((value) => value.startsWith('NOVA_JSON:'));
  assert.ok(line, result.stdout);
  const response = JSON.parse(line.slice('NOVA_JSON:'.length));
  assert.equal(response.ok, true);
  assert.deepEqual(response.data.map(({ status }) => status), ['removed', 'absent', 'failed', 'removed', 'failed']);
  assert.match(response.data[2].error, /Only some installed packages were removed.*Package in use/);
  assert.match(response.data[4].error, /does not allow/);
  const unchanged = spawnSync('powershell.exe', [
    '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand',
    Buffer.from(script, 'utf16le').toString('base64'),
  ], {
    encoding: 'utf8', timeout: 15_000, windowsHide: true,
    env: {
      ...process.env, NEXA_TEST_KEEP_NEWS: '1', NEXA_TEST_FAMILIES: JSON.stringify(families),
      NEXA_TEST_PAYLOAD: payload, NEXA_TEST_BRIDGE: path.resolve(__dirname, '../server/scripts/bridge.ps1'),
    },
  });
  assert.equal(unchanged.status, 0, unchanged.stderr);
  const stillInstalled = JSON.parse(unchanged.stdout.split(/\r?\n/).find((value) => value.startsWith('NOVA_JSON:')).slice('NOVA_JSON:'.length));
  assert.equal(stillInstalled.data[0].status, 'failed');
  assert.match(stillInstalled.data[0].error, /still lists this app/);
});
