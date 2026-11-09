const ICONS = {
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  spark: '<path d="m12 2 1.7 5.3L19 9l-5.3 1.7L12 16l-1.7-5.3L5 9l5.3-1.7L12 2Z"/><path d="m19 14 .9 2.6 2.6.9-2.6.9L19 21l-.9-2.6-2.6-.9 2.6-.9L19 14Z"/><path d="m5 15 .7 2.3L8 18l-2.3.7L5 21l-.7-2.3L2 18l2.3-.7L5 15Z"/>',
  pulse: '<path d="M3 12h4l2.5-7 5 14L17 12h4"/>',
  broom: '<path d="m19 3-5.5 5.5"/><path d="m14 7-8 8 3 3 8-8"/><path d="m6 15-3 6 6-3"/><path d="m9 18 3 3"/>',
  rocket: '<path d="M4.5 16.5c-1.5 1.3-2 5-2 5s3.7-.5 5-2"/><path d="M9 15 5 11c2.5-5.5 7-8 14-8 0 7-2.5 11.5-8 14l-2-2Z"/><circle cx="15" cy="9" r="1.5"/><path d="M9 15 5 11l-1 4 3 1 1 3 4-1"/>',
  sliders: '<path d="M4 6h16"/><path d="M4 12h16"/><path d="M4 18h16"/><circle cx="9" cy="6" r="2"/><circle cx="15" cy="12" r="2"/><circle cx="8" cy="18" r="2"/>',
  history: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l3 2"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3 1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"/>',
  power: '<path d="M12 2v10"/><path d="M18.4 6.6a9 9 0 1 1-12.8 0"/>',
  menu: '<path d="M4 6h16"/><path d="M4 12h16"/><path d="M4 18h16"/>',
  refresh: '<path d="M20 7v5h-5"/><path d="M4 17v-5h5"/><path d="M6.1 9A7 7 0 0 1 18.7 7.3L20 12"/><path d="M17.9 15A7 7 0 0 1 5.3 16.7L4 12"/>',
  scan: '<path d="M4 8V5a1 1 0 0 1 1-1h3"/><path d="M16 4h3a1 1 0 0 1 1 1v3"/><path d="M20 16v3a1 1 0 0 1-1 1h-3"/><path d="M8 20H5a1 1 0 0 1-1-1v-3"/><path d="M7 12h10"/>',
  shield: '<path d="M12 3 4.5 6v5.5c0 4.4 3.2 7.9 7.5 9.5 4.3-1.6 7.5-5.1 7.5-9.5V6L12 3Z"/><path d="m9 12 2 2 4-4"/>',
  cpu: '<rect x="7" y="7" width="10" height="10" rx="2"/><path d="M9 1v3"/><path d="M15 1v3"/><path d="M9 20v3"/><path d="M15 20v3"/><path d="M1 9h3"/><path d="M1 15h3"/><path d="M20 9h3"/><path d="M20 15h3"/><rect x="10" y="10" width="4" height="4" rx="1"/>',
  gpu: '<rect x="3" y="6" width="18" height="12" rx="2"/><circle cx="9" cy="12" r="2.5"/><circle cx="16" cy="12" r="2.5"/><path d="M7 18v3"/><path d="M17 18v3"/>',
  memory: '<path d="M3 8h18v8H3z"/><path d="M6 8V5"/><path d="M10 8V5"/><path d="M14 8V5"/><path d="M18 8V5"/><path d="M6 16v3"/><path d="M10 16v3"/><path d="M14 16v3"/><path d="M18 16v3"/><path d="M7 12h2"/><path d="M12 12h2"/><path d="M17 12h.01"/>',
  disk: '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5"/><path d="M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"/>',
  wifi: '<path d="M5 12.5a10 10 0 0 1 14 0"/><path d="M8.5 16a5 5 0 0 1 7 0"/><path d="M12 20h.01"/><path d="M2 9a15 15 0 0 1 20 0"/>',
  ethernet: '<rect x="5" y="9" width="14" height="10" rx="2"/><path d="M8 9V5h8v4"/><path d="M9 14h1"/><path d="M14 14h1"/><path d="M12 19v3"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  alert: '<path d="M12 3 2.8 20h18.4L12 3Z"/><path d="M12 9v5"/><path d="M12 17h.01"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5"/><path d="M12 8h.01"/>',
  x: '<path d="m6 6 12 12"/><path d="m18 6-12 12"/>',
  chevron: '<path d="m9 18 6-6-6-6"/>',
  external: '<path d="M14 3h7v7"/><path d="M10 14 21 3"/><path d="M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5"/>',
  lock: '<rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
  zap: '<path d="M13 2 3 14h8l-1 8 10-12h-8l1-8Z"/>',
  download: '<path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M4 21h16"/>',
  upload: '<path d="M12 21V9"/><path d="m7 14 5-5 5 5"/><path d="M4 3h16"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3c2.5 2.5 4 5.6 4 9s-1.5 6.5-4 9c-2.5-2.5-4-5.6-4-9s1.5-6.5 4-9Z"/>',
  server: '<rect x="3" y="3" width="18" height="7" rx="2"/><rect x="3" y="14" width="18" height="7" rx="2"/><path d="M7 6.5h.01"/><path d="M7 17.5h.01"/><path d="M11 6.5h6"/><path d="M11 17.5h6"/>',
  play: '<path d="m8 5 11 7-11 7V5Z"/>',
  stop: '<rect x="6" y="6" width="12" height="12" rx="2"/>',
  trash: '<path d="M4 7h16"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M6 7l1 14h10l1-14"/><path d="M9 7V4h6v3"/>',
  undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h9a7 7 0 1 1 0 14h-1"/>',
  arrow: '<path d="M5 12h14"/><path d="m13 6 6 6-6 6"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
  copy: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  folder: '<path d="M3 6a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6Z"/>',
  gauge: '<path d="M4.5 19a9 9 0 1 1 15 0"/><path d="M12 13 16 9"/><path d="M12 20h.01"/>',
  thermometer: '<path d="M10 13V5a2 2 0 1 1 4 0v8a4 4 0 1 1-4 0Z"/><path d="M12 9v7"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  key: '<circle cx="7.5" cy="15.5" r="4.5"/><path d="m11 12 9-9"/><path d="m17 6 3 3"/><path d="m14 9 3 3"/>',
  plus: '<path d="M12 5v14"/><path d="M5 12h14"/>',
  target: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="1"/>',
  activity: '<path d="M3 12h4l2-7 4 14 2-7h6"/>',
  monitor: '<rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8"/><path d="M12 17v4"/>',
  beaker: '<path d="M9 3h6"/><path d="M10 3v6l-5 9a2 2 0 0 0 1.7 3h10.6a2 2 0 0 0 1.7-3l-5-9V3"/><path d="M7.5 14h9"/>',
  star: '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>',
  list: '<path d="M8 6h13"/><path d="M8 12h13"/><path d="M8 18h13"/><path d="M3 6h.01"/><path d="M3 12h.01"/><path d="M3 18h.01"/>',
  gamepad: '<rect x="2" y="6" width="20" height="12" rx="4"/><path d="M6 12h4"/><path d="M8 10v4"/><circle cx="15" cy="11" r="1"/><circle cx="17" cy="13" r="1"/>',
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
  token: document.querySelector('meta[name="nova-token"]')?.getAttribute('content') || '',
  version: '1.4.0',
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
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true">${path}</svg>`;
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
  const headers = {
    'x-nova-token': state.token,
    ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    ...(options.headers || {}),
  };
  const response = await fetch(path, {
    ...options,
    headers,
    body: options.body && typeof options.body !== 'string' ? JSON.stringify(options.body) : options.body,
  });
  let data = null;
  try {
    data = await response.json();
  } catch {
    data = null;
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
  if (advancedNav) advancedNav.style.display = state.settings.showAdvanced === false ? 'none' : '';
  const runInBg = state.settings.runInBackground !== false;
  const bgToggle = document.getElementById('bg-mode-toggle');
  const bgSub = document.getElementById('bg-mode-sub');
  if (bgToggle) {
    bgToggle.classList.toggle('on', runInBg);
    bgToggle.setAttribute('aria-checked', String(runInBg));
  }
  if (bgSub) {
    bgSub.textContent = runInBg ? 'Active in background' : 'Stops when closed';
  }
}

export function updateAdminUI() {
  const admin = state.snapshot?.admin === true;
  const card = document.getElementById('admin-card');
  const cardTitle = document.getElementById('admin-card-title');
  const cardCopy = document.getElementById('admin-card-copy');
  const pill = document.getElementById('admin-pill');
  const pillLabel = document.getElementById('admin-pill-label');
  if (card) card.classList.toggle('is-admin', admin);
  if (cardTitle) cardTitle.textContent = admin ? 'Administrator' : 'Standard user';
  if (cardCopy) cardCopy.textContent = admin ? 'Full access enabled' : 'Some fixes need admin';
  if (pill) pill.classList.toggle('admin', admin);
  if (pillLabel) pillLabel.textContent = admin ? 'Administrator' : 'Standard user';
  const navIssues = document.getElementById('nav-issues');
  if (navIssues) {
    const count = state.scan?.counts?.issues || 0;
    navIssues.textContent = count > 0 ? String(count) : '';
    navIssues.classList.toggle('visible', count > 0);
  }
}

export async function loadScan(force = false) {
  if (state.scanLoading) return state.scanLoading;
  state.scanLoading = api(`/api/scan${force ? '?force=1' : ''}`)
    .then((data) => {
      state.snapshot = data.snapshot;
      state.scan = data.scan;
      state.applied = data.applied || {};
      updateAdminUI();
      return data;
    })
    .finally(() => {
      state.scanLoading = null;
    });
  return state.scanLoading;
}

export async function ensureScan() {
  if (!state.scan) await loadScan();
  return state.scan;
}

export async function applyActions(ids) {
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
          toast('success', 'Administrator access enabled', 'Reloading Nova with every fix available.');
          state.elevatePolling = false;
          setTimeout(() => window.location.reload(), 900);
          return;
        }
      } catch {
        // The old server is shutting down; keep waiting for the new one.
      }
      if (status) status.textContent = `Waiting for the elevated instance… ${attempt + 1}s`;
    }
    throw new Error('Nova did not reconnect. Close this window and start Nova again.');
  } catch (error) {
    if (overlay) overlay.hidden = true;
    if (!cancelled) toast('error', 'Could not elevate', error.message);
    state.elevatePolling = false;
  } finally {
    cancelBtn?.removeEventListener('click', onCancel);
  }
}

