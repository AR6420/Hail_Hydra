#!/usr/bin/env node
'use strict';

// Installer safety self-check. No framework — run directly:
//   node test/installer-safety.test.js
//
// Hostile fixtures (BOM, trailing-comma JSON, wrong-shape hooks, commented
// [features] headers, indented notify, stray BEGIN markers) must either
// install cleanly or abort THAT step with a warning — never data loss, never
// a crash; originals stay byte-preserved on every abort path. Also covers:
// bounded empty-dir climb on uninstall, extras skipped for hosts with no
// install, hydra-owned-only sweeps, atomic writes, missing-dist degradation,
// and host-aware completion output.

const assert = require('assert');
const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

const { buildAll } = require('../src/generator/build.js');
buildAll();

const claude = require('../src/installer/hosts/claude.js');
const gemini = require('../src/installer/hosts/gemini.js');
const codex = require('../src/installer/hosts/codex.js');
const installer = require('../src/installer');
const { writeFileAtomic, readUserJson, isPlainObject } = require('../src/installer/fsutil.js');
const { MARKER_BEGIN, MARKER_END } = require('../src/generator/emit-gemini.js');

const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'hydra-safety-'));
const V = '9.9.9';
const quiet = { header() {}, file() {}, ok() {}, warn() {}, blank() {} };
function capture() {
  const warns = [];
  return { log: { header() {}, file() {}, ok() {}, warn: (m) => warns.push(m), blank() {} }, warns };
}
let dirN = 0;
function freshDir() {
  const d = path.join(scratch, `cfg-${dirN++}`);
  fs.mkdirSync(d, { recursive: true });
  return d;
}

// ── 0. fsutil helpers ───────────────────────────────────────────────────────

{
  const f = path.join(freshDir(), 'x.json');
  writeFileAtomic(f, 'one');
  writeFileAtomic(f, 'two');
  assert.strictEqual(fs.readFileSync(f, 'utf8'), 'two', 'writeFileAtomic replaces content');
  assert.ok(!fs.existsSync(f + '.hydra-tmp'), 'writeFileAtomic leaves no temp file');

  fs.writeFileSync(f, '﻿{"a":1}');
  assert.deepStrictEqual(readUserJson(f), { exists: true, data: { a: 1 } }, 'readUserJson strips a UTF-8 BOM');
  fs.writeFileSync(f, '{"a":1,}');
  assert.ok(readUserJson(f).error, 'readUserJson reports parse errors');
  assert.deepStrictEqual(readUserJson(f + '.nope'), { exists: false, data: null }, 'missing file → exists false');
  assert.ok(isPlainObject({}) && !isPlainObject([]) && !isPlainObject(null) && !isPlainObject('x'));
}

// ── 1. Hostile settings.json / hooks.json: abort step, file byte-preserved ──

const HOSTILE_JSON = [
  ['trailing comma', '{"model":"opus","env":{"A":"1"},}'],
  ['BOM + trailing comma', '﻿{"model":"opus",}'],
  ['array root', '[1,2,3]'],
  ['null root', 'null'],
  ['string root', '"hello"'],
  ['array hooks container', '{"model":"opus","hooks":[]}'],
  ['object-shaped event', '{"hooks":{"SessionStart":{"matcher":"x"}}}'],
];

