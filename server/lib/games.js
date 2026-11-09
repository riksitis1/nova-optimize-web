'use strict';

/**
 * Game profiles: edit a game's OWN config file to its best-performance values.
 *
 * Safety model (same philosophy as the rest of Nova):
 *  - only well-known per-game config files are touched, never game binaries or memory
 *  - the game must be closed (games rewrite their config on exit and would undo us)
 *  - the user picks exactly which settings are applied
 *  - the first-ever copy of each file is saved, and every changed key records its
 *    previous value, so "Restore" puts back only what Nova changed (keybinds,
 *    resource packs and other settings changed later are left alone)
 */

const fs = require('node:fs');
const path = require('node:path');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');

const execFileAsync = promisify(execFile);

class GameError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

/* ------------------------------------------------------------------ */
/* Text helpers                                                        */
/* ------------------------------------------------------------------ */

function splitLines(text) {
  const eol = text.includes('\r\n') ? '\r\n' : '\n';
  return { lines: text.split(/\r?\n/), eol };
}

function unquote(value) {
  const v = String(value ?? '').trim();
  return v.length >= 2 && v.startsWith('"') && v.endsWith('"') ? v.slice(1, -1) : v;
}

/** Compare two config values: numbers numerically, everything else case-insensitively. */
function sameValue(a, b) {
  if (a === null || a === undefined || b === null || b === undefined) return false;
  const x = unquote(a);
  const y = unquote(b);
  const nx = Number(x);
  const ny = Number(y);
  if (x !== '' && y !== '' && Number.isFinite(nx) && Number.isFinite(ny)) return nx === ny;
  return x.toLowerCase() === y.toLowerCase();
}

/* ------------------------------------------------------------------ */
/* INI (Unreal Engine: Fortnite)                                       */
/* ------------------------------------------------------------------ */

