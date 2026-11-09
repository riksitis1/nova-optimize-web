'use strict';

const { runBridge } = require('./ps');
const { trimMemory } = require('./system');

/**
 * Apps the user may choose to close before a game. This is a fixed allowlist:
 * the UI can only ever ask Nova to close these process names, and they are
 * asked to close politely (like clicking the X), never force-killed.
 *
 * Microsoft Edge is intentionally absent: Nova's own window runs in Edge.
 */
const BOOST_APPS = [
  { name: 'OneDrive', label: 'OneDrive sync', defaultOn: true },
  { name: 'Dropbox', label: 'Dropbox sync', defaultOn: true },
  { name: 'GoogleDriveFS', label: 'Google Drive sync', defaultOn: true },
  { name: 'PhoneExperienceHost', label: 'Phone Link sync', defaultOn: true },
  { name: 'Widgets', label: 'Windows 11 Widgets', defaultOn: true },
  { name: 'GameBarPresenceWriter', label: 'Xbox Game Bar background writer', defaultOn: true },
  { name: 'ms-teams', label: 'Microsoft Teams', defaultOn: true },
  { name: 'Teams', label: 'Microsoft Teams (classic)', defaultOn: true },
  { name: 'Zoom', label: 'Zoom', defaultOn: true },
  { name: 'Slack', label: 'Slack', defaultOn: false },
  { name: 'Skype', label: 'Skype', defaultOn: false },
  { name: 'Spotify', label: 'Spotify', defaultOn: false },
  { name: 'Discord', label: 'Discord', defaultOn: false },
  { name: 'chrome', label: 'Google Chrome', defaultOn: false },
  { name: 'firefox', label: 'Firefox', defaultOn: false },
  { name: 'brave', label: 'Brave', defaultOn: false },
  { name: 'opera', label: 'Opera', defaultOn: false },
  { name: 'EpicGamesLauncher', label: 'Epic Games Launcher', defaultOn: false },
  { name: 'steam', label: 'Steam', defaultOn: false },
  { name: 'Battle.net', label: 'Battle.net', defaultOn: false },
  { name: 'GalaxyClient', label: 'GOG Galaxy', defaultOn: false },
  { name: 'RiotClientServices', label: 'Riot Client', defaultOn: false },
  { name: 'Overwolf', label: 'Overwolf overlay', defaultOn: false },
  { name: 'Medal', label: 'Medal.tv recorder', defaultOn: false },
];

const BY_NAME = new Map(BOOST_APPS.map((app) => [app.name.toLowerCase(), app]));

function cleanBoostApps(value) {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) throw new Error('Expected a list of app names.');
  const names = [];
  for (const raw of value.slice(0, 30)) {
    const app = typeof raw === 'string' ? BY_NAME.get(raw.toLowerCase()) : null;
    if (!app) throw new Error('That app is not on the Nova pre-game list.');
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
      return { name: app.name, label: app.label, defaultOn: app.defaultOn, count: row.count, memory: row.memory };
    })
    .filter(Boolean);
}

async function runBoost(closeApps = []) {
  const names = cleanBoostApps(closeApps);
  let closed = [];
  if (names.length) {
    const result = await runBridge('apps.close', { names }, { timeout: 40_000 });
    closed = Array.isArray(result) ? result : result ? [result] : [];
  }
  let dnsFlushed = true;
  try {
    await runBridge('dns.flush', {}, { timeout: 20_000 });
  } catch {
    dnsFlushed = false;
  }
  let memory = null;
  try {
    memory = await trimMemory();
  } catch {
    memory = null;
  }
  return { closed, dnsFlushed, memory };
}

module.exports = { BOOST_APPS, cleanBoostApps, listBoostApps, runBoost };