for (const [name, content] of HOSTILE_JSON) {
  for (const host of [claude, gemini]) {
    const cfg = freshDir();
    const file = path.join(cfg, 'settings.json');
    fs.writeFileSync(file, content);
    const before = fs.readFileSync(file);
    const { log, warns } = capture();
    const res = host.install({ scope: 'global', configDirOverride: cfg, version: V, log });
    assert.strictEqual(res.anyFailed, true, `${host.id}/${name}: counted as failure`);
    assert.ok(warns.some((w) => w.includes('settings.json')), `${host.id}/${name}: warning names settings.json`);
    assert.ok(before.equals(fs.readFileSync(file)), `${host.id}/${name}: settings.json byte-preserved`);
  }
  {
    const cfg = freshDir();
    const file = path.join(cfg, 'hooks.json');
    fs.writeFileSync(file, content);
    const before = fs.readFileSync(file);
    const { log, warns } = capture();
    const res = codex.install({ scope: 'global', configDirOverride: cfg, version: V, log });
    assert.strictEqual(res.anyFailed, true, `codex/${name}: counted as failure`);
    assert.ok(warns.some((w) => w.includes('hooks.json')), `codex/${name}: warning names hooks.json`);
    assert.ok(before.equals(fs.readFileSync(file)), `codex/${name}: hooks.json byte-preserved`);
  }
}

// BOM + valid JSON must install cleanly with user keys preserved.
{
  const cfg = freshDir();
  fs.writeFileSync(path.join(cfg, 'settings.json'), '﻿{"model":"opus","env":{"A":"1"}}');
  const res = claude.install({ scope: 'global', configDirOverride: cfg, version: V, log: quiet });
  assert.strictEqual(res.anyFailed, false, 'claude: BOM + valid JSON installs cleanly');
  const after = JSON.parse(fs.readFileSync(path.join(cfg, 'settings.json'), 'utf8'));
  assert.strictEqual(after.model, 'opus', 'claude: user keys survive the BOM');
  assert.strictEqual(after.env.A, '1');
  assert.ok(after.hooks.SessionStart.length >= 1, 'claude: hydra hooks registered');
}
{
  const cfg = freshDir();
  fs.writeFileSync(path.join(cfg, 'settings.json'), '﻿{"theme":"Dracula"}');
  const res = gemini.install({ scope: 'global', configDirOverride: cfg, version: V, log: quiet });
  assert.strictEqual(res.anyFailed, false, 'gemini: BOM + valid JSON installs cleanly');
  const after = JSON.parse(fs.readFileSync(path.join(cfg, 'settings.json'), 'utf8'));
  assert.strictEqual(after.theme, 'Dracula', 'gemini: user keys survive the BOM');
  assert.ok(Array.isArray(after.hooks.AfterTool), 'gemini: hydra hooks registered');
}

// ── 2. config.toml surgery: commented/indented headers, indented notify ─────

{
  const chain = '/x/chain.js';

  // [features] header with a trailing comment → no duplicate table.
  const feat = '[features]  # my features\nhooks = false\n';
  const r = codex.applyConfigToml(feat, { notifyChainScript: chain });
  assert.strictEqual((r.text.match(/\[features\]/g) || []).length, 1, 'commented header: no duplicate [features]');
  assert.ok(r.text.includes('# hydra-prev: hooks = false\nhooks = true # hydra'), 'commented header: hooks=false swapped');
  assert.strictEqual(codex.cleanConfigToml(r.text), feat, 'commented header: restored byte-exact');

  // Commented header without a hooks key → insert + fixed point + restore.
  const featC = '[features]  # my features\njs_repl = false\n';
  const rC = codex.applyConfigToml(featC, { notifyChainScript: chain });
  assert.strictEqual((rC.text.match(/\[features\]/g) || []).length, 1, 'commented header: hooks line inserted, single table');
  assert.ok(rC.text.includes('hooks = true # hydra'), 'commented header: hooks=true inserted');
  assert.strictEqual(codex.applyConfigToml(rC.text, { notifyChainScript: chain }).text, rC.text, 'commented header: re-apply fixed point');
  assert.strictEqual(codex.cleanConfigToml(rC.text), featC, 'commented header: insert restored byte-exact');

  // Indented [features] header → same guarantees.
  const featI = '  [features]\nhooks = false\n';
  const rI = codex.applyConfigToml(featI, { notifyChainScript: chain });
  assert.strictEqual((rI.text.match(/\[features\]/g) || []).length, 1, 'indented header: no duplicate [features]');
  assert.strictEqual(codex.cleanConfigToml(rI.text), featI, 'indented header: restored byte-exact');

  // Indented top-level notify → owned (commented + chained), never duplicated.
  const ind = '  notify = ["notify-send"]\n\n[features]\nhooks = false\n';
  const rN = codex.applyConfigToml(ind, { notifyChainScript: chain });
  assert.strictEqual((rN.text.match(/^[ \t]*notify[ \t]*=/gm) || []).length, 1, 'indented notify: exactly one active notify key');
  assert.ok(rN.text.includes('# hydra-prev: ' + '  notify = ["notify-send"]'), 'indented notify: commented in place');
  assert.deepStrictEqual(rN.savedNotify.argv, ['notify-send'], 'indented notify: argv parsed for chaining');
  assert.strictEqual(codex.cleanConfigToml(rN.text), ind, 'indented notify: restored byte-exact');

  // Ambiguous notify (duplicate keys — already invalid TOML) → skip chaining.
  const dup = 'notify = ["a"]\nnotify = ["b"]\n';
  const rD = codex.applyConfigToml(dup, { notifyChainScript: chain });
  assert.strictEqual(rD.notifySkipped, true, 'ambiguous notify: chaining skipped');
  assert.ok(!rD.text.includes('hydra-notify-chain'), 'ambiguous notify: no notify chain added');
  assert.ok(rD.text.includes(dup.trimEnd()), 'ambiguous notify: user lines preserved');
}

