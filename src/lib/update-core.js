'use strict';

// Hydra update-check core — cache-TTL gate + detached npm-registry version
// check. Host entries supply paths: where VERSION was installed, where the
// cache lives. The npm package name is the same for every host.

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const PKG_NAME = 'hail-hydra-cc';
const CHECK_INTERVAL_MS = 3600000; // 1 hour

// Returns true when a fresh check is unnecessary.
function recentlyChecked(cacheFile) {
  try {
    const existing = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
    return Date.now() - (existing.checked_at || 0) < CHECK_INTERVAL_MS;
  } catch {
    return false;
  }
}

// Spawns a DETACHED background process so the SessionStart hook returns
// immediately. versionFiles are tried in order (project first, then global).
function spawnCheck({ cacheFile, versionFiles }) {
  fs.mkdirSync(path.dirname(cacheFile), { recursive: true });

  const child = spawn(process.execPath, ['-e', `
    const fs = require('fs');
    const { execSync } = require('child_process');

    const cacheFile = ${JSON.stringify(cacheFile)};
    const versionFiles = ${JSON.stringify(versionFiles)};

    try {
      let installed = 'unknown';
      for (const vf of versionFiles) {
        try { installed = fs.readFileSync(vf, 'utf8').trim(); break; } catch (e) {}
      }

      const latest = execSync('npm view ${PKG_NAME} version', {
        encoding: 'utf8',
        timeout: 10000,
        windowsHide: true,
        stdio: ['pipe', 'pipe', 'pipe']
      }).trim();

      const updateAvailable = installed !== 'unknown' && latest !== installed;

      fs.writeFileSync(cacheFile, JSON.stringify({
        installed: installed,
        latest: latest,
        update_available: updateAvailable,
        checked_at: Date.now()
      }, null, 2));
    } catch (e) {
      fs.writeFileSync(cacheFile, JSON.stringify({
        installed: 'unknown',
        latest: 'unknown',
        update_available: false,
        checked_at: Date.now(),
        error: e.message
      }, null, 2));
    }
  `], {
    stdio: 'ignore',
    windowsHide: true,
    detached: true, // CRITICAL: prevents blocking the host CLI on Windows
  });

  child.unref();
}

module.exports = { recentlyChecked, spawnCheck, PKG_NAME };
