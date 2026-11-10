import {
  state,
  icon,
  escapeHtml,
  formatBytes,
  formatNumber,
  formatUptime,
  findActiveAdapter,
  adapterSpeedLabel,
  navigate,
  requestRender,
  toast,
  openModal,
  applyActions,
  undoAll,
  elevate,
  api,
} from '../core.js';
import { openBoostModal } from '../boost.js';
import { optimizePc } from './optimize.js';
import {
  scoreRing,
  statCard,
  severityBadge,
  sectionHead,
  emptyState,
  drawLineChart,
  drawSparkline,
  drawPerCore,
  latencyTone,
  latencyGrade,
  metricRow,
  bufferbloatText,
} from '../ui.js';

const START_TOOLS = [
  ['games', 'gamepad', 'Tune a game', 'Preview settings for Fortnite, CS2, or Minecraft Java.'],
  ['optimize', 'sliders', 'Review Windows', 'Check display, power, capture, and background activity.'],
  ['benchmark', 'pulse', 'Compare frame times', 'See what changed with two PresentMon captures.'],
];

function startPanel() {
  return `<section class="card card-pad start-panel" aria-labelledby="start-title">
    <div class="start-intro">
      <div>
        <h2 id="start-title">Get your PC ready to play</h2>
        <p>Choose what to tune, then compare the same scene before and after.</p>
      </div>
      <div class="start-actions">
        <button class="button button-primary" type="button" data-action="optimize-pc">${icon('spark')} Optimize PC</button>
        <button class="button" type="button" data-action="pre-game">${icon('zap')} Close background apps</button>
      </div>
    </div>
    <div class="start-tools">
      ${START_TOOLS.map(([route, glyph, label, description]) => `
        <a class="start-tool" href="#/${route}">
          <span class="start-tool-icon">${icon(glyph, 18)}</span>
          <span><strong>${label}</strong><small>${description}</small></span>
          <span class="start-tool-arrow">${icon('arrow', 16)}</span>
        </a>`).join('')}
    </div>
  </section>`;
}

function quickWinsHtml(scan) {
  if (!scan.quickWins.length) {
    return emptyState('check', 'No quick fixes found', 'Open Windows to review optional settings, or tune an individual game.');
  }
  const isSingle = scan.quickWins.length === 1;
  return `<div class="quick-wins ${isSingle ? 'single-win' : ''}">${scan.quickWins.map((finding) => {
    const action = finding.actionId ? scan.actions.find((item) => item.id === finding.actionId) : null;
    const needsAdmin = action?.requiresAdmin && !state.snapshot?.admin;
    return `
      <article class="quick-win">
        <div class="quick-win-top">${severityBadge(finding.severity)}${finding.category ? `<span class="badge muted">${escapeHtml(finding.category)}</span>` : ''}</div>
        <h3>${escapeHtml(finding.title)}</h3>
        <p>${escapeHtml(finding.description)}</p>
        <div class="quick-win-foot">
          ${finding.actionId
            ? `<button class="button ${needsAdmin ? '' : 'button-primary'}" type="button" data-quick-apply="${escapeHtml(finding.actionId)}">${needsAdmin ? icon('lock') + ' Admin required' : icon('zap') + ' Apply fix'}</button>`
            : `<button class="button" type="button" data-nav="${escapeHtml(finding.page || 'optimize')}">${icon('arrow')} Review</button>`}
          <button class="button button-ghost" type="button" data-quick-review="${escapeHtml(finding.actionId || finding.page || 'optimize')}">Details</button>
        </div>
      </article>`;
  }).join('')}</div>`;
}

