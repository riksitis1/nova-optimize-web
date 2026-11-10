param([switch]$SkipShortcut)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
function Get-RuntimeSha256([string]$Path) {
  $sha256 = [Security.Cryptography.SHA256]::Create()
  try {
    return [BitConverter]::ToString($sha256.ComputeHash([IO.File]::ReadAllBytes($Path))).Replace('-', '')
  } finally {
    $sha256.Dispose()
  }
}

# Older updaters copy whole directories into existing directories. Repair only
# files that match the new release manifest before the updater restarts Nexa.
$manifestPath = Join-Path $root 'manifest.json'
$nestedFolders = @('public', 'server') | Where-Object {
  Test-Path -LiteralPath (Join-Path $root "$_\$_") -PathType Container
}
if ($nestedFolders -and (Test-Path -LiteralPath $manifestPath -PathType Leaf)) {
  $manifest = Get-Content -Raw -LiteralPath $manifestPath | ConvertFrom-Json
  foreach ($entry in $manifest.files.PSObject.Properties) {
    $parts = $entry.Name.Split('/')
    $folder = $parts[0]
    if ($parts.Count -lt 2 -or $folder -notin $nestedFolders -or
        ($parts | Where-Object { $_ -notmatch '^[A-Za-z0-9_-][A-Za-z0-9_.-]*$' })) { continue }
    $nested = Join-Path (Join-Path $root $folder) ($parts -join '\')
    if (-not (Test-Path -LiteralPath $nested -PathType Leaf)) { continue }
    if ((Get-RuntimeSha256 $nested) -ne $entry.Value) { continue }
    $target = Join-Path $root ($parts -join '\')
    if ((Test-Path -LiteralPath $target -PathType Leaf) -and
        (Get-RuntimeSha256 $target) -eq $entry.Value) { continue }
    [void][IO.Directory]::CreateDirectory((Split-Path -Parent $target))
    Copy-Item -LiteralPath $nested -Destination $target -Force
  }
}
if ($SkipShortcut) { return }

$launcher = Join-Path $root 'NexaOptimize.vbs'
$server = Join-Path $root 'server\server.js'
$icon = Join-Path $root 'public\assets\nexa.ico'
if (-not (Test-Path -LiteralPath $launcher)) {
  throw 'NexaOptimize.vbs was not found. Keep this script inside the Nova Optimize folder.'
}
if (-not (Test-Path -LiteralPath $server)) {
  throw 'server\server.js was not found. The Nova Optimize folder looks incomplete.'
}
$desktop = [Environment]::GetFolderPath('Desktop')
if ([string]::IsNullOrWhiteSpace($desktop) -or -not (Test-Path -LiteralPath $desktop)) {
  $desktop = Join-Path $env:USERPROFILE 'Desktop'
}
$legacyPaths = @(
  (Join-Path $desktop 'Nova Optimize.lnk'),
  (Join-Path $desktop 'NOVA.lnk'),
  (Join-Path $desktop 'Nexa Optimize.lnk')
)
foreach ($lp in $legacyPaths) {
  if (Test-Path -LiteralPath $lp) {
    Remove-Item -LiteralPath $lp -Force -ErrorAction SilentlyContinue
  }
}
$shortcutPath = Join-Path $desktop 'NEXA.lnk'
$wscript = Join-Path $env:SystemRoot 'System32\wscript.exe'
$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = $wscript
$shortcut.Arguments = '"' + $launcher + '"'
$shortcut.WorkingDirectory = $root
$shortcut.WindowStyle = 1
$shortcut.Description = 'NEXA - Free, local-first Windows gaming performance suite'
if (Test-Path -LiteralPath $icon) {
  $shortcut.IconLocation = "$icon,0"
}
$shortcut.Save()

try {
  $bytes = [System.IO.File]::ReadAllBytes($shortcutPath)
  $bytes[0x15] = $bytes[0x15] -bor 0x20
  [System.IO.File]::WriteAllBytes($shortcutPath, $bytes)
} catch { }

try {
  $startMenu = [Environment]::GetFolderPath('Programs')
  if ($startMenu -and (Test-Path -LiteralPath $startMenu)) {
    $startShortcutPath = Join-Path $startMenu 'NEXA.lnk'
    $startShortcut = $shell.CreateShortcut($startShortcutPath)
    $startShortcut.TargetPath = $wscript
    $startShortcut.Arguments = '"' + $launcher + '"'
    $startShortcut.WorkingDirectory = $root
    $startShortcut.WindowStyle = 1
    $startShortcut.Description = 'NEXA - Free, local-first Windows gaming performance suite'
    if (Test-Path -LiteralPath $icon) {
      $startShortcut.IconLocation = "$icon,0"
    }
    $startShortcut.Save()
    try {
      $sBytes = [System.IO.File]::ReadAllBytes($startShortcutPath)
      $sBytes[0x15] = $sBytes[0x15] -bor 0x20
      [System.IO.File]::WriteAllBytes($startShortcutPath, $sBytes)
    } catch { }
  }
} catch { }
Write-Host ''
Write-Host '  Created Desktop shortcut: ' -NoNewline
Write-Host $shortcutPath -ForegroundColor Green
Write-Host '  Double-click the "NEXA" icon on your Desktop to start Nexa.'
Write-Host ''