#!/usr/bin/env node
'use strict';

// Generator self-check. No framework — run directly:
//   node test/generator.test.js
//
// 1. Builds dist/ fresh and asserts structural invariants for every host.
// 2. LEGACY PARITY (migration gate): while npm-package/files/ still exists,
//    asserts dist/claude is byte-identical to it, except for the files the
//    v2.5.0 bug fixes deliberately changed (sentinel bash → node helper) and
//    the restructured hooks (verified behaviorally instead). Once
//    npm-package/ is deleted this section auto-skips.
// 3. Behavioral checks on the bundled hooks: auto-guard writes tracking state
//    and emits the directive for substantial edits, stays silent for trivial
//    ones; sentinel-done clears the pending flag.

const assert = require('assert');
const { execFileSync, spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');

// ── 1. Build fresh ──────────────────────────────────────────────────────────

const { buildAll } = require('../src/generator/build.js');
buildAll();

const claudeDist = path.join(DIST, 'claude');

function walk(dir, base = dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full, base));
    else out.push(path.relative(base, full).split(path.sep).join('/'));
  }
  return out.sort();
}

const claudeFiles = walk(claudeDist);

// Structural invariants.
assert.strictEqual(claudeFiles.filter((f) => f.startsWith('agents/')).length, 10, '10 agents emitted');
assert.strictEqual(claudeFiles.filter((f) => f.startsWith('commands/hydra/')).length, 10, '10 commands emitted');
assert.ok(claudeFiles.includes('SKILL.md'), 'SKILL.md emitted');
assert.ok(claudeFiles.includes('skills/stfu-agents/SKILL.md'), 'stfu skill emitted');
assert.strictEqual(claudeFiles.filter((f) => f.startsWith('references/')).length, 2, '2 references emitted');
const hookJs = claudeFiles.filter((f) => f.startsWith('hooks/') && f.endsWith('.js'));
assert.deepStrictEqual(hookJs, [
  'hooks/hydra-auto-guard.js',
  'hooks/hydra-check-update.js',
  'hooks/hydra-notify.js',
  'hooks/hydra-sentinel-done.js',
  'hooks/hydra-statusline.js',
  'hooks/hydra-token-math.js',
], 'exactly the 6 expected hook bundles');
assert.ok(claudeFiles.includes('hooks/hydra-task-complete.wav'), 'wav emitted');

// No unresolved generator tokens anywhere.
for (const f of claudeFiles) {
  if (f.endsWith('.wav')) continue;
  const text = fs.readFileSync(path.join(claudeDist, f), 'utf8');
  assert.ok(!/\{\{HYDRA_[A-Z0-9_]+\}\}/.test(text), `no unresolved tokens in ${f}`);
}

// The sentinel fix landed: node helper referenced, bash tmpdir blocks gone.
// The invocation comes from the HYDRA_SENTINEL_DONE_CMD token — plain bash
// form on Claude, no shell redirects (the hook is silent, always exit 0).
for (const f of ['SKILL.md', 'agents/hydra-sentinel-scan.md']) {
  const text = fs.readFileSync(path.join(claudeDist, f), 'utf8');
  assert.ok(text.includes('node "${CLAUDE_CONFIG_DIR:-$HOME/.claude}/hooks/hydra-sentinel-done.js"'),
    `${f} runs the sentinel-done helper via the claude token value`);
  assert.ok(!text.includes('2>/dev/null'), `${f} sentinel-done line carries no shell redirects`);
  assert.ok(!text.includes('${TMPDIR:-/tmp}'), `${f} has no bash tmpdir block`);
  assert.ok(!text.includes('rm -f /tmp/hydra-sentinel'), `${f} has no /tmp cleanup block`);
}
// hydra-sentinel has no Bash tool — its REQUIRED cleanup block was removed
// (the orchestrator-side cleanup in SKILL.md covers it).
assert.ok(
  !fs.readFileSync(path.join(claudeDist, 'agents', 'hydra-sentinel.md'), 'utf8').includes('hydra-sentinel-done.js'),
  'hydra-sentinel (no Bash tool) carries no sentinel-done shell command'
);

// SKILL.md installation guidance uses the npx flow (scripts/install.sh is gone).
const claudeSkill = fs.readFileSync(path.join(claudeDist, 'SKILL.md'), 'utf8');
assert.ok(!claudeSkill.includes('install.sh'), 'SKILL.md no longer references scripts/install.sh');
assert.ok(claudeSkill.includes('npx hail-hydra-cc --global'), 'SKILL.md documents the npx install flow');

// Help screen: all 10 agents, host-neutral tier labels (no hardcoded models).
const helpMd = fs.readFileSync(path.join(claudeDist, 'commands', 'hydra', 'help.md'), 'utf8');
assert.strictEqual((helpMd.match(/[🟢🔵] hydra-/gu) || []).length, 10, 'help lists all 10 agents');
assert.ok(helpMd.includes('hydra-sentinel-scan') && helpMd.includes('hydra-sentinel '), 'help lists the sentinel pair');
assert.ok(helpMd.includes('(cheap tier)') && helpMd.includes('(mid tier)'), 'help uses tier labels');
assert.ok(!/Haiku|Sonnet|Opus/.test(helpMd), 'help hardcodes no concrete model names');

