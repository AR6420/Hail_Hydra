#!/usr/bin/env node

// Hydra Update Checker — Gemini CLI SessionStart hook (matcher: "startup").
//
// Gemini has no statusline (G20), so an available update is surfaced directly
// via the hook's `systemMessage` output (G10). The npm check itself runs in a
// detached background child (lib/update-core) and lands in the cache for the
// NEXT session start — this hook never blocks startup.
//
// Stdout contract: PURE JSON or empty on exit 0.

const fs = require('fs');
const path = require('path');
const os = require('os');

const update = require('../../lib/update-core');

const configDir = process.env.GEMINI_CONFIG_DIR || path.join(os.homedir(), '.gemini');
const cacheFile = path.join(configDir, 'hydra', 'cache', 'hydra-update-check.json');

const versionFiles = [
  path.join(process.cwd(), '.gemini', 'hydra', 'VERSION'),
  path.join(configDir, 'hydra', 'VERSION'),
];

let stdinData = '';
process.stdin.on('data', (chunk) => (stdinData += chunk));
process.stdin.on('end', () => {
  let message = null;
  try {
    const cache = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
    if (cache.update_available && cache.latest) {
      message = `🐉 Hydra update available: ${cache.installed} → ${cache.latest}. Run /hydra:update to update.`;
    }
  } catch (e) { /* no cache yet */ }

  if (!update.recentlyChecked(cacheFile)) {
    try { update.spawnCheck({ cacheFile, versionFiles }); } catch (e) { /* best-effort */ }
  }

  if (message) process.stdout.write(JSON.stringify({ systemMessage: message }));
  process.exit(0);
});
