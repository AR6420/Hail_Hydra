#!/usr/bin/env node
'use strict';

// Test runner — executes every test/*.test.js sequentially, fails on the
// first non-zero exit. New hosts add test files; nothing registers them.

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const files = fs.readdirSync(__dirname).filter((f) => f.endsWith('.test.js')).sort();

let failed = 0;
for (const f of files) {
  const r = spawnSync(process.execPath, [path.join(__dirname, f)], {
    stdio: 'inherit',
    timeout: 120000,
  });
  if (r.status !== 0) {
    console.error(`\nFAILED: ${f} (exit ${r.status})`);
    failed++;
  }
}

if (failed) {
  console.error(`\n${failed}/${files.length} test file(s) failed`);
  process.exit(1);
}
console.log(`\nall ${files.length} test file(s) passed`);
