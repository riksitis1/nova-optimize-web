const ICONS = {
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  spark: '<path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3L12 3z"/>',
  pulse: '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>',
  broom: '<path d="m19 3-5.5 5.5"/><path d="m14 7-8 8 3 3 8-8"/><path d="m6 15-3 6 6-3"/><path d="m9 18 3 3"/>',
  rocket: '<path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/>',
  sliders: '<path d="M4 6h16"/><path d="M4 12h16"/><path d="M4 18h16"/><circle cx="9" cy="6" r="2"/><circle cx="15" cy="12" r="2"/><circle cx="8" cy="18" r="2"/>',
  history: '<circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 15"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3 1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"/>',
  power: '<path d="M18.36 6.64a9 9 0 1 1-12.73 0"/><line x1="12" y1="2" x2="12" y2="12"/>',
  menu: '<line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="18" y2="18"/>',
  refresh: '<path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 16h5v5"/>',
  scan: '<path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/><line x1="7" y1="12" x2="17" y2="12"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/>',
  cpu: '<rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><path d="M9 1v3"/><path d="M15 1v3"/><path d="M9 20v3"/><path d="M15 20v3"/><path d="M20 9h3"/><path d="M20 14h3"/><path d="M1 9h3"/><path d="M1 14h3"/>',
  gpu: '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M6 19v2"/><path d="M10 19v2"/><path d="M14 19v2"/><circle cx="8" cy="12" r="2.5"/><circle cx="16" cy="12" r="2.5"/>',
  memory: '<rect x="2" y="7" width="20" height="10" rx="1.5"/><path d="M6 7V4"/><path d="M10 7V4"/><path d="M14 7V4"/><path d="M18 7V4"/><path d="M6 17v3"/><path d="M10 17v3"/><path d="M14 17v3"/><path d="M18 17v3"/><circle cx="6.5" cy="12" r="1"/><circle cx="11.5" cy="12" r="1"/><circle cx="16.5" cy="12" r="1"/>',
  disk: '<line x1="22" x2="2" y1="12" y2="12"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/><line x1="6" x2="6.01" y1="16" y2="16"/><line x1="10" x2="10.01" y1="16" y2="16"/>',
  wifi: '<path d="M5 12.5a10 10 0 0 1 14 0"/><path d="M8.5 16a5 5 0 0 1 7 0"/><line x1="12" y1="20" x2="12.01" y2="20"/><path d="M2 8.5a15 15 0 0 1 20 0"/>',
  ethernet: '<rect x="5" y="9" width="14" height="10" rx="2"/><path d="M8 9V5h8v4"/><line x1="9" y1="14" x2="10" y2="14"/><line x1="14" y1="14" x2="15" y2="14"/><line x1="12" y1="19" x2="12" y2="22"/>',
  clock: '<circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 15"/>',
  check: '<polyline points="20 6 9 17 4 12"/>',
  alert: '<path d="M12 3 2.8 20h18.4L12 3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
  info: '<circle cx="12" cy="12" r="9"/><line x1="12" y1="11" x2="12" y2="16"/><line x1="12" y1="8" x2="12.01" y2="8"/>',
  x: '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
  chevron: '<polyline points="9 18 15 12 9 6"/>',
  external: '<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>',
  lock: '<rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  zap: '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
  upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>',
  globe: '<circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>',
  server: '<rect x="2" y="2" width="20" height="8" rx="2" ry="2"/><rect x="2" y="14" width="20" height="8" rx="2" ry="2"/><line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/>',
  play: '<polygon points="5 3 19 12 5 21 5 3"/>',
  stop: '<rect x="4" y="4" width="16" height="16" rx="2"/>',
  trash: '<polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/>',
  undo: '<path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/>',
  arrow: '<line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>',
  search: '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>',
  copy: '<rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  folder: '<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>',
  gauge: '<path d="M12 2a10 10 0 1 0 10 10H12V2z"/><circle cx="12" cy="12" r="10"/>',
  thermometer: '<path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z"/>',
  user: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  key: '<path d="m21 2-2 2m-1.5 1.5L16 7l-1.5-1.5-1.5 1.5 1.5 1.5L13 10l-1.5-1.5L10 10l-1.5-1.5L7 10"/><circle cx="7.5" cy="16.5" r="4.5"/>',
  plus: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
  target: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
  activity: '<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>',
  monitor: '<rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>',
  beaker: '<path d="M4.5 3h15"/><path d="M6 3v16a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V3"/><line x1="6" y1="14" x2="18" y2="14"/>',
  star: '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>',
  list: '<line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>',
  gamepad: '<line x1="6" x2="10" y1="12" y2="12"/><line x1="8" x2="8" y1="10" y2="14"/><line x1="15" x2="15.01" y1="13" y2="13"/><line x1="18" x2="18.01" y1="11" y2="11"/><rect width="20" height="12" x="2" y="6" rx="3"/>',
};

