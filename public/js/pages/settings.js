import {
  state,
  icon,
  escapeHtml,
  toast,
  openModal,
  elevate,
  api,
  applyBodyPreferences,
  undoAll,
  requestRender,
  quitNexa,
  copyText,
  checkForUpdates,
  promptAndInstallUpdate,
} from '../core.js';
import { sectionHead, metricRow } from '../ui.js';
import { downloadReport } from './activity.js';

const DEFAULT_SETTINGS = {
  showAdvanced: true,
  autoRestorePoint: false,
  pingCount: 10,
  reduceMotion: false,
  compactMode: false,
  runInBackground: true,
};

function isSettingEnabled(key) {
  if (key === 'runInBackground' || key === 'showAdvanced') {
    return state.settings[key] !== false;
  }
  return state.settings[key] === true;
}

function toggleRow(key, title, description) {
  const enabled = isSettingEnabled(key);
  return `
    <div class="setting-row">
      <div class="setting-copy">
        <strong>${escapeHtml(title)}</strong>
        <p>${escapeHtml(description)}</p>
      </div>
      <button class="switch ${enabled ? 'on' : ''}" type="button" role="switch" aria-checked="${enabled}" aria-label="${escapeHtml(title)}" data-setting-toggle="${escapeHtml(key)}"></button>
    </div>`;
}

function accessCard() {
  const admin = state.snapshot?.admin === true;
  return `
    <div class="card card-pad">
      <div class="card-header"><div><h2>Access</h2><p>Nexa works without admin, but system-wide fixes need it.</p></div></div>
      <div class="setting-row">
        <div class="setting-copy">
          <strong>${admin ? 'Administrator session' : 'Standard user session'}</strong>
          <p>${admin ? 'Every Nexa fix is available. Changes still require your confirmation.' : 'User-level fixes work now. Windows-wide settings, DNS and system cleanup need an elevated session.'}</p>
        </div>
        <div class="setting-control">
          ${admin
            ? `<span class="badge lime">${icon('shield')} Administrator</span>`
            : `<button class="button button-primary" type="button" data-action="elevate">${icon('lock')} Restart as admin</button>`}
        </div>
      </div>
      <div class="setting-row">
        <div class="setting-copy">
          <strong>Windows restore point</strong>
          <p>Create a System Restore checkpoint before making bigger changes. Requires administrator access and System Restore enabled.</p>
        </div>
        <div class="setting-control">
          <button class="button button-small" type="button" data-action="restore-point">${icon('shield')} Create point</button>
        </div>
      </div>
    </div>`;
}

function experienceCard() {
  return `
    <div class="card card-pad">
      <div class="card-header"><div><h2>Experience</h2><p>Make Nexa feel right for you.</p></div></div>
      ${toggleRow('runInBackground', 'Run in the background', 'Keeps Nexa active in the background when unfocused or closed. Turn off to pause when unfocused and stop Nexa when you close the window.')}
      ${toggleRow('reduceMotion', 'Reduce motion', 'Turns off ambient animation and smooth transitions. Useful for motion sensitivity or older hardware.')}
      ${toggleRow('compactMode', 'Compact layout', 'Tightens spacing so more information fits on screen.')}
      ${toggleRow('showAdvanced', 'Show the Advanced page', 'Keeps expert-level, higher-risk tweaks in the sidebar. Safe mode stays the default.')}
    </div>`;
}

function safetyCard() {
  const pingCount = Number(state.settings.pingCount) || 10;
  const counts = [5, 10, 15, 20];
  return `
    <div class="card card-pad">
      <div class="card-header"><div><h2>Scans & safety</h2><p>Control how Nexa measures and protects your setup.</p></div></div>
      ${toggleRow('autoRestorePoint', 'Create a restore point before applying fixes', 'When Nexa is elevated, it asks Windows for a restore point before the first batch of changes. This can take a little while.')}
      <div class="setting-row">
        <div class="setting-copy">
          <strong>Ping samples per test</strong>
          <p>More samples give a steadier average and jitter reading. 10 is a good balance for most connections.</p>
        </div>
        <div class="setting-control">
          <select class="select settings-select" data-setting-select="pingCount" aria-label="Ping samples per test">
            ${counts.map((count) => `<option value="${count}" ${count === pingCount ? 'selected' : ''}>${count} pings</option>`).join('')}
          </select>
        </div>
      </div>
    </div>`;
}

