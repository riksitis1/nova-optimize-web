'use strict';

const { runBridge } = require('./ps');

/**
 * Apps the user may choose to close before a game. This is a fixed allowlist:
 * the UI can only ever ask Nova to close these process names, and they are
 * asked to close politely (like clicking the X), never force-killed.
 *
 * Microsoft Edge is intentionally absent: Nova's own window runs in Edge.
 */
const BOOST_APPS = [
  { name: 'OneDrive', label: 'OneDrive sync' },
  { name: 'Dropbox', label: 'Dropbox sync' },
  { name: 'GoogleDriveFS', label: 'Google Drive sync' },
  { name: 'ms-teams', label: 'Microsoft Teams' },
  { name: 'Teams', label: 'Microsoft Teams (classic)' },
  { name: 'Zoom', label: 'Zoom' },
  { name: 'Slack', label: 'Slack' },
  { name: 'Skype', label: 'Skype' },
  { name: 'Spotify', label: 'Spotify' },
  { name: 'Discord', label: 'Discord' },
  { name: 'chrome', label: 'Google Chrome' },
  { name: 'firefox', label: 'Firefox' },
  { name: 'brave', label: 'Brave' },
  { name: 'opera', label: 'Opera' },
  { name: 'Overwolf', label: 'Overwolf overlay' },
  { name: 'Medal', label: 'Medal.tv recorder' },
];

const BY_NAME = new Map(BOOST_APPS.map((app) => [app.name.toLowerCase(), app]));

function cleanBoostApps(value) {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) throw new Error('Expected a list of app names.');
  const names = [];
  if (value.length > 30) throw new Error('Choose at most 30 apps.');
  for (const raw of value) {
    const app = typeof raw === 'string' ? BY_NAME.get(raw.toLowerCase()) : null;
    if (!app) throw new Error('That app is not on the Nexa pre-game list.');
    if (!names.includes(app.name)) names.push(app.name);
  }
  return names;
}

async function listBoostApps() {
  const running = await runBridge('apps.running', { names: BOOST_APPS.map((app) => app.name) }, { timeout: 20_000 });
  const rows = Array.isArray(running) ? running : running ? [running] : [];
  return rows
    .map((row) => {
      const app = BY_NAME.get(String(row.name).toLowerCase());
      if (!app) return null;
      return { name: app.name, label: app.label, count: row.count, memory: row.memory, cpuPercent: row.cpuPercent };
    })
    .filter(Boolean)
    .sort((a, b) => b.cpuPercent - a.cpuPercent || b.memory - a.memory);
}

async function runBoost(closeApps = []) {
  const names = cleanBoostApps(closeApps);
  if (!names.length) return { closed: [] };
  const result = await runBridge('apps.close', { names }, { timeout: 15_000 });
  return { closed: Array.isArray(result) ? result : result ? [result] : [] };
}

module.exports = { BOOST_APPS, cleanBoostApps, listBoostApps, runBoost };

