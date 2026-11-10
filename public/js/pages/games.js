import {
  state,
  icon,
  escapeHtml,
  toast,
  openModal,
  api,
  requestRender,
} from '../core.js';
import { sectionHead, impactBadge, emptyState } from '../ui.js';

function selectionFor(game) {
  state.gameSelections = state.gameSelections || {};
  if (!state.gameSelections[game.id]) {
    state.gameSelections[game.id] = new Set(
      game.settings.filter((setting) => setting.available && setting.defaultOn && !setting.optimized).map((setting) => setting.id),
    );
  }
  return state.gameSelections[game.id];
}

function replaceGame(next) {
  if (!next || !Array.isArray(state.games)) return;
  state.games = state.games.map((game) => (game.id === next.id ? next : game));
}

function statusBadge(game) {
  if (game.running) return `<span class="badge amber">${icon('alert')} Running. Close it first</span>`;
  if (!game.installed) return '<span class="badge muted">Config not found</span>';
  if (game.applied) return `<span class="badge lime">${icon('check')} ${game.applied.settingIds.length} applied · Backed up</span>`;
  return '<span class="badge green">Ready</span>';
}

function formatDisplayValue(val, setting) {
  if (val === null || val === undefined) return setting.available ? 'not set' : 'Unavailable';
  let s = String(val).trim();
  // Strip trailing .000000 or decimal zeroes from Unreal Engine floats
  if (/^-?\d+\.0+$/.test(s)) s = s.replace(/\.0+$/, '');
  else if (/^-?\d+\.\d+?0+$/.test(s)) s = s.replace(/0+$/, '');

  if (s.toLowerCase() === 'false') return 'Off';
  if (s.toLowerCase() === 'true') return 'On';

  if (setting.id === 'fn-res' || setting.recommended?.includes('%')) {
    if (setting.id === 'mc-entities' && /^\d+(?:\.\d+)?$/.test(s)) return `${Number(s) * 100}%`;
    if (/^\d+$/.test(s)) return `${s}%`;
  }
  if (setting.id === 'fn-fps') {
    if (s === '0') return 'Unlimited';
    if (/^\d+$/.test(s)) return `${s} FPS`;
  }
  if (setting.id === 'mc-fps') {
    if (s === '260') return 'Unlimited';
    if (/^\d+$/.test(s)) return `${s} FPS`;
  }
  if (setting.id === 'mc-render' || setting.id === 'mc-sim') {
    if (/^\d+$/.test(s)) return `${s} chunks`;
  }

  // Fortnite scalability indices
  const FN_LEVELS = { '0': 'Low', '1': 'Medium', '2': 'High', '3': 'Epic', '4': 'Cinematic' };
  if (setting.id.startsWith('fn-') && FN_LEVELS[s]) return FN_LEVELS[s];

  // CS2 indices
  if (setting.id === 'cs2-reflex') {
    const REFLEX = { '0': 'Off', '1': 'On', '2': 'On + Boost' };
    if (REFLEX[s]) return REFLEX[s];
  }
  if (setting.id === 'cs2-fidelityfx') {
    const FSR = { '0': 'Disabled', '1': 'Ultra Quality', '2': 'Quality', '3': 'Balanced', '4': 'Performance' };
    if (FSR[s]) return FSR[s];
  }
  if (setting.id === 'cs2-ao' || setting.id === 'cs2-vsync') {
    if (s === '0') return 'Off';
    if (s === '1') return 'On';
  }
  const CS2_LEVELS = { '0': 'Low', '1': 'Medium', '2': 'High', '3': 'Very High' };
  if (setting.id.startsWith('cs2-') && CS2_LEVELS[s]) return CS2_LEVELS[s];

  // Minecraft indices
  if (setting.id === 'mc-graphics') {
    const G = { '0': 'Fast', '1': 'Fancy', '2': 'Fabulous' };
    if (G[s]) return G[s];
  }
  if (setting.id === 'mc-particles') {
    const P = { '0': 'All', '1': 'Decreased', '2': 'Minimal' };
    if (P[s]) return P[s];
  }
  if (setting.id === 'mc-smooth') {
    const SM = { '0': 'Off', '1': 'Minimum', '2': 'Maximum' };
    if (SM[s]) return SM[s];
  }
  if (setting.id === 'mc-clouds') {
    const CL = { '0': 'Off', '1': 'Fast', '2': 'Fancy' };
    if (CL[s]) return CL[s];
  }

  return s;
}

