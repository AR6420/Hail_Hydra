#!/usr/bin/env node

// Hydra Update Checker — SessionStart hook (Claude Code)
// Spawns a DETACHED background process to check npm for updates.
// Writes result to <configDir>/cache/hydra-update-check.json
// The statusline hook reads this cache file.
//
// VERSION is read from where the installer actually writes it:
// <base>/skills/hydra/VERSION (project first, then global). v3.0.0 fixes the
// v2.x path mismatch that left `installed` permanently 'unknown' and the
// update banner dead.

const path = require('path');
const os = require('os');

const update = require('../../lib/update-core');

const configDir = process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');
const cacheFile = path.join(configDir, 'cache', 'hydra-update-check.json');

const versionFiles = [
  path.join(process.cwd(), '.claude', 'skills', 'hydra', 'VERSION'),
  path.join(configDir, 'skills', 'hydra', 'VERSION'),
];

if (update.recentlyChecked(cacheFile)) {
  process.exit(0);
}

// Read stdin to prevent EPIPE (the host pipes JSON to all hooks)
let stdinData = '';
process.stdin.on('data', (chunk) => (stdinData += chunk));
process.stdin.on('end', () => {
  update.spawnCheck({ cacheFile, versionFiles });
  process.exit(0);
});
