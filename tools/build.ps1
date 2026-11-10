param([switch]$SyncInstalled)
$ErrorActionPreference = 'Stop'
$arguments = @((Join-Path $PSScriptRoot 'build.js'))
if ($SyncInstalled) { $arguments += '--sync-installed' }
& node @arguments
if ($LASTEXITCODE -ne 0) { throw 'Nexa build failed.' }
