'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const parserSource = fs.readFileSync(path.join(__dirname, '../public/js/benchmark-data.js'));
const parser = import('data:text/javascript;base64,' + parserSource.toString('base64'));

function csv(heading, times, application = 'Game.exe', processId = 14, swapChain = '0xABC') {
  return ['Application,ProcessID,SwapChainAddress,' + heading,
    ...times.map((time) => [application, processId, swapChain, time].join(',')),
  ].join('\r\n');
}

test('calculates average FPS, 1% low and P99 from frame intervals', async () => {
  const { parseCapture } = await parser;
  const input = csv('MsBetweenPresents', [...Array(197).fill(10), 20, 30, 40, 0, 'NA']);
  const { timing, streams: [stream] } = parseCapture('\uFEFF' + input);
  assert.equal(timing, 'presents');
  assert.equal(stream.count, 200);
  assert.equal(stream.skipped, 2);
  assert.equal(stream.durationMs, 2060);
  assert.equal(stream.averageFps, 200_000 / 2060);
  assert.equal(stream.lowFps, 2000 / 70);
  assert.equal(stream.p99Ms, 20);
});

test('reads desktop and console v2 timing, quoting, and independent swap chains', async () => {
  const { parseCapture } = await parser;
  const desktop = csv('FrameTime', Array(100).fill(12), '"Game, Deluxe.exe"');
  const consoleV2 = csv('MsCPUBusy,MsCPUWait', Array(100).fill('10,2'), 'Game.exe');
  const repeated = csv('MsCPUBusy,MsCPUWait', Array(100).fill('10,3'), 'Game.exe', 14, '0xDEF');
  const desktopCapture = parseCapture(desktop);
  assert.equal(desktopCapture.timing, 'cpu-frame-time');
  assert.equal(desktopCapture.streams[0].application, 'Game, Deluxe.exe');
  assert.equal(desktopCapture.streams[0].p99Ms, 12);
  const consoleCapture = parseCapture(consoleV2 + '\r\n' + repeated.slice(repeated.indexOf('\n') + 1));
  assert.equal(consoleCapture.timing, 'cpu-busy-wait');
  assert.deepEqual(consoleCapture.streams.map(({ p99Ms }) => p99Ms), [12, 13]);
});

test('compares the same executable even after it restarts', async () => {
  const { parseCapture, compareCaptures } = await parser;
  const before = parseCapture(csv('FrameTime', Array(100).fill(20), 'Game.exe', 14, '0xABC'));
  const after = parseCapture(csv('FrameTime', Array(100).fill(10), 'GAME.EXE', 31, '0xB'));
  const otherGame = parseCapture(csv('FrameTime', Array(100).fill(10), 'Other.exe'));
  const otherFormat = parseCapture(csv('MsBetweenPresents', Array(100).fill(10)));
  assert.deepEqual(compareCaptures(before, after, before.streams[0], after.streams[0]),
    { averageFps: 50, lowFps: 50, p99Ms: -10 });
  assert.throws(() => compareCaptures(before, otherGame, before.streams[0], otherGame.streams[0]), /same game executable/);
  assert.throws(() => compareCaptures(before, otherFormat, before.streams[0], otherFormat.streams[0]), /measure frame time differently/);
});

test('rejects summary, short, malformed, and over-limit captures', async () => {
  const { parseCapture, MAX_CAPTURE_BYTES } = await parser;
  assert.throws(() => parseCapture('AverageFPS,Duration\n100,30'), /raw PresentMon capture/);
  assert.throws(() => parseCapture(csv('FrameTime', Array(99).fill(10))), /at least 100/);
  assert.throws(() => parseCapture(csv('FrameTime', Array(100).fill(10)) + '\nGame.exe,14'), /inconsistent columns/);
  assert.throws(() => parseCapture(csv('FrameTime', Array(100).fill(10), '"Game.exe')), /Malformed CSV field/);
  assert.throws(() => parseCapture('x'.repeat(MAX_CAPTURE_BYTES + 1)), /24 MB/);
});