function findIniKey(lines, section, key) {
  const wantSection = section.toLowerCase();
  const wantKey = key.toLowerCase();
  let start = -1;
  let end = lines.length;
  for (let i = 0; i < lines.length; i += 1) {
    const header = /^\s*\[(.+?)\]\s*$/.exec(lines[i]);
    if (!header) continue;
    if (start !== -1) {
      end = i;
      break;
    }
    if (header[1].toLowerCase() === wantSection) start = i;
  }
  if (start === -1) return { start: -1, end, index: -1, match: null };
  for (let i = start + 1; i < end; i += 1) {
    if (/^\s*[;#]/.test(lines[i])) continue;
    const m = /^(\s*)([^=\s][^=]*?)\s*=\s*(.*?)\s*$/.exec(lines[i]);
    if (m && m[2].toLowerCase() === wantKey) return { start, end, index: i, match: m };
  }
  return { start, end, index: -1, match: null };
}

function readIni(text, spec) {
  const { lines } = splitLines(text);
  const found = findIniKey(lines, spec.section, spec.key);
  return found.match ? found.match[3] : null;
}

function patchIni(text, specs) {
  const { lines, eol } = splitLines(text);
  const prior = [];
  for (const spec of specs) {
    const found = findIniKey(lines, spec.section, spec.key);
    if (found.match) {
      prior.push({ section: spec.section, key: spec.key, existed: true, raw: found.match[3] });
      if (spec.value === null) lines.splice(found.index, 1);
      else lines[found.index] = `${found.match[1]}${found.match[2]}=${spec.value}`;
      continue;
    }
    if (spec.value === null || spec.onlyIfPresent) continue;
    prior.push({ section: spec.section, key: spec.key, existed: false, raw: null });
    if (found.start === -1) {
      while (lines.length && lines[lines.length - 1] === '') lines.pop();
      if (lines.length) lines.push('');
      lines.push(`[${spec.section}]`, `${spec.key}=${spec.value}`, '');
    } else {
      let at = found.end;
      while (at > found.start + 1 && lines[at - 1].trim() === '') at -= 1;
      lines.splice(at, 0, `${spec.key}=${spec.value}`);
    }
  }
  return { text: lines.join(eol), prior };
}

/* ------------------------------------------------------------------ */
/* Valve KeyValues (CS2: cs2_video.txt)                                */
/* ------------------------------------------------------------------ */

function findKvKey(lines, key) {
  const wantKey = key.toLowerCase();
  for (let i = 0; i < lines.length; i += 1) {
    const m = /^(\s*)"([^"]+)"(\s+)"([^"]*)"\s*$/.exec(lines[i]);
    if (m && m[2].toLowerCase() === wantKey) return { index: i, match: m };
  }
  return { index: -1, match: null };
}

function readKv(text, spec) {
  const { lines } = splitLines(text);
  const found = findKvKey(lines, spec.key);
  return found.match ? found.match[4] : null;
}

function patchKv(text, specs) {
  const { lines, eol } = splitLines(text);
  const prior = [];
  for (const spec of specs) {
    const found = findKvKey(lines, spec.key);
    if (found.match) {
      prior.push({ key: spec.key, existed: true, raw: found.match[4] });
      if (spec.value === null) lines.splice(found.index, 1);
      else lines[found.index] = `${found.match[1]}"${found.match[2]}"${found.match[3]}"${spec.value}"`;
      continue;
    }
    if (spec.value === null || spec.onlyIfPresent) continue;
    let close = -1;
    for (let i = lines.length - 1; i >= 0; i -= 1) {
      if (lines[i].trim() === '}') {
        close = i;
        break;
      }
    }
    if (close === -1) throw new GameError(422, 'The video config file has an unexpected format, so Nova left it unchanged.');
    prior.push({ key: spec.key, existed: false, raw: null });
    lines.splice(close, 0, `\t"${spec.key}"\t\t"${spec.value}"`);
  }
  return { text: lines.join(eol), prior };
}

/* ------------------------------------------------------------------ */
/* key:value options (Minecraft: options.txt)                          */
/* ------------------------------------------------------------------ */

function findOptionKey(lines, key) {
  for (let i = 0; i < lines.length; i += 1) {
    const m = /^([^:\r\n]+):(.*)$/.exec(lines[i]);
    if (m && m[1] === key) return { index: i, match: m };
  }
  return { index: -1, match: null };
}

function readOptions(text, spec) {
  const { lines } = splitLines(text);
  const found = findOptionKey(lines, spec.key);
  return found.match ? found.match[2] : null;
}

function patchOptions(text, specs) {
  const { lines, eol } = splitLines(text);
  const prior = [];
  for (const spec of specs) {
    const found = findOptionKey(lines, spec.key);
    if (found.match) {
      const existing = found.match[2];
      prior.push({ key: spec.key, existed: true, raw: existing });
      if (spec.value === null) {
        lines.splice(found.index, 1);
        continue;
      }
      let next = String(spec.value);
      // Older Minecraft versions store booleans as 0/1/2 instead of true/false.
      if (spec.boolish && /^\d+$/.test(existing.trim())) next = next === 'false' ? '0' : '1';
      // Newer versions quote some values ("false"): keep the file's own style.
      if (existing.trim().startsWith('"') && !next.startsWith('"')) next = `"${next}"`;
      lines[found.index] = `${spec.key}:${next}`;
      continue;
    }
    if (spec.value === null || spec.onlyIfPresent) continue;
    prior.push({ key: spec.key, existed: false, raw: null });
    const entry = `${spec.key}:${spec.value}`;
    if (lines.length && lines[lines.length - 1] === '') lines.splice(lines.length - 1, 0, entry);
    else lines.push(entry);
  }
  return { text: lines.join(eol), prior };
}

const FORMATS = {
  ini: { read: readIni, patch: patchIni, identity: (p) => `${String(p.section).toLowerCase()}|${String(p.key).toLowerCase()}` },
  kv: { read: readKv, patch: patchKv, identity: (p) => String(p.key).toLowerCase() },
  options: { read: readOptions, patch: patchOptions, identity: (p) => String(p.key) },
};

/* ------------------------------------------------------------------ */
/* Game catalog                                                        */
/* ------------------------------------------------------------------ */

const SG = 'ScalabilityGroups';
const FN = '/Script/FortniteGame.FortGameUserSettings';

function fn(id, label, description, impact, key, value, display, extra = {}) {
  return {
    id,
    label,
    description,
    impact,
    file: 'config',
    pairs: [{ section: SG, key, value }],
    display,
    defaultOn: true,
    ...extra,
  };
}

function cs(id, label, description, impact, pairs, display, extra = {}) {
  return { id, label, description, impact, file: 'video', pairs, display, defaultOn: true, ...extra };
}

function mc(id, label, description, impact, pairs, display, extra = {}) {
  return { id, label, description, impact, file: 'options', pairs, display, defaultOn: true, ...extra };
}

const GAMES = [
  {
    id: 'fortnite',
    name: 'Fortnite',
    tagline: 'Unreal Engine scalability groups, V-Sync and frame cap',
    processes: ['FortniteClient-Win64-Shipping.exe', 'FortniteLauncher.exe'],
    files: { config: { format: 'ini', label: 'GameUserSettings.ini' } },
    tips: [
      'Close Fortnite and the Epic launcher overlay before applying. Fortnite rewrites this file when it exits.',
      'For the biggest gain on weaker PCs, also pick Performance rendering mode inside Fortnite (Settings → Video).',
      'If your FPS stutters when uncapped, set a frame cap just under your monitor refresh rate instead.',
    ],
    settings: [
      fn('fn-shadows', 'Shadows', 'Shadows are one of the most expensive effects and also hide enemies in dark corners.', 'high', 'sg.ShadowQuality', '0', 'Low'),
      fn('fn-gi', 'Global illumination', 'Bounced-light calculations (Lumen) cost a lot of GPU time.', 'high', 'sg.GlobalIlluminationQuality', '0', 'Low'),
      fn('fn-reflections', 'Reflections', 'Cheaper reflection quality with almost no gameplay downside.', 'medium', 'sg.ReflectionQuality', '0', 'Low'),
      fn('fn-effects', 'Effects', 'Fewer and simpler particle and explosion effects.', 'medium', 'sg.EffectsQuality', '0', 'Low'),
      fn('fn-post', 'Post processing', 'Lighter bloom, depth of field and colour grading passes.', 'medium', 'sg.PostProcessQuality', '0', 'Low'),
      fn('fn-aa', 'Anti-aliasing', 'Fastest anti-aliasing mode. Edges look slightly sharper and more jagged.', 'medium', 'sg.AntiAliasingQuality', '0', 'Low'),
      fn('fn-shading', 'Shading', 'Simpler material shading.', 'medium', 'sg.ShadingQuality', '0', 'Low'),
      fn('fn-foliage', 'Foliage', 'Removes most grass and small plants. Also makes players easier to see.', 'low', 'sg.FoliageQuality', '0', 'Low'),
      fn('fn-textures', 'Textures', 'Medium keeps things readable and fits in less VRAM. Drop to Low only on 4 GB cards.', 'low', 'sg.TextureQuality', '1', 'Medium'),
      fn('fn-view', 'View distance', 'Kept at Epic on purpose: it lets you spot far-away players and costs little FPS.', 'low', 'sg.ViewDistanceQuality', '3', 'Epic'),
      {
        id: 'fn-vsync',
        label: 'V-Sync',
        description: 'Turns V-Sync off to remove its added input latency.',
        impact: 'high',
        file: 'config',
        pairs: [{ section: FN, key: 'bUseVSync', value: 'False' }],
        display: 'Off',
        defaultOn: true,
      },
      {
        id: 'fn-fps',
        label: 'Frame rate limit',
        description: 'Removes the frame cap. If you see stutter, cap just below your monitor refresh rate instead.',
        impact: 'high',
        file: 'config',
        pairs: [{ section: FN, key: 'FrameRateLimit', value: '0.000000' }],
        display: 'Unlimited',
        defaultOn: true,
      },
      fn('fn-res', '3D resolution', 'Renders at 75% resolution. Big FPS gain on weak GPUs, but the image gets softer.', 'high', 'sg.ResolutionQuality', '75.000000', '75%', { defaultOn: false }),
    ],
  },
  {
    id: 'cs2',
    name: 'Counter-Strike 2',
    tagline: 'cs2_video.txt for every Steam account on this PC',
    processes: ['cs2.exe'],
    files: { video: { format: 'kv', label: 'cs2_video.txt' } },
    launchOptions: '-novid +fps_max 0',
    tips: [
      'Close CS2 before applying. It rewrites cs2_video.txt when it exits.',
      'Launch options cannot be changed safely from outside Steam. Copy the suggestion below into Steam → CS2 → Properties → Launch Options.',
      'Launch CS2 at least once first so Steam creates the video config file.',
    ],
    settings: [
      cs('cs2-shadows', 'Shadow quality', 'Global shadow quality is the single most expensive CS2 video option.', 'high', [{ key: 'setting.videocfg_shadow_quality', value: '0' }], 'Low'),
      cs('cs2-ao', 'Ambient occlusion', 'Turns off ambient occlusion shading.', 'medium', [{ key: 'setting.videocfg_ao_detail', value: '0' }], 'Off'),
      cs('cs2-particles', 'Particle detail', 'Simpler smoke, fire and impact particles.', 'medium', [{ key: 'setting.videocfg_particle_detail', value: '0' }], 'Low'),
      cs('cs2-vsync', 'V-Sync', 'Turns V-Sync off to remove its added input latency.', 'high', [{ key: 'setting.mat_vsync', value: '0' }], 'Off'),
      cs(
        'cs2-aa',
        'Anti-aliasing',
        'Swaps MSAA for CMAA2, which is almost free and still smooths edges.',
        'medium',
        [
          { key: 'setting.msaa_samples', value: '0' },
          { key: 'setting.r_csgo_cmaa_enable', value: '1' },
        ],
        'CMAA2',
      ),
      cs('cs2-reflex', 'NVIDIA Reflex', 'Lower system latency on NVIDIA GPUs. Ignored on AMD and Intel graphics.', 'medium', [{ key: 'setting.r_low_latency', value: '1' }], 'On'),
    ],
  },
  {
    id: 'minecraft',
    name: 'Minecraft: Java Edition',
    tagline: 'options.txt in the default .minecraft folder',
    processes: ['javaw.exe'],
    files: { options: { format: 'options', label: 'options.txt' } },
    tips: [
      'Close Minecraft first. Nova looks for javaw.exe and will not edit the file while Java is running.',
      'Only the default .minecraft folder is edited. Custom launcher instances (Prism, MultiMC and so on) keep their own options.txt.',
      'Restore only puts back the values Nova changed. Your keybinds, resource packs and other options stay as they are.',
    ],
    settings: [
      mc('mc-render', 'Render distance', '8 chunks keeps the world readable and is far cheaper than the default 12 and above.', 'high', [{ key: 'renderDistance', value: '8' }], '8 chunks'),
      mc('mc-sim', 'Simulation distance', 'Fewer chunks run entity and block ticks, which helps the CPU a lot.', 'high', [{ key: 'simulationDistance', value: '6', onlyIfPresent: true }], '6 chunks'),
      mc('mc-graphics', 'Graphics mode', 'Fast graphics use simpler leaves and water.', 'medium', [
        { key: 'graphicsMode', value: '0', onlyIfPresent: true },
        { key: 'fancyGraphics', value: 'false', onlyIfPresent: true, boolish: true },
      ], 'Fast'),
      mc('mc-fps', 'Max framerate', 'Removes the cap (260 means unlimited in Minecraft).', 'medium', [{ key: 'maxFps', value: '260' }], 'Unlimited'),
      mc('mc-vsync', 'V-Sync', 'Turns V-Sync off to remove its added input latency.', 'medium', [{ key: 'enableVsync', value: 'false' }], 'Off'),
      mc('mc-particles', 'Particles', 'Minimal particles.', 'medium', [{ key: 'particles', value: '2' }], 'Minimal'),
      mc('mc-shadows', 'Entity shadows', 'Stops drawing shadows under mobs, players and items.', 'low', [{ key: 'entityShadows', value: 'false' }], 'Off'),
      mc('mc-ao', 'Smooth lighting', 'Flat lighting instead of smooth ambient occlusion.', 'medium', [{ key: 'ao', value: 'false', onlyIfPresent: true, boolish: true }], 'Off'),
      mc('mc-clouds', 'Clouds', 'Turns clouds off.', 'low', [{ key: 'renderClouds', value: 'false', onlyIfPresent: true }], 'Off'),
      mc('mc-biome', 'Biome blend', 'No colour blending between biomes.', 'low', [{ key: 'biomeBlendRadius', value: '0', onlyIfPresent: true }], 'Off'),
      mc('mc-entities', 'Entity distance', 'Draws far-away mobs less often.', 'low', [{ key: 'entityDistanceScaling', value: '0.5', onlyIfPresent: true }], '50%', { defaultOn: false }),
    ],
  },
];

const GAME_MAP = new Map(GAMES.map((game) => [game.id, game]));

function getGameDef(id) {
  return GAME_MAP.get(id) || null;
}

/* ------------------------------------------------------------------ */
/* Environment (real by default, injectable for tests)                 */
/* ------------------------------------------------------------------ */

let steamPathCache;

async function detectSteamPath() {
  if (steamPathCache !== undefined) return steamPathCache;
  steamPathCache = null;
  try {
    const { stdout } = await execFileAsync('reg', ['query', 'HKCU\\Software\\Valve\\Steam', '/v', 'SteamPath'], {
      windowsHide: true,
      timeout: 4000,
    });
    const match = /SteamPath\s+REG_SZ\s+(.+)/i.exec(stdout);
    if (match) steamPathCache = path.normalize(match[1].trim());
  } catch {
    // fall through to the default install location
  }
  if (!steamPathCache) {
    const fallback = path.join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'Steam');
    if (fs.existsSync(fallback)) steamPathCache = fallback;
  }
  return steamPathCache;
}

async function detectRunning(names) {
  try {
    const { stdout } = await execFileAsync('tasklist', ['/FO', 'CSV', '/NH'], {
      windowsHide: true,
      timeout: 8000,
      maxBuffer: 8 * 1024 * 1024,
    });
    const running = new Set(
      stdout
        .split(/\r?\n/)
        .map((line) => /^"([^"]+)"/.exec(line)?.[1]?.toLowerCase())
        .filter(Boolean),
    );
    return names.filter((name) => running.has(name.toLowerCase()));
  } catch {
    return [];
  }
}