function settingRow(game, setting, selected, locked) {
  locked = locked || !setting.available;
  const currentFormatted = formatDisplayValue(setting.current, setting);
  const values = setting.optimized
    ? `<div class="game-value-pill is-optimal"><span class="game-ok">${icon('check', 12)} ${escapeHtml(setting.recommended)}</span></div>`
    : `<div class="game-value-pill"><span class="game-from">${escapeHtml(currentFormatted)}</span><span class="game-arrow">${icon('arrow', 12)}</span><span class="game-to">${escapeHtml(setting.recommended)}</span></div>`;
  const restoreOneBtn = setting.appliedByNexa
    ? `<button class="button button-small button-ghost game-restore-inline" type="button" data-game-restore-one="${escapeHtml(game.id)}:${escapeHtml(setting.id)}" ${game.running ? 'disabled' : ''} title="Restore this setting to ${escapeHtml(setting.original ?? 'its original value')}">${icon('undo')} Restore</button>`
    : '';
  return `
    <div class="game-setting ${setting.optimized ? 'is-optimal' : ''} ${locked ? 'is-locked' : ''}">
      <label class="game-setting-label">
        <input type="checkbox" data-game-setting="${escapeHtml(game.id)}:${escapeHtml(setting.id)}" ${selected.has(setting.id) ? 'checked' : ''} ${locked ? 'disabled' : ''}>
        <span class="game-check" aria-hidden="true">${icon('check', 12)}</span>
        <span class="game-setting-main">
          <span class="game-setting-top">
            <strong>
              ${escapeHtml(setting.label)}
              ${impactBadge(setting.impact)}
              ${setting.appliedByNexa ? `<span class="badge lime">Backed up${setting.original !== null && setting.original !== undefined ? `: ${escapeHtml(formatDisplayValue(setting.original, setting))}` : ''}</span>` : ''}
            </strong>
            <span class="game-values mono">${values}</span>
          </span>
          <small>${escapeHtml(setting.description)}</small>
        </span>
      </label>
      ${restoreOneBtn ? `<div class="game-setting-actions">${restoreOneBtn}</div>` : ''}
    </div>`;
}

function gameCard(game) {
  const selected = selectionFor(game);
  const locked = !game.installed || game.running;
  const count = game.settings.filter((setting) => setting.available && selected.has(setting.id)).length;
  const hasBackup = Boolean(game.applied && game.applied.settingIds?.length);
  const tips = (game.tips || []).map((tip) => `<li>${escapeHtml(tip)}</li>`).join('');
  return `
    <article class="card game-card" data-game="${escapeHtml(game.id)}">
      <header class="game-head">
        <div class="game-mark">${icon('gamepad', 20)}</div>
        <div class="game-title">
          <div class="game-title-row">
            <h3>${escapeHtml(game.name)}</h3>
            ${statusBadge(game)}
          </div>
          <p>${escapeHtml(game.tagline)}</p>
        </div>
        <div class="game-tools">
          <span class="small muted">Select:</span>
          <span class="game-tool-links">
            <button class="link-button" type="button" data-game-pick="${escapeHtml(game.id)}:recommended" ${locked ? 'disabled' : ''}>Recommended</button>
            <button class="link-button" type="button" data-game-pick="${escapeHtml(game.id)}:all" ${locked ? 'disabled' : ''}>All</button>
            <button class="link-button" type="button" data-game-pick="${escapeHtml(game.id)}:none" ${locked ? 'disabled' : ''}>None</button>
          </span>
        </div>
      </header>
      ${game.installed
        ? `<div class="game-file-bar"><span class="mono">${escapeHtml(game.fileLabel)}</span>${game.files.length > 1 ? `<span class="badge muted">${game.files.length} Steam accounts</span>` : ''}${hasBackup ? `<span class="badge lime">Backup active (${game.applied.settingIds.length} setting${game.applied.settingIds.length === 1 ? '' : 's'})</span>` : ''}</div>`
        : `<p class="game-file game-missing">Config path: <span class="mono">${escapeHtml(game.expectedPath || game.fileLabel)}</span>. Launch ${escapeHtml(game.name)} once to generate its config file, then click Re-check games.</p>`}
      <div class="game-settings">
        ${game.settings.map((setting) => settingRow(game, setting, selected, locked)).join('')}
      </div>
      <footer class="game-foot">
        <div class="game-foot-buttons">
          <button class="button button-primary" type="button" data-game-max-fps="${escapeHtml(game.id)}" ${locked || !game.maxFps?.some((setting) => setting.available && !setting.optimized) ? 'disabled' : ''}>${icon('zap')} Review Max FPS</button>
          <button class="button" type="button" data-game-apply="${escapeHtml(game.id)}" ${locked || !count ? 'disabled' : ''}>${icon('zap')} <span data-game-apply-label="${escapeHtml(game.id)}">Apply ${count} setting${count === 1 ? '' : 's'}</span></button>
          <button class="button" type="button" data-game-restore="${escapeHtml(game.id)}" ${!hasBackup || game.running ? 'disabled' : ''} title="${hasBackup ? 'Restore all original backed-up settings for this game' : 'Apply settings first to create a restore point for this game'}">${icon('undo')} Restore original${hasBackup ? ` (${game.applied.settingIds.length})` : ''}</button>
        </div>
        <details class="game-tips">
          <summary>Notes &amp; behavior</summary>
          <ul>${tips}</ul>
        </details>
      </footer>
    </article>`;
}

