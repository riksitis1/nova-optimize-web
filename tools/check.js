'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.join(__dirname, '..');
const DIRS = ['server', 'public', 'test', 'tools'];
const files = [];

function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'data') continue;
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      walk(full);
    } else if (entry.isFile() && entry.name.endsWith('.js')) {
      files.push(full);
    }
  }
}

for (const directory of DIRS) {
  const full = path.join(ROOT, directory);
  if (fs.existsSync(full)) walk(full);
}

let failed = 0;
for (const file of files) {
  const relative = path.relative(ROOT, file);
  const frontend = relative.startsWith(`public${path.sep}`);
  const result = frontend
    ? spawnSync(process.execPath, ['--input-type=module', '--check'], {
        input: fs.readFileSync(file),
        encoding: 'utf8',
      })
    : spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  if (result.status !== 0) {
    failed += 1;
    console.error(`\nSyntax error in ${relative}`);
    console.error((result.stderr || result.stdout || '').trim());
  }
}

if (failed) {
  console.error(`\n${failed} file${failed === 1 ? '' : 's'} failed the syntax check.`);
  process.exit(1);
}
console.log(`Syntax checked ${files.length} JavaScript files.`);
