# Rebuild Nova Optimize Release Packages and Sync Local & Website
$ErrorActionPreference = 'Stop'
$root = "C:\Users\Riko\Desktop\pc optimize"
Set-Location $root

Write-Host "==> Running syntax check and unit tests..."
node tools/check.js
if ($LASTEXITCODE -ne 0) { throw "check.js failed" }
node tools/test.js
if ($LASTEXITCODE -ne 0) { throw "test.js failed" }

$dist = Join-Path $root "dist"
if (-not (Test-Path $dist)) { New-Item -ItemType Directory -Path $dist -Force | Out-Null }
$zipPath = Join-Path $dist "Nova-Optimize-v1.4.0.zip"
$setupPath = Join-Path $dist "Nova-Optimize-Setup-v1.4.0.cmd"

Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

$relFiles = @(
  "Create Shortcut.ps1",
  "Install Nova.bat",
  "LICENSE",
  "NovaOptimize.vbs",
  "package.json",
  "README.md",
  "SECURITY.md",
  "Start Nova.bat",
  "public\app.js",
  "public\index.html",
  "public\styles.css",
  "public\assets\logo.svg",
  "public\assets\nova.ico",
  "public\js\boost.js",
  "public\js\core.js",
  "public\js\ui.js",
  "public\js\pages\activity.js",
  "public\js\pages\cleanup.js",
  "public\js\pages\games.js",
  "public\js\pages\network.js",
  "public\js\pages\optimize.js",
  "public\js\pages\overview.js",
  "public\js\pages\settings.js",
  "public\js\pages\startup.js",
  "server\server.js",
  "server\lib\actions.js",
  "server\lib\analyze.js",
  "server\lib\boost.js",
  "server\lib\games.js",
  "server\lib\network.js",
  "server\lib\ps.js",
  "server\lib\store.js",
  "server\lib\system.js",
  "server\lib\updater.js",
  "server\lib\validate.js",
  "server\scripts\bridge.ps1",
  "test\actions.test.js",
  "test\analyze.test.js",
  "test\fixtures.js",
  "test\games.test.js",
  "test\modules.test.js",
  "test\network.test.js",
  "test\validate.test.js",
  "tools\check.js",
  "tools\test.js"
)

if (Test-Path $zipPath) { Remove-Item -Force $zipPath }
$zip = [System.IO.Compression.ZipFile]::Open($zipPath, [System.IO.Compression.ZipArchiveMode]::Create)
foreach ($rel in $relFiles) {
  $src = Join-Path $root $rel
  if (-not (Test-Path -LiteralPath $src)) {
    throw "Missing required file: $src"
  }
  [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, $src, $rel, [System.IO.Compression.CompressionLevel]::Optimal) | Out-Null
}
$zip.Dispose()
Write-Host "Created $zipPath"

$zipBytes = [System.IO.File]::ReadAllBytes($zipPath)
$b64 = [Convert]::ToBase64String($zipBytes, [Base64FormattingOptions]::InsertLineBreaks)

$cmdHeader = @"
@echo off
setlocal
title Nova Optimize v1.4.0 — Quick Setup
echo.
echo  ========================================================
echo   NOVA OPTIMIZE v1.4.0 — SELF-EXTRACTING SETUP
echo  ========================================================
echo.
set "INSTALL_DIR=%LOCALAPPDATA%\Programs\Nova-Optimize"

echo  [1/4] Checking Node.js environment...
where node >nul 2>nul
if errorlevel 1 (
  if exist "%ProgramFiles%\nodejs\node.exe" set "PATH=%ProgramFiles%\nodejs;%PATH%"
  if exist "%LOCALAPPDATA%\Programs\nodejs\node.exe" set "PATH=%LOCALAPPDATA%\Programs\nodejs;%PATH%"
)
where node >nul 2>nul
if errorlevel 1 (
  where winget >nul 2>nul
  if not errorlevel 1 (
    echo        Node.js not detected. Auto-installing Node.js LTS via winget...
    winget install OpenJS.NodeJS.LTS --accept-package-agreements --accept-source-agreements --silent
    for /f "tokens=2*" %%A in ('reg query "HKLM\System\CurrentControlSet\Control\Session Manager\Environment" /v Path 2^>nul') do set "SYS_PATH=%%B"
    for /f "tokens=2*" %%A in ('reg query "HKCU\Environment" /v Path 2^>nul') do set "USR_PATH=%%B"
    set "PATH=%ProgramFiles%\nodejs;%LOCALAPPDATA%\Programs\nodejs;%SYS_PATH%;%USR_PATH%;%PATH%"
  )
)