function defaultEnv() {
  const store = require('./store');
  return {
    localAppData: process.env.LOCALAPPDATA || '',
    appData: process.env.APPDATA || '',
    dataDir: store.DATA_DIR,
    getSteamPath: detectSteamPath,
    findRunning: detectRunning,
    store: {
      get: (id) => store.getGameState(id),
      set: (id, value) => store.setGameState(id, value),
      clear: (id) => store.clearGameState(id),
    },
  };
}

async function locate(game, env) {
  switch (game.id) {
    case 'fortnite':
      return {
        config: env.localAppData
          ? [path.join(env.localAppData, 'FortniteGame', 'Saved', 'Config', 'WindowsClient', 'GameUserSettings.ini')]
          : [],
      };
    case 'cs2': {
      const steam = await env.getSteamPath();
      const result = [];
      if (steam) {
        const userdata = path.join(steam, 'userdata');
        let users = [];
        try {
          users = fs.readdirSync(userdata).filter((name) => /^\d+$/.test(name));
        } catch {
          users = [];
        }
        for (const user of users) {
          result.push(path.join(userdata, user, '730', 'local', 'cfg', 'cs2_video.txt'));
        }
      }
      return { video: result };
    }
    case 'minecraft':
      return { options: env.appData ? [path.join(env.appData, '.minecraft', 'options.txt')] : [] };
    default:
      return {};
  }
}

