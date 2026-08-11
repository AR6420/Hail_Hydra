#!/usr/bin/env node
'use strict';

// hydra-core generator: content/ + src/hooks/ → dist/<host>/
//
// dist/<host>/ mirrors the installed payload layout exactly:
//   agents/*.md
//   SKILL.md
//   skills/stfu-agents/SKILL.md
//   references/*.md
//   commands/hydra/*.md          (claude; other hosts differ)
//   hooks/*.js + hydra-task-complete.wav
//
// `npm run build` regenerates everything; `prepack` runs build + test so a
// published tarball can never carry a stale dist/. This replaces the
// hand-synced npm-package/files/ mirror that repeatedly drifted.

const fs = require('fs');
const path = require('path');

const { HOSTS, applyTokens } = require('./maps');
const { bundleHook } = require('./bundle');

const ROOT = path.resolve(__dirname, '..', '..');
const CONTENT = path.join(ROOT, 'content');
const DIST = path.join(ROOT, 'dist');
const VERSION = require(path.join(ROOT, 'package.json')).version;

function write(dest, content) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, content, 'utf8');
}

function emitText(srcFile, destFile, host) {
  const text = applyTokens(fs.readFileSync(srcFile, 'utf8'), host);
  if (/\{\{HYDRA_[A-Z0-9_]+\}\}/.test(text)) {
    throw new Error(`Unresolved generator token left in ${destFile}`);
  }
  write(destFile, text);
}

function listMd(dir) {
  return fs.readdirSync(dir).filter((f) => f.endsWith('.md')).sort();
}

// ── Claude emitter ───────────────────────────────────────────────────────────

function buildClaude() {
  const host = 'claude';
  const out = path.join(DIST, host);

  // Agents — verbatim apart from token resolution.
  for (const f of listMd(path.join(CONTENT, 'agents'))) {
    emitText(path.join(CONTENT, 'agents', f), path.join(out, 'agents', f), host);
  }

  // Skill + standalone skills.
  emitText(path.join(CONTENT, 'SKILL.md'), path.join(out, 'SKILL.md'), host);
  emitText(
    path.join(CONTENT, 'skills', 'stfu-agents', 'SKILL.md'),
    path.join(out, 'skills', 'stfu-agents', 'SKILL.md'),
    host
  );

  // References.
  for (const f of listMd(path.join(CONTENT, 'references'))) {
    emitText(path.join(CONTENT, 'references', f), path.join(out, 'references', f), host);
  }

  // Commands — installed under commands/hydra/ for the /hydra:* namespace.
  for (const f of listMd(path.join(CONTENT, 'commands'))) {
    emitText(path.join(CONTENT, 'commands', f), path.join(out, 'commands', 'hydra', f), host);
  }

  // Hooks — bundled self-contained from src/hooks/claude/.
  const hookSrcDir = path.join(ROOT, 'src', 'hooks', 'claude');
  for (const f of fs.readdirSync(hookSrcDir).filter((f) => f.endsWith('.js')).sort()) {
    write(path.join(out, 'hooks', f), bundleHook(path.join(hookSrcDir, f)));
  }
  fs.mkdirSync(path.join(out, 'hooks'), { recursive: true });
  fs.copyFileSync(
    path.join(ROOT, 'src', 'hooks', 'hydra-task-complete.wav'),
    path.join(out, 'hooks', 'hydra-task-complete.wav')
  );
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

const EMITTERS = { claude: buildClaude };

function buildAll(hosts = Object.keys(EMITTERS)) {
  fs.rmSync(DIST, { recursive: true, force: true });
  for (const host of hosts) {
    if (!EMITTERS[host]) throw new Error(`No emitter for host '${host}'`);
    if (!HOSTS[host]) throw new Error(`No host map for '${host}'`);
    EMITTERS[host]();
  }
  stampPluginManifest();
  return { hosts, version: VERSION, dist: DIST };
}

if (require.main === module) {
  const result = buildAll();
  console.log(`hydra-core build ${result.version} → dist/{${result.hosts.join(',')}}`);
}

module.exports = { buildAll, DIST, VERSION };