export const DEFAULT_TARGETS = [
  { id: 'epic', game: 'Fortnite / Epic', region: 'Global', host: 'matchmaking.epicgames.com', port: 443, protocol: 'tcp', note: 'Epic matchmaking route' },
  { id: 'steam', game: 'CS2 / Steam', region: 'Global', host: 'steamcommunity.com', port: 443, protocol: 'tcp', note: 'Steam network route' },
  { id: 'riot-na', game: 'Valorant / Riot', region: 'NA', host: 'na1.api.riotgames.com', port: 443, protocol: 'tcp', note: 'Valorant / League service route' },
  { id: 'riot-euw', game: 'Valorant / Riot', region: 'EUW', host: 'euw1.api.riotgames.com', port: 443, protocol: 'tcp', note: 'Valorant / League service route' },
  { id: 'riot-kr', game: 'Valorant / Riot', region: 'KR', host: 'kr.api.riotgames.com', port: 443, protocol: 'tcp', note: 'Valorant / League service route' },
  { id: 'minecraft-hypixel', game: 'Minecraft', region: 'Hypixel', host: 'mc.hypixel.net', port: 25565, protocol: 'tcp', note: 'Actual Hypixel game port' },
  { id: 'roblox', game: 'Roblox', region: 'Global', host: 'roblox.com', port: 443, protocol: 'tcp', note: 'Roblox service route' },
  { id: 'ea', game: 'Apex / EA', region: 'Global', host: 'ea.com', port: 443, protocol: 'tcp', note: 'EA service route' },
  { id: 'call-of-duty', game: 'Call of Duty', region: 'Global', host: 'callofduty.com', port: 443, protocol: 'tcp', note: 'Activision service route' },
  { id: 'blizzard', game: 'Overwatch / Blizzard', region: 'Global', host: 'blizzard.com', port: 443, protocol: 'tcp', note: 'Blizzard service route' },
  { id: 'discord', game: 'Discord', region: 'Global', host: 'discord.com', port: 443, protocol: 'tcp', note: 'Voice chat service route' },
  { id: 'cloudflare', game: 'Cloudflare', region: 'Internet', host: '1.1.1.1', port: 443, protocol: 'icmp', note: 'Global internet baseline' },
  { id: 'google', game: 'Google', region: 'Internet', host: '8.8.8.8', port: 443, protocol: 'icmp', note: 'Global internet baseline' },
  { id: 'quad9', game: 'Quad9', region: 'Internet', host: '9.9.9.9', port: 443, protocol: 'icmp', note: 'Global internet baseline' },
];