/* ------------------------------------------------------------------ */
/* File IO that preserves encoding and BOM                             */
/* ------------------------------------------------------------------ */

function readConfig(file) {
  const buffer = fs.readFileSync(file);
  if (buffer.length >= 2 && buffer[0] === 0xff && buffer[1] === 0xfe) {
    return { text: buffer.slice(2).toString('utf16le'), encoding: 'utf16le', bom: true };
  }
  if (buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
    return { text: buffer.slice(3).toString('utf8'), encoding: 'utf8', bom: true };
  }
  return { text: buffer.toString('utf8'), encoding: 'utf8', bom: false };
}

function writeConfig(file, text, meta) {
  let body = Buffer.from(text, meta.encoding === 'utf16le' ? 'utf16le' : 'utf8');
  if (meta.bom) {
    const bom = meta.encoding === 'utf16le' ? Buffer.from([0xff, 0xfe]) : Buffer.from([0xef, 0xbb, 0xbf]);
    body = Buffer.concat([bom, body]);
  }
  let wasReadOnly = false;
  let originalMode = 0;
  try {
    const stat = fs.statSync(file);
    originalMode = stat.mode;
    // On Windows and POSIX, if write permission is missing, clear the Read-Only attribute
    if ((originalMode & 0o200) === 0) {
      wasReadOnly = true;
      fs.chmodSync(file, originalMode | 0o200);
    }
  } catch {
    // If stat fails (e.g. file does not exist yet), let writeFileSync create it or throw
  }

  try {
    fs.writeFileSync(file, body);
  } catch (error) {
    if (error.code === 'EPERM' || error.code === 'EACCES' || error.code === 'EROFS') {
      throw new GameError(
        409,
        `${path.basename(file)} is read-only or locked by another process.`,
      );
    }
    throw error;
  } finally {
    if (wasReadOnly) {
      try {
        fs.chmodSync(file, originalMode);
      } catch {
        // Best effort restore
      }
    }
  }
}