// ── 3. Reinstall over a replaced notify warns about the discarded command ───

{
  const cfg = freshDir();
  fs.writeFileSync(path.join(cfg, 'config.toml'), 'notify = ["orig-cmd"]\n');
  codex.install({ scope: 'global', configDirOverride: cfg, version: V, log: quiet });
  // The user adds a new top-level notify above the saved copy, then reinstalls.
  const text = fs.readFileSync(path.join(cfg, 'config.toml'), 'utf8');
  fs.writeFileSync(path.join(cfg, 'config.toml'), text.replace(
    '# hydra-prev: notify = ["orig-cmd"]',
    'notify = ["new-cmd"]\n# hydra-prev: notify = ["orig-cmd"]'
  ));
  const { log, warns } = capture();
  codex.install({ scope: 'global', configDirOverride: cfg, version: V, log });
  assert.ok(warns.some((w) => w.includes('orig-cmd')), 'reinstall warns naming the discarded notify command');
  assert.deepStrictEqual(
    JSON.parse(fs.readFileSync(path.join(cfg, 'hydra', 'notify-prev.json'), 'utf8')).argv,
    ['new-cmd'],
    'newest save wins in notify-prev.json'
  );
}

// ── 4. Marker blocks: stray BEGIN never eats user text ──────────────────────

for (const [host, ctxFile] of [[gemini, 'GEMINI.md'], [codex, 'AGENTS.md']]) {
  // Unbalanced markers (stray BEGIN): install AND uninstall leave the file alone.
  const cfg = freshDir();
  const file = path.join(cfg, ctxFile);
  const mangled = `${MARKER_BEGIN}\nold half block\n## My rules\nnever delete prod\n\n${MARKER_BEGIN}\nreal block\n${MARKER_END}\n`;
  fs.writeFileSync(file, mangled);

  const inst = capture();
  const res = host.install({ scope: 'global', configDirOverride: cfg, version: V, log: inst.log });
  assert.strictEqual(fs.readFileSync(file, 'utf8'), mangled, `${host.id}: install leaves unbalanced ${ctxFile} untouched`);
  assert.ok(inst.warns.some((w) => w.includes('unbalanced')), `${host.id}: install warns about unbalanced markers`);
  assert.strictEqual(res.anyFailed, true, `${host.id}: unbalanced markers counted as failure`);

  const un = capture();
  host.uninstallExtras({ configDirOverride: cfg, log: un.log });
  assert.strictEqual(fs.readFileSync(file, 'utf8'), mangled, `${host.id}: uninstall leaves unbalanced ${ctxFile} untouched`);
  assert.ok(un.warns.some((w) => w.includes('unbalanced')), `${host.id}: uninstall warns about unbalanced markers`);

  // Balanced blocks with user text between them: text between blocks survives.
  const cfg2 = freshDir();
  const file2 = path.join(cfg2, ctxFile);
  fs.writeFileSync(file2, `${MARKER_BEGIN}\nA\n${MARKER_END}\nuser keeps this\n${MARKER_BEGIN}\nB\n${MARKER_END}\n`);
  host.uninstallExtras({ configDirOverride: cfg2, log: quiet });
  assert.strictEqual(fs.readFileSync(file2, 'utf8'), 'user keeps this\n', `${host.id}: blocks removed, user text between them kept`);
}