export const state = {
  token:
    new URLSearchParams(window.location.search).get('token') ||
    document.querySelector('meta[name="nexa-token"]')?.getAttribute('content') ||
    '',
  version: '1.10.0',
  port: null,
  dataDir: '',
  settings: {},
  page: 'dashboard',
  snapshot: null,
  scan: null,
  applied: {},
  games: null,
  gameSelections: {},
  scanLoading: null,
  telemetry: null,
  telemetryHistory: { cpu: [], memory: [] },
  processes: null,
  processSort: 'memory',
  optimizeFilter: 'all',
  targets: [...DEFAULT_TARGETS],
  pingResults: {},
  selectedTarget: null,
  networkTab: 'routes',
  customTarget: { host: '', protocol: 'tcp', port: '443' },
  livePing: null,
  livePingTimer: null,
  dns: null,
  dnsBenchmark: null,
  speedTest: null,
  cleanup: null,
  cleanupSelected: new Set(),
  startup: null,
  startupFilter: '',
  history: null,
  activityFilter: 'all',
  activityLoading: false,
  render: null,
  busy: false,
  elevatePolling: false,
};

export function icon(name, size = 18) {
  const path = ICONS[name] || ICONS.info;
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`;
}

export function hydrateIcons(root = document) {
  root.querySelectorAll('[data-icon]').forEach((element) => {
    const name = element.getAttribute('data-icon');
    if (name && !element.querySelector('svg')) element.innerHTML = icon(name);
  });
}

export function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export function formatBytes(bytes, decimals = 1) {
  const value = Number(bytes);
  if (!Number.isFinite(value) || value <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const index = Math.min(units.length - 1, Math.floor(Math.log(value) / Math.log(1024)));
  return `${(value / 1024 ** index).toFixed(index >= 3 ? decimals : 0)} ${units[index]}`;
}

export function formatNumber(value, decimals = 0) {
  const number = Number(value);
  if (!Number.isFinite(number)) return '—';
  return number.toLocaleString(undefined, { maximumFractionDigits: decimals, minimumFractionDigits: decimals });
}

export function formatMbps(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return '—';
  return `${number.toFixed(1)} <small>Mbps</small>`;
}

export function formatDate(value, options = {}) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    ...options,
  });
}

export function formatTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

export function formatUptime(seconds) {
  const value = Number(seconds);
  if (!Number.isFinite(value) || value <= 0) return '—';
  const days = Math.floor(value / 86400);
  const hours = Math.floor((value % 86400) / 3600);
  const minutes = Math.floor((value % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

/**
 * Pick the adapter that is actually carrying traffic. Windows can leave a
 * Wi-Fi adapter in the "Up" state with no address and a 0 bps link while
 * Ethernet is the real connection.
 */
export function findActiveAdapter(adapters) {
  const up = (adapters || []).filter((adapter) => adapter && adapter.status === 'Up');
  const hasAddress = (adapter) =>
    (Array.isArray(adapter.ipv4) && adapter.ipv4.length > 0) ||
    (Array.isArray(adapter.ipv6) && adapter.ipv6.length > 0);
  return (
    up.find(hasAddress) ||
    up.find((adapter) => /[1-9]/.test(String(adapter.linkSpeed || ''))) ||
    up[0] ||
    null
  );
}

export function adapterSpeedLabel(adapter) {
  const speed = String(adapter?.linkSpeed || '').trim();
  return speed && !/^0\s*bps$/i.test(speed) ? speed : 'unknown speed';
}

export function titleCase(value) {
  return String(value || '').replace(/\b\w/g, (character) => character.toUpperCase());
}

export async function api(path, options = {}) {
  if (!state.token && path !== '/api/health') {
    try {
      const hRes = await fetch('/api/health');
      if (hRes.ok) {
        const hData = await hRes.json();
        if (hData?.token) state.token = hData.token;
      }
    } catch {
      // offline or server starting
    }
  }
  const headers = {
    'x-nexa-token': state.token,
    ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    ...(options.headers || {}),
  };
  let response;
  try {
    response = await fetch(path, {
      ...options,
      headers,
      body: options.body && typeof options.body !== 'string' ? JSON.stringify(options.body) : options.body,
    });
  } catch (netErr) {
    if (!options._retried && path !== '/api/health') {
      await new Promise((resolve) => setTimeout(resolve, 400));
      try {
        const hRes = await fetch('/api/health');
        if (hRes.ok) {
          const hData = await hRes.json();
          if (hData?.token) state.token = hData.token;
          return await api(path, { ...options, _retried: true });
        }
      } catch {}
    }
    throw netErr;
  }
  let data = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }
  if (response.status === 403 && !options._retried && path !== '/api/health') {
    try {
      const hRes = await fetch('/api/health');
      if (hRes.ok) {
        const hData = await hRes.json();
        if (hData?.token) {
          state.token = hData.token;
          return await api(path, { ...options, _retried: true });
        }
      }
    } catch {}
  }
  if (!response.ok) {
    const message = data?.error || `Request failed (${response.status}).`;
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }
  return data;
}

export function toast(type, title, message = '', duration = 5200) {
  const root = document.getElementById('toasts');
  if (!root) return;
  const element = document.createElement('div');
  element.className = `toast ${type === 'error' ? 'error' : type === 'warn' ? 'warn' : ''}`;
  const iconName = type === 'error' ? 'alert' : type === 'warn' ? 'alert' : 'check';
  element.innerHTML = `<span class="toast-icon">${icon(iconName, 13)}</span><div><strong>${escapeHtml(title)}</strong>${message ? `<p>${escapeHtml(message)}</p>` : ''}</div>`;
  root.appendChild(element);
  const remove = () => {
    element.classList.add('leaving');
    setTimeout(() => element.remove(), 220);
  };
  const timer = setTimeout(remove, duration);
  element.addEventListener('click', () => {
    clearTimeout(timer);
    remove();
  });
}

let modalKeyHandler = null;
let modalReturnFocus = null;

export function closeModal() {
  const root = document.getElementById('modal-root');
  if (!root) return;
  if (modalKeyHandler) {
    document.removeEventListener('keydown', modalKeyHandler);
    modalKeyHandler = null;
  }
  root.innerHTML = '';
  if (modalReturnFocus && typeof modalReturnFocus.focus === 'function' && document.contains(modalReturnFocus)) {
    try {
      modalReturnFocus.focus();
    } catch {
      // ignore focus restoration errors
    }
  }
  modalReturnFocus = null;
}

export function openModal({ title, body = '', confirmLabel = 'Confirm', cancelLabel = 'Cancel', danger = false, onConfirm = null, hideCancel = false }) {
  const root = document.getElementById('modal-root');
  if (!root) return;
  if (modalKeyHandler) {
    document.removeEventListener('keydown', modalKeyHandler);
    modalKeyHandler = null;
  }
  modalReturnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  root.innerHTML = `
    <div class="modal-backdrop" data-modal-close>
      <div class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <h2 id="modal-title">${escapeHtml(title)}</h2>
        ${body ? `<div class="modal-body">${body}</div>` : ''}
        <div class="modal-actions">
          ${hideCancel ? '' : `<button class="button button-ghost" type="button" data-modal-cancel>${escapeHtml(cancelLabel)}</button>`}
          <button class="button ${danger ? 'button-danger' : 'button-primary'}" type="button" data-modal-confirm>${escapeHtml(confirmLabel)}</button>
        </div>
      </div>
    </div>`;
  const backdrop = root.querySelector('.modal-backdrop');
  const modal = root.querySelector('.modal');
  const confirm = root.querySelector('[data-modal-confirm]');
  const cancel = root.querySelector('[data-modal-cancel]');
  const close = () => {
    if (confirm?.disabled) return;
    closeModal();
  };
  cancel?.addEventListener('click', close);
  backdrop.addEventListener('click', (event) => {
    if (event.target === backdrop) close();
  });
  modalKeyHandler = (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
      return;
    }
    if (event.key === 'Tab' && modal) {
      const focusable = Array.from(
        modal.querySelectorAll('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'),
      );
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  };
  document.addEventListener('keydown', modalKeyHandler);
  confirm.addEventListener('click', async () => {
    if (!onConfirm) return closeModal();
    const original = confirm.textContent;
    confirm.disabled = true;
    if (cancel) cancel.disabled = true;
    confirm.textContent = 'Working…';
    try {
      const result = await onConfirm();
      if (result !== false) closeModal();
    } catch (error) {
      toast('error', 'Could not complete that', error.message);
      confirm.disabled = false;
      if (cancel) cancel.disabled = false;
      confirm.textContent = original;
    }
  });
  hydrateIcons(root);
  confirm.focus();
}

export function navigate(route) {
  const target = `#/${route}`;
  if (window.location.hash === target) {
    if (state.render) state.render();
  } else {
    window.location.hash = target;
  }
}