export function renderGames() {
  if (state.gamesError) {
    return `
      <div class="empty-state" style="margin:40px auto;max-width:480px;text-align:center">
        <div class="empty-icon">${icon('alert', 24)}</div>
        <h3 style="margin:12px 0 6px">Could not load game profiles</h3>
        <p style="color:var(--muted);font-size:13px;line-height:1.5;margin-bottom:18px">${escapeHtml(state.gamesError)}</p>
        <button class="button button-primary" id="retry-games-btn" type="button">${icon('refresh')} Retry scan</button>
      </div>`;
  }
  if (!Array.isArray(state.games)) {
    return '<div class="page-loading"><div class="loading-orbit"></div><p>Scanning game configurations…</p></div>';
  }
  const activeFilter = state.gameFilter || 'all';
  const visibleGames = activeFilter === 'all'
    ? state.games
    : state.games.filter((g) => g.id === activeFilter);
  const anyApplied = state.games.some((g) => g.applied && g.applied.settingIds?.length);
  const filterTabs = `
    <div class="game-filter-bar" role="tablist" aria-label="Filter games">
      <button type="button" class="tab ${activeFilter === 'all' ? 'active' : ''}" data-game-filter="all">All (${state.games.length})</button>
      ${state.games.map((g) => `
        <button type="button" class="tab ${activeFilter === g.id ? 'active' : ''}" data-game-filter="${escapeHtml(g.id)}">
          ${escapeHtml(g.name)}
          ${g.applied?.settingIds?.length ? `<span class="badge lime">${g.applied.settingIds.length}</span>` : g.installed ? '<span class="badge green">Ready</span>' : ''}
        </button>`).join('')}
      <div style="display:flex;gap:8px;margin-left:auto;flex-wrap:wrap">
        <button class="button button-small" type="button" data-action="restore-all-games" ${anyApplied ? '' : 'disabled'} title="Restore all games back to their original settings">${icon('undo')} Restore all games</button>
        <button class="button button-small" type="button" data-action="recheck-games">${icon('refresh')} Refresh</button>
      </div>
    </div>`;
  const infoBanner = `
    <div class="panel" style="margin-bottom:14px;padding:14px 18px;display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap;background:rgba(255,255,255,0.02);border:1px solid var(--line);border-radius:12px">
      <div style="display:flex;align-items:center;gap:12px">
        <span style="font-size:22px">🎮</span>
        <div>
          <strong style="font-size:13px;font-weight:650;display:block">Per-game FPS tuning</strong>
          <small style="color:var(--muted);font-size:11px;display:block;margin-top:2px">
            Preview Max FPS to trade visual detail for higher frame rates. Compare average FPS and 1% lows in the same scene before and after. Use Restore original if frame times or visibility get worse.
          </small>
        </div>
      </div>
      <div>
        <a class="button button-small" href="ms-settings:display-advancedgraphics">Windows graphics settings</a>
        <p class="small muted">On a dual-GPU PC, set the game executable to High performance.</p>
      </div>
    </div>`;
  return `
    ${infoBanner}
    ${filterTabs}
    <div class="game-grid">${visibleGames.map(gameCard).join('')}</div>
    ${state.games.some((game) => game.installed) ? '' : emptyState('gamepad', 'No supported game configs detected', 'Launch Fortnite, Counter-Strike 2, or Minecraft once so it creates its config file, then click Refresh.')}
  `;
}

