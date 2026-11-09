import { escapeHtml, formatNumber, icon } from './core.js';

const COLORS = {
  lime: '#c7ff4a',
  cyan: '#62e6ff',
  amber: '#ffc857',
  red: '#ff7272',
  green: '#62e8a7',
  purple: '#b69cff',
  grid: 'rgba(255,255,255,0.055)',
  text: 'rgba(139,150,166,0.75)',
};

export function scoreRing(score, potential = null, size = 184) {
  const value = Math.max(0, Math.min(100, Number(score) || 0));
  const radius = 78;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - value / 100);
  return `
    <div class="score-ring" style="width:${size}px;height:${size}px">
      <svg class="score-ring-svg" viewBox="0 0 184 184" aria-hidden="true">
        <circle class="score-ring-track" cx="92" cy="92" r="${radius}"></circle>
        <circle class="score-ring-ambient" cx="92" cy="92" r="${radius}" stroke-dasharray="${circumference}" stroke-dashoffset="${offset}"></circle>
        <circle class="score-ring-bloom" cx="92" cy="92" r="${radius}" stroke-dasharray="${circumference}" stroke-dashoffset="${offset}"></circle>
        <circle class="score-ring-progress" cx="92" cy="92" r="${radius}" stroke-dasharray="${circumference}" stroke-dashoffset="${offset}"></circle>
      </svg>
      <div class="score-center">
        <strong>${value}</strong>
        <span>${value >= 90 ? 'Optimal' : value >= 75 ? 'Good' : value >= 60 ? 'Fair' : 'Needs tuning'}</span>
        <small>INDEX / 100</small>
      </div>
    </div>
    ${potential !== null ? `<div class="score-foot"><span>Target <b>${Math.max(value, Number(potential) || value)}</b></span><span>·</span><span>System config</span></div>` : ''}
  `;
}

export function severityBadge(severity) {
  const map = {
    high: ['red', 'High impact'],
    medium: ['amber', 'Medium impact'],
    low: ['cyan', 'Low impact'],
    info: ['muted', 'Info'],
  };
  const [tone, label] = map[severity] || map.info;
  return `<span class="badge ${tone}">${escapeHtml(label)}</span>`;
}

export function riskBadge(risk) {
  if (risk === 'advanced') return '<span class="badge advanced">Advanced</span>';
  if (risk === 'caution') return '<span class="badge amber">Caution</span>';
  return '<span class="badge green">Safe</span>';
}

export function impactBadge(impact) {
  const map = {
    high: ['red', 'High impact'],
    medium: ['amber', 'Medium impact'],
    low: ['cyan', 'Low impact'],
  };
  const [tone, label] = map[impact] || map.low;
  return `<span class="badge ${tone}">${label}</span>`;
}

export function rebootBadge() {
  return '<span class="badge muted">Reboot</span>';
}

export function adminBadge() {
  return '<span class="badge muted"><span data-icon="lock"></span>Admin</span>';
}

export function emptyState(iconName, title, text, action = '', compact = false) {
  return `
    <div class="empty-state ${compact ? 'compact' : ''}">
      <div class="empty-icon">${icon(iconName, compact ? 18 : 22)}</div>
      <h3>${escapeHtml(title)}</h3>
      <p>${escapeHtml(text)}</p>
      ${action}
    </div>`;
}

export function sectionHead(title, subtitle = '', actions = '') {
  return `
    <div class="section-head">
      <div><h2>${escapeHtml(title)}</h2>${subtitle ? `<p>${escapeHtml(subtitle)}</p>` : ''}</div>
      ${actions ? `<div class="section-actions">${actions}</div>` : ''}
    </div>`;
}

export function statCard({ label, value, unit = '', sub = '', iconName = 'activity', sparkId = '', accent = 'lime', valueId = '', subId = '' }) {
  return `
    <div class="card stat-card">
      <div class="stat-top"><span class="stat-icon" style="${accent === 'cyan' ? 'color:var(--cyan);background:var(--cyan-soft);border-color:rgba(98,230,255,.18)' : ''}">${icon(iconName, 14)}</span>${escapeHtml(label)}</div>
      <div class="stat-value"><strong${valueId ? ` id="${valueId}"` : ''}>${value}</strong>${unit ? `<span>${escapeHtml(unit)}</span>` : ''}</div>
      <div class="stat-sub"${subId ? ` id="${subId}"` : ''}>${escapeHtml(sub)}</div>
      ${sparkId ? `<div class="stat-spark"><canvas id="${sparkId}"></canvas></div>` : ''}
    </div>`;
}