function statCardsHtml() {
  const telemetry = state.telemetry;
  const snapshot = state.snapshot;
  const cpu = telemetry?.cpu;
  const memory = telemetry?.memory;
  const gpu = telemetry?.gpu;
  const primaryGpu = snapshot?.gpus?.find((item) => !/Microsoft Basic/i.test(item.name || '')) || snapshot?.gpus?.[0];
  const disk = telemetry?.disk;
  const cpuValue = cpu ? Math.round(cpu.usage) : '—';
  const memoryValue = memory ? Math.round(memory.usagePercent) : (snapshot?.computer?.memoryUsagePercent ? Math.round(snapshot.computer.memoryUsagePercent) : '—');
  const gpuValue = gpu && Number.isFinite(gpu.usage) ? Math.round(gpu.usage) : '—';
  const diskValue = disk ? Math.round(disk.usedPercent) : (snapshot?.bootDisk && snapshot.bootDisk.size ? Math.round(((snapshot.bootDisk.size - snapshot.bootDisk.free) / snapshot.bootDisk.size) * 100) : '—');

  const diskType = snapshot?.physicalDisks?.[0]?.busType ? `${snapshot.physicalDisks[0].busType} ` : '';
  const diskMedia = snapshot?.physicalDisks?.[0]?.mediaType ? `${snapshot.physicalDisks[0].mediaType} · ` : '';
  const memSub = memory
    ? `${formatBytes(memory.used)} / ${formatBytes(memory.total)} used`
    : snapshot?.computer?.totalRam
      ? `${formatBytes((snapshot.computer.totalRam * (snapshot.computer.memoryUsagePercent || 0)) / 100)} / ${formatBytes(snapshot.computer.totalRam)} used`
      : 'Waiting for telemetry';
  const diskSub = disk
    ? `${diskType}${diskMedia}${formatBytes(disk.free)} free on ${disk.drive}`
    : snapshot?.bootDisk
      ? `${diskType}${diskMedia}${formatBytes(snapshot.bootDisk.free)} free`
      : 'Waiting for storage data';

  return `
    <div class="grid-4">
      ${statCard({
        label: 'CPU load',
        value: cpuValue,
        unit: '%',
        sub: cpu ? `${cpu.cores} threads · ${cpu.model}` : snapshot?.cpu?.name || 'Waiting for telemetry',
        iconName: 'cpu',
        sparkId: 'cpu-spark',
        valueId: 'stat-cpu-value',
      })}
      ${statCard({
        label: 'Memory',
        value: memoryValue,
        unit: '%',
        sub: memSub,
        iconName: 'memory',
        sparkId: 'mem-spark',
        accent: 'cyan',
        valueId: 'stat-mem-value',
        subId: 'stat-mem-sub',
      })}
      ${statCard({
        label: 'GPU load',
        value: gpuValue,
        unit: '%',
        sub: gpu?.name
          ? `${gpu.name}${Number.isFinite(gpu.temperature) ? ` · ${gpu.temperature}°C` : ''}`
          : primaryGpu?.name?.trim() || 'No live GPU sensor',
        iconName: 'gpu',
        valueId: 'stat-gpu-value',
      })}
      ${statCard({
        label: 'Boot drive',
        value: diskValue,
        unit: '%',
        sub: diskSub,
        iconName: 'disk',
        valueId: 'stat-disk-value',
        subId: 'stat-disk-sub',
      })}
    </div>`;
}

function liveChartHtml() {
  return `
    <div class="card chart-card">
      <div class="card-header">
        <div>
          <h2>Live system</h2>
          <p>Updates while this panel is open and Nexa has focus.</p>
        </div>
        <div class="chart-legend"><span><span class="legend-dot"></span>CPU</span><span><span class="legend-dot cyan"></span>RAM</span></div>
      </div>
      <div class="chart-wrap"><canvas id="live-chart"></canvas></div>
      <div class="chart-wrap" style="height:44px;margin-top:4px"><canvas id="core-chart"></canvas></div>
    </div>`;
}