function updateApplyButton(gameId) {
  const game = state.games?.find((item) => item.id === gameId);
  if (!game) return;
  const selection = selectionFor(game);
  const count = game.settings.filter((setting) => setting.available && selection.has(setting.id)).length;
  const button = document.querySelector(`[data-game-apply="${gameId}"]`);
  const label = document.querySelector(`[data-game-apply-label="${gameId}"]`);
  if (label) label.textContent = `Apply ${count} setting${count === 1 ? '' : 's'}`;
  if (button) button.disabled = !count || !game.installed || game.running;
}

async function applySelected(gameId) {
  const game = state.games?.find((item) => item.id === gameId);
  if (!game) return;
  const selected = selectionFor(game);
  const ids = game.settings.filter((setting) => setting.available && selected.has(setting.id)).map((setting) => setting.id);
  if (!ids.length) {
    toast('info', 'Nothing selected', 'Tick at least one setting to apply.');
    return;
  }
  const button = document.querySelector(`[data-game-apply="${gameId}"]`);
  if (button) button.disabled = true;
  try {
    const data = await api('/api/games/apply', { method: 'POST', body: { gameId, settingIds: ids } });
    replaceGame(data.game);
    state.history = null;
    const count = data.result.applied.length;
    toast(count ? 'success' : 'info', count ? 'Game settings applied' : 'Already configured', `${count} setting${count === 1 ? '' : 's'} changed.`);
  } catch (error) {
    toast('error', `Could not tune ${game.name}`, error.message);
  } finally {
    requestRender();
  }
}

function reviewMaxFps(gameId) {
  const game = state.games?.find((item) => item.id === gameId);
  if (!game?.installed || game.running) return;
  const pending = (game.maxFps || []).filter((setting) => setting.available && !setting.optimized);
  if (!pending.length) return;
  openModal({
    title: `Max FPS for ${game.name}`,
    body: `
      <p>This profile trades image quality for frame rate. Lower resolution and draw distance can make distant objects harder to see. Turning off V-Sync can cause tearing.</p>
      <ul class="modal-list">${pending.map((setting) => `<li>${escapeHtml(setting.label)} → ${escapeHtml(setting.recommended)}</li>`).join('')}</ul>
      ${game.id === 'fortnite' ? '<p>To try Epic’s Performance renderer, set it in Fortnite under Video → Rendering Mode and restart the game.</p>' : ''}
      ${game.id === 'cs2' ? '<p>CS2’s FPS limit and FidelityFX Super Resolution are configured in the game.</p>' : ''}
      <p>Restore original is available on the game card.</p>`,
    confirmLabel: 'Apply Max FPS',
    onConfirm: async () => {
      const data = await api('/api/games/apply', { method: 'POST', body: { gameId, profile: 'max-fps' } });
      replaceGame(data.game);
      if (state.gameSelections) delete state.gameSelections[gameId];
      state.history = null;
      const count = data.result.applied.length;
      toast(count ? 'success' : 'info', count ? 'Max FPS applied' : 'Already configured',
        `${game.name} · ${count} setting${count === 1 ? '' : 's'} changed.`);
      requestRender();
    },
  });
}

async function restoreSingleSetting(gameId, settingId) {
  const game = state.games?.find((item) => item.id === gameId);
  if (!game) return;
  const setting = game.settings.find((item) => item.id === settingId);
  try {
    const data = await api('/api/games/revert', {
      method: 'POST',
      body: { gameId, settingIds: [settingId] },
    });
    replaceGame(data.game);
    state.history = null;
    toast('success', `${setting ? setting.label : 'Setting'} restored`, `Restored in ${game.name}.`);
  } catch (error) {
    toast('error', `Could not restore setting`, error.message);
  } finally {
    requestRender();
  }
}