export function quitNova() {
  openModal({
    title: 'Quit Nova?',
    body: '<p>The local server will stop and this window can be closed. Any applied Windows changes stay applied until you undo them.</p>',
    confirmLabel: 'Quit Nova',
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
          <h1>Nova has stopped</h1>
          <p>The local server is off. You can close this window now.</p>
        </div>`;
      setTimeout(() => window.close(), 600);
    },
  });
}

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
      toast('success', 'Nova is up to date', `You are running the latest version (v${info.currentVersion}).`);
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
    title: `Update Nova to v${info.latestVersion}?`,
    body: `
      <p>Nova will download <strong>v${escapeHtml(info.latestVersion)}</strong>, verify its SHA-256 checksum (<code>${escapeHtml(String(info.sha256 || '').slice(0, 16))}…</code>), update in place while keeping all your backups and settings, and restart automatically.</p>
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

  if (heading) heading.textContent = `Updating Nova to v${targetVersion}`;
  if (copy) copy.textContent = 'Downloading package, verifying SHA-256 checksum, and restarting Nova…';
  if (status) status.textContent = 'Downloading & verifying update…';
  if (overlay) overlay.hidden = false;

  try {
    await api('/api/update/install', { method: 'POST', body: {} });
    if (status) status.textContent = 'Update installed. Waiting for Nova to restart…';
    for (let attempt = 0; attempt < 35; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 900));
      try {
        const res = await fetch('/api/health', { cache: 'no-store' });
        if (res.ok) {
          const health = await res.json();
          if (health && health.ok) {
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
