import { icon, escapeHtml, formatBytes, toast, openModal, api, hydrateIcons } from './core.js';

export async function openBoostModal(button, onComplete) {
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
    title: 'Close background apps',
    body: `
      <p>Close apps only if you can pause their work. Save your work first. Listed RAM is the process working set and can include shared memory.</p>
      <div class="boost-list" id="boost-apps">${rows}</div>`,
    confirmLabel: apps.length ? 'Close selected apps' : 'Done',
    hideCancel: !apps.length,
    onConfirm: apps.length ? async () => {
      const closeApps = Array.from(document.querySelectorAll('#boost-apps input:checked')).map((input) => input.value);
      if (!closeApps.length) return;
      const { result } = await api('/api/boost', { method: 'POST', body: { closeApps } });
      const closed = result.closed.reduce((sum, item) => sum + item.closed, 0);
      const remaining = result.closed.filter((item) => item.stillRunning > 0).map((item) => item.name);
      const measured = result.memory ? ` Available RAM changed from ${formatBytes(result.memory.before.availableBytes)} to ${formatBytes(result.memory.after.availableBytes)}. Other running apps affect this reading.` : '';
      const detail = (closed ? `${closed} process${closed === 1 ? '' : 'es'} exited.` : 'No selected processes exited.') + measured;
      if (remaining.length) {
        toast('info', 'Some apps are still running', `${detail} Check ${remaining.join(', ')} for save prompts or tray activity.`);
      } else {
        toast(closed ? 'success' : 'info', 'Background app check complete', detail);
      }
      if (onComplete) onComplete(result);
    } : null,
  });
  hydrateIcons(document.getElementById('modal-root'));
}

export function boostIcon() {
  return icon('zap');
}