async function restoreGame(gameId) {
  const game = state.games?.find((item) => item.id === gameId);
  if (!game) return;
  try {
    const data = await api('/api/games/revert', { method: 'POST', body: { gameId } });
    replaceGame(data.game);
    state.gameSelections = state.gameSelections || {};
    delete state.gameSelections[gameId];
    state.history = null;
    toast('success', `${game.name} restored`, 'Original settings restored.');
  } catch (error) {
    toast('error', `Could not restore ${game.name}`, error.message);
  } finally {
    requestRender();
  }
}

async function restoreAllGames() {
  const activeGames = (state.games || []).filter((g) => g.applied && g.applied.settingIds?.length);
  if (!activeGames.length) return;
  try {
    for (const game of activeGames) {
      const data = await api('/api/games/revert', { method: 'POST', body: { gameId: game.id } });
      replaceGame(data.game);
      if (state.gameSelections) delete state.gameSelections[game.id];
    }
    state.history = null;
    toast('success', 'All game settings restored', 'Every game is back to its original configuration.');
  } catch (error) {
    toast('error', 'Could not restore all games', error.message);
  } finally {
    requestRender();
  }
}

export async function loadGames(force = false) {
  const data = await api(force ? '/api/games?force=1' : '/api/games');
  state.games = data.games;
}

export function bindGames() {
  document.getElementById('retry-games-btn')?.addEventListener('click', async () => {
    state.gamesError = null;
    state.games = null;
    requestRender();
    try {
      await loadGames();
    } catch (err) {
      state.gamesError = err.message;
    }
    requestRender();
  });
  document.querySelectorAll('[data-game-filter]').forEach((button) => {
    button.addEventListener('click', () => {
      state.gameFilter = button.getAttribute('data-game-filter') || 'all';
      requestRender();
    });
  });
  document.querySelectorAll('[data-game-setting]').forEach((input) => {
    input.addEventListener('change', () => {
      const [gameId, settingId] = input.getAttribute('data-game-setting').split(':');
      const game = state.games?.find((item) => item.id === gameId);
      if (!game) return;
      const selected = selectionFor(game);
      if (input.checked) selected.add(settingId);
      else selected.delete(settingId);
      updateApplyButton(gameId);
    });
  });
  document.querySelectorAll('[data-game-pick]').forEach((button) => {
    button.addEventListener('click', () => {
      const [gameId, mode] = button.getAttribute('data-game-pick').split(':');
      const game = state.games?.find((item) => item.id === gameId);
      if (!game) return;
      const next = new Set();
      for (const setting of game.settings) {
        if (setting.available && (mode === 'all' || (mode === 'recommended' && setting.defaultOn && !setting.optimized))) next.add(setting.id);
      }
      state.gameSelections[gameId] = next;
      requestRender();
    });
  });
  document.querySelectorAll('[data-game-max-fps]').forEach((button) => {
    button.addEventListener('click', () => reviewMaxFps(button.getAttribute('data-game-max-fps')));
  });
  document.querySelectorAll('[data-game-apply]').forEach((button) => {
    button.addEventListener('click', () => applySelected(button.getAttribute('data-game-apply')));
  });
  document.querySelectorAll('[data-game-restore]').forEach((button) => {
    button.addEventListener('click', () => restoreGame(button.getAttribute('data-game-restore')));
  });
  document.querySelectorAll('[data-game-restore-one]').forEach((button) => {
    button.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      const [gameId, settingId] = button.getAttribute('data-game-restore-one').split(':');
      restoreSingleSetting(gameId, settingId);
    });
  });
  document.querySelectorAll('[data-action="restore-all-games"]').forEach((button) => {
    button.addEventListener('click', restoreAllGames);
  });
  document.querySelectorAll('[data-action="recheck-games"]').forEach((button) => {
    button.addEventListener('click', async () => {
      button.disabled = true;
      try {
        await loadGames(true);
        toast('success', 'Games re-checked');
      } catch (error) {
        toast('error', 'Could not check games', error.message);
      }
      requestRender();
    });
  });
}
