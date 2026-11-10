export const MAX_CAPTURE_BYTES = 24 * 1024 * 1024;
const MAX_ROWS = 500_000;
const MAX_STREAMS = 64;
const MAX_ROW_LENGTH = 16_384;
const MIN_SAMPLES = 100;

const TIMINGS = [
  { id: 'presents', columns: ['msbetweenpresents'], description: 'time between Present calls' },
  { id: 'cpu-frame-time', columns: ['frametime'], description: 'time between CPU frames' },
  { id: 'cpu-busy-wait', columns: ['mscpubusy', 'mscpuwait'], description: 'CPU busy time plus CPU wait time' },
];

function parseRecord(line) {
  if (!line.includes('"')) return line.split(',');
  const fields = [];
  let offset = 0;
  while (offset <= line.length) {
    if (line[offset] !== '"') {
      const comma = line.indexOf(',', offset);
      const end = comma === -1 ? line.length : comma;
      const field = line.slice(offset, end);
      if (field.includes('"')) throw new Error('Malformed CSV field.');
      fields.push(field);
      offset = end + 1;
      continue;
    }

    let field = '';
    let start = offset + 1;
    let quote = line.indexOf('"', start);
    while (quote !== -1 && line[quote + 1] === '"') {
      field += line.slice(start, quote + 1);
      start = quote + 2;
      quote = line.indexOf('"', start);
    }
    if (quote === -1 || (quote + 1 < line.length && line[quote + 1] !== ',')) {
      throw new Error('Malformed CSV field.');
    }
    fields.push(field + line.slice(start, quote));
    offset = quote + 2;
  }
  return fields;
}

function readTime(record, columns) {
  let total = 0;
  for (const index of columns) {
    const value = record[index].trim();
    if (!/^(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(value)) return null;
    total += Number(value);
  }
  return total >= 0.000001 && total <= 3_600_000 ? total : null;
}

function summarize(stream) {
  const { samples, ...details } = stream;
  const count = samples.length;
  const durationMs = samples.reduce((sum, value) => sum + value, 0);
  samples.sort((a, b) => a - b);
  const slowestCount = Math.ceil(count / 100);
  let slowestMs = 0;
  for (let index = count - slowestCount; index < count; index += 1) {
    slowestMs += samples[index];
  }
  return {
    ...details,
    count,
    durationMs,
    averageFps: count * 1000 / durationMs,
    lowFps: slowestCount * 1000 / slowestMs,
    p99Ms: samples[Math.ceil(count * 0.99) - 1],
  };
}

export function parseCapture(csv) {
  if (typeof csv !== 'string' || csv.length > MAX_CAPTURE_BYTES) {
    throw new Error('Choose a raw CSV file no larger than 24 MB.');
  }
  const streams = new Map();
  let header;
  let timing;
  let timeColumns;
  let identityColumns;
  let rows = 0;
  for (let start = 0; start < csv.length;) {
    const next = csv.indexOf('\n', start);
    const end = next === -1 ? csv.length : next;
    if (end - start > MAX_ROW_LENGTH) throw new Error('A row is too long for a PresentMon capture.');
    const line = csv.slice(start, end).replace(/\r$/, '').replace(/^\uFEFF/, '');
    start = end + 1;
    if (!line.trim()) continue;
    const record = parseRecord(line);
    if (!header) {
      header = record.map((field) => field.trim().toLowerCase());
      identityColumns = ['application', 'processid', 'swapchainaddress'].map((name) => header.indexOf(name));
      timing = TIMINGS.find(({ columns }) => columns.every((name) => header.includes(name)));
      if (!timing || identityColumns.includes(-1)) {
        throw new Error('Choose a raw PresentMon capture CSV with per-frame timing.');
      }
      timeColumns = timing.columns.map((name) => header.indexOf(name));
      continue;
    }

    rows += 1;
    if (rows > MAX_ROWS) throw new Error('The capture exceeds 500,000 rows. Record a shorter run.');
    if (record.length !== header.length) throw new Error('CSV rows have inconsistent columns.');
    const [application, processId, swapChain] = identityColumns.map((index) => record[index].trim());
    if (!application || !/^\d+$/.test(processId) || !swapChain ||
      application.length > 260 || processId.length > 10 || swapChain.length > 32) {
      throw new Error('A frame is missing valid process or swap chain information.');
    }
    const key = JSON.stringify([application.toLowerCase(), processId, swapChain.toLowerCase()]);
    let stream = streams.get(key);
    if (!stream) {
      if (streams.size >= MAX_STREAMS) throw new Error('Too many frame streams. Capture just the game process.');
      stream = { application, processId, swapChain, samples: [], skipped: 0 };
      streams.set(key, stream);
    }
    const frameTime = readTime(record, timeColumns);
    if (frameTime === null) stream.skipped += 1;
    else stream.samples.push(frameTime);
  }
  if (!header) throw new Error('The capture CSV is empty.');

  const qualifying = [...streams.values()]
    .filter((stream) => stream.samples.length >= MIN_SAMPLES)
    .map(summarize)
    .sort((a, b) => b.count - a.count);
  if (!qualifying.length) {
    throw new Error('Record at least 100 valid frame intervals from one game stream.');
  }
  return { timing: timing.id, description: timing.description, streams: qualifying };
}

export function compareCaptures(before, after, beforeStream, afterStream) {
  if (before.timing !== after.timing) {
    throw new Error('These captures measure frame time differently. Use the same PresentMon capture format for both runs.');
  }
  if (beforeStream.application.toLowerCase() !== afterStream.application.toLowerCase()) {
    throw new Error('Select the same game executable in both captures.');
  }
  return {
    averageFps: afterStream.averageFps - beforeStream.averageFps,
    lowFps: afterStream.lowFps - beforeStream.lowFps,
    p99Ms: afterStream.p99Ms - beforeStream.p99Ms,
  };
}
