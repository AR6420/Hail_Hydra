#!/usr/bin/env node
'use strict';

// hydra-core generator: content/ + src/hooks/ → dist/<host>/
//
// Emitters are auto-discovered from src/generator/emit-<host>.js — adding a
// host means adding one emitter module (plus its src/hooks/<host>/ entries
// and src/installer/hosts/<host>.js); nothing here changes.
//
// `npm run build` regenerates everything; `prepack` runs build + test so a
// published tarball can never carry a stale dist/. This replaces the
// hand-synced npm-package/files/ mirror that repeatedly drifted.

const fs = require('fs');
const path = require('path');

const { ROOT, DIST, VERSION } = require('./shared');

// ── Emitter discovery ────────────────────────────────────────────────────────

function loadEmitters() {
  const emitters = {};
  for (const f of fs.readdirSync(__dirname).sort()) {
    const m = /^emit-([a-z]+)\.js$/.exec(f);
    if (!m) continue;
    const emitter = require(path.join(__dirname, f));
    if (emitter.id !== m[1]) {
      throw new Error(`Emitter ${f} exports id '${emitter.id}' — must match filename`);
    }
    emitters[emitter.id] = emitter;
  }
  return emitters;
}

// ── Shared stamps ────────────────────────────────────────────────────────────

// Keep .claude-plugin/plugin.json's version in lockstep with package.json.
function stampPluginManifest() {
  const pluginFile = path.join(ROOT, '.claude-plugin', 'plugin.json');
  if (!fs.existsSync(pluginFile)) return;
  const plugin = JSON.parse(fs.readFileSync(pluginFile, 'utf8'));
  plugin.version = VERSION;
  fs.writeFileSync(pluginFile, JSON.stringify(plugin, null, 2) + '\n');
}

// ── Entry ────────────────────────────────────────────────────────────────────

function buildAll(hosts = null) {
  const emitters = loadEmitters();
  const targets = hosts || Object.keys(emitters);
  fs.rmSync(DIST, { recursive: true, force: true });
  for (const host of targets) {
    if (!emitters[host]) throw new Error(`No emitter for host '${host}'`);
    emitters[host].emit();
  }
  stampPluginManifest();
  return { hosts: targets, version: VERSION, dist: DIST };
}

if (require.main === module) {
  const result = buildAll();
  console.log(`hydra-core build ${result.version} → dist/{${result.hosts.join(',')}}`);
}

module.exports = { buildAll, DIST, VERSION };
