import { icon, escapeHtml, formatBytes, toast, openModal, api, hydrateIcons } from './core.js';

export async function openBoostModal(button) {
  if (button?.disabled) return;
  if (button) button.disabled = true;
  let apps;
  try {
    const data = await api('/api/boost/apps');
    apps = data.apps;
  } catch (error) {
    toast('error', 'Could not measure background apps', error.message);
    return;
  } finally {
    if (button) button.disabled = false;
  }

  const rows = apps.length
    ? apps.map((app) => `
        <label class="boost-app">
          <input type="checkbox" value="${escapeHtml(app.name)}">
          <span class="boost-app-name">${escapeHtml(app.label)}</span>
          <span class="boost-app-mem mono">${app.cpuPercent.toFixed(1)}% CPU · ${formatBytes(app.memory)} RAM</span>
        </label>`).join('')
    : '<p class="small muted">No supported apps with an open window were found.</p>';

  openModal({
    title: 'Pre-game boost',
    body: `
      <p>CPU use is sampled for half a second. Close apps only if you can pause their work. Save your work first.</p>
      <div class="boost-list" id="boost-apps">${rows}</div>`,
    confirmLabel: apps.length ? 'Close selected apps' : 'Done',
    hideCancel: !apps.length,
    onConfirm: apps.length ? async () => {
      const closeApps = Array.from(document.querySelectorAll('#boost-apps input:checked')).map((input) => input.value);
      if (!closeApps.length) return;
      const { result } = await api('/api/boost', { method: 'POST', body: { closeApps } });
      const closed = result.closed.reduce((sum, item) => sum + item.closed, 0);
      const remaining = result.closed.filter((item) => item.stillRunning > 0).map((item) => item.name);
      const detail = closed ? `${closed} process${closed === 1 ? '' : 'es'} exited.` : 'No selected processes exited.';
      if (remaining.length) {
        toast('info', 'Some apps are still running', `${detail} Check ${remaining.join(', ')} for save prompts or tray activity.`);
      } else {
        toast(closed ? 'success' : 'info', 'Background app check complete', detail);
      }
    } : null,
  });
  hydrateIcons(document.getElementById('modal-root'));
}

export function boostIcon() {
  return icon('zap');
}

