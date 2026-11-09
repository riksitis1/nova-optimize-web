@echo off
setlocal
title Nova Optimize
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 goto missing

node -e "process.exit(Number(process.versions.node.split('.')[0]) >= 18 ? 0 : 1)" >nul 2>nul
if errorlevel 1 goto oldnode

if not exist "%USERPROFILE%\Desktop\NOVA.lnk" (
  powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0Create Shortcut.ps1" >nul 2>nul
)

echo.
echo   Starting Nova Optimize...
echo   Keep this window open while you use Nova.
echo   Close it or press Ctrl+C to stop the local server.
echo.
node --max-old-space-size=96 server\server.js
if errorlevel 1 (
  echo.
  echo   Nova stopped with an error. The message above explains why.
  pause
)
exit /b 0

:missing
echo.
echo   Nova needs Node.js 18 or newer.
echo.
echo   Install the LTS version from https://nodejs.org/ and run this file again.
echo.
pause
exit /b 1

:oldnode
echo.
echo   This PC has an old version of Node.js.
echo.
echo   Install Node.js 18 or newer from https://nodejs.org/ and run this file again.
echo.
pause
exit /b 1
