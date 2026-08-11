#!/usr/bin/env node

// Hydra Update Checker — Codex CLI SessionStart hook.
//
// Codex has no statusline, and its `systemMessage` hook output is parsed but
// not implemented (C8) — so an available update is surfaced through the
// reliable channel: SessionStart `hookSpecificOutput.additionalContext`.
// The npm check itself runs in a detached background child (lib/update-core)
// and lands in the cache for the NEXT session start — this hook never blocks
// startup.

const fs = require('fs');
const path = require('path');
const os = require('os');

const update = require('../../lib/update-core');

const configDir = process.env.CODEX_HOME || path.join(os.homedir(), '.codex');
const cacheFile = path.join(configDir, 'hydra', 'cache', 'hydra-update-check.json');

const versionFiles = [
  path.join(process.cwd(), '.codex', 'hydra', 'VERSION'),
  path.join(configDir, 'hydra', 'VERSION'),
];

let stdinData = '';
process.stdin.on('data', (chunk) => (stdinData += chunk));
process.stdin.on('end', () => {
  let message = null;
  try {
    const cache = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
    if (cache.update_available && cache.latest) {
      message = `🐉 Hydra update available: ${cache.installed} → ${cache.latest}. Mention it to the user and suggest $hydra-update.`;
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