export function requestRender() {
  if (state.render) state.render();
}

export function applyBodyPreferences() {
  document.body.classList.toggle('reduce-motion', state.settings.reduceMotion === true);
  document.body.classList.toggle('compact', state.settings.compactMode === true);
  const advancedNav = document.querySelector('.nav-link[data-route="advanced"]');
  if (advancedNav) advancedNav.hidden = state.settings.showAdvanced === false;
}

export function updateAdminUI() {
  const admin = state.snapshot?.admin === true;
  const known = typeof state.snapshot?.admin === 'boolean';
  const card = document.getElementById('admin-card');
  const cardTitle = document.getElementById('admin-card-title');
  const cardCopy = document.getElementById('admin-card-copy');
  const pill = document.getElementById('admin-pill');
  const pillLabel = document.getElementById('admin-pill-label');
  if (card) card.classList.toggle('is-admin', admin);
  if (cardTitle) cardTitle.textContent = admin ? 'Administrator' : known ? 'Standard user' : 'Access unchecked';
  if (cardCopy) cardCopy.textContent = admin ? 'Full access enabled' : known ? 'Some fixes need admin' : 'Scan Windows to check';
  if (pill) pill.classList.toggle('admin', admin);
  if (pillLabel) pillLabel.textContent = admin ? 'Administrator' : known ? 'Standard user' : 'Access unchecked';
  const navIssues = document.getElementById('nav-issues');
  if (navIssues) {
    const count = state.scan?.counts?.issues || 0;
    navIssues.textContent = count > 0 ? String(count) : '';
    navIssues.classList.toggle('visible', count > 0);
  }
}