// ── 5. Uninstall sweeps only hydra-owned entries under <config>/hydra/ ──────

for (const host of [gemini, codex]) {
  const cfg = freshDir();
  host.install({ scope: 'global', configDirOverride: cfg, version: V, log: quiet });
  const userFile = path.join(cfg, 'hydra', 'config', 'hydra.config.md');
  fs.mkdirSync(path.dirname(userFile), { recursive: true });
  fs.writeFileSync(userFile, 'user config\n');
  for (const t of host.uninstallTargets(cfg, V)) fs.unlinkSync(t.dest);
  host.uninstallExtras({ configDirOverride: cfg, log: quiet });
  assert.strictEqual(fs.readFileSync(userFile, 'utf8'), 'user config\n', `${host.id}: user file under hydra/ survives uninstall`);
  assert.ok(!fs.existsSync(path.join(cfg, 'hydra', 'hooks')), `${host.id}: hydra-owned hooks dir swept`);
}

// ── 6. No temp-file residue from atomic writes ──────────────────────────────

{
  const cfg = freshDir();
  fs.writeFileSync(path.join(cfg, 'settings.json'), '{"theme":"x"}');
  gemini.install({ scope: 'global', configDirOverride: cfg, version: V, log: quiet });
  const leftovers = [];
  (function walk(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (p.endsWith('.hydra-tmp')) leftovers.push(p);
    }
  })(cfg);
  assert.deepStrictEqual(leftovers, [], 'no .hydra-tmp files left behind');
}

