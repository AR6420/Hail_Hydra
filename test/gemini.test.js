#!/usr/bin/env node
'use strict';

// Gemini CLI host self-check. No framework — run directly:
//   node test/gemini.test.js
//
// 1. Builds dist/ fresh; asserts dist/gemini structural invariants (agent
//    frontmatter transform, TOML commands, fragment + SKILL, bundled hooks).
// 2. Behavioral checks on the bundled auto-guard (pure-JSON stdout contract).
// 3. Token-math against a fixture ~/.gemini tree (registry/marker/sha256
//    discovery, main + subagent transcripts, G23 pricing, delegation).
// 4. Installer round-trip into a scratch config dir via the host module.

const assert = require('assert');
const { execFileSync, spawnSync } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

const { buildAll } = require('../src/generator/build.js');
buildAll();

const DIST = path.join(ROOT, 'dist', 'gemini');
const { MARKER_BEGIN, MARKER_END, TOOL_MAP, MODEL_MAP } = require('../src/generator/emit-gemini.js');

const TRIGGERS = ['⚠️ HYDRA_SENTINEL_REQUIRED', '✅ HYDRA_NO_CODE_CHANGES'];

// ── 1. Structural invariants ────────────────────────────────────────────────

const agentFiles = fs.readdirSync(path.join(DIST, 'agents')).sort();
assert.strictEqual(agentFiles.length, 10, '10 agents emitted');

const GEMINI_TOOLS = new Set(Object.values(TOOL_MAP));
const GEMINI_MODELS = new Set(Object.values(MODEL_MAP));

