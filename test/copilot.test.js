#!/usr/bin/env node
'use strict';

// Copilot CLI host self-check. No framework — run directly:
//   node test/copilot.test.js
//
// 1. Builds dist/ fresh; asserts dist/copilot structural invariants (agent
//    Markdown frontmatter transform, Markdown commands, COPILOT-fragment +
//    SKILL, bundled hooks).
// 2. Behavioral checks on the bundled hooks (auto-guard envelope contract,
//    sentinel-done, check-update banner).
// 3. Installer round-trip into a scratch config dir via the host module.

const assert = require('assert');
const { execFileSync, spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

const { buildAll } = require('../src/generator/build.js');
buildAll();

const DIST = path.join(ROOT, 'dist', 'copilot');
const { MARKER_BEGIN, MARKER_END, TOOL_MAP, MODEL_MAP } = require('../src/generator/emit-copilot.js');

const TRIGGERS = ['⚠️ HYDRA_SENTINEL_REQUIRED', '✅ HYDRA_NO_CODE_CHANGES'];

// ── 1. Structural invariants ────────────────────────────────────────────────

const agentFiles = fs.readdirSync(path.join(DIST, 'agents')).sort();
assert.strictEqual(agentFiles.length, 12, '12 agents emitted');

const COPILOT_TOOLS = new Set(Object.values(TOOL_MAP));
const COPILOT_MODELS = new Set(Object.values(MODEL_MAP));

for (const f of agentFiles) {
  const text = fs.readFileSync(path.join(DIST, 'agents', f), 'utf8');
  const fm = /^---\r?\n([\s\S]*?)\r?\n---\r?\n/.exec(text);
  assert.ok(fm, `${f}: frontmatter present`);
  assert.ok(new RegExp(`^name: ${f.replace(/\.md$/, '')}$`, 'm').test(fm[1]), `${f}: name matches filename`);
  assert.ok(!/^color:/m.test(fm[1]), `${f}: color dropped`);
  assert.ok(!/^memory:/m.test(fm[1]), `${f}: memory dropped`);

  const model = /^model: (.+)$/m.exec(fm[1]);
  assert.ok(model && COPILOT_MODELS.has(model[1]), `${f}: model '${model && model[1]}' is a mapped Copilot model`);

  const tools = /^tools: (.+)$/m.exec(fm[1]);
  assert.ok(tools, `${f}: tools line present`);
  const toolList = tools[1].split(',').map((s) => s.trim()).filter(Boolean);
  assert.ok(toolList.length > 0, `${f}: tools list non-empty`);
  for (const t of toolList) assert.ok(COPILOT_TOOLS.has(t), `${f}: tool '${t}' is a Copilot built-in name`);

  assert.ok(!text.includes('.claude'), `${f}: no .claude paths`);
  assert.ok(!/\{\{HYDRA_/.test(text), `${f}: no unresolved tokens`);
  assert.ok(
    text.trimEnd().endsWith('If required context is missing, report the gap — do not fabricate data.'),
    `${f}: Copilot agentic overlay appended`
  );
}

// Commands — kept as Markdown with frontmatter.
const cmdFiles = fs.readdirSync(path.join(DIST, 'commands')).sort();
assert.strictEqual(cmdFiles.length, 10, '10 commands emitted');
for (const f of cmdFiles) {
  const text = fs.readFileSync(path.join(DIST, 'commands', f), 'utf8');
  const fm = /^---\r?\n([\s\S]*?)\r?\n---\r?\n/.exec(text);
  assert.ok(fm, `${f}: frontmatter present`);
  assert.ok(/^name: hydra-/.test(fm[1]), `${f}: name prefixed with hydra-`);
  assert.ok(/^description: /m.test(fm[1]), `${f}: description present`);
  assert.ok(!/\{\{HYDRA_/.test(text), `${f}: no unresolved tokens`);
  assert.ok(!text.includes('.claude'), `${f}: no .claude paths`);
}

// Stats command must target the installed copilot helper.
const statsMd = fs.readFileSync(path.join(DIST, 'commands', 'stats.md'), 'utf8');
assert.ok(statsMd.includes("/.copilot/hydra/hooks/hydra-token-math.js').printReport()"), 'stats runs the installed helper');

// Help screen: host-neutral tier labels, all 12 agents, no Anthropic models.
const helpMd = fs.readFileSync(path.join(DIST, 'commands', 'help.md'), 'utf8');
assert.strictEqual((helpMd.match(/[🟢🔵] hydra-/gu) || []).length, 12, 'help lists all 12 agents');
assert.ok(helpMd.includes('(cheap tier)') && helpMd.includes('(mid tier)'), 'help uses tier labels');
assert.ok(!/Haiku|Sonnet|Opus/.test(helpMd), 'help hardcodes no Anthropic model names');

// Update command must reinstall the copilot payload non-interactively.
const updateMd = fs.readFileSync(path.join(DIST, 'commands', 'update.md'), 'utf8');
assert.ok(updateMd.includes('--agent=copilot --global --yes'), 'update reinstalls the copilot payload non-interactively');

// Fragment + SKILL.
const fragment = fs.readFileSync(path.join(DIST, 'COPILOT-fragment.md'), 'utf8');
assert.ok(fragment.startsWith(MARKER_BEGIN), 'fragment starts with the BEGIN marker');
assert.ok(fragment.trimEnd().endsWith(MARKER_END), 'fragment ends with the END marker');
assert.ok(fragment.includes('`hydra/skills/hail-hydra/SKILL.md` under your Copilot config dir'), 'fragment full-protocol pointer');
const skill = fs.readFileSync(path.join(DIST, 'skills', 'hail-hydra', 'SKILL.md'), 'utf8');
for (const t of TRIGGERS) {
  assert.ok(fragment.includes(t), `fragment carries trigger token ${t} byte-exact`);
  assert.ok(skill.includes(t), `SKILL carries trigger token ${t} byte-exact`);
}
assert.ok(!skill.includes('.claude') && !skill.includes('Claude Code'), 'SKILL vocabulary rewritten');
assert.ok(fs.existsSync(path.join(DIST, 'skills', 'stfu-agents', 'SKILL.md')), 'stfu skill emitted');

// Sentinel-done cleanup uses the shell-agnostic node -e form.
const SENTINEL_DONE = `node -e "require(require('os').homedir()+'/.copilot/hydra/hooks/hydra-sentinel-done.js')"`;
for (const [name, text] of [['fragment', fragment], ['SKILL', skill]]) {
  assert.ok(text.includes(SENTINEL_DONE), `${name} sentinel-done uses the shell-agnostic node -e form`);
  assert.ok(!text.includes('2>/dev/null') && !text.includes('|| true'), `${name} has no bash-only redirects`);
}
assert.ok(
  fs.readFileSync(path.join(DIST, 'agents', 'hydra-sentinel-scan.md'), 'utf8').includes(SENTINEL_DONE),
  'sentinel-scan agent cleanup uses the shell-agnostic form'
);
assert.ok(
  !fs.readFileSync(path.join(DIST, 'agents', 'hydra-sentinel.md'), 'utf8').includes('hydra-sentinel-done'),
  'hydra-sentinel (no Bash tool) carries no cleanup command'
);

// No statusline on Copilot: SKILL prose rewritten.
assert.ok(!/statusline|status bar/i.test(skill), 'SKILL has no statusline mentions');
assert.ok(skill.includes('hydra/cache/hydra-update-check.json'), 'SKILL describes the cache-file update surfacing');
assert.ok(skill.includes('causing the model to respond'), 'bare-Claude leftover rewritten');
assert.ok(skill.includes('~/.copilot/hydra/references/routing-guide.md'), 'SKILL points at the installed references');
assert.ok(!skill.includes('install.sh'), 'SKILL documents the npx flow');
for (const f of ['routing-guide.md', 'model-capabilities.md']) {
  assert.ok(fs.existsSync(path.join(DIST, 'references', f)), `references/${f} emitted`);
}

// Hooks bundle + parse.
const hookJs = fs.readdirSync(path.join(DIST, 'hooks')).filter((f) => f.endsWith('.js')).sort();
assert.deepStrictEqual(hookJs, [
  'hydra-auto-guard.js',
  'hydra-check-update.js',
  'hydra-notify.js',
  'hydra-sentinel-done.js',
  'hydra-token-math.js',
], 'exactly the 5 expected copilot hook bundles');
assert.ok(fs.existsSync(path.join(DIST, 'hooks', 'hydra-task-complete.wav')), 'wav emitted');
for (const f of hookJs) execFileSync(process.execPath, ['--check', path.join(DIST, 'hooks', f)]);

// ── 2. Hook behavior ────────────────────────────────────────────────────────

const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'hydra-cop-test-'));
const tmpEnv = { ...process.env, TMPDIR: scratch, TEMP: scratch, TMP: scratch };
const SID = 'cop-test-session';

function runHook(script, stdinText, extraEnv = {}) {
  const r = spawnSync(process.execPath, [path.join(DIST, 'hooks', script)], {
    input: stdinText,
    env: { ...tmpEnv, ...extraEnv },
    encoding: 'utf8',
    timeout: 15000,
  });
  assert.strictEqual(r.status, 0, `${script} exits 0 (stderr: ${r.stderr})`);
  return r.stdout;
}

// Substantial Write → PostToolUse envelope with directive.
const editedFile = path.join(scratch, 'proj', 'edited.js');
const out1 = runHook('hydra-auto-guard.js', JSON.stringify({
  session_id: SID,
  tool_name: 'Write',
  tool_input: { file_path: editedFile, content: 'x' },
}));
const parsed = JSON.parse(out1);
assert.deepStrictEqual(Object.keys(parsed), ['hookSpecificOutput'], 'envelope only');
assert.strictEqual(parsed.hookSpecificOutput.hookEventName, 'PostToolUse', 'envelope event name');
assert.ok(parsed.hookSpecificOutput.additionalContext.includes('hydra-sentinel-scan'), 'directive mentions sentinel-scan');
assert.ok(fs.readFileSync(path.join(scratch, 'hydra-guard', `${SID}.txt`), 'utf8').includes(editedFile), 'edit tracked');
assert.ok(fs.existsSync(path.join(scratch, 'hydra-sentinel', `${SID}-pending.json`)), 'pending flag written');

// Trivial Edit → silent.
assert.strictEqual(runHook('hydra-auto-guard.js', JSON.stringify({
  session_id: SID,
  tool_name: 'Edit',
  tool_input: { file_path: editedFile, old_string: 'a', new_string: 'b' },
})), '', 'trivial edit stays silent');

// Malformed stdin → exit 0, silent.
assert.strictEqual(runHook('hydra-auto-guard.js', '{ not json'), '', 'malformed stdin stays silent');

// sentinel-done clears the pending flag and writes the clean marker.
const rDone = spawnSync(process.execPath, [path.join(DIST, 'hooks', 'hydra-sentinel-done.js'), SID], {
  env: tmpEnv, encoding: 'utf8', timeout: 15000,
});
assert.strictEqual(rDone.status, 0, 'sentinel-done exits 0');
assert.ok(!fs.existsSync(path.join(scratch, 'hydra-sentinel', `${SID}-pending.json`)), 'pending flag cleared');
assert.ok(fs.existsSync(path.join(scratch, 'hydra-sentinel', `${SID}-last-scan`)), 'last-scan marker written');

// check-update surfaces a cached update via SessionStart additionalContext.
const copHome = path.join(scratch, 'copilot-upd');
fs.mkdirSync(path.join(copHome, 'hydra', 'cache'), { recursive: true });
fs.writeFileSync(path.join(copHome, 'hydra', 'cache', 'hydra-update-check.json'), JSON.stringify({
  installed: '3.0.0', latest: '9.9.9', update_available: true, checked_at: Date.now(),
}));
const updOut = JSON.parse(runHook('hydra-check-update.js', '{}', { COPILOT_CONFIG_DIR: copHome }));
assert.strictEqual(updOut.hookSpecificOutput.hookEventName, 'SessionStart');
assert.ok(updOut.hookSpecificOutput.additionalContext.includes('3.0.0 → 9.9.9'), 'update banner in additionalContext');
assert.ok(updOut.hookSpecificOutput.additionalContext.includes('/hail-hydra --update'), 'banner names the copilot invocation');

// ── 3. Installer round-trip (scratch config dir only) ───────────────────────

const host = require('../src/installer/hosts/copilot.js');
const log = { header() {}, file() {}, ok() {}, warn() {}, blank() {} };
const V = '9.9.9';

const cfg = path.join(scratch, 'install-cfg');
fs.mkdirSync(cfg, { recursive: true });
fs.writeFileSync(path.join(cfg, 'settings.json'), JSON.stringify({
  editor: { theme: 'dark' },
  hooks: { PreRun: [{ matcher: 'compile', hooks: [{ type: 'command', command: 'echo mine' }] }] },
}, null, 2));
fs.writeFileSync(path.join(cfg, 'instructions.md'), 'My personal notes\n');

assert.strictEqual(host.hasAnyInstalled('global', cfg, V), false, 'fresh dir → nothing installed');
assert.ok(host.plan('global', cfg, V).length > 10, 'plan lists the planned writes');

const res1 = host.install({ scope: 'global', configDirOverride: cfg, version: V, log });
assert.strictEqual(res1.anyFailed, false, 'install reports no failures');
assert.strictEqual(res1.statusLineConfigured, false, 'copilot has no statusline');

// Files.
assert.strictEqual(fs.readdirSync(path.join(cfg, 'agents')).length, 12, '12 agents installed');
assert.strictEqual(fs.readdirSync(path.join(cfg, 'hydra', 'commands')).length, 10, '10 commands installed');
assert.ok(fs.existsSync(path.join(cfg, 'hydra', 'skills', 'hail-hydra', 'SKILL.md')), 'SKILL installed');
assert.ok(fs.existsSync(path.join(cfg, 'hydra', 'skills', 'stfu-agents', 'SKILL.md')), 'stfu skill installed');
assert.ok(fs.existsSync(path.join(cfg, 'hydra', 'references', 'routing-guide.md')), 'references installed');
assert.strictEqual(fs.readFileSync(path.join(cfg, 'hydra', 'VERSION'), 'utf8'), V, 'VERSION written');
assert.ok(fs.existsSync(path.join(cfg, 'hydra', 'manifest.json')), 'manifest written');
for (const f of [...hookJs, 'hydra-task-complete.wav']) {
  assert.ok(fs.existsSync(path.join(cfg, 'hydra', 'hooks', f)), `hook ${f} installed`);
}

// settings.json hook registration.
let settings = JSON.parse(fs.readFileSync(path.join(cfg, 'settings.json'), 'utf8'));
assert.strictEqual(settings.editor.theme, 'dark', 'non-hydra settings preserved');
assert.ok(settings.hooks.PreRun, 'non-hydra hook entries preserved');
assert.strictEqual(settings.hooks.PreRun.length, 1, 'foreign PreRun untouched');
assert.ok(Array.isArray(settings.hooks.PostToolUse), 'PostToolUse registered');
assert.ok(Array.isArray(settings.hooks.SessionStart), 'SessionStart registered');
assert.ok(Array.isArray(settings.hooks.Stop), 'Stop registered');
const hydraPost = settings.hooks.PostToolUse.find((e) =>
  e.hooks && e.hooks.some((h) => (h.command || '').includes('hydra-'))
);
assert.ok(hydraPost, 'hydra PostToolUse entry found');
assert.ok(hydraPost.hooks[0].command.includes('hydra-auto-guard.js'), 'PostToolUse command points at auto-guard');

// instructions.md context block.
let contextMd = fs.readFileSync(path.join(cfg, 'instructions.md'), 'utf8');
assert.ok(contextMd.includes('My personal notes'), 'user instructions.md content preserved');
assert.strictEqual(contextMd.split(MARKER_BEGIN).length - 1, 1, 'exactly one hydra marker block');
for (const t of TRIGGERS) assert.ok(contextMd.includes(t), `installed block carries ${t}`);

// Re-install: idempotent — no duplicate hook entries, single block.
host.install({ scope: 'global', configDirOverride: cfg, version: V, log });
settings = JSON.parse(fs.readFileSync(path.join(cfg, 'settings.json'), 'utf8'));
assert.strictEqual(settings.hooks.PostToolUse.length, 1, 're-install does not duplicate PostToolUse');
assert.strictEqual(settings.hooks.SessionStart.length, 1, 're-install does not duplicate SessionStart');
assert.strictEqual(settings.hooks.Stop.length, 1, 're-install does not duplicate Stop');
contextMd = fs.readFileSync(path.join(cfg, 'instructions.md'), 'utf8');
assert.strictEqual(contextMd.split(MARKER_BEGIN).length - 1, 1, 're-install keeps a single marker block');
assert.strictEqual(host.hasAnyInstalled('global', cfg, V), true);

// Uninstall: targets removed, hydra hook entries + block gone, rest preserved.
for (const t of host.uninstallTargets(cfg, V)) fs.unlinkSync(t.dest);
host.uninstallExtras({ configDirOverride: cfg, log });

settings = JSON.parse(fs.readFileSync(path.join(cfg, 'settings.json'), 'utf8'));
assert.strictEqual(settings.editor.theme, 'dark', 'non-hydra settings survive uninstall');
assert.strictEqual(settings.hooks.PreRun.length, 1, 'non-hydra PreRun entry survives');
assert.strictEqual(settings.hooks.PreRun[0].hooks[0].command, 'echo mine');
assert.ok(!('PostToolUse' in settings.hooks), 'emptied PostToolUse removed');
assert.ok(!('SessionStart' in settings.hooks), 'emptied SessionStart removed');
assert.ok(!('Stop' in settings.hooks), 'emptied Stop removed');
assert.ok(!JSON.stringify(settings).includes('hydra-'), 'no hydra strings left in settings');

contextMd = fs.readFileSync(path.join(cfg, 'instructions.md'), 'utf8');
assert.ok(!contextMd.includes(MARKER_BEGIN), 'marker block removed');
assert.ok(contextMd.includes('My personal notes'), 'user instructions.md content still intact');
assert.ok(!fs.existsSync(path.join(cfg, 'hydra')), 'hydra dir swept');
assert.strictEqual(host.hasAnyInstalled('global', cfg, V), false, 'uninstall leaves nothing behind');

fs.rmSync(scratch, { recursive: true, force: true });

console.log('copilot: all checks passed');