async function main() {
  // ── 7. Uninstall empty-dir climb never escapes the config dir ─────────────

  {
    const deep = path.join(scratch, 'x', 'a', 'b', 'cfg');
    fs.mkdirSync(deep, { recursive: true });
    claude.install({ scope: 'global', configDirOverride: deep, version: V, log: quiet });
    fs.unlinkSync(path.join(deep, 'settings.json')); // the file that used to block the climb
    await installer.runUninstall({ hostIds: ['claude'], configDirOverride: deep, interactive: false });
    assert.ok(fs.existsSync(deep), 'climb never removes the --config-dir itself');
    assert.ok(fs.existsSync(path.join(scratch, 'x', 'a', 'b')), 'climb never removes ancestors above --config-dir');
  }

  // ── 8. uninstallExtras skipped for hosts with no Hydra install ────────────

  {
    const claudeDir = freshDir();
    const geminiDir = freshDir();
    fs.writeFileSync(path.join(geminiDir, 'settings.json'), '{\n    "theme": "Dracula",\n    "hooks": {}\n}\n');
    fs.writeFileSync(path.join(geminiDir, 'GEMINI.md'), 'notes\n\n\n');
    const before = {
      settings: fs.readFileSync(path.join(geminiDir, 'settings.json')),
      context: fs.readFileSync(path.join(geminiDir, 'GEMINI.md')),
    };
    const prevC = process.env.CLAUDE_CONFIG_DIR;
    const prevG = process.env.GEMINI_CONFIG_DIR;
    process.env.CLAUDE_CONFIG_DIR = claudeDir;
    process.env.GEMINI_CONFIG_DIR = geminiDir;
    try {
      claude.install({ scope: 'global', configDirOverride: null, version: V, log: quiet });
      await installer.runUninstall({ hostIds: ['claude', 'gemini'], interactive: false });
    } finally {
      if (prevC === undefined) delete process.env.CLAUDE_CONFIG_DIR; else process.env.CLAUDE_CONFIG_DIR = prevC;
      if (prevG === undefined) delete process.env.GEMINI_CONFIG_DIR; else process.env.GEMINI_CONFIG_DIR = prevG;
    }
    assert.ok(before.settings.equals(fs.readFileSync(path.join(geminiDir, 'settings.json'))),
      'gemini settings.json untouched when only claude was installed');
    assert.ok(before.context.equals(fs.readFileSync(path.join(geminiDir, 'GEMINI.md'))),
      'gemini GEMINI.md untouched when only claude was installed');
  }

  // ── 9. Missing dist/: install fails fast, status/uninstall degrade ────────

  {
    const cli = path.join(ROOT, 'bin', 'cli.js');
    const env = {
      ...process.env,
      CLAUDE_CONFIG_DIR: freshDir(),
      GEMINI_CONFIG_DIR: freshDir(),
      CODEX_HOME: freshDir(),
    };
    const distDir = path.join(ROOT, 'dist');
    const bak = distDir + '.safety-bak';
    fs.renameSync(distDir, bak);
    try {
      const rIns = spawnSync(process.execPath, [cli, '--agent=claude', '--global', '--yes'], { env, encoding: 'utf8', timeout: 60000 });
      assert.strictEqual(rIns.status, 1, 'install with missing dist exits 1');
      assert.ok(/npm run build/.test(rIns.stdout + rIns.stderr), 'install error points at npm run build');
      assert.ok(!/ENOENT/.test(rIns.stdout + rIns.stderr), 'install error is not a raw ENOENT');

      const rSt = spawnSync(process.execPath, [cli, '--status'], { env, encoding: 'utf8', timeout: 60000 });
      assert.strictEqual(rSt.status, 0, `status with missing dist exits 0 (stderr: ${rSt.stderr})`);
      assert.ok(!/ENOENT/.test(rSt.stdout + rSt.stderr), 'status shows no raw ENOENT');

      const rUn = spawnSync(process.execPath, [cli, '--uninstall', '--yes', '--agent=claude'], { env, encoding: 'utf8', timeout: 60000 });
      assert.strictEqual(rUn.status, 0, `uninstall with missing dist exits 0 (stderr: ${rUn.stderr})`);
      assert.ok(!/ENOENT/.test(rUn.stdout + rUn.stderr), 'uninstall shows no raw ENOENT');
    } finally {
      fs.renameSync(bak, distDir);
    }
  }

  // ── 10. Single-host completion output is host-aware ───────────────────────

  {
    const cli = path.join(ROOT, 'bin', 'cli.js');
    const cfg = freshDir();
    const r = spawnSync(process.execPath, [cli, '--agent=codex', '--global', '--yes', '--config-dir', cfg], {
      encoding: 'utf8',
      timeout: 120000,
    });
    assert.strictEqual(r.status, 0, `codex cli install exits 0 (stderr: ${r.stderr})`);
    assert.ok(r.stdout.includes('REQUIRED: run /hooks'), 'single-host codex install prints the /hooks trust note');
    assert.ok(!r.stdout.includes('StatusLine skipped'), 'no misleading StatusLine line for codex');
    assert.ok(!r.stdout.includes('/hydra:help'), 'no Claude-only quick start on a codex install');
    assert.ok(r.stdout.includes('$hydra-help'), 'codex $-trigger syntax shown instead');
    assert.ok(r.stdout.includes('AI coding CLIs'), 'tagline is host-neutral');
    assert.ok(!r.stdout.includes('70% cheaper'), 'savings claim aligned to ~50%');
  }

  fs.rmSync(scratch, { recursive: true, force: true });
  console.log('installer-safety: all checks passed');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