export function metricRow(label, value) {
  return `<div class="kv"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`;
}

export function latencyTone(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 'muted';
  if (number <= 30) return 'latency-good';
  if (number <= 60) return 'latency-ok';
  if (number <= 100) return 'latency-meh';
  return 'latency-bad';
}

export function latencyGrade(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 'No data';
  if (number <= 20) return 'Excellent';
  if (number <= 40) return 'Great';
  if (number <= 70) return 'Playable';
  if (number <= 110) return 'High';
  return 'Poor';
}

export function dnsTone(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 'bad';
  if (number <= 25) return 'good';
  if (number <= 50) return 'ok';
  if (number <= 90) return 'meh';
  return 'bad';
}

export function bufferbloatText(grade) {
  const map = {
    'A+': 'Minimal latency increase under active load.',
    A: 'Connection remains responsive during heavy transfers.',
    B: 'Moderate latency increase under active load.',
    C: 'Noticeable queueing delay during downloads or uploads.',
    D: 'High latency spikes when bandwidth is saturated.',
    F: 'Severe router bufferbloat under active load.',
  };
  return map[grade] || 'Run a test to measure latency under load.';
}

export function scoreGrade(score) {
  if (score >= 90) return 'Excellent';
  if (score >= 75) return 'Good';
  if (score >= 60) return 'Fair';
  return 'Needs work';
}

export function miniBars(values, max = 100) {
  const list = Array.isArray(values) && values.length ? values : [0];
  return `<div class="mini-bars">${list.map((value) => {
    const height = Math.max(4, Math.min(100, (Number(value) || 0) / max * 100));
    return `<span class="mini-bar" style="height:${height}%"></span>`;
  }).join('')}</div>`;
}

function prepareCanvas(canvas) {
  if (!canvas) return null;
  const rect = canvas.getBoundingClientRect();
  if (!rect.width || !rect.height) return null;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.round(rect.width * dpr);
  canvas.height = Math.round(rect.height * dpr);
  const context = canvas.getContext('2d');
  context.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { context, width: rect.width, height: rect.height };
}

export function drawLineChart(canvas, series, options = {}) {
  const prepared = prepareCanvas(canvas);
  if (!prepared) return;
  const { context: ctx, width, height } = prepared;
  const padding = { top: 10, right: 6, bottom: 12, left: 6 };
  const plotWidth = Math.max(1, width - padding.left - padding.right);
  const plotHeight = Math.max(1, height - padding.top - padding.bottom);
  ctx.clearRect(0, 0, width, height);

  const allValues = series.flatMap((item) => item.values.filter((value) => Number.isFinite(value)));
  let min = options.min;
  let max = options.max;
  if (!Number.isFinite(min)) min = allValues.length ? Math.min(...allValues) : 0;
  if (!Number.isFinite(max)) max = allValues.length ? Math.max(...allValues) : 100;
  if (min === max) {
    min = Math.max(0, min - 5);
    max += 5;
  }
  if (options.zeroBase && min > 0) min = 0;
  if (options.percent) {
    min = 0;
    max = 100;
  }
  const range = max - min || 1;

  ctx.strokeStyle = COLORS.grid;
  ctx.lineWidth = 1;
  for (let line = 0; line <= 4; line += 1) {
    const y = padding.top + (plotHeight / 4) * line;
    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(width - padding.right, y);
    ctx.stroke();
  }

  series.forEach((item, seriesIndex) => {
    const values = item.values;
    if (!values.length) return;
    const points = values.map((value, index) => {
      const x = padding.left + (values.length === 1 ? plotWidth / 2 : (plotWidth / (values.length - 1)) * index);
      const normalized = Number.isFinite(value) ? (value - min) / range : null;
      const y = normalized === null ? null : padding.top + plotHeight - normalized * plotHeight;
      return { x, y, value };
    });

    if (seriesIndex === 0 && item.fill !== false) {
      const gradient = ctx.createLinearGradient(0, padding.top, 0, padding.top + plotHeight);
      gradient.addColorStop(0, item.fillColor || 'rgba(199,255,74,0.16)');
      gradient.addColorStop(1, 'rgba(199,255,74,0)');
      ctx.beginPath();
      let started = false;
      points.forEach((point) => {
        if (point.y === null) return;
        if (!started) {
          ctx.moveTo(point.x, point.y);
          started = true;
        } else {
          ctx.lineTo(point.x, point.y);
        }
      });
      if (started) {
        const last = [...points].reverse().find((point) => point.y !== null);
        ctx.lineTo(last.x, padding.top + plotHeight);
        ctx.lineTo(points.find((point) => point.y !== null).x, padding.top + plotHeight);
        ctx.closePath();
        ctx.fillStyle = gradient;
        ctx.fill();
      }
    }

    ctx.beginPath();
    ctx.strokeStyle = item.color || COLORS.lime;
    ctx.lineWidth = item.width || 2;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    let started = false;
    points.forEach((point) => {
      if (point.y === null) {
        started = false;
        return;
      }
      if (!started) {
        ctx.moveTo(point.x, point.y);
        started = true;
      } else {
        ctx.lineTo(point.x, point.y);
      }
    });
    ctx.stroke();

    const last = [...points].reverse().find((point) => point.y !== null);
    if (last) {
      ctx.beginPath();
      ctx.arc(last.x, last.y, 3.2, 0, Math.PI * 2);
      ctx.fillStyle = item.color || COLORS.lime;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(last.x, last.y, 6.5, 0, Math.PI * 2);
      ctx.fillStyle = `${item.color || COLORS.lime}22`;
      ctx.fill();
    }
  });

  if (!allValues.length) {
    ctx.fillStyle = COLORS.text;
    ctx.font = '11px Segoe UI, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(options.emptyText || 'No samples yet', width / 2, height / 2);
  }
}

