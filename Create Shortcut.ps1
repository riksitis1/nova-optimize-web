#requires -Version 5.1
<#
  Creates the "NOVA" Desktop (and Start Menu) shortcut with the Nova icon.
  The shortcut starts NovaOptimize.vbs with wscript.exe, so no console window
  appears.
#>

$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$launcher = Join-Path $root 'NovaOptimize.vbs'
$server = Join-Path $root 'server\server.js'
$icon = Join-Path $root 'public\assets\nova.ico'

if (-not (Test-Path -LiteralPath $launcher)) {
  throw 'NovaOptimize.vbs was not found. Keep this script inside the Nova Optimize folder.'
}
if (-not (Test-Path -LiteralPath $server)) {
  throw 'server\server.js was not found. The Nova Optimize folder looks incomplete.'
}

$desktop = [Environment]::GetFolderPath('Desktop')
if ([string]::IsNullOrWhiteSpace($desktop) -or -not (Test-Path -LiteralPath $desktop)) {
  $desktop = Join-Path $env:USERPROFILE 'Desktop'
}

# Remove legacy "Nova Optimize.lnk" if present so only "NOVA" appears
$legacyPath = Join-Path $desktop 'Nova Optimize.lnk'
if (Test-Path -LiteralPath $legacyPath) {
  Remove-Item -LiteralPath $legacyPath -Force -ErrorAction SilentlyContinue
}

$shortcutPath = Join-Path $desktop 'NOVA.lnk'
$wscript = Join-Path $env:SystemRoot 'System32\wscript.exe'

$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = $wscript
$shortcut.Arguments = '"' + $launcher + '"'
$shortcut.WorkingDirectory = $root
$shortcut.WindowStyle = 1
$shortcut.Description = 'NOVA - Free, local-first Windows gaming performance suite'
if (Test-Path -LiteralPath $icon) {
  $shortcut.IconLocation = "$icon,0"
}
$shortcut.Save()

# Also register in Start Menu Programs so searching "NOVA" in Windows Start works
try {
  $startMenu = [Environment]::GetFolderPath('Programs')
  if ($startMenu -and (Test-Path -LiteralPath $startMenu)) {
    $startShortcutPath = Join-Path $startMenu 'NOVA.lnk'
    $startShortcut = $shell.CreateShortcut($startShortcutPath)
    $startShortcut.TargetPath = $wscript
    $startShortcut.Arguments = '"' + $launcher + '"'
    $startShortcut.WorkingDirectory = $root
    $startShortcut.WindowStyle = 1
    $startShortcut.Description = 'NOVA - Free, local-first Windows gaming performance suite'
    if (Test-Path -LiteralPath $icon) {
      $startShortcut.IconLocation = "$icon,0"
    }
    $startShortcut.Save()
  }
} catch { }

Write-Host ''
Write-Host '  Created Desktop shortcut: ' -NoNewline
Write-Host $shortcutPath -ForegroundColor Green
Write-Host '  Double-click the "NOVA" icon on your Desktop to start Nova.'
Write-Host ''
