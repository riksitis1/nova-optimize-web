@echo off
setlocal
title Nexa Optimize - Setup
cd /d "%~dp0"

echo.
echo   ========================================================
echo     Nexa Optimize v1.4.0 - Local Setup
echo     Free, local-first Windows 10/11 gaming performance
echo   ========================================================
echo.
echo   NOTICE: Proprietary Freeware — Free for personal use. All Rights Reserved.
echo   Provided strictly "AS IS" without warranty of any kind. Use at your own risk.
echo.

where node >nul 2>nul
if errorlevel 1 (
  if exist "%ProgramFiles%\nodejs\node.exe" (
    set "PATH=%ProgramFiles%\nodejs;%PATH%"
  ) else if exist "%LOCALAPPDATA%\Programs\nodejs\node.exe" (
    set "PATH=%LOCALAPPDATA%\Programs\nodejs;%PATH%"
  )
)

where node >nul 2>nul
if errorlevel 1 (
  echo   [!] Node.js 18+ was not found on your PATH.
  where winget >nul 2>nul
  if not errorlevel 1 (
    echo   Installing Node.js LTS automatically via Windows Package Manager (winget)...
    winget install OpenJS.NodeJS.LTS --accept-package-agreements --accept-source-agreements --silent
    for /f "tokens=2*" %%A in ('reg query "HKLM\System\CurrentControlSet\Control\Session Manager\Environment" /v Path 2^>nul') do set "SYS_PATH=%%B"
    for /f "tokens=2*" %%A in ('reg query "HKCU\Environment" /v Path 2^>nul') do set "USR_PATH=%%B"
    set "PATH=%ProgramFiles%\nodejs;%LOCALAPPDATA%\Programs\nodejs;%SYS_PATH%;%USR_PATH%;%PATH%"
  ) else (
    echo   Please install Node.js 18 LTS or newer from https://nodejs.org/
  )
)

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo   [NOTICE] Node.js is not yet recognized in this active console session.
  echo   If winget just installed Node.js, close this window and launch Nova via
  echo   the Desktop shortcut or Start Nexa.bat.
  echo.
)

echo.
echo   Creating Desktop shortcut...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0Create Shortcut.ps1"
if errorlevel 1 (
  echo   [!] Could not create Desktop shortcut automatically.
  echo   You can still launch Nova anytime using "Start Nexa.bat".
) else (
  echo   [OK] Desktop shortcut created.
)

echo.
set /p LAUNCH_NOW="  Launch Nexa Optimize now? [Y/N] (default Y): "
if "%LAUNCH_NOW%"=="" set LAUNCH_NOW=Y
if /i "%LAUNCH_NOW%"=="Y" (
  start "" wscript.exe "%~dp0NexaOptimize.vbs"
  echo.
  echo   Nexa Optimize is starting in its own window...
)

echo.
pause
exit /b 0