export function drawSparkline(canvas, values, color = COLORS.lime) {
  const prepared = prepareCanvas(canvas);
  if (!prepared) return;
  const { context: ctx, width, height } = prepared;
  ctx.clearRect(0, 0, width, height);
  const list = (values || []).filter((value) => Number.isFinite(value));
  if (!list.length) return;
  const min = Math.min(...list);
  const max = Math.max(...list);
  const range = max - min || 1;
  const points = list.map((value, index) => ({
    x: (width / Math.max(1, list.length - 1)) * index,
    y: height - 3 - ((value - min) / range) * (height - 6),
  }));
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, `${color}30`);
  gradient.addColorStop(1, `${color}00`);
  ctx.beginPath();
  points.forEach((point, index) => {
    if (index === 0) ctx.moveTo(point.x, point.y);
    else ctx.lineTo(point.x, point.y);
  });
  ctx.lineTo(width, height);
  ctx.lineTo(0, height);
  ctx.closePath();
  ctx.fillStyle = gradient;
  ctx.fill();
  ctx.beginPath();
  points.forEach((point, index) => {
    if (index === 0) ctx.moveTo(point.x, point.y);
    else ctx.lineTo(point.x, point.y);
  });
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.6;
  ctx.lineJoin = 'round';
  ctx.stroke();
}

export function drawPerCore(canvas, cores) {
  const prepared = prepareCanvas(canvas);
  if (!prepared) return;
  const { context: ctx, width, height } = prepared;
  ctx.clearRect(0, 0, width, height);
  const list = cores || [];
  if (!list.length) return;
  const gap = 4;
  const barWidth = Math.max(2, (width - gap * (list.length - 1)) / list.length);
  list.forEach((core, index) => {
    const value = Math.max(0, Math.min(100, Number(core.usage) || 0));
    const barHeight = (value / 100) * (height - 4);
    const x = index * (barWidth + gap);
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    ctx.fillRect(x, 0, barWidth, height);
    const gradient = ctx.createLinearGradient(0, height, 0, height - barHeight);
    gradient.addColorStop(0, '#c7ff4a');
    gradient.addColorStop(1, '#62e6ff');
    ctx.fillStyle = value > 85 ? '#ff7272' : gradient;
    ctx.fillRect(x, height - barHeight, barWidth, barHeight);
  });
}

export function formatSpeedValue(value) {
  return Number.isFinite(Number(value)) ? Number(value).toFixed(1) : '—';
}

export function pct(value) {
  return `${Math.round(Number(value) || 0)}%`;
}

export function bytesShort(bytes) {
  const value = Number(bytes) || 0;
  if (value < 1024) return `${value} B`;
  if (value < 1024 ** 2) return `${(value / 1024).toFixed(0)} KB`;
  if (value < 1024 ** 3) return `${(value / 1024 ** 2).toFixed(1)} MB`;
  return `${(value / 1024 ** 3).toFixed(1)} GB`;
}

export function formatPercent(value) {
  return `${formatNumber(value, 1)}%`;
}
