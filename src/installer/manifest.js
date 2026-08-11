'use strict';

// Install manifest — written to <base>/skills/hydra/manifest.json per host.
// Records what this version installed (with content hashes), enabling:
//   - precise uninstall (remove exactly what we wrote)
//   - future user-edit preservation on update (GSD's --reapply pattern):
//     a file whose on-disk hash differs from the manifest hash was edited
//     by the user after install.

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

function sha256(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

function writeManifest(base, { version, host, files }) {
  const manifestPath = path.join(base, 'skills', 'hydra', 'manifest.json');
  const manifest = {
    version,
    host,
    installedAt: new Date().toISOString(),
    files: files.map((f) => ({
      path: f.path,
      sha256: sha256(f.content !== undefined ? Buffer.from(f.content, 'utf8') : fs.readFileSync(f.absPath)),
    })),
  };
  fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  return manifestPath;
}

function readManifest(base) {
  try {
    return JSON.parse(fs.readFileSync(path.join(base, 'skills', 'hydra', 'manifest.json'), 'utf8'));
  } catch {
    return null;
  }
}

module.exports = { writeManifest, readManifest, sha256 };
