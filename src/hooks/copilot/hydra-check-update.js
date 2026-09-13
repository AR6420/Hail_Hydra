#!/usr/bin/env node

// Hydra Update Checker — Copilot CLI SessionStart hook.
//
// Copilot has no statusline, so an available update is surfaced through
// SessionStart `hookSpecificOutput.additionalContext`. The npm check itself
// runs in a detached background child (lib/update-core) and lands in the
// cache for the NEXT session start — this hook never blocks startup.

const fs = require('fs');
const path = require('path');
const os = require('os');

const update = require('../../lib/update-core');

const configDir = process.env.COPILOT_CONFIG_DIR || path.join(os.homedir(), '.copilot');
const cacheFile = path.join(configDir, 'hydra', 'cache', 'hydra-update-check.json');

const versionFiles = [
  path.join(process.cwd(), '.copilot', 'hydra', 'VERSION'),
  path.join(configDir, 'hydra', 'VERSION'),
];

let stdinData = '';
process.stdin.on('data', (chunk) => (stdinData += chunk));
process.stdin.on('end', () => {
  let message = null;
  try {
    const cache = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
    if (cache.update_available && cache.latest) {
      message = `🐉 Hydra update available: ${cache.installed} → ${cache.latest}. Mention it to the user and suggest /hail-hydra --update.`;
    }
  } catch (e) { /* no cache yet */ }

  if (!update.recentlyChecked(cacheFile)) {
    try { update.spawnCheck({ cacheFile, versionFiles }); } catch (e) { /* best-effort */ }
  }

  if (message) {
    process.stdout.write(JSON.stringify({
      hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: message },
    }));
  }
  process.exit(0);
});