function dataCard() {
  const admin = state.snapshot?.admin === true;
  const update = state.updateInfo;
  return `
    <div class="card card-pad">
      <div class="card-header"><div><h2>Data, updates & reports</h2><p>Everything Nexa knows lives on this PC. Update in place anytime without reinstalling.</p></div></div>
      <div class="kv-list settings-about">
        ${metricRow('Installed version', `Nexa Optimize v${state.version}`)}
        ${metricRow('Update status', update ? (update.updateAvailable ? `v${update.latestVersion} available` : `Up to date (v${update.currentVersion})`) : 'Not checked yet')}
        ${metricRow('Session', admin ? 'Administrator' : 'Standard user')}
        ${metricRow('Local port', state.port ? String(state.port) : '—')}
        ${metricRow('Data folder', state.dataDir || 'data')}
      </div>
      <div class="settings-actions">
        ${update?.updateAvailable
          ? `<button class="button button-small button-primary" type="button" data-action="install-update">${icon('download')} Update to v${escapeHtml(update.latestVersion)} & restart</button>`
          : `<button class="button button-small button-primary" type="button" data-action="check-update">${icon('refresh')} Check for updates</button>`}
        <button class="button button-small" type="button" data-action="open-data">${icon('folder')} Open data folder</button>
        <button class="button button-small" type="button" data-action="copy-data-path">${icon('copy')} Copy path</button>
        <button class="button button-small" type="button" data-action="export-report">${icon('download')} Export report</button>
        <button class="button button-small" type="button" data-action="post-review">${icon('star')} Post verified review</button>
      </div>
      <p class="small muted" style="margin:12px 0 0;line-height:1.6">In-app updates verify the official SHA-256 release hash before updating and never overwrite your local backups or settings.</p>
    </div>`;
}

function dangerCard() {
  const applied = Object.keys(state.applied || {}).length;
  return `
    <div class="card card-pad danger-zone">
      <div class="card-header"><div><h2>Reset & maintenance</h2><p>Undo Nexa changes, restore default preferences or stop the app.</p></div></div>
      <div class="setting-row">
        <div class="setting-copy">
          <strong>Undo every Nexa change</strong>
          <p>${applied ? `${applied} backed-up change${applied === 1 ? '' : 's'} can be restored.` : 'No Nexa changes are currently active.'}</p>
        </div>
        <div class="setting-control">
          <button class="button button-small button-danger" type="button" data-action="undo-all" ${applied ? '' : 'disabled'}>${icon('undo')} Undo all</button>
        </div>
      </div>
      <div class="setting-row">
        <div class="setting-copy">
          <strong>Reset Nexa preferences</strong>
          <p>Restores the default appearance, scan and advanced-page settings. It does not touch Windows settings or your activity log.</p>
        </div>
        <div class="setting-control">
          <button class="button button-small" type="button" data-action="reset-settings">${icon('refresh')} Reset</button>
        </div>
      </div>
      <div class="setting-row">
        <div class="setting-copy">
          <strong>Quit Nexa</strong>
          <p>Stops the local server. Applied Windows changes remain until you undo them.</p>
        </div>
        <div class="setting-control">
          <button class="button button-small" type="button" data-action="quit">${icon('power')} Quit</button>
        </div>
      </div>
    </div>`;
}

export function renderSettings() {
  return `
    <div class="settings-grid">
      ${accessCard()}
      ${experienceCard()}
      ${safetyCard()}
      ${dataCard()}
      ${dangerCard()}
    </div>
  `;
}

async function saveSetting(key, value) {
  const previous = state.settings[key];
  state.settings[key] = value;
  applyBodyPreferences();
  requestRender();
  try {
    const data = await api('/api/settings', { method: 'POST', body: { [key]: value } });
    state.settings = data.settings;
    applyBodyPreferences();
  } catch (error) {
    state.settings[key] = previous;
    applyBodyPreferences();
    toast('error', 'Could not save that setting', error.message);
    requestRender();
  }
}

function createRestorePoint(button) {
  if (!state.snapshot?.admin) {
    openModal({
      title: 'Administrator access needed',
      body: '<p>Creating a Windows restore point requires administrator rights.</p>',
      confirmLabel: 'Restart as administrator',
      onConfirm: elevate,
    });
    return;
  }
  if (button) {
    button.disabled = true;
    button.innerHTML = `${icon('refresh')} Creating…`;
  }
  api('/api/restore-point', { method: 'POST', body: {} })
    .then(() => toast('success', 'Restore point created', 'Windows System Restore can roll back system changes.'))
    .catch((error) => toast('error', 'Could not create restore point', error.message))
    .finally(() => {
      if (button) {
        button.disabled = false;
        button.innerHTML = `${icon('shield')} Create point`;
      }
    });
}