function processTable(processes) {
  const sortByCpu = state.processSort === 'cpu';
  const rows = ((sortByCpu ? processes.byCpu : processes.byMemory) || []).slice(0, 6);
  const maxMem = Math.max(1, ...(processes.byMemory || []).map((item) => Number(item.memory) || 0));
  const maxCpu = Math.max(1, ...(processes.byCpu || []).map((item) => Number(item.cpu) || 0));

  if (sortByCpu) {
    return `
      <table class="table">
        <thead><tr><th>Process</th><th class="bar-cell">CPU</th><th>Memory</th></tr></thead>
        <tbody>${rows.map((process) => {
          const cpuVal = Number(process.cpu) || 0;
          const barWidth = cpuVal > 0 ? Math.min(100, Math.max(6, (cpuVal / Math.max(10, maxCpu)) * 100)) : 0;
          return `
          <tr>
            <td class="name">${escapeHtml(process.name)}<div class="mono">PID ${process.pid}</div></td>
            <td class="bar-cell">
              <div class="meter"><span style="width:${barWidth}%"></span></div>
              <div class="mono" style="margin-top:4px"><strong class="${cpuVal >= 25 ? 'text-amber' : ''}">${formatNumber(cpuVal, 1)}%</strong>${process.totalCpu ? ` <span class="muted">(${formatNumber(process.totalCpu, 0)}s active)</span>` : ''}</div>
            </td>
            <td><strong>${formatBytes(process.memory)}</strong></td>
          </tr>`;
        }).join('') || '<tr><td colspan="3" class="muted">No process data.</td></tr>'}</tbody>
      </table>`;
  }

  return `
    <table class="table">
      <thead><tr><th>Process</th><th class="bar-cell">Memory</th><th>CPU</th></tr></thead>
      <tbody>${rows.map((process) => `
        <tr>
          <td class="name">${escapeHtml(process.name)}<div class="mono">PID ${process.pid}</div></td>
          <td class="bar-cell"><div class="meter"><span style="width:${Math.min(100, (process.memory / maxMem) * 100)}%"></span></div><div class="mono" style="margin-top:4px">${formatBytes(process.memory)}</div></td>
          <td><strong class="${process.cpu >= 25 ? 'text-amber' : ''}">${formatNumber(process.cpu, 1)}%</strong></td>
        </tr>`).join('') || '<tr><td colspan="3" class="muted">No process data.</td></tr>'}</tbody>
    </table>`;
}

function processesHtml() {
  const processes = state.processes;
  if (!processes) {
    return `<div class="card card-pad"><div class="card-header"><div><h2>Top processes</h2><p>Reading process activity…</p></div></div><div class="skeleton" style="height:150px"></div></div>`;
  }
  const sort = state.processSort === 'cpu' ? 'cpu' : 'memory';
  return `
    <div class="card card-pad">
      <div class="card-header">
        <div><h2>Top processes</h2><p>Sorted by ${sort === 'cpu' ? 'CPU' : 'memory'} use · <span id="process-count">${processes.processCount || 0}</span> processes</p></div>
        <div class="card-actions">
          <div class="tabs tabs-compact" role="group" aria-label="Sort processes">
            <button class="tab ${sort === 'memory' ? 'active' : ''}" type="button" data-process-sort="memory">Memory</button>
            <button class="tab ${sort === 'cpu' ? 'active' : ''}" type="button" data-process-sort="cpu">CPU</button>
          </div>
          <button class="button button-small button-ghost" type="button" data-action="refresh-processes">${icon('refresh')} Refresh</button>
        </div>
      </div>
      <div id="processes-body">${processTable(processes)}</div>
    </div>`;
}