export function cancelScan() {
  state.scanAbortController?.abort();
}

export async function loadScan(force = false) {
  if (state.scanLoading) return state.scanLoading;
  const controller = new AbortController();
  state.scanAbortController = controller;
  state.scanLoading = api(`/api/scan${force ? '?force=1' : ''}`, { signal: controller.signal })
    .then((data) => {
      state.snapshot = data.snapshot;
      state.scan = data.scan;
      state.applied = data.applied || {};
      updateAdminUI();
      return data;
    })
    .finally(() => {
      state.scanLoading = null;
      if (state.scanAbortController === controller) state.scanAbortController = null;
    });
  return state.scanLoading;
}

export async function ensureScan() {
  if (!state.scan) await loadScan();
  return state.scan;
}

export async function applyActions(ids) {
  if (!Array.isArray(ids) || ids.length === 0) return { ok: true, results: [] };

  if (ids.length === 1) {
    const response = await api('/api/actions/apply', { method: 'POST', body: { ids } });
    if (response.snapshot) state.snapshot = response.snapshot;
    if (response.scan) state.scan = response.scan;
    if (response.applied) {
      state.applied = response.applied;
    } else {
      for (const result of response.results || []) {
        if (result.ok && !result.skipped) state.applied[result.id] = new Date().toISOString();
      }
    }
    state.history = null;
    updateAdminUI();
    requestRender();
    return response;
  }

  const modalRoot = document.getElementById('modal-root');
  const allActions = state.scan?.actions || [];
  const actionNameMap = new Map(allActions.map((a) => [a.id, a.name]));

  if (modalRoot) {
    modalRoot.innerHTML = `
      <div class="modal-backdrop">
        <div class="modal progress-modal" role="dialog" aria-modal="true" aria-labelledby="pm-title">
          <div class="progress-modal-header">
            <span class="progress-modal-badge">${icon('activity', 12)} Applying Optimizations</span>
            <h2 id="pm-title" class="progress-modal-title">Tuning System Performance</h2>
            <p id="pm-sub" class="progress-modal-subtitle">Starting configuration pass...</p>
          </div>
          <div class="progress-track-wrap">
            <div class="progress-bar-track">
              <div id="pm-bar" class="progress-bar-fill" style="width: 0%"></div>
            </div>
            <div class="progress-meta-row">
              <span id="pm-count" class="progress-meta-count">0 / ${ids.length} completed</span>
              <span id="pm-pct" class="progress-meta-pct">0%</span>
            </div>
          </div>
          <div id="pm-log" class="progress-stream-log"></div>
        </div>
      </div>`;
  }

  const barEl = document.getElementById('pm-bar');
  const countEl = document.getElementById('pm-count');
  const pctEl = document.getElementById('pm-pct');
  const subEl = document.getElementById('pm-sub');
  const logEl = document.getElementById('pm-log');

  const addLog = (text, status = 'done') => {
    if (!logEl) return;
    const item = document.createElement('div');
    item.className = `progress-stream-item ${status}`;
    item.innerHTML = `<span class="progress-stream-icon">${status === 'done' ? icon('check', 13) : status === 'active' ? icon('refresh', 13) : icon('alert', 13)}</span><span>${escapeHtml(text)}</span>`;
    logEl.prepend(item);
  };

  const updateProgress = (appliedCount, currentActionName) => {
    const pct = Math.min(100, Math.round((appliedCount / ids.length) * 100));
    if (barEl) barEl.style.width = `${pct}%`;
    if (countEl) countEl.textContent = `${appliedCount} / ${ids.length} completed`;
    if (pctEl) pctEl.textContent = `${pct}%`;
    if (subEl && currentActionName) subEl.textContent = currentActionName;
  };

  const CHUNK_SIZE = 3;
  const chunks = [];
  for (let i = 0; i < ids.length; i += CHUNK_SIZE) {
    chunks.push(ids.slice(i, i + CHUNK_SIZE));
  }

  const accumulatedResults = [];
  let appliedSoFar = 0;
  let finalResponse = null;

  try {
    for (let c = 0; c < chunks.length; c++) {
      const chunk = chunks[c];
      const isFirst = c === 0;
      const isLast = c === chunks.length - 1;

      const chunkNames = chunk.map((id) => actionNameMap.get(id) || id).join(', ');
      updateProgress(appliedSoFar, `Applying: ${chunkNames}...`);

      const resp = await api('/api/actions/apply', {
        method: 'POST',
        body: {
          ids: chunk,
          skipRestorePoint: !isFirst,
          skipSnapshot: !isLast,
        },
      });

      if (resp.applied) {
        state.applied = { ...state.applied, ...resp.applied };
      }
      for (const res of resp.results || []) {
        accumulatedResults.push(res);
        if (res.ok && !res.skipped) state.applied[res.id] = new Date().toISOString();
        const aName = actionNameMap.get(res.id) || res.id;
        addLog(res.ok ? aName : `Failed: ${aName}`, res.ok ? 'done' : 'error');
      }

      appliedSoFar += chunk.length;
      updateProgress(appliedSoFar, isLast ? 'Finalizing optimizations...' : `Applied ${appliedSoFar} of ${ids.length}`);

      if (isLast) {
        finalResponse = resp;
        if (resp.snapshot) state.snapshot = resp.snapshot;
        if (resp.scan) state.scan = resp.scan;
      }
    }

    if (finalResponse) {
      finalResponse.results = accumulatedResults;
      finalResponse.ok = accumulatedResults.every((r) => r.ok);
    }

    updateProgress(ids.length, 'All safe optimizations active!');
    if (subEl) subEl.textContent = 'All safe optimizations active!';
    await new Promise((r) => setTimeout(r, 650));
  } finally {
    closeModal();
  }

  state.history = null;
  updateAdminUI();
  requestRender();
  return finalResponse || { ok: accumulatedResults.every((r) => r.ok), results: accumulatedResults };
}