function undoEverything() {
  const applied = Object.keys(state.applied || {}).length;
  if (!applied) {
    toast('info', 'Nothing to undo', 'Nexa has no active changes with backups.');
    return;
  }
  openModal({
    title: 'Undo every Nexa change?',
    body: '<p>Nexa will restore every setting it backed up. Some changes need a reboot or reconnect to fully revert.</p>',
    confirmLabel: 'Undo all changes',
    danger: true,
    onConfirm: async () => {
      const response = await undoAll();
      const failed = (response.results || []).filter((result) => !result.ok);
      if (failed.length) toast('warn', 'Some changes could not be undone', failed.map((item) => item.error).join(' · '));
      else toast('success', 'All Nexa changes undone');
      requestRender();
    },
  });
}

function resetSettings() {
  openModal({
    title: 'Reset Nexa preferences?',
    body: '<p>This restores default appearance and scan preferences. Windows settings and the activity log are not affected.</p>',
    confirmLabel: 'Reset preferences',
    onConfirm: async () => {
      const data = await api('/api/settings', { method: 'POST', body: DEFAULT_SETTINGS });
      state.settings = data.settings;
      applyBodyPreferences();
      toast('success', 'Preferences reset');
      requestRender();
    },
  });
}

export function bindSettings() {
  document.querySelectorAll('[data-setting-toggle]').forEach((button) => {
    button.addEventListener('click', () => {
      const key = button.getAttribute('data-setting-toggle');
      saveSetting(key, !isSettingEnabled(key));
    });
  });
  document.querySelectorAll('[data-setting-select]').forEach((select) => {
    select.addEventListener('change', () => {
      const key = select.getAttribute('data-setting-select');
      const value = key === 'pingCount' ? Number(select.value) : select.value;
      saveSetting(key, value);
    });
  });
  document.querySelectorAll('[data-action="elevate"]').forEach((button) => {
    button.addEventListener('click', elevate);
  });
  document.querySelectorAll('[data-action="restore-point"]').forEach((button) => {
    button.addEventListener('click', () => createRestorePoint(button));
  });
  document.querySelectorAll('[data-action="open-data"]').forEach((button) => {
    button.addEventListener('click', async () => {
      try {
        await api('/api/app/open-data', { method: 'POST', body: {} });
      } catch (error) {
        toast('error', 'Could not open the data folder', error.message);
      }
    });
  });
  document.querySelectorAll('[data-action="copy-data-path"]').forEach((button) => {
    button.addEventListener('click', () => copyText(state.dataDir || 'data'));
  });
  document.querySelectorAll('[data-action="export-report"]').forEach((button) => {
    button.addEventListener('click', downloadReport);
  });
  document.querySelectorAll('[data-action="post-review"]').forEach((button) => {
    button.addEventListener('click', () => {
      const cpu = state.snapshot?.cpu?.name || 'Unknown CPU';
      const gpuList = (state.snapshot?.gpus || []).map((g) => g.name).filter(Boolean);
      const gpu = gpuList.length > 0 ? gpuList.join(', ') : 'Unknown GPU';
      const ram = state.snapshot?.memory?.totalGb ? `${state.snapshot.memory.totalGb} GB` : 'Unknown RAM';
      const score = state.scan?.score !== undefined ? `${state.scan.score}/100` : 'Not scanned';
      const version = `v${state.version || '1.9.0'}`;
      const nicMsi = (state.msiMode || []).find((m) => m.deviceType === 'Network')?.msiSupported ? 'Supported' : 'Standard';

      const title = encodeURIComponent(`[Review]: ${cpu} + ${gpu} (Score: ${score})`);
      const specs = `CPU: ${cpu}\nGPU: ${gpu}\nRAM: ${ram}\nNexa Readiness Score: ${score}\nActive NIC MSI Mode: ${nicMsi}\nNexa Version: ${version}`;
      
      const issueUrl = `https://github.com/riksitis1/nova-optimize-web/issues/new?template=review.yml&title=${title}&specs=${encodeURIComponent(specs)}`;
      window.open(issueUrl, '_blank');
    });
  });
  document.querySelectorAll('[data-action="check-update"]').forEach((button) => {
    button.addEventListener('click', async () => {
      button.disabled = true;
      button.innerHTML = `${icon('refresh')} Checking…`;
      await checkForUpdates({ silent: false });
      requestRender();
    });
  });
  document.querySelectorAll('[data-action="install-update"]').forEach((button) => {
    button.addEventListener('click', () => promptAndInstallUpdate());
  });
  document.querySelectorAll('[data-action="undo-all"]').forEach((button) => {
    button.addEventListener('click', undoEverything);
  });
  document.querySelectorAll('[data-action="reset-settings"]').forEach((button) => {
    button.addEventListener('click', resetSettings);
  });
  document.querySelectorAll('[data-action="quit"]').forEach((button) => {
    button.addEventListener('click', quitNexa);
  });
}