function networkCardHtml() {
  const adapters = state.snapshot?.adapters || [];
  const active = findActiveAdapter(adapters);
  const results = Object.values(state.pingResults || {});
  const latest = results.sort((a, b) => new Date(b.testedAt || 0) - new Date(a.testedAt || 0))[0];
  return `
    <div class="card card-pad">
      <div class="card-header">
        <div><h2>Network at a glance</h2><p>${active ? `${escapeHtml(active.name)} · ${escapeHtml(adapterSpeedLabel(active))}` : 'No active adapter detected'}</p></div>
        <div class="card-actions"><button class="button button-small" type="button" data-nav="network">${icon('pulse')} Open lab</button></div>
      </div>
      ${latest ? `
        <div class="ping-stats">
          <div class="ping-stat"><span>Average</span><strong class="${latencyTone(latest.avg)}">${latest.avg ?? '—'} <small>ms</small></strong></div>
          <div class="ping-stat"><span>Jitter</span><strong>${latest.jitter ?? '—'} <small>ms</small></strong></div>
          <div class="ping-stat"><span>Packet loss</span><strong>${latest.loss ?? '—'}%</strong></div>
          <div class="ping-stat"><span>Route</span><strong style="font-size:12px">${escapeHtml(latest.host)}</strong></div>
        </div>
        <p class="small muted" style="margin:11px 0 0">${escapeHtml(latencyGrade(latest.avg))} · last tested ${new Date(latest.testedAt || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
      ` : emptyState('pulse', 'No route tested yet', 'Run a game route or internet latency test in the network lab.')}
    </div>`;
}

function profileHtml() {
  const snapshot = state.snapshot;
  if (!snapshot) return '';
  const primaryGpu = snapshot.gpus?.find((item) => !/Microsoft Basic/i.test(item.name || '')) || snapshot.gpus?.[0];
  const ramSpeed = snapshot.memoryModules?.find((item) => item.speed)?.speed;
  return `
    <div class="card card-pad">
      <div class="card-header"><div><h2>System profile</h2><p>What Nexa sees on this machine.</p></div></div>
      <div class="kv-list">
        ${metricRow('Windows', `${snapshot.os.caption} · build ${snapshot.os.build}`)}
        ${metricRow('CPU', snapshot.cpu?.name?.trim() || 'Unknown')}
        ${metricRow('GPU', primaryGpu?.name?.trim() || 'Unknown')}
        ${metricRow('Memory', `${formatBytes(snapshot.computer.totalRam)}${ramSpeed ? ` · ${ramSpeed} MT/s` : ''}`)}
        ${metricRow('Power plan', snapshot.power?.name || 'Unknown')}
        ${metricRow('Uptime', formatUptime(snapshot.os.uptimeSeconds))}
        ${metricRow('Secure Boot', snapshot.security?.secureBoot === true ? 'On' : snapshot.security?.secureBoot === false ? 'Off' : 'Unknown')}
      </div>
    </div>`;
}

function appliedHtml() {
  const appliedActions = (state.scan?.actions || []).filter((action) => action.appliedByNexa);
  if (!appliedActions.length) return '';
  return `
    <div class="card card-pad">
      <div class="card-header">
        <div><h2>Nexa changes on this PC</h2><p>Every change below has a backup and can be undone.</p></div>
        <div class="card-actions"><button class="button button-small" type="button" data-action="undo-all">${icon('undo')} Undo all</button></div>
      </div>
      <div class="chip-row">${appliedActions.map((action) => `<span class="badge lime">${icon('check')} ${escapeHtml(action.name)}</span>`).join('')}</div>
    </div>`;
}

export function renderOverview() {
  const scan = state.scan;
  return `
    ${startPanel()}
    ${scan?.quickWins.length ? `
      ${sectionHead('Recommended checks', 'Review the settings Nexa flagged on this PC.')}
      ${quickWinsHtml(scan)}
    ` : ''}
    <details class="card disclosure overview-details" id="overview-details" ${state.overviewDetails ? 'open' : ''}>
      <summary>
        <span><strong>PC details</strong><small>Hardware, live usage, network, and applied changes</small></span>
        <span class="disclosure-chevron">${icon('chevron', 16)}</span>
      </summary>
      <div class="disclosure-body">
        ${scan ? `
          <div class="overview-readiness">
            ${scoreRing(scan.score, scan.potentialScore, 100)}
            <div><h3>Windows readiness</h3><p>${escapeHtml(scan.summary)}</p></div>
          </div>
          ${statCardsHtml()}
          <div class="grid-2">${liveChartHtml()}${processesHtml()}</div>
          <div class="grid-2">${networkCardHtml()}${profileHtml()}</div>
          ${appliedHtml()}
        ` : `
          <p class="muted">Scan this PC to see hardware, Windows recommendations, and live activity.</p>
          <button class="button" type="button" data-action="scan">${icon('scan')} Scan PC</button>
        `}
      </div>
    </details>`;
}

function drawCharts() {
  const history = state.telemetryHistory;
  drawLineChart(document.getElementById('live-chart'), [
    { values: history.cpu, color: '#c7ff4a', fillColor: 'rgba(199,255,74,0.15)' },
    { values: history.memory, color: '#62e6ff', fill: false },
  ], { percent: true });
  drawSparkline(document.getElementById('cpu-spark'), history.cpu.slice(-24), '#c7ff4a');
  drawSparkline(document.getElementById('mem-spark'), history.memory.slice(-24), '#62e6ff');
  drawPerCore(document.getElementById('core-chart'), state.telemetry?.cpu?.perCore || []);
}

export function updateOverviewLive() {
  if (state.page !== 'dashboard') return;
  const telemetry = state.telemetry;
  if (!telemetry) return;
  const cpuValue = document.getElementById('stat-cpu-value');
  const memValue = document.getElementById('stat-mem-value');
  const memSub = document.getElementById('stat-mem-sub');
  const gpuValue = document.getElementById('stat-gpu-value');
  const diskValue = document.getElementById('stat-disk-value');
  const diskSub = document.getElementById('stat-disk-sub');
  if (!cpuValue && !memValue && !gpuValue && !diskValue) return;
  if (cpuValue) cpuValue.textContent = Math.round(telemetry.cpu.usage);
  if (memValue) memValue.textContent = Math.round(telemetry.memory.usagePercent);
  if (memSub && telemetry.memory) memSub.textContent = `${formatBytes(telemetry.memory.used)} / ${formatBytes(telemetry.memory.total)} used`;
  if (gpuValue) gpuValue.textContent = telemetry.gpu && Number.isFinite(telemetry.gpu.usage) ? Math.round(telemetry.gpu.usage) : '—';
  if (diskValue) diskValue.textContent = telemetry.disk ? Math.round(telemetry.disk.usedPercent) : '—';
  if (diskSub && telemetry.disk) {
    const diskType = state.snapshot?.physicalDisks?.[0]?.busType ? `${state.snapshot.physicalDisks[0].busType} ` : '';
    const diskMedia = state.snapshot?.physicalDisks?.[0]?.mediaType ? `${state.snapshot.physicalDisks[0].mediaType} · ` : '';
    diskSub.textContent = `${diskType}${diskMedia}${formatBytes(telemetry.disk.free)} free on ${telemetry.disk.drive}`;
  }
  drawCharts();
}

export function updateOverviewProcesses() {
  if (state.page !== 'dashboard') return;
  const processes = state.processes;
  if (!processes) return;
  const body = document.getElementById('processes-body');
  const count = document.getElementById('process-count');
  if (body) body.innerHTML = processTable(processes);
  if (count) count.textContent = String(processes.processCount || 0);
}

async function refreshProcesses(button) {
  if (!button || button.disabled) return;
  button.disabled = true;
  button.innerHTML = `${icon('refresh')} Reading…`;
  button.classList.add('spinning');
  try {
    const data = await api('/api/processes?force=1');
    state.processes = data.processes;
    requestRender();
  } catch (error) {
    toast('error', 'Could not read processes', error.message);
    button.disabled = false;
    button.classList.remove('spinning');
    button.innerHTML = `${icon('refresh')} Refresh`;
  }
}

function applyQuickWin(id) {
  const action = state.scan?.actions?.find((item) => item.id === id);
  if (!action) return;
  if (action.requiresAdmin && !state.snapshot?.admin) {
    openModal({
      title: 'Administrator access needed',
      body: `<p>${escapeHtml(action.name)} changes a system-wide setting. Restart Nexa with administrator rights to apply it.</p>`,
      confirmLabel: 'Restart as administrator',
      onConfirm: elevate,
    });
    return;
  }
  openModal({
    title: action.name,
    body: `<p>${escapeHtml(action.description)}</p><ul class="modal-list"><li>${escapeHtml(action.note)}</li><li>Nexa records a backup before changing anything.</li>${action.requiresReboot ? '<li>A reboot is required for this change to fully apply.</li>' : ''}</ul>`,
    confirmLabel: 'Apply fix',
    danger: action.risk !== 'safe',
    onConfirm: async () => {
      const response = await applyActions([id]);
      const failed = (response.results || []).find((result) => !result.ok);
      if (failed) throw new Error(failed.error || 'The change could not be applied.');
      toast('success', 'Change applied', action.name);
    },
  });
}

export function bindOverview() {
  document.querySelector('[data-action="optimize-pc"]')?.addEventListener('click', (event) => optimizePc(event.currentTarget));
  document.querySelector('[data-action="scan"]')?.addEventListener('click', () => document.getElementById('scan-btn')?.click());
  document.querySelector('[data-action="pre-game"]')?.addEventListener('click', (event) => openBoostModal(event.currentTarget));
  document.querySelectorAll('[data-action="refresh-processes"]').forEach((button) => {
    button.addEventListener('click', () => refreshProcesses(button));
  });
  document.querySelectorAll('[data-action="undo-all"]').forEach((button) => {
    button.addEventListener('click', () => {
      openModal({
        title: 'Undo Nexa’s Windows tweaks?',
        body: '<p>Nexa will restore the settings it backed up. Some changes need a reboot or reconnect to fully revert.</p>',
        confirmLabel: 'Undo all changes',
        danger: true,
        onConfirm: async () => {
          const response = await undoAll();
          const failed = (response.results || []).filter((result) => !result.ok);
          if (failed.length) toast('warn', 'Some changes could not be undone', failed.map((item) => item.error).join(' · '));
          else toast('success', 'Windows tweaks restored');
        },
      });
    });
  });
  document.querySelectorAll('[data-process-sort]').forEach((button) => {
    button.addEventListener('click', () => {
      const newSort = button.getAttribute('data-process-sort') === 'cpu' ? 'cpu' : 'memory';
      if (state.processSort !== newSort) {
        state.processSort = newSort;
        requestRender();
      }
    });
  });
  document.querySelectorAll('[data-quick-apply]').forEach((button) => {
    button.addEventListener('click', () => applyQuickWin(button.getAttribute('data-quick-apply')));
  });
  document.querySelectorAll('[data-quick-review]').forEach((button) => {
    button.addEventListener('click', () => {
      const id = button.getAttribute('data-quick-review');
      if (id === 'cleanup' || id === 'startup') {
        navigate(id);
        return;
      }
      const action = state.scan?.actions?.find((item) => item.id === id);
      if (action) {
        openModal({
          title: action.name,
          body: `<p>${escapeHtml(action.description)}</p><ul class="modal-list">${action.currentValue ? `<li>Current Windows state: <strong>${escapeHtml(action.currentValue)}</strong></li>` : ''}<li>${escapeHtml(action.note)}</li><li>Risk level: ${escapeHtml(action.risk)} · Impact: ${escapeHtml(action.impact)}</li>${action.requiresAdmin ? '<li>Requires administrator access.</li>' : ''}${action.requiresReboot ? '<li>Requires a reboot to take full effect.</li>' : ''}</ul>`,
          confirmLabel: 'Open in Optimize',
          cancelLabel: 'Close',
          onConfirm: () => {
            navigate(action.risk === 'advanced' ? 'advanced' : 'optimize');
          },
        });
        return;
      }
      navigate('optimize');
    });
  });
  drawCharts();
}