export async function undoAction(id) {
  const response = await api('/api/actions/revert', { method: 'POST', body: { id } });
  if (response.snapshot) state.snapshot = response.snapshot;
  if (response.scan) state.scan = response.scan;
  if (response.applied) {
    state.applied = response.applied;
  } else {
    delete state.applied[id];
  }
  state.history = null;
  updateAdminUI();
  requestRender();
  return response;
}

export async function undoAll() {
  const response = await api('/api/actions/revert-all', { method: 'POST', body: {} });
  if (response.snapshot) state.snapshot = response.snapshot;
  if (response.scan) state.scan = response.scan;
  if (response.applied) {
    state.applied = response.applied;
  } else {
    for (const result of response.results || []) {
      if (result.ok) delete state.applied[result.id];
    }
  }
  state.history = null;
  updateAdminUI();
  requestRender();
  return response;
}

export async function elevate() {
  if (state.elevatePolling) return;
  state.elevatePolling = true;
  const overlay = document.getElementById('elevate-overlay');
  const status = document.getElementById('elevate-status');
  const cancelBtn = document.getElementById('elevate-cancel');
  let cancelled = false;
  const onCancel = () => {
    cancelled = true;
    state.elevatePolling = false;
    if (overlay) overlay.hidden = true;
  };
  cancelBtn?.addEventListener('click', onCancel, { once: true });
  if (overlay) overlay.hidden = false;
  if (status) status.textContent = 'Approve the Windows UAC prompt…';
  try {
    await api('/api/system/elevate', { method: 'POST', body: {} });
    if (status) status.textContent = 'Waiting for the elevated instance…';
    for (let attempt = 0; attempt < 45; attempt += 1) {
      if (cancelled) return;
      await new Promise((resolve) => setTimeout(resolve, 1000));
      if (cancelled) return;
      try {
        const data = await api('/api/system');
        if (data.snapshot?.admin) {
          state.snapshot = data.snapshot;
          await loadScan(true);
          applyBodyPreferences();
          updateAdminUI();
          if (overlay) overlay.hidden = true;
          toast('success', 'Administrator access enabled', 'Reloading Nexa with every fix available.');
          state.elevatePolling = false;
          setTimeout(() => window.location.reload(), 900);
          return;
        }
      } catch {
        // The old server is shutting down; keep waiting for the new one.
      }
      if (status) status.textContent = `Waiting for the elevated instance… ${attempt + 1}s`;
    }
    throw new Error('Nexa did not reconnect. Close this window and start Nexa again.');
  } catch (error) {
    if (overlay) overlay.hidden = true;
    if (!cancelled) toast('error', 'Could not elevate', error.message);
    state.elevatePolling = false;
  } finally {
    cancelBtn?.removeEventListener('click', onCancel);
  }
}

