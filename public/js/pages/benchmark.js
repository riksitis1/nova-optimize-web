import { escapeHtml, icon, requestRender } from '../core.js';
import { compareCaptures, MAX_CAPTURE_BYTES, parseCapture } from '../benchmark-data.js';

const SLOTS = ['before', 'after'];
const captures = { before: null, after: null };
const number = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 });

function streamPicker(slot, entry) {
  const streams = entry.capture?.streams || [];
  if (streams.length < 2) return '';
  return `
    <label for="benchmark-${slot}-stream">Game frame stream</label>
    <select class="select" id="benchmark-${slot}-stream" data-benchmark-stream="${slot}">
      <option value="" ${entry.selected === null ? 'selected' : ''}>Choose the game’s main stream</option>
      ${streams.map((stream, index) => `
        <option value="${index}" ${entry.selected === index ? 'selected' : ''}>
          ${escapeHtml(stream.application)} · PID ${stream.processId} · ${escapeHtml(stream.swapChain)} · ${number.format(stream.count)} frames
        </option>`).join('')}
    </select>`;
}

function captureField(slot) {
  const entry = captures[slot];
  const label = slot === 'before' ? 'Before tuning' : 'After tuning';
  const stream = entry?.capture?.streams[entry.selected];
  return `
    <div class="field benchmark-input">
      <label for="benchmark-${slot}">${label}</label>
      <input id="benchmark-${slot}" type="file" accept=".csv,text/csv" data-benchmark-file="${slot}" aria-describedby="benchmark-${slot}-status">
      <p class="small ${entry?.error ? 'benchmark-error' : 'muted'}" id="benchmark-${slot}-status" role="status">
        ${entry?.error ? escapeHtml(entry.error) : entry ? escapeHtml(entry.name) : 'Choose a raw PresentMon CSV.'}
      </p>
      ${entry ? streamPicker(slot, entry) : ''}
      ${stream ? `<p class="small muted">${escapeHtml(stream.application)} · ${number.format(stream.count)} intervals · ${number.format(stream.durationMs / 1000)} s${stream.skipped ? ` · ${number.format(stream.skipped)} invalid timings skipped` : ''}</p>` : ''}
    </div>`;
}

function metric(label, key, suffix, before, after, changes, lowerIsBetter = false) {
  const change = changes[key];
  const neutral = Math.abs(change) < 0.005;
  const favorable = lowerIsBetter ? change < 0 : change > 0;
  const style = neutral ? '' : favorable ? ' is-improved' : ' is-regressed';
  const sign = neutral ? '' : change > 0 ? '+' : '−';
  return `<tr>
    <th scope="row">${label}</th>
    <td>${number.format(before[key])} ${suffix}</td>
    <td>${number.format(after[key])} ${suffix}</td>
    <td class="benchmark-change${style}">${sign}${number.format(neutral ? 0 : Math.abs(change))} ${suffix}</td>
  </tr>`;
}

function comparison() {
  const before = captures.before;
  const after = captures.after;
  const beforeStream = before?.capture?.streams[before.selected];
  const afterStream = after?.capture?.streams[after.selected];
  if (!beforeStream || !afterStream) return '';
  let changes;
  try {
    changes = compareCaptures(before.capture, after.capture, beforeStream, afterStream);
  } catch (error) {
    return `<p class="callout warn" role="status">${escapeHtml(error.message)}</p>`;
  }
  const beforeMs = beforeStream.durationMs;
  const afterMs = afterStream.durationMs;
  const durationsDiffer = Math.max(beforeMs, afterMs) > 1.25 * Math.min(beforeMs, afterMs);
  const shortRun = Math.min(beforeMs, afterMs) < 20_000;
  return `
    <section class="card card-pad benchmark-results" aria-labelledby="benchmark-results-heading">
      <div class="card-header"><div><h2 id="benchmark-results-heading">Results</h2><p>${escapeHtml(before.capture.description[0].toUpperCase() + before.capture.description.slice(1))}. Higher FPS and lower frame times are better.</p></div></div>
      ${durationsDiffer || shortRun ? `<p class="callout warn">${durationsDiffer ? 'The captures differ in duration. ' : ''}${shortRun ? 'At least one capture is under 20 seconds. ' : ''}Repeat both runs over the same 30–60 second scene for a fairer comparison.</p>` : ''}
      <div class="benchmark-table-wrap">
        <table class="benchmark-table">
          <thead><tr><th scope="col">Metric</th><th scope="col">Before</th><th scope="col">After</th><th scope="col">Change</th></tr></thead>
          <tbody>
            ${metric('Average FPS', 'averageFps', 'FPS', beforeStream, afterStream, changes)}
            ${metric('1% low FPS', 'lowFps', 'FPS', beforeStream, afterStream, changes)}
            ${metric('99th-percentile frame time', 'p99Ms', 'ms', beforeStream, afterStream, changes, true)}
          </tbody>
        </table>
      </div>
      <p class="small muted">Average FPS is frame count divided by sampled time. The 1% low uses the mean interval of the slowest 1% of frames. Results use application timing and can differ from what the monitor displayed.</p>
    </section>`;
}

export function renderBenchmark() {
  return `
    <div class="benchmark-page">
      <section class="card card-pad" aria-labelledby="benchmark-import-heading">
        <div class="card-header">
          <div><h2 id="benchmark-import-heading">Compare two captures</h2><p>Run the same scene for the same amount of time before and after a tweak. Keep all other settings the same.</p></div>
          ${captures.before || captures.after ? '<button type="button" class="button button-small" data-benchmark-clear>Clear captures</button>' : ''}
        </div>
        <div class="benchmark-inputs">${SLOTS.map(captureField).join('')}</div>
        <p class="small muted">Import raw PresentMon CSV files up to 24 MB. Nexa reads them locally in this window.</p>
        <details>
          <summary>How to record a capture</summary>
          <p class="small muted">In Intel PresentMon, target the game and record the same 30–60 second scene twice. Use the raw capture CSV for each run. The desktop capture app saves these in <code>%LOCALAPPDATA%\\Intel\\PresentMon\\Capture</code>.</p>
          <a class="button button-small" href="https://github.com/GameTechDev/PresentMon/releases" target="_blank" rel="noreferrer">${icon('external')} Get Intel PresentMon</a>
        </details>
      </section>
      ${comparison()}
    </div>`;
}

async function readCapture(slot, file) {
  const entry = { name: file.name, capture: null, selected: null, error: '' };
  captures[slot] = entry;
  try {
    if (file.size > MAX_CAPTURE_BYTES) throw new Error('Choose a raw CSV file no larger than 24 MB.');
    entry.capture = parseCapture(await file.text());
    if (entry.capture.streams.length === 1) entry.selected = 0;
  } catch (error) {
    entry.error = error instanceof Error ? error.message : 'Could not read the capture.';
  }
  if (captures[slot] === entry) requestRender();
}

export function bindBenchmark() {
  for (const slot of SLOTS) {
    document.getElementById(`benchmark-${slot}`)?.addEventListener('change', (event) => {
      const file = event.currentTarget.files[0];
      if (file) void readCapture(slot, file);
    });
    document.getElementById(`benchmark-${slot}-stream`)?.addEventListener('change', (event) => {
      const { value } = event.currentTarget;
      captures[slot].selected = value === '' ? null : Number(value);
      requestRender();
    });
  }
  document.querySelector('[data-benchmark-clear]')?.addEventListener('click', () => {
    captures.before = null;
    captures.after = null;
    requestRender();
  });
}