for (const f of agentFiles) {
  const text = fs.readFileSync(path.join(DIST, 'agents', f), 'utf8');
  const fm = /^---\r?\n([\s\S]*?)\r?\n---\r?\n/.exec(text);
  assert.ok(fm, `${f}: frontmatter present`);
  assert.ok(new RegExp(`^name: ${f.replace(/\.md$/, '')}$`, 'm').test(fm[1]), `${f}: name matches filename`);
  assert.ok(/^description: >/m.test(fm[1]), `${f}: description block kept`);
  assert.ok(!/^color:/m.test(fm[1]), `${f}: color dropped`);
  assert.ok(!/^memory:/m.test(fm[1]), `${f}: memory dropped`);

  const model = /^model: (.+)$/m.exec(fm[1]);
  assert.ok(model && GEMINI_MODELS.has(model[1]), `${f}: model '${model && model[1]}' is a mapped Gemini model`);

  const tools = [...fm[1].matchAll(/^ {2}- (.+)$/gm)].map((m) => m[1]);
  assert.ok(tools.length > 0, `${f}: tools array non-empty`);
  for (const t of tools) assert.ok(GEMINI_TOOLS.has(t), `${f}: tool '${t}' is a Gemini built-in name`);

  assert.ok(!text.includes('.claude'), `${f}: no .claude paths`);
  assert.ok(!/\{\{HYDRA_/.test(text), `${f}: no unresolved tokens`);
  assert.ok(
    text.trimEnd().endsWith('If required context is missing, report the gap — do not fabricate data.'),
    `${f}: Gemini agentic overlay appended`
  );
}

const tomlFiles = fs.readdirSync(path.join(DIST, 'commands', 'hydra')).sort();
assert.strictEqual(tomlFiles.length, 11, '11 command TOMLs emitted');
for (const f of tomlFiles) {
  const text = fs.readFileSync(path.join(DIST, 'commands', 'hydra', f), 'utf8');
  const desc = /^description = (".*")$/m.exec(text);
  assert.ok(desc, `${f}: description line present`);
  assert.doesNotThrow(() => JSON.parse(desc[1]), `${f}: description is a valid TOML basic string`);
  const opens = text.match(/'''/g) || [];
  assert.strictEqual(opens.length, 2, `${f}: exactly one balanced ''' literal block`);
  assert.ok(/^prompt = '''$/m.test(text), `${f}: prompt uses a literal multi-line string`);
  assert.ok(text.trimEnd().endsWith("'''"), `${f}: prompt block closed at EOF`);
  assert.ok(!/\{\{HYDRA_/.test(text), `${f}: no unresolved tokens`);
  assert.ok(!text.includes('.claude'), `${f}: no .claude paths`);
  assert.ok(!text.includes('$ARGUMENTS'), `${f}: no Claude-only $ARGUMENTS token`);
}
// The stats command must target the installed gemini helper.
const statsToml = fs.readFileSync(path.join(DIST, 'commands', 'hydra', 'stats.toml'), 'utf8');
assert.ok(statsToml.includes("/.gemini/hydra/hooks/hydra-token-math.js').printReport()"), 'stats runs the installed helper');
// Argument substitution: Gemini's token is {{args}}, and it must survive the
// generator's own {{HYDRA_*}} token pass untouched.
const guardToml = fs.readFileSync(path.join(DIST, 'commands', 'hydra', 'guard.toml'), 'utf8');
assert.ok(guardToml.includes('**Target**: {{args}}'), 'guard target uses the Gemini {{args}} token');
// Help screen: host-neutral tier labels, all 10 agents, no Anthropic models.
const helpToml = fs.readFileSync(path.join(DIST, 'commands', 'hydra', 'help.toml'), 'utf8');
assert.strictEqual((helpToml.match(/[🟢🔵] hydra-/gu) || []).length, 10, 'help lists all 10 agents');
assert.ok(helpToml.includes('(cheap tier)') && helpToml.includes('(mid tier)'), 'help uses tier labels');
assert.ok(!/Haiku|Sonnet|Opus/.test(helpToml), 'help hardcodes no Anthropic model names');

// Fragment + SKILL.
const fragment = fs.readFileSync(path.join(DIST, 'GEMINI-fragment.md'), 'utf8');
assert.ok(fragment.startsWith(MARKER_BEGIN), 'fragment starts with the BEGIN marker');
assert.ok(fragment.trimEnd().endsWith(MARKER_END), 'fragment ends with the END marker');
// Path-agnostic pointer: a --local install has no ~/.gemini/hydra/SKILL.md.
assert.ok(fragment.includes('`hydra/SKILL.md` under your Gemini config dir'), 'fragment full-protocol pointer is path-agnostic');
const skill = fs.readFileSync(path.join(DIST, 'SKILL.md'), 'utf8');
for (const t of TRIGGERS) {
  assert.ok(fragment.includes(t), `fragment carries trigger token ${t} byte-exact`);
  assert.ok(skill.includes(t), `SKILL carries trigger token ${t} byte-exact`);
}
assert.ok(!skill.includes('.claude') && !skill.includes('Claude Code'), 'SKILL vocabulary rewritten');
assert.ok(fs.existsSync(path.join(DIST, 'skills', 'stfu-agents', 'SKILL.md')), 'stfu skill emitted');

// Sentinel-done cleanup is shell-agnostic (bash ${VAR:-...}/redirects break in
// PowerShell/cmd, which Gemini uses on Windows) — node -e form, no redirects.
const SENTINEL_DONE = `node -e "require(require('os').homedir()+'/.gemini/hydra/hooks/hydra-sentinel-done.js')"`;
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
  'hydra-sentinel (no shell tool) carries no cleanup command'
);

// No statusline on Gemini (G20): SKILL prose rewritten to the tracking-state /
// session-message reality, and references/ ship to <base>/hydra/references/.
assert.ok(!/statusline|status bar/i.test(skill), 'SKILL has no statusline mentions');
assert.ok(skill.includes('hydra/cache/hydra-update-check.json'), 'SKILL describes the cache-file update surfacing');
assert.ok(skill.includes('causing the model to respond'), 'bare-Claude leftover rewritten');
assert.ok(skill.includes('~/.gemini/hydra/references/routing-guide.md'), 'SKILL points at the installed references');
assert.ok(!skill.includes('install.sh'), 'SKILL documents the npx flow, not the deleted install.sh');
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
], 'exactly the 5 expected gemini hook bundles');
assert.ok(fs.existsSync(path.join(DIST, 'hooks', 'hydra-task-complete.wav')), 'wav emitted');
for (const f of hookJs) execFileSync(process.execPath, ['--check', path.join(DIST, 'hooks', f)]);

// ── 2. Auto-guard behavior (G10 stdout contract) ────────────────────────────

const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'hydra-gem-test-'));
const tmpEnv = { ...process.env, TMPDIR: scratch, TEMP: scratch, TMP: scratch };
const SID = 'gem-test-session';

function runGuard(stdinText) {
  const r = spawnSync(process.execPath, [path.join(DIST, 'hooks', 'hydra-auto-guard.js')], {
    input: stdinText,
    env: tmpEnv,
    encoding: 'utf8',
    timeout: 15000,
  });
  assert.strictEqual(r.status, 0, `auto-guard exits 0 (stderr: ${r.stderr})`);
  return r.stdout;
}

// Substantial write_file → PURE JSON stdout with additionalContext.
const editedFile = path.join(scratch, 'proj', 'edited.js');
const out1 = runGuard(JSON.stringify({
  session_id: SID,
  tool_name: 'write_file',
  tool_input: { file_path: editedFile, content: 'x' },
}));
const parsed = JSON.parse(out1); // throws if stdout is not pure JSON
assert.deepStrictEqual(Object.keys(parsed), ['hookSpecificOutput'], 'gemini envelope only');
assert.ok(parsed.hookSpecificOutput.additionalContext.includes('hydra-sentinel-scan'), 'directive mentions sentinel-scan');
assert.ok(fs.readFileSync(path.join(scratch, 'hydra-guard', `${SID}.txt`), 'utf8').includes(editedFile), 'edit tracked');
assert.ok(fs.existsSync(path.join(scratch, 'hydra-sentinel', `${SID}-pending.json`)), 'pending flag written');

// Trivial replace → silent.
assert.strictEqual(runGuard(JSON.stringify({
  session_id: SID,
  tool_name: 'replace',
  tool_input: { file_path: editedFile, old_string: 'a', new_string: 'b' },
})), '', 'trivial replace stays silent');

// Malformed stdin → exit 0, silent.
assert.strictEqual(runGuard('{ not json'), '', 'malformed stdin stays silent');

// ── 3. Token-math against a fixture ~/.gemini tree ──────────────────────────

const tm = require(path.join(DIST, 'hooks', 'hydra-token-math.js'));

// getTier / getPrice.
assert.strictEqual(tm.getTier('gemini-2.5-flash-lite'), 'flash-lite');
assert.strictEqual(tm.getTier('gemini-3.1-flash-lite'), 'flash-lite-3.1', 'own priced tier (G23)');
assert.strictEqual(tm.getTier('gemini-2.5-flash'), 'flash');
assert.strictEqual(tm.getTier('gemini-3-flash-preview'), 'flash-3');
assert.strictEqual(tm.getTier('gemini-3.1-flash'), null, 'no published price → unknown, never a wrong tier');
assert.strictEqual(tm.getTier('gemini-2.5-pro'), 'pro-2.5', 'own priced tier, not the 3.1-pro proxy (G23)');
assert.strictEqual(tm.getTier('gemini-3-pro-preview'), 'pro');
assert.strictEqual(tm.getTier('gemini-3.1-pro-preview'), 'pro');
assert.strictEqual(tm.getTier('claude-opus-5'), null);
assert.strictEqual(tm.getTier(''), null);
assert.deepStrictEqual(tm.DELEGATED_TIERS, ['flash-lite', 'flash-lite-3.1', 'flash', 'flash-3', 'flash-3.5', 'flash-3.6']);
assert.strictEqual(tm.PRICING.pro.proxyOf, 'gemini-3.1-pro-preview', 'pro tier carries the proxy note');
assert.strictEqual(tm.getPrice('gemini-2.5-flash').input, 0.30);

// Fixture config dir: registry-resolved project with main + subagent logs.
const gdir = path.join(scratch, 'gemini-config');
const FULL_SID = 'aaaa1111-2222-3333-4444-555566667777';
const chats = path.join(gdir, 'tmp', 'proj-a', 'chats');
fs.mkdirSync(path.join(chats, FULL_SID), { recursive: true });
fs.writeFileSync(path.join(gdir, 'projects.json'), JSON.stringify({ projects: { [process.cwd()]: 'proj-a' } }));
fs.writeFileSync(path.join(gdir, 'settings.json'), JSON.stringify({ security: { auth: { selectedType: 'oauth-personal' } } }));

const gRow = (model, tokens) => JSON.stringify({ type: 'gemini', model, tokens });
fs.writeFileSync(path.join(chats, 'session-2026-08-10T10-00-aaaa1111.jsonl'), [
  JSON.stringify({ sessionId: FULL_SID, projectHash: 'x', startTime: '2026-08-10T10:00:00Z', kind: 'main' }),
  gRow('gemini-3.1-pro-preview', { input: 1000000, output: 50000, cached: 400000, thoughts: 50000, tool: 0, total: 1100000 }),
  gRow('gemini-3-flash-preview', { input: 100000, output: 10000, cached: 0, thoughts: 0, tool: 5000, total: 115000 }),
  JSON.stringify({ type: 'user', content: [{ text: 'hi' }] }),
  JSON.stringify({ $set: { messages: [] } }),
  '{ not json',
  JSON.stringify({ type: 'info', text: 'x' }),
].join('\n'));
fs.writeFileSync(path.join(chats, FULL_SID, 'sub1.jsonl'), [
  JSON.stringify({ sessionId: 'sub-1', projectHash: 'x', kind: 'subagent' }),
  gRow('gemini-2.5-flash', { input: 200000, output: 20000, cached: 100000, thoughts: 0, tool: 0, total: 220000 }),
  gRow('gemini-2.5-flash', { input: 200000, output: 20000, cached: 100000, thoughts: 0, tool: 0, total: 220000 }),
].join('\n'));

process.env.GEMINI_CONFIG_DIR = gdir;

const mainFile = tm.findActiveSessionFile();
assert.ok(mainFile && mainFile.endsWith('session-2026-08-10T10-00-aaaa1111.jsonl'), 'registry discovery finds the main session');
assert.strictEqual(tm.subagentFiles(mainFile).length, 1, 'nested subagent transcript attached');

const summary = tm.computeSummary();
assert.strictEqual(summary.available, true);
assert.strictEqual(summary.totalTurns, 4, 'main(2) + subagent(2) gemini rows counted');
assert.strictEqual(summary.requests, 4, 'one request per gemini row');
assert.strictEqual(summary.delegatedTurns, 2, 'subagent rows are the delegation signal');
assert.ok(Math.abs(summary.delegationRate - 50) < 1e-9);
assert.strictEqual(summary.subagentSessions, 1);
assert.strictEqual(summary.authType, 'oauth-personal');

// Hand-computed per-tier accounting (cached ⊂ input; thoughts→output; tool→input).
assert.strictEqual(summary.stats.pro.input, 600000);
assert.strictEqual(summary.stats.pro.cache_read, 400000);
assert.strictEqual(summary.stats.pro.output, 100000);
assert.strictEqual(summary.stats['flash-3'].input, 105000);
assert.strictEqual(summary.stats['flash-3'].output, 10000);
assert.strictEqual(summary.stats.flash.input, 200000);
assert.strictEqual(summary.stats.flash.cache_read, 200000);
assert.strictEqual(summary.stats.flash.output, 40000);

// Hand-computed costs (G23 prices): pro 2.48, flash-3 0.0825, flash 0.166.
const close = (a, b, m) => assert.ok(Math.abs(a - b) < 1e-9, `${m}: ${a} != ${b}`);
close(summary.costs.pro, 2.48, 'pro cost');
close(summary.costs['flash-3'], 0.0825, 'flash-3 cost');
close(summary.costs.flash, 0.166, 'flash cost');
close(summary.actualCost, 2.7285, 'actual cost');
close(summary.hypotheticalCost, 3.73, 'all-Pro baseline');
close(summary.savedUSD, 1.0015, 'saved USD');

const report = tm.formatReport(summary);
assert.ok(report.includes('Delegation rate:    50.0%'), 'report shows delegation rate');
assert.ok(report.includes('requests: 4'), 'report shows request count');
assert.ok(report.includes('oauth-personal'), 'report surfaces OAuth request framing');

// End-to-end: direct execution prints the report (argv main guard).
const rr = spawnSync(process.execPath, [path.join(DIST, 'hooks', 'hydra-token-math.js')], {
  env: { ...process.env, GEMINI_CONFIG_DIR: gdir },
  encoding: 'utf8',
  timeout: 15000,
});
assert.strictEqual(rr.status, 0, `token-math exits 0 (stderr: ${rr.stderr})`);
assert.ok(rr.stdout.includes('🐉 Hydra Stats (Gemini CLI)'), 'direct run prints the stats card');

// Discovery fallbacks: .project_root marker, then legacy sha256 dir.
const gdir2 = path.join(scratch, 'gemini-config-marker');
fs.mkdirSync(path.join(gdir2, 'tmp', 'marker-proj'), { recursive: true });
fs.writeFileSync(path.join(gdir2, 'tmp', 'marker-proj', '.project_root'), process.cwd() + '\n');
process.env.GEMINI_CONFIG_DIR = gdir2;
assert.strictEqual(tm.resolveProjectId(process.cwd()), 'marker-proj', 'marker fallback');

const norm = process.platform === 'win32' ? path.resolve(process.cwd()).toLowerCase() : path.resolve(process.cwd());
const legacyHash = crypto.createHash('sha256').update(norm).digest('hex');
const gdir3 = path.join(scratch, 'gemini-config-legacy');
fs.mkdirSync(path.join(gdir3, 'tmp', legacyHash), { recursive: true });
process.env.GEMINI_CONFIG_DIR = gdir3;
assert.strictEqual(tm.resolveProjectId(process.cwd()), legacyHash, 'sha256 legacy fallback');

const gdir4 = path.join(scratch, 'gemini-config-empty');
fs.mkdirSync(gdir4, { recursive: true });
process.env.GEMINI_CONFIG_DIR = gdir4;
assert.strictEqual(tm.resolveProjectId(process.cwd()), null, 'no match → null');
assert.deepStrictEqual(tm.computeSummary(), { available: false }, 'no session → unavailable');
delete process.env.GEMINI_CONFIG_DIR;

// ── 4. Installer round-trip (scratch config dir only) ───────────────────────

const host = require('../src/installer/hosts/gemini.js');
const cfg = path.join(scratch, 'install-cfg');
fs.mkdirSync(cfg, { recursive: true });
fs.writeFileSync(path.join(cfg, 'settings.json'), JSON.stringify({
  ide: { hasSeenNudge: true },
  hooks: { AfterTool: [{ matcher: 'write_file', hooks: [{ name: 'my-hook', type: 'command', command: 'echo hi' }] }] },
}, null, 2));
fs.writeFileSync(path.join(cfg, 'GEMINI.md'), 'My personal notes\n');

const log = { header() {}, file() {}, ok() {}, warn() {}, blank() {} };
const V = '9.9.9';

assert.strictEqual(host.hasAnyInstalled('global', cfg, V), false, 'fresh dir → nothing installed');
assert.ok(host.plan('global', cfg, V).length > 20, 'plan lists the planned writes');

const res1 = host.install({ scope: 'global', configDirOverride: cfg, version: V, log });
assert.strictEqual(res1.anyFailed, false, 'install reports no failures');
assert.strictEqual(res1.statusLineConfigured, false, 'gemini has no statusline');

assert.strictEqual(fs.readdirSync(path.join(cfg, 'agents')).length, 10, '10 agents installed');
assert.strictEqual(fs.readdirSync(path.join(cfg, 'commands', 'hydra')).length, 11, '11 command TOMLs installed');
assert.ok(fs.existsSync(path.join(cfg, 'hydra', 'SKILL.md')), 'SKILL installed');
assert.ok(fs.existsSync(path.join(cfg, 'hydra', 'references', 'routing-guide.md')), 'references installed');
assert.strictEqual(fs.readFileSync(path.join(cfg, 'hydra', 'VERSION'), 'utf8'), V, 'VERSION written');
assert.ok(fs.existsSync(path.join(cfg, 'hydra', 'skills', 'stfu-agents', 'SKILL.md')), 'stfu skill installed');
assert.ok(fs.existsSync(path.join(cfg, 'hydra', 'manifest.json')), 'manifest written');
for (const f of ['hydra-auto-guard.js', 'hydra-check-update.js', 'hydra-notify.js', 'hydra-sentinel-done.js', 'hydra-token-math.js', 'hydra-task-complete.wav']) {
  assert.ok(fs.existsSync(path.join(cfg, 'hydra', 'hooks', f)), `hook ${f} installed`);
}

let settings = JSON.parse(fs.readFileSync(path.join(cfg, 'settings.json'), 'utf8'));
assert.strictEqual(settings.ide.hasSeenNudge, true, 'non-hydra settings preserved');
assert.strictEqual(settings.hooks.AfterTool.length, 2, 'non-hydra AfterTool entry preserved + hydra added');
const hydraAfterTool = settings.hooks.AfterTool.find((e) => e.hooks[0].name === 'hydra-auto-guard');
assert.ok(hydraAfterTool, 'hydra AfterTool entry named hydra-auto-guard');
assert.strictEqual(hydraAfterTool.matcher, 'write_file|replace', 'AfterTool matcher per G7');
assert.strictEqual(settings.hooks.SessionStart.length, 1);
assert.strictEqual(settings.hooks.SessionStart[0].matcher, 'startup', 'SessionStart matcher per G25');
assert.strictEqual(settings.hooks.Notification.length, 1);
const cmd1 = hydraAfterTool.hooks[0].command;
assert.ok(cmd1.includes('hydra-auto-guard.js'), 'command points at the installed hook');

let contextMd = fs.readFileSync(path.join(cfg, 'GEMINI.md'), 'utf8');
assert.ok(contextMd.includes('My personal notes'), 'user GEMINI.md content preserved');
assert.strictEqual(contextMd.split(MARKER_BEGIN).length - 1, 1, 'exactly one hydra marker block');
for (const t of TRIGGERS) assert.ok(contextMd.includes(t), `installed block carries ${t}`);

// Re-install: idempotent — no duplicate hook entries, single block, stable command.
host.install({ scope: 'global', configDirOverride: cfg, version: V, log });
settings = JSON.parse(fs.readFileSync(path.join(cfg, 'settings.json'), 'utf8'));
assert.strictEqual(settings.hooks.AfterTool.length, 2, 're-install does not duplicate AfterTool');
assert.strictEqual(settings.hooks.SessionStart.length, 1, 're-install does not duplicate SessionStart');
assert.strictEqual(settings.hooks.Notification.length, 1, 're-install does not duplicate Notification');
assert.strictEqual(
  settings.hooks.AfterTool.find((e) => e.hooks[0].name === 'hydra-auto-guard').hooks[0].command,
  cmd1,
  'hook command string byte-stable across reinstalls (G12)'
);
contextMd = fs.readFileSync(path.join(cfg, 'GEMINI.md'), 'utf8');
assert.strictEqual(contextMd.split(MARKER_BEGIN).length - 1, 1, 're-install keeps a single marker block');
assert.strictEqual(host.hasAnyInstalled('global', cfg, V), true);

// Uninstall: targets removed, hydra hook entries + block gone, rest preserved.
for (const t of host.uninstallTargets(cfg, V)) fs.unlinkSync(t.dest);
host.uninstallExtras({ configDirOverride: cfg, log });

settings = JSON.parse(fs.readFileSync(path.join(cfg, 'settings.json'), 'utf8'));
assert.strictEqual(settings.ide.hasSeenNudge, true, 'non-hydra settings survive uninstall');
assert.strictEqual(settings.hooks.AfterTool.length, 1, 'non-hydra AfterTool entry survives');
assert.strictEqual(settings.hooks.AfterTool[0].hooks[0].name, 'my-hook');
assert.ok(!('SessionStart' in settings.hooks), 'emptied SessionStart removed');
assert.ok(!('Notification' in settings.hooks), 'emptied Notification removed');
assert.ok(!JSON.stringify(settings).includes('hydra-'), 'no hydra strings left in settings');

contextMd = fs.readFileSync(path.join(cfg, 'GEMINI.md'), 'utf8');
assert.ok(!contextMd.includes(MARKER_BEGIN), 'marker block removed');
assert.ok(contextMd.includes('My personal notes'), 'user GEMINI.md content still intact');
assert.ok(!fs.existsSync(path.join(cfg, 'hydra')), 'hydra dir swept');
assert.strictEqual(host.hasAnyInstalled('global', cfg, V), false, 'uninstall leaves nothing behind');

fs.rmSync(scratch, { recursive: true, force: true });

console.log('gemini: all checks passed');