function backupOnce(env, game, file, gameState) {
  gameState.files = gameState.files || {};
  const entry = gameState.files[file] || { backupPath: null, prior: {} };
  if (!entry.backupPath || !fs.existsSync(entry.backupPath)) {
    const dir = path.join(env.dataDir, 'game-backups', game.id);
    fs.mkdirSync(dir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const target = path.join(dir, `${stamp}_${path.basename(file)}`);
    fs.copyFileSync(file, target);
    entry.backupPath = target;
  }
  gameState.files[file] = entry;
  return entry;
}

/* ------------------------------------------------------------------ */
/* Service                                                             */
/* ------------------------------------------------------------------ */

function specsFor(setting) {
  return setting.pairs.map((pair) => ({
    section: pair.section,
    key: pair.key,
    value: pair.value,
    onlyIfPresent: pair.onlyIfPresent === true,
    boolish: pair.boolish === true,
  }));
}

function describeSetting(setting, format, existingFiles, gameState) {
  let current = null;
  let optimized = false;
  const first = existingFiles[0];
  if (first) {
    try {
      const { text } = readConfig(first);
      const values = setting.pairs.map((pair) => FORMATS[format].read(text, pair));
      const present = values.filter((v) => v !== null);
      current = present.length ? unquote(present[0]) : null;
      const checkable = setting.pairs
        .map((pair, i) => ({ pair, value: values[i] }))
        .filter(({ pair, value }) => !(pair.onlyIfPresent && value === null));
      optimized = checkable.length > 0 && checkable.every(({ pair, value }) => {
        const want = pair.boolish && value !== null && /^\d+$/.test(String(value).trim())
          ? (pair.value === 'false' ? '0' : '1')
          : pair.value;
        return sameValue(value, want);
      });
    } catch {
      current = null;
    }
  }
  const touched = !!gameState && Array.isArray(gameState.settingIds) && gameState.settingIds.includes(setting.id);
  let original = null;
  if (touched && first && gameState?.files?.[first]?.prior) {
    const id = FORMATS[format].identity(setting.pairs[0]);
    const rec = gameState.files[first].prior[id];
    if (rec && rec.existed) original = unquote(rec.raw);
  }
  return {
    id: setting.id,
    label: setting.label,
    description: setting.description,
    impact: setting.impact,
    recommended: setting.display,
    current,
    original,
    optimized,
    defaultOn: setting.defaultOn !== false,
    appliedByNova: touched,
  };
}

function createGameService(env = defaultEnv()) {
  async function inspect(game) {
    const located = await locate(game, env);
    const kind = Object.keys(game.files)[0];
    const candidates = located[kind] || [];
    const existing = candidates.filter((file) => fs.existsSync(file));
    return { kind, format: game.files[kind].format, candidates, existing };
  }

  async function describe(game) {
    const info = await inspect(game);
    const running = await env.findRunning(game.processes);
    const gameState = env.store.get(game.id) || null;
    return {
      id: game.id,
      name: game.name,
      tagline: game.tagline,
      tips: game.tips,
      launchOptions: game.launchOptions || null,
      fileLabel: game.files[info.kind].label,
      installed: info.existing.length > 0,
      files: info.existing,
      expectedPath: info.candidates[0] || null,
      running: running.length > 0,
      runningProcesses: running,
      applied: gameState
        ? { at: gameState.at, settingIds: gameState.settingIds || [], fileCount: Object.keys(gameState.files || {}).length }
        : null,
      settings: game.settings.map((setting) => describeSetting(setting, info.format, info.existing, gameState)),
    };
  }

  async function list() {
    const result = [];
    for (const game of GAMES) result.push(await describe(game));
    return result;
  }

  async function apply(gameId, settingIds) {
    const game = getGameDef(gameId);
    if (!game) throw new GameError(404, 'Unknown game.');
    const chosen = game.settings.filter((setting) => settingIds.includes(setting.id));
    if (!chosen.length) throw new GameError(400, 'Select at least one setting to apply.');

    const running = await env.findRunning(game.processes);
    if (running.length) {
      throw new GameError(409, `Close ${game.name} first (${running[0]} is running). It rewrites its config when it exits and would undo the changes.`);
    }
    const info = await inspect(game);
    if (!info.existing.length) {
      throw new GameError(404, `${game.name} has no ${game.files[info.kind].label} yet. Launch the game once so it creates its config, then try again.`);
    }

    const format = FORMATS[info.format];
    const gameState = env.store.get(game.id) || { at: null, settingIds: [], files: {} };
    const specs = chosen.flatMap(specsFor);
    const changedFiles = [];

    for (const file of info.existing) {
      const meta = readConfig(file);
      const entry = backupOnce(env, game, file, gameState);
      const outcome = format.patch(meta.text, specs);
      for (const prior of outcome.prior) {
        const id = format.identity(prior);
        if (!entry.prior[id]) entry.prior[id] = prior;
      }
      if (outcome.text !== meta.text) {
        writeConfig(file, outcome.text, meta);
        changedFiles.push(file);
      }
    }

    gameState.at = new Date().toISOString();
    gameState.settingIds = Array.from(new Set([...(gameState.settingIds || []), ...chosen.map((s) => s.id)]));
    env.store.set(game.id, gameState);

    return {
      gameId: game.id,
      name: game.name,
      applied: chosen.map((s) => s.id),
      changedFiles,
      unchanged: info.existing.length - changedFiles.length,
    };
  }

  async function revert(gameId, settingIds = null) {
    const game = getGameDef(gameId);
    if (!game) throw new GameError(404, 'Unknown game.');
    const gameState = env.store.get(game.id);
    if (!gameState || !gameState.files || !Object.keys(gameState.files).length) {
      throw new GameError(404, `Nova has not changed any ${game.name} settings, so there is nothing to restore.`);
    }
    const running = await env.findRunning(game.processes);
    if (running.length) {
      throw new GameError(409, `Close ${game.name} first (${running[0]} is running), then restore.`);
    }
    const info = await inspect(game);
    const format = FORMATS[info.format];
    const partial = Array.isArray(settingIds) && settingIds.length > 0;
    const targetSettings = partial
      ? game.settings.filter((s) => settingIds.includes(s.id))
      : game.settings;
    const targetKeys = new Set(
      targetSettings.flatMap((s) => s.pairs.map((pair) => format.identity(pair))),
    );

    const restored = [];
    for (const [file, entry] of Object.entries(gameState.files)) {
      if (!fs.existsSync(file)) continue;
      const meta = readConfig(file);
      const priorsToRestore = Object.entries(entry.prior || {}).filter(([key]) =>
        !partial || targetKeys.has(key),
      );
      const specs = priorsToRestore.map(([, prior]) => ({
        section: prior.section,
        key: prior.key,
        value: prior.existed ? prior.raw : null,
      }));
      if (specs.length) {
        const outcome = format.patch(meta.text, specs);
        if (outcome.text !== meta.text) writeConfig(file, outcome.text, meta);
        restored.push(file);
      }
      if (partial && entry.prior) {
        for (const [key] of priorsToRestore) delete entry.prior[key];
      }
    }

    if (partial) {
      const removedIds = new Set(targetSettings.map((s) => s.id));
      gameState.settingIds = (gameState.settingIds || []).filter((id) => !removedIds.has(id));
      const anyLeft = Object.values(gameState.files || {}).some(
        (entry) => entry.prior && Object.keys(entry.prior).length > 0,
      );
      if (!gameState.settingIds.length || !anyLeft) {
        env.store.clear(game.id);
      } else {
        env.store.set(game.id, gameState);
      }
    } else {
      env.store.clear(game.id);
    }

    return {
      gameId: game.id,
      name: game.name,
      restored,
      restoredSettings: partial ? targetSettings.map((s) => s.id) : null,
    };
  }

  return { list, describe: (id) => describe(getGameDef(id)), apply, revert };
}

let defaultService = null;
function service() {
  if (!defaultService) defaultService = createGameService();
  return defaultService;
}

module.exports = {
  GameError,
  GAMES,
  getGameDef,
  createGameService,
  listGames: () => service().list(),
  describeGame: (id) => service().describe(id),
  applyGameSettings: (id, ids) => service().apply(id, ids),
  revertGameSettings: (id, ids) => service().revert(id, ids),
  patchIni,
  patchKv,
  patchOptions,
  readIni,
  readKv,
  readOptions,
  sameValue,
};