echo  [2/4] Extracting Nova Optimize v1.4.0 to:
echo        %INSTALL_DIR%
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "`$ErrorActionPreference = 'Stop'; `$lines = Get-Content -LiteralPath '%~f0'; `$idx = [Array]::IndexOf(`$lines, '::PAYLOAD_BEGIN::'); if (`$idx -lt 0) { throw 'Payload marker not found' }; `$b64 = (`$lines[(`$idx + 1)..(`$lines.Length - 1)]) -join ''; `$bytes = [Convert]::FromBase64String(`$b64); `$tmpZip = Join-Path `$env:TEMP ('Nova-Optimize-Setup-' + [guid]::NewGuid().ToString('N') + '.zip'); [IO.File]::WriteAllBytes(`$tmpZip, `$bytes); `$dest = `$env:INSTALL_DIR; if (!(Test-Path `$dest)) { New-Item -ItemType Directory -Path `$dest -Force | Out-Null }; Expand-Archive -LiteralPath `$tmpZip -DestinationPath `$dest -Force; Remove-Item -LiteralPath `$tmpZip -Force"
if %ERRORLEVEL% NEQ 0 (
  echo  [ERROR] Extraction failed.
  pause
  exit /b 1
)
echo  [3/4] Creating NOVA Desktop and Start Menu shortcuts...
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%INSTALL_DIR%\Create Shortcut.ps1"
echo  [4/4] Launching Nova Optimize...
cd /d "%INSTALL_DIR%"
call "%INSTALL_DIR%\Install Nova.bat"
exit /b 0
::PAYLOAD_BEGIN::
"@

[System.IO.File]::WriteAllText($setupPath, "$cmdHeader`r`n$b64", [System.Text.Encoding]::ASCII)
Write-Host "Created $setupPath"

# Copy to website/downloads
$webDownloads = Join-Path $root "website\downloads"
if (-not (Test-Path $webDownloads)) { New-Item -ItemType Directory -Path $webDownloads -Force | Out-Null }
Copy-Item -Path $zipPath -Destination (Join-Path $webDownloads "Nova-Optimize-v1.4.0.zip") -Force
Copy-Item -Path $setupPath -Destination (Join-Path $webDownloads "Nova-Optimize-Setup-v1.4.0.cmd") -Force
Write-Host "Copied to website/downloads"

# Sync to %LOCALAPPDATA%\Programs\Nova-Optimize
$installedProg = "$env:LOCALAPPDATA\Programs\Nova-Optimize"
if (Test-Path $installedProg) {
  foreach ($rel in $relFiles) {
    $src = Join-Path $root $rel
    $dst = Join-Path $installedProg $rel
    $dstDir = Split-Path -Parent $dst
    if (-not (Test-Path $dstDir)) { New-Item -ItemType Directory -Path $dstDir -Force | Out-Null }
    Copy-Item -Path $src -Destination $dst -Force
  }
  Write-Host "Synced runtime files to $installedProg"
}

# Hashes and sizes
$zipHash = (Get-FileHash $zipPath -Algorithm SHA256).Hash.ToLower()
$zipSize = (Get-Item $zipPath).Length
$setupHash = (Get-FileHash $setupPath -Algorithm SHA256).Hash.ToLower()
$setupSize = (Get-Item $setupPath).Length

Write-Host "ZIP: $zipSize bytes | SHA256: $zipHash"
Write-Host "CMD: $setupSize bytes | SHA256: $setupHash"

# Update website/version.json
$versionJsonPath = Join-Path $root "website\version.json"
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
if (Test-Path $versionJsonPath) {
  $vJson = Get-Content $versionJsonPath -Raw | ConvertFrom-Json
  $vJson.sha256 = $zipHash
  $jsonStr = $vJson | ConvertTo-Json -Depth 5
  [System.IO.File]::WriteAllText($versionJsonPath, $jsonStr, $utf8NoBom)
  Write-Host "Updated website/version.json with new zip sha256"
}

# Update website/index.html hashes and sizes
$webIndexPath = Join-Path $root "website\index.html"
if (Test-Path $webIndexPath) {
  $html = Get-Content $webIndexPath -Raw -Encoding UTF8
  # Setup hash and size
  $setupKb = [Math]::Round($setupSize / 1024, 1)
  $zipKb = [Math]::Round($zipSize / 1024, 1)
  
  $html = [regex]::Replace($html, '<span>[\d\.]+\s*KB\s*·\s*Self-Extracting Setup</span>', "<span>$setupKb KB · Self-Extracting Setup</span>")
  $html = [regex]::Replace($html, 'id="hash-setup">([a-f0-9]{64})<', "id=`"hash-setup`">$setupHash<")
  $html = [regex]::Replace($html, 'data-copy="([a-f0-9]{64})"(\s*>Copy Hash</button>\s*</div>\s*</div>\s*<div class="checksum-card">)', "data-copy=`"$setupHash`"`$2")
  
  $html = [regex]::Replace($html, '<span>[\d\.]+\s*KB\s*·\s*Portable Source Archive</span>', "<span>$zipKb KB · Portable Source Archive</span>")
  $html = [regex]::Replace($html, 'id="hash-zip">([a-f0-9]{64})<', "id=`"hash-zip`">$zipHash<")
  $html = [regex]::Replace($html, 'data-copy="([a-f0-9]{64})"(\s*>Copy Hash</button>\s*</div>\s*</div>\s*<div class="verify-cmd-box">)', "data-copy=`"$zipHash`"`$2")
  
  [System.IO.File]::WriteAllText($webIndexPath, $html, $utf8NoBom)
  Write-Host "Updated website/index.html with new hashes and file sizes"
}

Write-Host "Build and sync completed successfully."

