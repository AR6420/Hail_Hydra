#!/usr/bin/env node
'use strict';

// Codex CLI host self-check. No framework — run directly:
//   node test/codex.test.js
//
// 1. Builds dist/ fresh; asserts dist/codex structural invariants (agent
//    TOMLs via a minimal no-deps sanity check, command skills, AGENTS
//    fragment budget, hooks fragment shape, bundled hooks).
// 2. Behavioral checks on the bundled hooks (auto-guard envelope contract,
//    sentinel-done, check-update banner, notify-chain spawn).
// 3. Token-math against a fixture ~/.codex sessions tree (C19 discovery,
//    C16/C17 cumulative-delta accounting, C21 pricing, info:null fallback)
//    plus a READ-ONLY smoke-parse of one real rollout when available.
// 4. config.toml text-surgery unit tests + installer round-trip into a
//    scratch config dir (byte-exact config restore on uninstall).

const assert = require('assert');
const { execFileSync, spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

const { buildAll } = require('../src/generator/build.js');
buildAll();

const DIST = path.join(ROOT, 'dist', 'codex');
const { MARKER_BEGIN, MARKER_END, MODEL_MAP, FRAGMENT_BUDGET } = require('../src/generator/emit-codex.js');

const TRIGGERS = ['⚠️ HYDRA_SENTINEL_REQUIRED', '✅ HYDRA_NO_CODE_CHANGES'];
const COMMANDS = ['config', 'guard', 'help', 'map', 'preflight', 'quiet', 'report', 'stats', 'status', 'stfu', 'update'];

// ── 1. Structural invariants ────────────────────────────────────────────────

const agentFiles = fs.readdirSync(path.join(DIST, 'agents')).sort();
assert.strictEqual(agentFiles.length, 10, '10 agent TOMLs emitted');

const CODEX_MODELS = new Set(Object.values(MODEL_MAP).map((m) => m.model));

for (const f of agentFiles) {
  assert.ok(f.endsWith('.toml'), `${f}: .toml extension`);
  const text = fs.readFileSync(path.join(DIST, 'agents', f), 'utf8');

  // Minimal TOML sanity: quoted scalar keys parse as JSON strings, exactly
  // one balanced ''' literal block that closes the file.
  const name = /^name = ("(?:[^"\\]|\\.)*")$/m.exec(text);
  assert.ok(name, `${f}: name line present`);
  assert.strictEqual(JSON.parse(name[1]), f.replace(/\.toml$/, ''), `${f}: name matches filename`);
  const desc = /^description = ("(?:[^"\\]|\\.)*")$/m.exec(text);
  assert.ok(desc, `${f}: description line present`);
  assert.ok(JSON.parse(desc[1]).length > 40, `${f}: description non-trivial`);
  assert.strictEqual((text.match(/'''/g) || []).length, 2, `${f}: one balanced ''' block`);
  assert.ok(/^developer_instructions = '''$/m.test(text), `${f}: developer_instructions literal block`);
  assert.ok(text.trimEnd().endsWith("'''"), `${f}: instructions block closes the file`);

  const model = /^model = "(.+)"$/m.exec(text);
  assert.ok(model && CODEX_MODELS.has(model[1]), `${f}: model '${model && model[1]}' is a mapped Codex model`);
  if (model[1] === 'gpt-5.6-luna') {
    assert.ok(/^model_reasoning_effort = "low"$/m.test(text), `${f}: luna agents pin low reasoning effort`);
  }
  if (model[1] === 'gpt-5.6-terra') {
    assert.ok(/^model_reasoning_effort = "medium"$/m.test(text), `${f}: terra agents pin medium reasoning effort`);
  }

  // C2 refutation: "inherit" is invalid — inherit by omission. hydra-sentinel
  // is the one Write/Edit/Bash-free agent, so it alone gets read-only sandbox.
  if (f === 'hydra-sentinel.toml') {
    assert.ok(/^sandbox_mode = "read-only"$/m.test(text), `${f}: read-only sandbox (no write tools)`);
  } else {
    assert.ok(!text.includes('sandbox_mode'), `${f}: no sandbox_mode key (inherit by omission)`);
  }
  assert.ok(text.includes('## Tool Restrictions (Codex)'), `${f}: tool-restriction prose present (C3)`);

  assert.ok(!text.includes('.claude'), `${f}: no .claude paths`);
  assert.ok(!/\{\{HYDRA_/.test(text), `${f}: no unresolved tokens`);
}
// analyst has no Write/Edit → its prose must forbid file modification.
assert.ok(
  fs.readFileSync(path.join(DIST, 'agents', 'hydra-analyst.toml'), 'utf8').includes('Never create or modify files.'),
  'analyst restriction prose forbids writes'
);
// sentinel dropped its Write grant in v2.5.1 — same restriction prose applies.
assert.ok(
  fs.readFileSync(path.join(DIST, 'agents', 'hydra-sentinel.toml'), 'utf8').includes('Never create or modify files.'),
  'sentinel restriction prose forbids writes'
);
// C22 fix: codebase-map path is .codex (lowercase), never .Codex/.claude.
const scoutToml = fs.readFileSync(path.join(DIST, 'agents', 'hydra-scout.toml'), 'utf8');
assert.ok(scoutToml.includes('.codex/hydra/codebase-map.json'), 'scout map path is .codex/hydra/codebase-map.json');
assert.ok(!scoutToml.includes('.Codex'), 'no capital-C .Codex leak');

// Skills: 11 commands + full protocol + stfu.
const skillDirs = fs.readdirSync(path.join(DIST, 'skills')).sort();
assert.deepStrictEqual(
  skillDirs,
  [...COMMANDS.map((c) => `hydra-${c}`), 'hydra', 'stfu-agents'].sort(),
  '13 skill dirs emitted'
);
for (const dir of skillDirs) {
  const text = fs.readFileSync(path.join(DIST, 'skills', dir, 'SKILL.md'), 'utf8');
  assert.ok(/^---\r?\n/.test(text), `${dir}: frontmatter present`);
  assert.ok(!text.includes('.claude'), `${dir}: no .claude paths`);
  assert.ok(!/\{\{HYDRA_/.test(text), `${dir}: no unresolved tokens`);
  assert.ok(!/\/hydra:/.test(text), `${dir}: no /hydra: invocations left`);
  assert.ok(!text.includes('$ARGUMENTS'), `${dir}: no Claude-only $ARGUMENTS token`);
  assert.ok(!text.includes('~/~'), `${dir}: no corrupted ~/~ paths`);
}
// Status/report skills must glob what the installer actually writes: skills
// live at ~/.agents/skills/hydra-*/SKILL.md and agents install as .toml.
const statusSkill = fs.readFileSync(path.join(DIST, 'skills', 'hydra-status', 'SKILL.md'), 'utf8');
assert.ok(statusSkill.includes('ls -1 ~/.agents/skills/hydra-*/SKILL.md'), 'status globs the real skills location');
assert.ok(statusSkill.includes('~/.codex/agents/hydra-*.toml'), 'status globs .toml agents (global)');
assert.ok(statusSkill.includes('.codex/agents/hydra-*.toml'), 'status globs .toml agents (local)');
assert.ok(!statusSkill.includes('agents/hydra-*.md'), 'status has no dead .md agent glob');
const reportSkill = fs.readFileSync(path.join(DIST, 'skills', 'hydra-report', 'SKILL.md'), 'utf8');
assert.ok(reportSkill.includes('~/.codex/agents/hydra-*.toml'), 'report counts .toml agents');
// Help screen: host-neutral tier labels, all 10 agents, no Anthropic models.
const helpSkill = fs.readFileSync(path.join(DIST, 'skills', 'hydra-help', 'SKILL.md'), 'utf8');
assert.strictEqual((helpSkill.match(/[🟢🔵] hydra-/gu) || []).length, 10, 'help lists all 10 agents');
assert.ok(helpSkill.includes('(cheap tier)') && helpSkill.includes('(mid tier)'), 'help uses tier labels');
assert.ok(!/Haiku|Sonnet|Opus/.test(helpSkill), 'help hardcodes no Anthropic model names');
for (const c of COMMANDS) {
  const text = fs.readFileSync(path.join(DIST, 'skills', `hydra-${c}`, 'SKILL.md'), 'utf8');
  assert.ok(new RegExp(`^name: hydra-${c}$`, 'm').test(text), `hydra-${c}: skill name matches dir`);
  assert.ok(text.includes(`$hydra-${c}`), `hydra-${c}: description carries the $ trigger (C12)`);
}
const statsSkill = fs.readFileSync(path.join(DIST, 'skills', 'hydra-stats', 'SKILL.md'), 'utf8');
assert.ok(statsSkill.includes("/.codex/hydra/hooks/hydra-token-math.js').printReport()"), 'stats runs the installed helper');
const updateSkill = fs.readFileSync(path.join(DIST, 'skills', 'hydra-update', 'SKILL.md'), 'utf8');
assert.ok(updateSkill.includes('--agent=codex --global --yes'), 'update reinstalls the codex payload non-interactively');
assert.ok(/^name: stfu-agents\r?$/m.test(fs.readFileSync(path.join(DIST, 'skills', 'stfu-agents', 'SKILL.md'), 'utf8')), 'stfu skill name slugified');
const fullSkill = fs.readFileSync(path.join(DIST, 'skills', 'hydra', 'SKILL.md'), 'utf8');
for (const t of TRIGGERS) assert.ok(fullSkill.includes(t), `full skill carries trigger ${t} byte-exact`);
// hydra-notify.js is never installed on Codex (notify chain owns the sound) —
// the emitted skill must not instruct running it.
assert.ok(!fullSkill.includes('hydra-notify.js'), 'codex skill does not reference the uninstalled hydra-notify.js');

// Sentinel-done cleanup is shell-agnostic (bash ${VAR:-...}/redirects break in
// PowerShell/cmd on Windows) — node -e form, no redirects.
const SENTINEL_DONE = `node -e "require(require('os').homedir()+'/.codex/hydra/hooks/hydra-sentinel-done.js')"`;
assert.ok(fullSkill.includes(SENTINEL_DONE), 'full skill sentinel-done uses the shell-agnostic node -e form');
assert.ok(!fullSkill.includes('2>/dev/null') && !fullSkill.includes('|| true'), 'full skill has no bash-only redirects');
assert.ok(
  fs.readFileSync(path.join(DIST, 'agents', 'hydra-sentinel-scan.toml'), 'utf8').includes(SENTINEL_DONE),
  'sentinel-scan agent cleanup uses the shell-agnostic form'
);
assert.ok(
  !fs.readFileSync(path.join(DIST, 'agents', 'hydra-sentinel.toml'), 'utf8').includes('hydra-sentinel-done'),
  'hydra-sentinel (shell forbidden) carries no cleanup command'
);

// No statusline on Codex: SKILL prose rewritten to the tracking-state /
// session-message reality; references/ ship to <base>/hydra/references/.
assert.ok(!/statusline|status bar/i.test(fullSkill), 'full skill has no statusline mentions');
assert.ok(fullSkill.includes('hydra/cache/hydra-update-check.json'), 'full skill describes the cache-file update surfacing');
assert.ok(fullSkill.includes('causing the model to respond'), 'bare-Claude leftover rewritten');
assert.ok(fullSkill.includes('~/.codex/hydra/references/routing-guide.md'), 'full skill points at the installed references');
assert.ok(!fullSkill.includes('install.sh'), 'full skill documents the npx flow, not the deleted install.sh');
for (const f of ['routing-guide.md', 'model-capabilities.md']) {
  assert.ok(fs.existsSync(path.join(DIST, 'references', f)), `references/${f} emitted`);
}

// AGENTS.md fragment: markers, budget, triggers, vocabulary.
const fragment = fs.readFileSync(path.join(DIST, 'AGENTS-fragment.md'), 'utf8');
assert.ok(fragment.startsWith(MARKER_BEGIN), 'fragment starts with the BEGIN marker');
assert.ok(fragment.trimEnd().endsWith(MARKER_END), 'fragment ends with the END marker');
assert.ok(Buffer.byteLength(fragment, 'utf8') <= FRAGMENT_BUDGET, `fragment within the ${FRAGMENT_BUDGET}-byte budget (C13)`);
assert.ok(fragment.includes('~/.agents/skills/hydra/SKILL.md'), 'fragment points at the installed full skill');
assert.ok(fragment.includes('$hydra-help'), 'fragment teaches the $ invocation');
assert.ok(!/\/hydra:/.test(fragment) && !/[^$]\bhydra:[a-z]/.test(fragment), 'no stray hydra: invocations');
for (const t of TRIGGERS) assert.ok(fragment.includes(t), `fragment carries trigger ${t} byte-exact`);

// hooks fragment (C6).
const hooksFrag = JSON.parse(fs.readFileSync(path.join(DIST, 'hooks-fragment.json'), 'utf8'));
assert.strictEqual(hooksFrag.hooks.PostToolUse[0].matcher, 'Write|Edit|MultiEdit', 'PostToolUse matcher');
assert.ok(Array.isArray(hooksFrag.hooks.SessionStart), 'SessionStart entry present');
for (const entries of Object.values(hooksFrag.hooks)) {
  for (const entry of entries) {
    for (const h of entry.hooks) {
      assert.strictEqual(h.type, 'command');
      assert.ok(h.command.includes('~/.codex/hydra/hooks/'), 'command uses the installable prefix');
      assert.ok(h.commandWindows && h.commandWindows.includes('~/.codex/hydra/hooks/'), 'commandWindows present (C6)');
    }
  }
}

// Hook bundles parse standalone.
const hookJs = fs.readdirSync(path.join(DIST, 'hooks')).filter((f) => f.endsWith('.js')).sort();
assert.deepStrictEqual(hookJs, [
  'hydra-auto-guard.js',
  'hydra-check-update.js',
  'hydra-notify-chain.js',
  'hydra-sentinel-done.js',
  'hydra-token-math.js',
], 'exactly the 5 expected codex hook bundles');
assert.ok(fs.existsSync(path.join(DIST, 'hooks', 'hydra-task-complete.wav')), 'wav emitted');
for (const f of hookJs) execFileSync(process.execPath, ['--check', path.join(DIST, 'hooks', f)]);

// ── 2. Hook behavior ────────────────────────────────────────────────────────

const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'hydra-cdx-test-'));
const tmpEnv = { ...process.env, TMPDIR: scratch, TEMP: scratch, TMP: scratch };
const SID = 'cdx-test-session';

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

// Substantial Write (C7 payload) → PostToolUse envelope (C8), < 500 tokens.
const editedFile = path.join(scratch, 'proj', 'edited.js');
const out1 = runHook('hydra-auto-guard.js', JSON.stringify({
  session_id: SID,
  tool_name: 'Write',
  tool_input: { file_path: editedFile, content: 'x' },
}));
const parsed = JSON.parse(out1); // throws if stdout is not pure JSON
assert.deepStrictEqual(Object.keys(parsed), ['hookSpecificOutput'], 'envelope only');
assert.strictEqual(parsed.hookSpecificOutput.hookEventName, 'PostToolUse', 'C8 envelope event name');
assert.ok(parsed.hookSpecificOutput.additionalContext.includes('hydra-sentinel-scan'), 'directive mentions sentinel-scan');
assert.ok(parsed.hookSpecificOutput.additionalContext.length < 1500, 'directive stays well under the context limit');
assert.ok(fs.readFileSync(path.join(scratch, 'hydra-guard', `${SID}.txt`), 'utf8').includes(editedFile), 'edit tracked');
assert.ok(fs.existsSync(path.join(scratch, 'hydra-sentinel', `${SID}-pending.json`)), 'pending flag written');

// Trivial Edit → silent. Malformed stdin → silent, still exit 0.
assert.strictEqual(runHook('hydra-auto-guard.js', JSON.stringify({
  session_id: SID,
  tool_name: 'Edit',
  tool_input: { file_path: editedFile, old_string: 'a', new_string: 'b' },
})), '', 'trivial edit stays silent');
assert.strictEqual(runHook('hydra-auto-guard.js', '{ not json'), '', 'malformed stdin stays silent');

// sentinel-done clears the pending flag and writes the clean marker.
const rDone = spawnSync(process.execPath, [path.join(DIST, 'hooks', 'hydra-sentinel-done.js'), SID], {
  env: tmpEnv, encoding: 'utf8', timeout: 15000,
});
assert.strictEqual(rDone.status, 0, 'sentinel-done exits 0');
assert.ok(!fs.existsSync(path.join(scratch, 'hydra-sentinel', `${SID}-pending.json`)), 'pending flag cleared');
assert.ok(fs.existsSync(path.join(scratch, 'hydra-sentinel', `${SID}-last-scan`)), 'last-scan marker written');

// check-update surfaces a cached update via SessionStart additionalContext.
const cdxHome1 = path.join(scratch, 'codex-upd');
fs.mkdirSync(path.join(cdxHome1, 'hydra', 'cache'), { recursive: true });
fs.writeFileSync(path.join(cdxHome1, 'hydra', 'cache', 'hydra-update-check.json'), JSON.stringify({
  installed: '3.0.0', latest: '9.9.9', update_available: true, checked_at: Date.now(),
}));
const updOut = JSON.parse(runHook('hydra-check-update.js', '{}', { CODEX_HOME: cdxHome1 }));
assert.strictEqual(updOut.hookSpecificOutput.hookEventName, 'SessionStart');
assert.ok(updOut.hookSpecificOutput.additionalContext.includes('3.0.0 → 9.9.9'), 'update banner in additionalContext');
assert.ok(updOut.hookSpecificOutput.additionalContext.includes('$hydra-update'), 'banner names the codex invocation');

// notify-chain: plays (missing wav = no-op) then re-fires the saved command
// with the payload appended as the final argv element (C11).
const cdxHome2 = path.join(scratch, 'codex-notify');
const chainOut = path.join(scratch, 'chain-out.txt');
fs.mkdirSync(path.join(cdxHome2, 'hydra'), { recursive: true });
fs.writeFileSync(path.join(cdxHome2, 'hydra', 'notify-prev.json'), JSON.stringify({
  line: 'notify = [...]',
  argv: [process.execPath, '-e', `require('fs').writeFileSync(${JSON.stringify(chainOut)}, process.argv[1] || '')`],
}));
const PAYLOAD = '{"type":"agent-turn-complete","turn-id":"t1"}';
const rChain = spawnSync(process.execPath, [path.join(DIST, 'hooks', 'hydra-notify-chain.js'), PAYLOAD], {
  env: { ...tmpEnv, CODEX_HOME: cdxHome2 }, encoding: 'utf8', timeout: 15000,
});
assert.strictEqual(rChain.status, 0, `notify-chain exits 0 (stderr: ${rChain.stderr})`);
const deadline = Date.now() + 5000;
while (!fs.existsSync(chainOut) && Date.now() < deadline) execFileSync(process.execPath, ['-e', 'setTimeout(()=>{},100)']);
assert.ok(fs.existsSync(chainOut), 'previous notify command was chained');
assert.strictEqual(fs.readFileSync(chainOut, 'utf8'), PAYLOAD, 'payload appended verbatim as final argv');
// No saved command → still silent success.
const cdxHome3 = path.join(scratch, 'codex-notify-empty');
fs.mkdirSync(cdxHome3, { recursive: true });
const rChain2 = spawnSync(process.execPath, [path.join(DIST, 'hooks', 'hydra-notify-chain.js'), PAYLOAD], {
  env: { ...tmpEnv, CODEX_HOME: cdxHome3 }, encoding: 'utf8', timeout: 15000,
});
assert.strictEqual(rChain2.status, 0, 'notify-chain without prev exits 0');
assert.strictEqual(rChain2.stdout, '', 'notify-chain emits nothing');

// ── 3. Token-math against a fixture ~/.codex sessions tree ──────────────────

const tm = require(path.join(DIST, 'hooks', 'hydra-token-math.js'));

assert.strictEqual(tm.getTier('gpt-5.6-luna'), 'luna');
assert.strictEqual(tm.getTier('gpt-5.6-terra'), 'terra');
assert.strictEqual(tm.getTier('gpt-5.6-sol'), 'sol');
assert.strictEqual(tm.getTier('gpt-5.6'), 'sol', 'gpt-5.6 alias (C20)');
assert.strictEqual(tm.getTier('gpt-5.5'), 'sol', 'gpt-5.5 bills identically to sol (C21)');
assert.strictEqual(tm.getTier('gpt-5.3-codex-spark'), null, 'spark has no published price');
assert.strictEqual(tm.getTier('gpt-5.4'), null, 'retired models unpriced');
assert.strictEqual(tm.getTier('claude-opus-5'), null);
assert.strictEqual(tm.getTier(''), null);
assert.deepStrictEqual(tm.DELEGATED_TIERS, ['luna', 'terra']);
assert.strictEqual(tm.getPrice('gpt-5.6-luna').cacheRead, 0.02, 'explicit cached pricing (C21)');

const cdxHome = path.join(scratch, 'codex-config');
const dayDir = path.join(cdxHome, 'sessions', '2026', '08', '10');
fs.mkdirSync(dayDir, { recursive: true });
const oldDayDir = path.join(cdxHome, 'sessions', '2026', '08', '09');
fs.mkdirSync(oldDayDir, { recursive: true });

const meta = (cwd) => JSON.stringify({ timestamp: 't', type: 'session_meta', payload: { id: 'sess-1', cwd, cli_version: '0.137.0', originator: 'codex_cli_rs', source: 'cli' } });
const turnCtx = (model) => JSON.stringify({ timestamp: 't', type: 'turn_context', payload: { turn_id: 'x', cwd: process.cwd(), model, effort: 'low' } });
const tokenCount = (input, cached, output, reasoning) => JSON.stringify({
  timestamp: 't', type: 'event_msg', payload: { type: 'token_count', info: {
    total_token_usage: { input_tokens: input, cached_input_tokens: cached, output_tokens: output, reasoning_output_tokens: reasoning, total_tokens: input + output },
    last_token_usage: { input_tokens: input, cached_input_tokens: cached, output_tokens: output, reasoning_output_tokens: reasoning, total_tokens: input + output },
    model_context_window: 258400,
  }, rate_limits: null },
});
const nullCount = () => JSON.stringify({ timestamp: 't', type: 'event_msg', payload: { type: 'token_count', info: null, rate_limits: {} } });

// Main fixture: cumulative totals, model switches, a repeat final row, an
// info:null row, a malformed line, an unpriced-model segment.
fs.writeFileSync(path.join(dayDir, 'rollout-2026-08-10T10-00-00-aaaa.jsonl'), [
  meta(process.cwd()),
  turnCtx('gpt-5.5'),
  tokenCount(10000, 4000, 500, 100),
  tokenCount(30000, 20000, 1500, 150),
  '{ not json',
  nullCount(),
  turnCtx('gpt-5.6-luna'),
  tokenCount(50000, 36000, 3500, 200),
  tokenCount(50000, 36000, 3500, 200),   // verbatim repeat → delta 0, skipped
  turnCtx('gpt-5.3-codex-spark'),
  tokenCount(60000, 40000, 4000, 220),   // unpriced model → uncounted, footnoted
].join('\n') + '\n');
// Newer same-day file for a DIFFERENT cwd → discovery must skip it.
fs.writeFileSync(path.join(dayDir, 'rollout-2026-08-10T11-00-00-bbbb.jsonl'), [
  meta(path.join(scratch, 'elsewhere')),
  turnCtx('gpt-5.5'),
  tokenCount(999999, 0, 999, 0),
].join('\n') + '\n');
// Older matching file → newest-first scan must prefer the 08/10 one.
fs.writeFileSync(path.join(oldDayDir, 'rollout-2026-08-09T09-00-00-cccc.jsonl'), [
  meta(process.cwd()),
  turnCtx('gpt-5.5'),
  tokenCount(1, 0, 1, 0),
].join('\n') + '\n');

process.env.CODEX_HOME = cdxHome;

const mainFile = tm.findActiveSessionFile();
assert.ok(mainFile && mainFile.endsWith('rollout-2026-08-10T10-00-00-aaaa.jsonl'), 'newest cwd-matching rollout found (C19)');

// Windows case-insensitivity: flipped-case cwd still matches.
if (process.platform === 'win32') {
  const flipped = tm.findActiveSessionFile(process.cwd().toUpperCase());
  assert.ok(flipped && flipped.endsWith('aaaa.jsonl'), 'cwd compare is case-insensitive on win32');
}

const summary = tm.computeSummary();
assert.strictEqual(summary.available, true);
assert.strictEqual(summary.totalTurns, 3, 'sol(2) + luna(1); repeat + unpriced rows uncounted');
assert.strictEqual(summary.delegatedTurns, 1, 'luna turn counts as delegated');
assert.ok(Math.abs(summary.delegationRate - 100 / 3) < 1e-9);
assert.ok(summary.unknownModels.has('gpt-5.3-codex-spark'), 'spark surfaces as unpriced');

// Hand-computed accounting (cumulative deltas; cached ⊂ input; reasoning ⊂ output).
assert.strictEqual(summary.stats.sol.input, 10000);
assert.strictEqual(summary.stats.sol.cache_read, 20000);
assert.strictEqual(summary.stats.sol.output, 1500);
assert.strictEqual(summary.stats.sol.turns, 2);
assert.strictEqual(summary.stats.luna.input, 4000);
assert.strictEqual(summary.stats.luna.cache_read, 16000);
assert.strictEqual(summary.stats.luna.output, 2000);
assert.strictEqual(summary.stats.luna.turns, 1);

// Hand-computed costs (C21): sol 0.105, luna 0.00352; baseline all-Sol 0.193.
const close = (a, b, m) => assert.ok(Math.abs(a - b) < 1e-9, `${m}: ${a} != ${b}`);
close(summary.costs.sol, 0.105, 'sol cost');
close(summary.costs.luna, 0.00352, 'luna cost');
close(summary.actualCost, 0.10852, 'actual cost');
close(summary.hypotheticalCost, 0.193, 'all-Sol baseline');
close(summary.savedUSD, 0.08448, 'saved USD');

const report = tm.formatReport(summary);
assert.ok(report.includes('Hydra Stats (Codex CLI)'), 'report card header');
assert.ok(report.includes('All-Sol baseline:   $0.193'), 'report shows baseline');
assert.ok(report.includes('gpt-5.3-codex-spark'), 'report footnotes unpriced models');

// Direct execution prints the report (argv main guard).
const rr = spawnSync(process.execPath, [path.join(DIST, 'hooks', 'hydra-token-math.js')], {
  env: { ...process.env, CODEX_HOME: cdxHome }, encoding: 'utf8', timeout: 15000,
});
assert.strictEqual(rr.status, 0, `token-math exits 0 (stderr: ${rr.stderr})`);
assert.ok(rr.stdout.includes('🐉 Hydra Stats (Codex CLI)'), 'direct run prints the stats card');

// info:null-only session (vscode/app-server surface) → explicit no-data path.
const cdxHomeNull = path.join(scratch, 'codex-config-null');
const nullDay = path.join(cdxHomeNull, 'sessions', '2026', '08', '10');
fs.mkdirSync(nullDay, { recursive: true });
fs.writeFileSync(path.join(nullDay, 'rollout-2026-08-10T12-00-00-dddd.jsonl'), [
  meta(process.cwd()),
  turnCtx('gpt-5.5'),
  nullCount(),
  nullCount(),
].join('\n') + '\n');
process.env.CODEX_HOME = cdxHomeNull;
const nullSummary = tm.computeSummary();
assert.strictEqual(nullSummary.available, false);
assert.strictEqual(nullSummary.noUsageData, true, 'info:null session → explicit noUsageData (C17)');
assert.ok(tm.formatReport(nullSummary).includes('No token usage recorded'), 'no-data report text');
for (const v of Object.values(nullSummary)) assert.ok(typeof v !== 'number' || Number.isFinite(v), 'never NaN');

// No sessions at all → plain unavailable.
const cdxHomeEmpty = path.join(scratch, 'codex-config-empty');
fs.mkdirSync(cdxHomeEmpty, { recursive: true });
process.env.CODEX_HOME = cdxHomeEmpty;
assert.deepStrictEqual(tm.computeSummary(), { available: false }, 'no session → unavailable');
delete process.env.CODEX_HOME;

// READ-ONLY smoke-parse of one real rollout from the live install, if present.
(() => {
  const realRoot = path.join(os.homedir(), '.codex', 'sessions');
  let real = null;
  try {
    outer:
    for (const y of fs.readdirSync(realRoot).sort().reverse()) {
      for (const m of fs.readdirSync(path.join(realRoot, y)).sort().reverse()) {
        for (const d of fs.readdirSync(path.join(realRoot, y, m)).sort().reverse()) {
          const files = fs.readdirSync(path.join(realRoot, y, m, d)).filter((f) => f.endsWith('.jsonl'));
          if (files.length) { real = path.join(realRoot, y, m, d, files[0]); break outer; }
        }
      }
    }
  } catch { /* no live install — skip */ }
  if (!real) return;
  const parsed = tm.parseSession(real); // must not throw
  for (const tier of tm.TIERS) {
    for (const k of ['input', 'output', 'cache_read', 'turns']) {
      assert.ok(Number.isFinite(parsed.stats[tier][k]) && parsed.stats[tier][k] >= 0, `real rollout: ${tier}.${k} sane`);
    }
  }
  const cwd = tm.sessionCwd(real);
  assert.ok(cwd === null || typeof cwd === 'string', 'real rollout: session_meta cwd readable');
  console.log(`codex: smoke-parsed real rollout ${path.basename(real)} (${parsed.tokenRows} token rows)`);
})();

// ── 4. config.toml surgery + installer round-trip ───────────────────────────

const host = require('../src/installer/hosts/codex.js');
const log = { header() {}, file() {}, ok() {}, warn() {}, blank() {} };
const V = '9.9.9';

// 4a. Surgery unit tests.
{
  // Empty file → both blocks; clean → empty again.
  const a = host.applyConfigToml('', { notifyChainScript: 'C:\\x\\hydra-notify-chain.js' });
  assert.ok(a.text.startsWith(MARKER_BEGIN), 'top block first');
  assert.ok(a.text.includes('[features]\nhooks = true'), 'features block appended');
  assert.strictEqual(a.savedNotify, null);
  assert.strictEqual(host.cleanConfigToml(a.text), '', 'empty file restored');

  // Idempotency: applying twice = applying once.
  const b = host.applyConfigToml(a.text, { notifyChainScript: 'C:\\x\\hydra-notify-chain.js' });
  assert.strictEqual(b.text, a.text, 're-apply is a fixed point');

  // Multi-line notify → untouched, ours skipped (duplicate key would be invalid).
  const multi = 'notify = [\n  "exe",\n  "arg",\n]\n';
  const c = host.applyConfigToml(multi, { notifyChainScript: '/x/chain.js' });
  assert.strictEqual(c.notifySkipped, true, 'multi-line notify skipped');
  assert.ok(c.text.includes(multi), 'multi-line notify preserved verbatim');
  assert.ok(!c.text.includes('hydra-notify-chain'), 'no second notify key added');

  // hooks = false → commented + overridden; clean restores.
  const feat = '[features]\nhooks = false\n';
  const d = host.applyConfigToml(feat, { notifyChainScript: '/x/chain.js' });
  assert.ok(d.text.includes('# hydra-prev: hooks = false\nhooks = true # hydra'), 'hooks=false swapped');
  assert.strictEqual(host.cleanConfigToml(d.text), feat, 'hooks=false restored byte-exact');

  // Literal-string notify parses too.
  assert.deepStrictEqual(host.parseNotifyArgv("notify = ['C:\\bin\\n.exe', \"a b\"]"), ['C:\\bin\\n.exe', 'a b']);
  assert.strictEqual(host.parseNotifyArgv('notify = [\n'), null, 'unclosed array → null');
}

// 4b. Full round-trip in a scratch config dir.
const cfg = path.join(scratch, 'install-cfg');
fs.mkdirSync(cfg, { recursive: true });
const ORIGINAL_CONFIG = [
  '# my personal config',
  'model = "gpt-5.5"',
  '',
  'notify = [ "C:\\\\tools\\\\notify.exe", "turn-ended" ]',
  '',
  "[projects.'c:\\work\\thing']",
  'trust_level = "trusted"',
  '',
  '[features]',
  'js_repl = false',
  '',
  '[hooks.state]',
  '',
  "[hooks.state.'C:\\Users\\someone\\.codex\\hooks.json:post_tool_use:0:0']",
  'trusted_hash = "sha256:aaaa"',
  '',
].join('\n');
fs.writeFileSync(path.join(cfg, 'config.toml'), ORIGINAL_CONFIG);
fs.writeFileSync(path.join(cfg, 'AGENTS.md'), 'My personal agent notes\n');

assert.strictEqual(host.hasAnyInstalled('global', cfg, V), false, 'fresh dir → nothing installed');
assert.ok(host.plan('global', cfg, V).length > 25, 'plan lists the planned writes');

const res1 = host.install({ scope: 'global', configDirOverride: cfg, version: V, log });
assert.strictEqual(res1.anyFailed, false, 'install reports no failures');
assert.strictEqual(res1.statusLineConfigured, false, 'codex has no statusline');

// Files.
assert.strictEqual(fs.readdirSync(path.join(cfg, 'agents')).length, 10, '10 agent TOMLs installed');
assert.ok(fs.existsSync(path.join(cfg, 'hydra', 'references', 'routing-guide.md')), 'references installed');
assert.strictEqual(fs.readFileSync(path.join(cfg, 'hydra', 'VERSION'), 'utf8'), V, 'VERSION written');
assert.ok(fs.existsSync(path.join(cfg, 'hydra', 'manifest.json')), 'manifest written');
for (const n of skillDirs) {
  assert.ok(fs.existsSync(path.join(cfg, '.agents', 'skills', n, 'SKILL.md')), `skill ${n} installed under the test-seam root`);
}
for (const f of [...hookJs, 'hydra-task-complete.wav']) {
  assert.ok(fs.existsSync(path.join(cfg, 'hydra', 'hooks', f)), `hook ${f} installed`);
}

// hooks.json.
let hooksJson = JSON.parse(fs.readFileSync(path.join(cfg, 'hooks.json'), 'utf8'));
assert.strictEqual(hooksJson.hooks.PostToolUse[0].matcher, 'Write|Edit|MultiEdit');
const guardHandler = hooksJson.hooks.PostToolUse[0].hooks[0];
const expectedCmd = `node "${path.join(cfg, 'hydra', 'hooks', 'hydra-auto-guard.js')}"`;
assert.strictEqual(guardHandler.command, expectedCmd, 'command carries the absolute installed path');
assert.strictEqual(guardHandler.commandWindows, expectedCmd, 'commandWindows carries the absolute installed path');
assert.ok(hooksJson.hooks.SessionStart[0].hooks[0].command.includes('hydra-check-update.js'));

// AGENTS.md.
let agentsMd = fs.readFileSync(path.join(cfg, 'AGENTS.md'), 'utf8');
assert.ok(agentsMd.includes('My personal agent notes'), 'user AGENTS.md content preserved');
assert.strictEqual(agentsMd.split(MARKER_BEGIN).length - 1, 1, 'exactly one hydra marker block');
for (const t of TRIGGERS) assert.ok(agentsMd.includes(t), `installed block carries ${t}`);

// config.toml.
let configText = fs.readFileSync(path.join(cfg, 'config.toml'), 'utf8');
assert.ok(configText.startsWith(MARKER_BEGIN), 'notify block inserted at the TOP (top-level key region)');
assert.ok(configText.includes('hydra-notify-chain.js'), 'our notify line present');
assert.ok(configText.includes('# hydra-prev: notify = [ "C:\\\\tools\\\\notify.exe", "turn-ended" ]'), 'original notify commented in place');
assert.strictEqual((configText.match(/^notify\s*=/gm) || []).length, 1, 'exactly one active notify key');
assert.ok(configText.includes('[features]\nhooks = true # hydra\njs_repl = false'), 'hooks=true inserted into the EXISTING [features] table');
assert.strictEqual((configText.match(/\[features\]/g) || []).length, 1, 'no duplicate [features] table (invalid TOML)');
assert.ok(configText.includes("trusted_hash = \"sha256:aaaa\""), 'foreign hooks.state entry untouched');
const notifyPrev = JSON.parse(fs.readFileSync(path.join(cfg, 'hydra', 'notify-prev.json'), 'utf8'));
assert.deepStrictEqual(notifyPrev.argv, ['C:\\tools\\notify.exe', 'turn-ended'], 'previous notify argv saved for chaining');

// Re-install: idempotent.
host.install({ scope: 'global', configDirOverride: cfg, version: V, log });
hooksJson = JSON.parse(fs.readFileSync(path.join(cfg, 'hooks.json'), 'utf8'));
assert.strictEqual(hooksJson.hooks.PostToolUse.length, 1, 're-install does not duplicate PostToolUse');
assert.strictEqual(hooksJson.hooks.SessionStart.length, 1, 're-install does not duplicate SessionStart');
const configText2 = fs.readFileSync(path.join(cfg, 'config.toml'), 'utf8');
assert.strictEqual(configText2, configText, 'config.toml is a fixed point across reinstalls');
assert.deepStrictEqual(
  JSON.parse(fs.readFileSync(path.join(cfg, 'hydra', 'notify-prev.json'), 'utf8')).argv,
  notifyPrev.argv,
  'saved notify not clobbered by reinstall'
);
agentsMd = fs.readFileSync(path.join(cfg, 'AGENTS.md'), 'utf8');
assert.strictEqual(agentsMd.split(MARKER_BEGIN).length - 1, 1, 're-install keeps a single AGENTS.md block');
assert.strictEqual(host.hasAnyInstalled('global', cfg, V), true);

// Simulate the user trusting our hooks via /hooks (Codex appends state rows).
const cfgHooksJson = path.join(cfg, 'hooks.json');
fs.appendFileSync(path.join(cfg, 'config.toml'),
  `[hooks.state.'${cfgHooksJson}:post_tool_use:0:0']\ntrusted_hash = "sha256:bbbb"\n\n` +
  `[hooks.state.'${cfgHooksJson}:session_start:0:0']\ntrusted_hash = "sha256:cccc"\n`);

// Uninstall: targets + extras → byte-exact restore of everything user-owned.
for (const t of host.uninstallTargets(cfg, V)) fs.unlinkSync(t.dest);
host.uninstallExtras({ configDirOverride: cfg, log });

assert.ok(!fs.existsSync(path.join(cfg, 'hooks.json')), 'hooks.json removed (only hydra entries existed)');
assert.strictEqual(fs.readFileSync(path.join(cfg, 'config.toml'), 'utf8'), ORIGINAL_CONFIG,
  'config.toml restored BYTE-EXACT (notify reinstated, blocks + hooks.state pruned, foreign entries kept)');
assert.strictEqual(fs.readFileSync(path.join(cfg, 'AGENTS.md'), 'utf8'), 'My personal agent notes\n', 'AGENTS.md restored');
assert.ok(!fs.existsSync(path.join(cfg, 'hydra')), 'hydra dir swept');
for (const n of skillDirs) assert.ok(!fs.existsSync(path.join(cfg, '.agents', 'skills', n)), `skill dir ${n} removed`);
assert.strictEqual(host.hasAnyInstalled('global', cfg, V), false, 'uninstall leaves nothing behind');

// 4c. Foreign hooks.json entries survive uninstall; file is kept.
const cfg2 = path.join(scratch, 'install-cfg2');
fs.mkdirSync(cfg2, { recursive: true });
fs.writeFileSync(path.join(cfg2, 'hooks.json'), JSON.stringify({
  hooks: { PostToolUse: [{ matcher: 'Write', hooks: [{ type: 'command', command: 'echo mine' }] }] },
}, null, 2));
host.install({ scope: 'global', configDirOverride: cfg2, version: V, log });
let hooks2 = JSON.parse(fs.readFileSync(path.join(cfg2, 'hooks.json'), 'utf8'));
assert.strictEqual(hooks2.hooks.PostToolUse.length, 2, 'foreign PostToolUse entry preserved + hydra added');
for (const t of host.uninstallTargets(cfg2, V)) fs.unlinkSync(t.dest);
host.uninstallExtras({ configDirOverride: cfg2, log });
hooks2 = JSON.parse(fs.readFileSync(path.join(cfg2, 'hooks.json'), 'utf8'));
assert.strictEqual(hooks2.hooks.PostToolUse.length, 1, 'only the foreign entry remains');
assert.strictEqual(hooks2.hooks.PostToolUse[0].hooks[0].command, 'echo mine');
assert.ok(!JSON.stringify(hooks2).includes('hydra-'), 'no hydra strings left in hooks.json');

fs.rmSync(scratch, { recursive: true, force: true });

console.log('codex: all checks passed');
