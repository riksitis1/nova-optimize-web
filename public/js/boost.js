import { state, icon, escapeHtml, formatBytes, toast, openModal, api, hydrateIcons } from './core.js';

/**
 * Pre-game boost: flush DNS, reclaim idle RAM, and (optionally) politely close
 * a fixed list of background apps. Nothing is force-killed.
 */
export async function openBoostModal() {
  let apps = [];
  try {
    const data = await api('/api/boost/apps');
    apps = data.apps || [];
  } catch {
    apps = [];
  }

  const rows = apps.length
    ? apps.map((app) => `
        <label class="boost-app">
          <input type="checkbox" value="${escapeHtml(app.name)}" ${app.defaultOn ? 'checked' : ''}>
          <span class="boost-app-name">${escapeHtml(app.label)}</span>
          <span class="boost-app-mem mono">${formatBytes(app.memory)}</span>
        </label>`).join('')
    : '<p class="small muted" style="margin:0">None of the optional background apps are running right now. Nova will still flush DNS and trim idle RAM.</p>';

  openModal({
    title: 'Pre-game boost',
    body: `
      <p>Before you play, Nova will flush the DNS cache and give back RAM that idle background programs are holding. You can also ask these apps to close like pressing their X button. Nothing is force-killed, so unsaved work can still prompt you.</p>
      <div class="boost-list" id="boost-apps">${rows}</div>
      <p class="small muted" style="margin:12px 0 0">Microsoft Edge is never on this list because Nova runs in it.</p>`,
    confirmLabel: 'Boost now',
    onConfirm: async () => {
      const closeApps = Array.from(document.querySelectorAll('#boost-apps input:checked')).map((input) => input.value);
      const data = await api('/api/boost', { method: 'POST', body: { closeApps } });
      if (data.telemetry) state.telemetry = data.telemetry;
      const freedMb = Math.round(((Number(data.result?.memory?.freedBytes) || 0) / 1024 ** 2) * 10) / 10;
      const closed = (data.result?.closed || []).reduce((sum, item) => sum + (Number(item.closed) || 0), 0);
      const stuck = (data.result?.closed || []).filter((item) => item.stillRunning > 0).map((item) => item.name);
      toast(
        'success',
        'Ready to play',
        `${closed ? `Closed ${closed} process${closed === 1 ? '' : 'es'} · ` : ''}${freedMb > 0 ? `${freedMb} MB RAM freed · ` : ''}DNS flushed`,
      );
      if (stuck.length) toast('info', 'Still running', `${stuck.join(', ')} asked to stay open (a save prompt may be waiting).`);
    },
  });
  hydrateIcons(document.getElementById('modal-root'));
}

export function boostIcon() {
  return icon('zap');
}