// Every hook bundle parses and the token-math bundle exports the stable API.
for (const f of hookJs) {
  execFileSync(process.execPath, ['--check', path.join(claudeDist, f)]);
}
const tm = require(path.join(claudeDist, 'hooks', 'hydra-token-math.js'));
for (const name of ['computeSummary', 'computeSummaryCached', 'parseSession', 'findActiveSessionFile',
                    'tierCost', 'asOpusCost', 'getTier', 'getPrice', 'PRICING', 'TIERS', 'DELEGATED_TIERS']) {
  assert.ok(name in tm, `token-math exports ${name}`);
}

// ── 2. Legacy parity (auto-skips once npm-package/ is deleted) ──────────────

const LEGACY = path.join(ROOT, 'npm-package', 'files');
if (fs.existsSync(LEGACY)) {
  // Files the v2.5.0 fixes deliberately changed — checked above, not byte-compared.
  const expectDiff = new Set(['SKILL.md', 'agents/hydra-sentinel-scan.md', 'agents/hydra-sentinel.md']);
  const legacyFiles = walk(LEGACY).filter((f) => !f.startsWith('hooks/'));

  for (const f of legacyFiles) {
    const distPath = path.join(claudeDist, f);
    assert.ok(fs.existsSync(distPath), `legacy file ${f} present in dist`);
    if (expectDiff.has(f)) continue;
    const a = fs.readFileSync(path.join(LEGACY, f));
    const b = fs.readFileSync(distPath);
    assert.ok(a.equals(b), `byte parity: ${f}`);
  }
  console.log(`legacy parity: ${legacyFiles.length} files compared (${expectDiff.size} deliberate diffs)`);
}

// ── 3. Behavioral checks on bundled hooks ───────────────────────────────────

// Isolate tmpdir state per test run: os.tmpdir() honors TMPDIR (posix) /
// TEMP+TMP (Windows), so spawn hooks with an overridden temp env.
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'hydra-gen-test-'));
const tmpEnv = { ...process.env, TMPDIR: scratch, TEMP: scratch, TMP: scratch };
const SID = 'gen-test-session';

function runHook(name, stdinObj) {
  const r = spawnSync(process.execPath, [path.join(claudeDist, 'hooks', name)], {
    input: JSON.stringify(stdinObj),
    env: tmpEnv,
    encoding: 'utf8',
    timeout: 15000,
  });
  assert.strictEqual(r.status, 0, `${name} exits 0 (stderr: ${r.stderr})`);
  return r.stdout;
}

// Substantial edit (Write) → directive + tracking + pending flag.
const editedFile = path.join(scratch, 'some', 'edited-file.js');
const out1 = runHook('hydra-auto-guard.js', {
  session_id: SID,
  tool_name: 'Write',
  tool_input: { file_path: editedFile, content: 'x' },
});
assert.ok(out1.includes('additionalContext'), 'auto-guard emits directive for Write');
assert.ok(out1.includes('hydra-sentinel-scan'), 'directive mentions sentinel-scan');
assert.strictEqual(JSON.parse(out1).hookSpecificOutput.hookEventName, 'PostToolUse', 'claude envelope');

const trackingFile = path.join(scratch, 'hydra-guard', `${SID}.txt`);
assert.ok(fs.existsSync(trackingFile), 'tracking file written');
assert.ok(fs.readFileSync(trackingFile, 'utf8').includes(editedFile), 'edited path tracked');
const pendingFile = path.join(scratch, 'hydra-sentinel', `${SID}-pending.json`);
assert.ok(fs.existsSync(pendingFile), 'sentinel pending flag written');

// Trivial edit → silent, but still tracked.
const out2 = runHook('hydra-auto-guard.js', {
  session_id: SID,
  tool_name: 'Edit',
  tool_input: { file_path: editedFile, old_string: 'a', new_string: 'b' },
});
assert.strictEqual(out2, '', 'auto-guard silent for trivial edit');

// sentinel-done → pending cleared, marker written.
const r = spawnSync(process.execPath, [path.join(claudeDist, 'hooks', 'hydra-sentinel-done.js'), SID], {
  env: tmpEnv, encoding: 'utf8', timeout: 15000,
});
assert.strictEqual(r.status, 0, 'sentinel-done exits 0');
assert.ok(!fs.existsSync(pendingFile), 'pending flag cleared');
assert.ok(fs.existsSync(path.join(scratch, 'hydra-sentinel', `${SID}-last-scan`)), 'scan marker written');

// Statusline: composes a line from fixture stdin (no session log needed).
const slOut = spawnSync(process.execPath, [path.join(claudeDist, 'hooks', 'hydra-statusline.js')], {
  input: JSON.stringify({
    model: { display_name: 'Opus' },
    context_window: { used_percentage: 42 },
    cost: { total_cost_usd: 1.23 },
    workspace: { current_dir: ROOT },
    session_id: SID,
  }),
  env: tmpEnv, encoding: 'utf8', timeout: 15000,
}).stdout;
assert.ok(slOut.includes('Opus'), 'statusline shows model');
assert.ok(slOut.includes('42%'), 'statusline shows context pct');
assert.ok(slOut.includes('$1.23'), 'statusline shows cost');

fs.rmSync(scratch, { recursive: true, force: true });

console.log('generator: all checks passed');
