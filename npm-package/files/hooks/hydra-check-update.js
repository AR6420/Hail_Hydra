#!/usr/bin/env node

// Hydra Update Checker — SessionStart hook
// Spawns a DETACHED background process to check npm for updates.
// Writes result to ~/.claude/cache/hydra-update-check.json
// The statusline hook reads this cache file.

const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const homeDir = os.homedir();
const cacheDir = path.join(homeDir, '.claude', 'cache');
const cacheFile = path.join(cacheDir, 'hydra-update-check.json');

// VERSION file locations (check project first, then global)
const projectVersionFile = path.join(process.cwd(), '.claude', 'hydra', 'VERSION');
const globalVersionFile = path.join(homeDir, '.claude', 'hydra', 'VERSION');

// Ensure cache directory exists
if (!fs.existsSync(cacheDir)) {
  fs.mkdirSync(cacheDir, { recursive: true });
}

// Skip check if we checked within the last hour
try {
  const existing = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
  const age = Date.now() - (existing.checked_at || 0);
  if (age < 3600000) { // 1 hour
    process.exit(0);
  }
} catch (e) {
  // No cache or invalid — proceed with check
}

// Read stdin to prevent EPIPE (Claude Code pipes JSON to all hooks)
let stdinData = '';
process.stdin.on('data', (chunk) => (stdinData += chunk));
process.stdin.on('end', () => {
  // Spawn background process (MUST be detached to not block Claude Code)
  const child = spawn(process.execPath, ['-e', `
    const fs = require('fs');
    const { execSync } = require('child_process');

    const cacheFile = ${JSON.stringify(cacheFile)};
    const projectVersionFile = ${JSON.stringify(projectVersionFile)};
    const globalVersionFile = ${JSON.stringify(globalVersionFile)};

    try {
      // Read installed version
      let installed = 'unknown';
      try {
        installed = fs.readFileSync(projectVersionFile, 'utf8').trim();
      } catch (e) {
        try {
          installed = fs.readFileSync(globalVersionFile, 'utf8').trim();
        } catch (e2) {}
      }

      // Fetch latest version from npm (with timeout)
      const latest = execSync('npm view hail-hydra-cc version', {
        encoding: 'utf8',
        timeout: 10000,
        windowsHide: true,
        stdio: ['pipe', 'pipe', 'pipe']
      }).trim();

      // Compare and write cache
      const updateAvailable = installed !== 'unknown' && latest !== installed;

      const result = {
        installed: installed,
        latest: latest,
        update_available: updateAvailable,
        checked_at: Date.now()
      };

      fs.writeFileSync(cacheFile, JSON.stringify(result, null, 2));
    } catch (e) {
      // Network error or npm not available — write a "no check" result
      const result = {
        installed: 'unknown',
        latest: 'unknown',
        update_available: false,
        checked_at: Date.now(),
        error: e.message
      };
      fs.writeFileSync(cacheFile, JSON.stringify(result, null, 2));
    }
  `], {
    stdio: 'ignore',
    windowsHide: true,
    detached: true  // CRITICAL: prevents blocking Claude Code input on Windows
  });

  child.unref();
  process.exit(0);
});