export function quitNexa() {
  openModal({
    title: 'Quit Nexa?',
    body: '<p>The local server will stop and this window can be closed. Any applied Windows changes stay applied until you undo them.</p>',
    confirmLabel: 'Quit Nexa',
    danger: true,
    onConfirm: async () => {
      try {
        await api('/api/app/quit', { method: 'POST', body: {} });
      } catch {
        // The server may close before the response finishes.
      }
      document.body.innerHTML = `
        <div class="quit-screen">
          <div class="quit-mark">N</div>
          <h1>Nexa has stopped</h1>
          <p>The local server is off. You can close this window now.</p>
        </div>`;
      setTimeout(() => window.close(), 600);
    },
  });
}
export const quitNova = quitNexa;

export async function copyText(text) {
  const value = String(text ?? '');
  try {
    if (!navigator.clipboard?.writeText) throw new Error('Clipboard API unavailable');
    await navigator.clipboard.writeText(value);
    toast('success', 'Copied to clipboard');
    return;
  } catch {
    // Fall through to the legacy copy path. The Clipboard API can be blocked
    // by browser permissions even on localhost.
  }
  const textarea = document.createElement('textarea');
  textarea.value = value;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  textarea.style.pointerEvents = 'none';
  document.body.appendChild(textarea);
  textarea.select();
  try {
    if (!document.execCommand('copy')) throw new Error('Copy command was rejected');
    toast('success', 'Copied to clipboard');
  } catch {
    toast('error', 'Could not copy automatically', 'Select the text and press Ctrl+C instead.');
  } finally {
    textarea.remove();
  }
}

