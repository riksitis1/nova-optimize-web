import {
  state,
  icon,
  escapeHtml,
  formatBytes,
  formatNumber,
  formatDate,
  findActiveAdapter,
  adapterSpeedLabel,
  toast,
  openModal,
  elevate,
  api,
  requestRender,
} from '../core.js';
import {
  emptyState,
  sectionHead,
  drawLineChart,
  latencyTone,
  latencyGrade,
  dnsTone,
  bufferbloatText,
  formatSpeedValue,
  metricRow,
} from '../ui.js';

function activeAdapter() {
  return findActiveAdapter(state.snapshot?.adapters);
}

function targetInitials(game) {
  return String(game || '?')
    .split(/[\s/]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}

function selectedTarget() {
  if (state.selectedTarget === 'custom') {
    const custom = state.customTarget;
    return {
      id: 'custom',
      game: 'Custom target',
      region: 'Custom',
      host: custom.host || '',
      port: Number(custom.port) || 443,
      protocol: custom.protocol || 'tcp',
      note: 'Your own hostname or IP',
    };
  }
  return (state.targets || []).find((target) => target.id === state.selectedTarget) || null;
}

function networkSummary() {
  const adapter = activeAdapter();
  const ip = adapter?.ipv4?.[0] || '—';
  const dnsServers = state.dns?.adapters?.flatMap((item) => item.dns4 || []) || [];
  const results = Object.values(state.pingResults || {}).sort((a, b) => new Date(b.testedAt || 0) - new Date(a.testedAt || 0));
  const latest = results[0];
  return `
    <div class="network-hero">
      <div class="network-stat"><span>Active link</span><strong>${adapter ? escapeHtml(adapter.name) : 'No adapter'}</strong><small>${adapter ? escapeHtml(`${adapter.mediaType || 'Network'} · ${adapterSpeedLabel(adapter)}`) : 'Connect a network adapter'}</small></div>
      <div class="network-stat"><span>Local address</span><strong>${escapeHtml(ip)}</strong><small>${adapter?.macAddress ? escapeHtml(adapter.macAddress) : 'No MAC address'}</small></div>
      <div class="network-stat"><span>DNS</span><strong>${dnsServers.length ? escapeHtml(dnsServers.slice(0, 2).join(' · ')) : 'Automatic'}</strong><small>${state.dns?.applied ? `Custom: ${escapeHtml(state.dns.applied.provider || 'Applied')}` : 'Managed by Windows / DHCP'}</small></div>
      <div class="network-stat"><span>Last latency</span><strong class="${latest ? latencyTone(latest.avg) : ''}">${latest ? `${latest.avg ?? '—'} ms` : 'Not tested'}</strong><small>${latest ? `${latest.jitter ?? '—'} ms jitter · ${latest.loss ?? 0}% loss` : 'Run a game route test'}</small></div>
    </div>`;
}

function tabs() {
  return `
    <div class="tabs" style="margin:16px 0 14px">
      <button class="tab ${state.networkTab === 'routes' ? 'active' : ''}" type="button" data-tab="routes">Game routes</button>
      <button class="tab ${state.networkTab === 'dns' ? 'active' : ''}" type="button" data-tab="dns">DNS & lookups</button>
      <button class="tab ${state.networkTab === 'speed' ? 'active' : ''}" type="button" data-tab="speed">Speed & bufferbloat</button>
    </div>`;
}

function targetRow(target) {
  const result = state.pingResults[target.id];
  const busy = state.pingBusy?.[target.id];
  const selected = state.selectedTarget === target.id;
  return `
    <div class="target-row ${selected ? 'selected' : ''}" data-select-target="${escapeHtml(target.id)}">
      <div class="target-avatar">${escapeHtml(targetInitials(target.game))}</div>
      <div class="target-info"><strong>${escapeHtml(target.game)} <span class="badge muted">${escapeHtml(target.region || '')}</span></strong><small>${escapeHtml(target.host)}:${target.port || 443} · ${target.protocol.toUpperCase()}</small></div>
      <div class="target-result">
        ${busy ? '<strong class="muted">…</strong><small>testing</small>' : result ? `<strong class="${latencyTone(result.avg)}">${result.avg ?? '—'}<span class="small"> ms</span></strong><small>${result.jitter ?? '—'} ms jitter</small>` : '<strong class="muted">—</strong><small>not tested</small>'}
      </div>
      <button class="button button-small" type="button" data-test-target="${escapeHtml(target.id)}">${busy ? icon('refresh') + ' Testing' : icon('play') + ' Test'}</button>
    </div>`;
}

function routesTab() {
  const gameTargets = (state.targets || []).filter((target) => target.region !== 'Internet');
  const internetTargets = (state.targets || []).filter((target) => target.region === 'Internet');
  const selected = selectedTarget();
  const result = selected ? state.pingResults[selected.id] : null;
  const history = selected ? state.pingHistory?.[selected.id] || result?.times || [] : [];
  const live = state.livePing?.targetId === selected?.id;
  return `
    ${sectionHead('Game routes', 'Latency to game service networks. Exact in-game servers can differ by match.', `<button class="button button-small" type="button" data-action="test-all">${icon('zap')} Test game routes</button>`)}
    <div class="grid-2">
      <div class="card card-pad">
        <div class="card-header"><div><h2>Game service routes</h2><p>TCP or ICMP latency to the closest service endpoint.</p></div></div>
        <div class="target-list">${gameTargets.map(targetRow).join('')}</div>
      </div>
      <div>
        <div class="card card-pad">
          <div class="card-header"><div><h2>Internet baseline</h2><p>If these are slow, the problem is before the game server.</p></div></div>
          <div class="target-list">${internetTargets.map(targetRow).join('')}</div>
        </div>
        <div class="card card-pad" style="margin-top:12px">
          <div class="card-header"><div><h2>Custom target</h2><p>Use the IP or hostname of your actual game server.</p></div></div>
          <div class="custom-target">
            <div class="field"><label for="custom-host">Hostname or IP</label><input class="input" id="custom-host" data-custom="host" value="${escapeHtml(state.customTarget.host)}" placeholder="e.g. 192.0.2.10" autocomplete="off" spellcheck="false"></div>
            <div class="field"><label for="custom-protocol">Protocol</label><select class="select" id="custom-protocol" data-custom="protocol"><option value="tcp" ${state.customTarget.protocol === 'tcp' ? 'selected' : ''}>TCP</option><option value="icmp" ${state.customTarget.protocol === 'icmp' ? 'selected' : ''}>ICMP</option></select></div>
            <div class="field"><label for="custom-port">Port</label><input class="input" id="custom-port" data-custom="port" value="${escapeHtml(state.customTarget.port)}" inputmode="numeric" placeholder="443"></div>
            <div class="field"><label>&nbsp;</label><button class="button" type="button" data-action="test-custom">${icon('target')} Test</button></div>
          </div>
          <p class="small muted" style="margin:10px 0 0">TCP tests measure the handshake to a port. ICMP uses Windows ping. Some game servers block both; that is not proof of packet loss.</p>
        </div>
      </div>
    </div>
    ${sectionHead('Latency monitor', selected ? `${selected.game} · ${selected.host}` : 'Choose a target above', live ? '<span class="badge lime">Live</span>' : '')}
    <div class="card card-pad">
      ${selected ? `
        <div class="ping-panel">
          <div>
            <div class="card-header" style="margin-bottom:4px">
              <div><h2>${escapeHtml(selected.game)} <span class="badge muted">${escapeHtml(selected.region || '')}</span></h2><p>${escapeHtml(selected.note || '')} · ${escapeHtml(selected.host)}:${selected.port || 443}</p></div>
              <div class="card-actions"><span class="badge ${result && result.avg <= 60 ? 'green' : result ? 'amber' : 'muted'}">${result ? latencyGrade(result.avg) : 'No data'}</span></div>
            </div>
            <div class="ping-chart-wrap"><canvas id="ping-chart"></canvas></div>
            <div class="ping-actions">
              <button class="button button-primary" type="button" data-action="ping-selected">${icon('play')} Run ${Number(state.settings.pingCount) || 10} pings</button>
              <button class="button ${live ? 'button-danger' : ''}" type="button" data-action="${live ? 'stop-live' : 'start-live'}">${live ? icon('stop') + ' Stop live' : icon('pulse') + ' Live monitor'}</button>
              ${result ? `<span class="small muted" style="align-self:center">${formatDate(result.testedAt, { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>` : ''}
            </div>
          </div>
          <div>
            <div class="ping-stats">
              <div class="ping-stat"><span>Average</span><strong class="${result ? latencyTone(result.avg) : ''}">${result?.avg ?? '—'} <small>ms</small></strong></div>
              <div class="ping-stat"><span>Jitter</span><strong>${result?.jitter ?? '—'} <small>ms</small></strong></div>
              <div class="ping-stat"><span>Min / max</span><strong>${result ? `${result.min ?? '—'} / ${result.max ?? '—'}` : '—'} <small>ms</small></strong></div>
              <div class="ping-stat"><span>Packet loss</span><strong>${result?.loss ?? '—'}%</strong></div>
              <div class="ping-stat"><span>Received</span><strong>${result ? `${result.received}/${result.sent}` : '—'}</strong></div>
              <div class="ping-stat"><span>Protocol</span><strong style="font-size:12px">${selected.protocol.toUpperCase()}</strong></div>
            </div>
            <p class="small muted" style="margin:12px 0 0;line-height:1.55">For competitive play, consistency matters more than a single low number. Watch jitter and loss, not just average ping.</p>
          </div>
        </div>` : emptyState('target', 'Choose a game route', 'Select any game service or baseline route above to measure real-time latency, jitter, and packet loss.', '', true)}
    </div>
    <div class="callout" style="margin-top:14px">${icon('info')}<div><strong>Service routes are estimates.</strong> Riot, Epic, Steam and other services use many datacenters. For your exact match server, use the custom target with the IP shown by the game or router.</div></div>
  `;
}

function dnsTab() {
  const adapters = state.dns?.adapters || [];
  const benchmark = state.dnsBenchmark;
  const admin = state.snapshot?.admin === true;
  return `
    ${!admin ? `<div class="callout warn" style="margin-bottom:14px">${icon('lock')}<div><strong>DNS changes need administrator access.</strong> You can still benchmark every resolver without it. <button class="button button-small" type="button" data-action="elevate" style="margin-left:8px">Restart as admin</button></div></div>` : ''}
    <div class="grid-2">
      <div class="card card-pad">
        <div class="card-header"><div><h2>Current DNS</h2><p>Where Windows sends domain lookups right now.</p></div><div class="card-actions"><button class="button button-small" type="button" data-action="flush-dns">${icon('refresh')} Flush cache</button></div></div>
        ${adapters.length ? adapters.map((adapter) => `
          <div class="finding" style="margin-bottom:8px">
            <div class="finding-sev low">${icon('server')}</div>
            <div class="finding-body"><h3 class="finding-title">${escapeHtml(adapter.name)} <span class="badge muted">${escapeHtml(adapter.mode === 'static' ? 'Static' : 'Automatic')}</span></h3><p class="finding-desc">${(adapter.dns4 || []).length ? escapeHtml((adapter.dns4 || []).join(' · ')) : 'No IPv4 DNS configured'}<br>${(adapter.dns6 || []).length ? escapeHtml((adapter.dns6 || []).join(' · ')) : 'No IPv6 DNS configured'}</p></div>
          </div>`).join('') : emptyState('wifi', 'No active adapter', 'Connect to a network to see its DNS configuration.')}
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:14px">
          <button class="button button-small" type="button" data-action="dns-reset">${icon('undo')} Reset to original</button>
          ${state.dns?.applied ? `<span class="badge lime" style="align-self:center">${icon('check')} ${escapeHtml(state.dns.applied.provider || 'Custom DNS')}</span>` : ''}
        </div>
      </div>
      <div class="card card-pad">
        <div class="card-header"><div><h2>DNS benchmark</h2><p>Median lookup time across popular domains. Lower is snappier; it does not change in-game ping.</p></div><div class="card-actions"><button class="button button-small button-primary" type="button" data-action="dns-benchmark">${icon('gauge')} Benchmark</button></div></div>
        ${benchmark ? `
          <div class="dns-table-wrap">
            <table class="dns-table">
              <thead><tr><th>Resolver</th><th>Median</th><th>p95</th><th>Success</th><th></th></tr></thead>
              <tbody>${benchmark.results.map((result) => `
                <tr class="${benchmark.bestId === result.id ? 'best' : ''}">
                  <td><div class="dns-name">${escapeHtml(result.name)} ${benchmark.bestId === result.id ? '<span class="badge lime">Fastest</span>' : ''}</div><div class="dns-servers">${escapeHtml((result.servers || []).join(' · '))}</div></td>
                  <td><span class="dns-time ${dnsTone(result.median)}">${result.median ?? '—'} ms</span></td>
                  <td>${result.p95 ?? '—'} ms</td>
                  <td>${result.successRate}%</td>
                  <td>${result.id === 'current' ? '<span class="badge muted">In use</span>' : `<button class="button button-small" type="button" data-apply-dns="${escapeHtml(result.id)}">${icon('arrow')} Use</button>`}</td>
                </tr>`).join('')}</tbody>
            </table>
          </div>
          <p class="small muted" style="margin:10px 0 0">Tested ${formatDate(benchmark.testedAt)} · ${benchmark.domains.length} domains · results are approximate.</p>
        ` : emptyState('gauge', 'No benchmark yet', 'Run a benchmark to compare your ISP resolver with Cloudflare, Google, Quad9 and AdGuard.')}
      </div>
    </div>
    <div class="callout" style="margin-top:14px">${icon('info')}<div><strong>DNS is not a ping fix.</strong> It speeds up name lookups and can make browsing feel snappier, but it cannot lower the route latency to a game server. Nova will never pretend otherwise.</div></div>
  `;
}

function speedTab() {
  const result = state.speedTest;
  const running = state.speedRunning === true;
  const grade = result?.latency?.grade || null;
  const gradeClass = grade === 'A+' ? 'Aplus' : grade || '';
  return `
    ${sectionHead('Speed & bufferbloat', 'Download, upload and the latency spike under load. The last number is the one most speed tests hide.')}
    <div class="card speed-card">
      <div class="speed-gauge">
        <div class="speed-number">
          <strong>${running ? '…' : result ? formatSpeedValue(result.download?.mbps) : '—'}</strong>
          <span>Mbps download</span>
        </div>
        <div class="speed-side">
          <div class="speed-metric"><span>Upload</span><strong>${running ? '…' : result ? `${formatSpeedValue(result.upload?.mbps)} <small>Mbps</small>` : '—'}</strong></div>
          <div class="speed-metric"><span>Idle latency</span><strong>${result?.latency?.idle ?? '—'} <small>ms</small></strong></div>
          <div class="speed-metric"><span>Loaded latency</span><strong>${result?.latency?.loaded ?? '—'} <small>ms</small></strong></div>
          <div class="speed-metric"><span>Bufferbloat</span><strong>${grade ? `<span class="grade ${gradeClass}">${grade}</span>` : '—'}</strong></div>
          <div class="speed-metric"><span>Down / Up load</span><strong style="font-size:13px">${result?.latency?.downloadLoaded != null ? `${result.latency.downloadLoaded} / ${result.latency.uploadLoaded ?? '—'} ms` : result?.server || 'Cloudflare'}</strong></div>
          <div class="speed-metric"><span>Tested</span><strong style="font-size:11px">${result ? formatDate(result.testedAt) : 'Not yet'}</strong></div>
        </div>
      </div>
      <div class="progress"><span id="speed-progress" style="width:${running ? '12%' : result ? '100%' : '0%'}"></span></div>
      <div style="display:flex;flex-wrap:wrap;align-items:center;gap:10px;margin-top:14px">
        <button class="button button-primary" type="button" data-action="speedtest" ${running ? 'disabled' : ''}>${running ? icon('refresh') + ' Testing…' : icon('gauge') + ' Run speed test'}</button>
        ${running ? `<span class="small muted" id="speed-elapsed">0s elapsed</span>` : '<span class="small muted">~33–68 MB of data · Cloudflare test endpoint</span>'}
      </div>
      ${result ? `<div class="speed-note">${icon('info')} ${escapeHtml(bufferbloatText(grade))} ${result.latency?.increase != null ? `Loaded latency is +${result.latency.increase} ms above idle.` : ''}</div>` : ''}
    </div>
    ${result?.latency?.idleSamples?.length ? `
      ${sectionHead('Latency under load', 'Measured before and during active download and upload transfers.')}
      <div class="card chart-card">
        <div class="chart-legend" style="margin-bottom:6px"><span><span class="legend-dot"></span>Idle samples</span><span><span class="legend-dot cyan"></span>Download load</span>${result.latency?.uploadSamples?.length ? '<span><span class="legend-dot amber"></span>Upload load</span>' : ''}</div>
        <div class="chart-wrap tall"><canvas id="bufferbloat-chart"></canvas></div>
      </div>` : ''}
    <div class="callout" style="margin-top:14px">${icon('info')}<div><strong>Why bufferbloat matters:</strong> a 900 Mbps connection with a bad bufferbloat grade can feel worse in a game than a 100 Mbps connection with a good grade. If the grade is C or worse, enable SQM/QoS on your router if it supports it.</div></div>
  `;
}

export function renderNetwork() {
  if (!state.snapshot) {
    return '<div class="page-loading"><div class="loading-orbit"></div><p>Mapping the network…</p></div>';
  }
  return `
    ${networkSummary()}
    ${tabs()}
    ${state.networkTab === 'dns' ? dnsTab() : state.networkTab === 'speed' ? speedTab() : routesTab()}
  `;
}

function drawPingChart() {
  const target = selectedTarget();
  if (!target) return;
  const result = state.pingResults[target.id];
  const history = state.pingHistory?.[target.id] || result?.times || [];
  drawLineChart(document.getElementById('ping-chart'), [
    { values: history, color: '#c7ff4a', fillColor: 'rgba(199,255,74,0.14)' },
  ], { emptyText: 'Run a test to see the route', min: 0 });
}

function drawBufferbloat() {
  const result = state.speedTest;
  if (!result?.latency) return;
  const series = [
    { values: result.latency.idleSamples || [], color: '#c7ff4a', fillColor: 'rgba(199,255,74,0.1)' },
    { values: result.latency.downloadSamples || result.latency.loadedSamples || [], color: '#62e6ff', fill: false },
  ];
  if (result.latency.uploadSamples?.length) {
    series.push({ values: result.latency.uploadSamples, color: '#ffc857', fill: false });
  }
  drawLineChart(document.getElementById('bufferbloat-chart'), series, { emptyText: 'No samples', min: 0 });
}

async function pingTarget(target, options = {}) {
  if (!target || !target.host) {
    toast('warn', 'Enter a target first', 'A hostname or IP address is required.');
    return null;
  }
  if (state.pingBusy?.[target.id]) return null;
  state.pingBusy = { ...(state.pingBusy || {}), [target.id]: true };
  requestRender();
  try {
    const data = await api('/api/network/ping', {
      method: 'POST',
      body: {
        targetId: target.id,
        host: target.host,
        port: target.port || 443,
        protocol: target.protocol || 'tcp',
        count: options.count || Number(state.settings.pingCount) || 10,
      },
    });
    const result = { ...data.result, testedAt: data.result.testedAt || new Date().toISOString() };
    state.pingResults[target.id] = result;
    state.pingHistory = { ...(state.pingHistory || {}) };
    if (options.live && state.pingHistory[target.id]) {
      state.pingHistory[target.id] = [...state.pingHistory[target.id], ...(result.times || [])].slice(-80);
    } else {
      state.pingHistory[target.id] = result.times || [];
    }
    if (state.selectedTarget !== target.id) state.selectedTarget = target.id;
    return result;
  } catch (error) {
    toast('error', 'Latency test failed', error.message);
    return null;
  } finally {
    const busy = { ...(state.pingBusy || {}) };
    delete busy[target.id];
    state.pingBusy = busy;
    requestRender();
  }
}

async function testAllGameRoutes(button) {
  if (state.testAllRunning) return;
  const targets = (state.targets || []).filter((target) => target.region !== 'Internet');
  if (!targets.length) return;
  state.testAllRunning = true;
  if (button) {
    button.disabled = true;
    button.innerHTML = `${icon('refresh')} Testing…`;
  }
  const queue = [...targets];
  const workers = Array.from({ length: Math.min(3, queue.length) }, async () => {
    while (queue.length) {
      const target = queue.shift();
      await pingTarget(target, { count: 5 });
    }
  });
  try {
    await Promise.all(workers);
    toast('success', 'Game routes tested', 'Results are estimates based on the nearest service endpoint.');
  } finally {
    state.testAllRunning = false;
    if (button) {
      button.disabled = false;
      button.innerHTML = `${icon('zap')} Test game routes`;
    }
    requestRender();
  }
}

function startLive() {
  const target = selectedTarget();
  if (!target) return;
  if (state.livePingTimer) clearInterval(state.livePingTimer);
  state.livePing = { targetId: target.id, startedAt: new Date().toISOString() };
  state.pingHistory = { ...(state.pingHistory || {}), [target.id]: [] };
  const tick = async () => {
    if (!state.livePing) return;
    if (state.livePingBusy) return;
    state.livePingBusy = true;
    try {
      await pingTarget(target, { count: 3, live: true });
    } finally {
      state.livePingBusy = false;
    }
  };
  tick();
  state.livePingTimer = setInterval(tick, 2500);
  requestRender();
}

export function stopNetworkLive() {
  if (state.livePingTimer) clearInterval(state.livePingTimer);
  state.livePingTimer = null;
  state.livePing = null;
  state.livePingBusy = false;
}

function customTargetFromState() {
  return {
    id: 'custom',
    game: 'Custom target',
    region: 'Custom',
    host: state.customTarget.host.trim(),
    port: Number(state.customTarget.port) || 443,
    protocol: state.customTarget.protocol === 'icmp' ? 'icmp' : 'tcp',
    note: 'Your own hostname or IP',
  };
}

async function refreshDns() {
  try {
    const data = await api('/api/network/dns');
    state.dns = data;
  } catch (error) {
    toast('error', 'Could not read DNS settings', error.message);
  }
}

function applyDns(result) {
  if (!state.snapshot?.admin) {
    openModal({
      title: 'Administrator access needed',
      body: '<p>Changing DNS servers requires administrator rights. Nova will restart with an elevated session.</p>',
      confirmLabel: 'Restart as administrator',
      onConfirm: elevate,
    });
    return;
  }
  const ifIndexes = (state.dns?.adapters || [])
    .filter((adapter) => (adapter.ipv4 || []).length || (adapter.ipv6 || []).length)
    .map((adapter) => adapter.ifIndex);
  if (!ifIndexes.length) {
    toast('warn', 'No active adapter', 'Connect to a network before changing DNS.');
    return;
  }
  openModal({
    title: `Use ${result.name}?`,
    body: `<p>Nova will set DNS servers on ${ifIndexes.length} active adapter${ifIndexes.length === 1 ? '' : 's'}. Your original DNS configuration is saved for one-click reset.</p><ul class="modal-list"><li>${escapeHtml((result.servers || []).join(' · '))}</li><li>This changes name lookups, not in-game ping.</li></ul>`,
    confirmLabel: 'Apply DNS',
    onConfirm: async () => {
      const response = await api('/api/network/dns/apply', {
        method: 'POST',
        body: { servers: result.servers, ifIndexes, provider: result.name },
      });
      if (!response.ok) throw new Error('Windows refused the DNS change.');
      await refreshDns();
      toast('success', 'DNS updated', result.name);
      requestRender();
    },
  });
}

function resetDns() {
  if (!state.snapshot?.admin) {
    openModal({
      title: 'Administrator access needed',
      body: '<p>Resetting DNS requires administrator rights.</p>',
      confirmLabel: 'Restart as administrator',
      onConfirm: elevate,
    });
    return;
  }
  openModal({
    title: 'Reset DNS to the original configuration?',
    body: '<p>Nova will restore the DNS settings it backed up, or return the adapter to automatic DNS if no backup exists.</p>',
    confirmLabel: 'Reset DNS',
    danger: true,
    onConfirm: async () => {
      await api('/api/network/dns/reset', { method: 'POST', body: {} });
      await refreshDns();
      toast('success', 'DNS reset');
      requestRender();
    },
  });
}

async function runDnsBenchmark(button) {
  if (button?.disabled) return;
  if (button) {
    button.disabled = true;
    button.innerHTML = `${icon('refresh')} Benchmarking…`;
  }
  try {
    const data = await api('/api/network/dns/benchmark', { method: 'POST', body: {} });
    state.dnsBenchmark = data.benchmark;
    toast('success', 'DNS benchmark complete', data.benchmark.best ? `${data.benchmark.best.name} had the lowest median lookup.` : 'No resolver passed the test.');
    requestRender();
  } catch (error) {
    toast('error', 'DNS benchmark failed', error.message);
    if (button) {
      button.disabled = false;
      button.innerHTML = `${icon('gauge')} Benchmark`;
    }
  }
}

function startSpeedTest() {
  if (state.speedRunning) return;
  state.speedRunning = true;
  state.speedStarted = Date.now();
  requestRender();
  if (state.speedTimer) clearInterval(state.speedTimer);
  state.speedTimer = setInterval(() => {
    const elapsed = Math.floor((Date.now() - state.speedStarted) / 1000);
    const bar = document.getElementById('speed-progress');
    const label = document.getElementById('speed-elapsed');
    if (bar) bar.style.width = `${Math.min(92, 8 + (elapsed / 28) * 84)}%`;
    if (label) label.textContent = `${elapsed}s elapsed`;
  }, 500);
  api('/api/network/speedtest', { method: 'POST', body: {} })
    .then((data) => {
      state.speedTest = data.result;
      toast('success', 'Speed test complete', `${data.result.download.mbps} Mbps down · bufferbloat ${data.result.latency.grade}`);
    })
    .catch((error) => toast('error', 'Speed test failed', error.message))
    .finally(() => {
      clearInterval(state.speedTimer);
      state.speedTimer = null;
      state.speedRunning = false;
      state.speedStarted = null;
      requestRender();
    });
}

export function bindNetwork() {
  document.querySelectorAll('[data-tab]').forEach((button) => {
    button.addEventListener('click', () => {
      state.networkTab = button.getAttribute('data-tab');
      requestRender();
    });
  });
  document.querySelectorAll('[data-select-target]').forEach((row) => {
    row.addEventListener('click', (event) => {
      if (event.target.closest('button')) return;
      state.selectedTarget = row.getAttribute('data-select-target');
      requestRender();
    });
  });
  document.querySelectorAll('[data-test-target]').forEach((button) => {
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      const target = (state.targets || []).find((item) => item.id === button.getAttribute('data-test-target'));
      if (target) {
        state.selectedTarget = target.id;
        pingTarget(target);
      }
    });
  });
  document.querySelectorAll('[data-action="test-all"]').forEach((button) => {
    button.addEventListener('click', () => testAllGameRoutes(button));
  });
  document.querySelectorAll('[data-action="ping-selected"]').forEach((button) => {
    button.addEventListener('click', () => {
      const target = selectedTarget();
      if (target) pingTarget(target);
    });
  });
  document.querySelectorAll('[data-action="start-live"]').forEach((button) => {
    button.addEventListener('click', startLive);
  });
  document.querySelectorAll('[data-action="stop-live"]').forEach((button) => {
    button.addEventListener('click', () => {
      stopNetworkLive();
      requestRender();
    });
  });
  document.querySelectorAll('[data-custom]').forEach((input) => {
    input.addEventListener('input', () => {
      state.customTarget = { ...state.customTarget, [input.getAttribute('data-custom')]: input.value };
    });
  });
  document.querySelectorAll('[data-action="test-custom"]').forEach((button) => {
    button.addEventListener('click', () => {
      const target = customTargetFromState();
      if (!target.host) {
        toast('warn', 'Enter a target', 'Type a hostname or IP address first.');
        return;
      }
      state.selectedTarget = 'custom';
      pingTarget(target);
    });
  });
  document.querySelectorAll('[data-action="dns-benchmark"]').forEach((button) => {
    button.addEventListener('click', () => runDnsBenchmark(button));
  });
  document.querySelectorAll('[data-apply-dns]').forEach((button) => {
    button.addEventListener('click', () => {
      const result = state.dnsBenchmark?.results?.find((item) => item.id === button.getAttribute('data-apply-dns'));
      if (result) applyDns(result);
    });
  });
  document.querySelectorAll('[data-action="dns-reset"]').forEach((button) => {
    button.addEventListener('click', resetDns);
  });
  document.querySelectorAll('[data-action="flush-dns"]').forEach((button) => {
    button.addEventListener('click', async () => {
      button.disabled = true;
      button.innerHTML = `${icon('refresh')} Flushing…`;
      try {
        await api('/api/network/flush', { method: 'POST', body: {} });
        toast('success', 'DNS cache flushed');
      } catch (error) {
        toast('error', 'Could not flush DNS', error.message);
      } finally {
        button.disabled = false;
        button.innerHTML = `${icon('refresh')} Flush cache`;
      }
    });
  });
  document.querySelectorAll('[data-action="elevate"]').forEach((button) => {
    button.addEventListener('click', elevate);
  });
  document.querySelectorAll('[data-action="speedtest"]').forEach((button) => {
    button.addEventListener('click', startSpeedTest);
  });
  drawPingChart();
  drawBufferbloat();
}
