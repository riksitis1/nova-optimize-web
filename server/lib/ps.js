'use strict';

const { execFile } = require('node:child_process');
const path = require('node:path');
const { promisify } = require('node:util');

const execFileAsync = promisify(execFile);
const BRIDGE = path.join(__dirname, '..', 'scripts', 'bridge.ps1');
const POWERSHELL = process.env.NOVA_POWERSHELL || 'powershell.exe';
const MARKER = 'NOVA_JSON:';

/**
 * Run one operation through the PowerShell bridge.
 * The bridge receives a base64-encoded JSON payload so user data is never
 * interpolated into a command line.
 */
async function runBridge(op, args = {}, options = {}) {
  const payload = Buffer.from(JSON.stringify({ op, args }), 'utf8').toString('base64');
  let stdout = '';
  let stderr = '';
  try {
    const result = await execFileAsync(
      POWERSHELL,
      [
        '-NoLogo',
        '-NoProfile',
        '-NonInteractive',
        '-ExecutionPolicy',
        'Bypass',
        '-File',
        BRIDGE,
        '-Payload',
        payload,
      ],
      {
        timeout: options.timeout ?? 30_000,
        windowsHide: true,
        maxBuffer: 16 * 1024 * 1024,
        encoding: 'utf8',
      },
    );
    stdout = result.stdout;
    stderr = result.stderr;
  } catch (error) {
    stdout = error.stdout || '';
    stderr = error.stderr || error.message || '';
    const markerAt = stdout.lastIndexOf(MARKER);
    if (markerAt !== -1) {
      try {
        const parsed = JSON.parse(stdout.slice(markerAt + MARKER.length).replace(/^\uFEFF/, '').trim());
        if (parsed && parsed.ok === false) throw new Error(parsed.error || 'PowerShell operation failed');
      } catch (parseError) {
        if (parseError.message && parseError.message !== 'Unexpected end of JSON input') {
          throw parseError;
        }
      }
    }
    const detail = String(stderr || stdout || error.message || '').trim();
    throw new Error(detail.slice(0, 1200) || 'PowerShell operation failed');
  }

  const markerAt = stdout.lastIndexOf(MARKER);
  if (markerAt === -1) {
    const detail = String(stderr || stdout || '').trim();
    throw new Error(`PowerShell bridge returned no data${detail ? `: ${detail.slice(0, 800)}` : ''}`);
  }

  let parsed;
  try {
    parsed = JSON.parse(stdout.slice(markerAt + MARKER.length).replace(/^\uFEFF/, '').trim());
  } catch {
    throw new Error('PowerShell bridge returned invalid JSON');
  }
  if (!parsed || parsed.ok !== true) {
    throw new Error((parsed && parsed.error) || 'PowerShell operation failed');
  }
  return parsed.data;
}

async function runPowerShell(script, options = {}) {
  const result = await execFileAsync(
    POWERSHELL,
    ['-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script],
    {
      timeout: options.timeout ?? 60_000,
      windowsHide: true,
      maxBuffer: 8 * 1024 * 1024,
      encoding: 'utf8',
    },
  );
  return result.stdout.trim();
}

module.exports = { runBridge, runPowerShell };