export function syncUpdateBanner() {
  const btn = document.getElementById('update-btn');
  const label = document.getElementById('update-btn-label');
  if (!btn) return;
  const info = state.updateInfo;
  if (info && info.updateAvailable === true) {
    btn.hidden = false;
    btn.style.display = 'inline-flex';
    if (label) label.textContent = `Update to v${info.latestVersion}`;
  } else {
    btn.hidden = true;
    btn.style.display = 'none';
  }
}

export async function checkForUpdates({ silent = false } = {}) {
  try {
    const info = await api('/api/update/check');
    state.updateInfo = info;
    syncUpdateBanner();
    requestRender();
    if (info && info.updateAvailable) {
      if (!silent) {
        promptAndInstallUpdate();
      } else {
        toast('info', `Update v${info.latestVersion} available`, 'Click the Update button in the top bar to install and restart.');
      }
    } else if (!silent) {
      toast('success', 'Nexa is up to date', `You are running the latest version (v${info.currentVersion}).`);
    }
    return info;
  } catch (error) {
    syncUpdateBanner();
    if (!silent) {
      toast('error', 'Could not check for updates', error.message);
    }
    return null;
  }
}

export function promptAndInstallUpdate() {
  const info = state.updateInfo;
  if (!info || !info.updateAvailable) {
    checkForUpdates({ silent: false });
    return;
  }
  const notesHtml = Array.isArray(info.notes) && info.notes.length
    ? `<ul class="modal-list">${info.notes.map((n) => `<li>${escapeHtml(n)}</li>`).join('')}</ul>`
    : '';
  openModal({
    title: `Update Nexa to v${info.latestVersion}?`,
    body: `
      <p>Nexa will download <strong>v${escapeHtml(info.latestVersion)}</strong>, verify its SHA-256 checksum (<code>${escapeHtml(String(info.sha256 || '').slice(0, 16))}…</code>), update in place while keeping all your backups and settings, and restart automatically.</p>
      ${notesHtml}`,
    confirmLabel: `Update to v${info.latestVersion} & restart`,
    onConfirm: async () => {
      await runInPlaceUpdate(info.latestVersion);
    },
  });
}

async function runInPlaceUpdate(targetVersion) {
  const overlay = document.getElementById('elevate-overlay');
  const heading = overlay?.querySelector('h2');
  const copy = overlay?.querySelector('p');
  const status = document.getElementById('elevate-status');
  const oldHeading = heading ? heading.textContent : '';
  const oldCopy = copy ? copy.textContent : '';

  if (heading) heading.textContent = `Updating Nexa to v${targetVersion}`;
  if (copy) copy.textContent = 'Downloading package, verifying SHA-256 checksum, and restarting Nexa…';
  if (status) status.textContent = 'Downloading & verifying update…';
  if (overlay) overlay.hidden = false;

  try {
    const { installedVersion } = await api('/api/update/install', { method: 'POST', body: {} });
    if (status) status.textContent = 'Update installed. Waiting for Nexa to restart…';
    for (let attempt = 0; attempt < 35; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 900));
      try {
        const res = await fetch('/api/health', { cache: 'no-store' });
        if (res.ok) {
          const health = await res.json();
          if (health?.ok && health.version === installedVersion) {
            if (status) status.textContent = `Restarted on v${health.version}. Reloading UI…`;
            setTimeout(() => window.location.reload(), 400);
            return;
          }
        }
      } catch {
        // Server is restarting
      }
      if (status) status.textContent = `Reconnecting to updated server… ${attempt + 1}s`;
    }
    window.location.reload();
  } catch (error) {
    if (overlay) overlay.hidden = true;
    if (heading) heading.textContent = oldHeading;
    if (copy) copy.textContent = oldCopy;
    throw error;
  }
}
