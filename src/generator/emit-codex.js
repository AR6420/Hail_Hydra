'use strict';

// Codex CLI emitter — dist/codex/ payload:
//   agents/hydra-*.toml        C1/C2 TOML agents (name/description/
//                              developer_instructions; model tier map; NEVER
//                              sandbox_mode="inherit" — omit to inherit)
//   skills/hydra-<cmd>/SKILL.md  11 commands as user skills, invoked
//                              `$hydra-<cmd>` (C12 — /hydra:* namespacing is
//                              impossible on Codex)
//   skills/hydra/SKILL.md      full protocol the AGENTS.md core points to
//   skills/stfu-agents/SKILL.md
//   AGENTS-fragment.md         marker-block orchestration core (from
//                              content/skill-core.md) merged into
//                              ~/.codex/AGENTS.md — hard 12 KiB budget so the
//                              32 KiB combined AGENTS.md cap (C13) keeps room
//   hooks-fragment.json        hooks.json shape (C6) — command AND
//                              commandWindows; installer swaps the
//                              `~/.codex/hydra/hooks` prefix for the absolute
//                              installed path
//   hooks/*.js + wav           bundled from src/hooks/codex/
//
// Installed layout (see src/installer/hosts/codex.js):
//   <base>/agents/*.toml · <base>/hydra/{VERSION,hooks/,cache/} ·
//   ~/.agents/skills/<name>/SKILL.md · <base>/hooks.json ·
//   <base>/AGENTS.md + config.toml marker blocks.

const fs = require('fs');
const path = require('path');

const { ROOT, CONTENT, DIST, write, applyTokens, listMd } = require('./shared');
const { bundleHook } = require('./bundle');

// Shell expression for the installed hooks dir, used in bash blocks.
const TOKENS = {
  HYDRA_HOOKS_DIR_SH: '${CODEX_HOME:-$HOME/.codex}/hydra/hooks',
  // Full sentinel-done invocation. Codex shells out via PowerShell/cmd on
  // Windows, where bash `${VAR:-...}` / `/dev/null` / `|| true` all break —
  // the node -e form works unchanged in every shell (same pattern as the
  // stats skill). The hook is silent and always exits 0.
  HYDRA_SENTINEL_DONE_CMD:
    `node -e "require(require('os').homedir()+'/.codex/hydra/hooks/hydra-sentinel-done.js')"`,
};

// Claude model tier → Codex model (C20). haiku (cheap) pins low reasoning
// effort, sonnet (mid) pins medium. Never gpt-5.4*/spark (retiring /
// research-preview — C20).
const MODEL_MAP = {
  haiku: { model: 'gpt-5.6-luna', effort: 'low' },
  sonnet: { model: 'gpt-5.6-terra', effort: 'medium' },
};

// Ordered literal rewrites (specific layout moves first, then catch-alls,
// then conservative vocabulary). The `.claude/` catch-all also fixes the C22
// codebase-map leak: `.claude/hydra/codebase-map.json` → `.codex/...`.
const REWRITES = [
  ['~/.claude/skills/hydra/config/', '~/.codex/hydra/config/'],
  ['.claude/skills/hydra/config/', '.codex/hydra/config/'],
  ['~/.claude/skills/hydra/VERSION', '~/.codex/hydra/VERSION'],
  ['~/.claude/skills/hydra/SKILL.md', '~/.agents/skills/hydra/SKILL.md'],
  // The '~/'-prefixed variant MUST run before the bare one, or the bare rule
  // matches inside it and yields a corrupted '~/~/.agents/...' glob.
  ['~/.claude/commands/hydra/*.md', '~/.agents/skills/hydra-*/SKILL.md'],
  ['.claude/commands/hydra/*.md', '~/.agents/skills/hydra-*/SKILL.md'],
  ['~/.claude/commands/hydra/', '~/.agents/skills/'],
  ['~/.claude/hooks/', '~/.codex/hydra/hooks/'],
  ['skills/stfu-agents/SKILL.md', '~/.agents/skills/stfu-agents/SKILL.md'],
  // Codex agents install as TOML (C1) — the .md glob can never match.
  ['agents/hydra-*.md', 'agents/hydra-*.toml'],
  // References install under <base>/hydra/references/ on this host.
  ['references/routing-guide.md', '~/.codex/hydra/references/routing-guide.md'],
  ['references/model-capabilities.md', '~/.codex/hydra/references/model-capabilities.md'],
  ['.claude/', '.codex/'],
  ['.claude', '.codex'],
  ['CLAUDE.md', 'AGENTS.md'],
  ['Claude Code', 'Codex CLI'],
  // PostToolUse exists verbatim on Codex (C5) — no hook-event rewrite needed.
  ['via the Task tool', 'via subagent dispatch'],
  ['every Task tool call', 'every subagent dispatch'],
  ['Task tool dispatch', 'subagent dispatch'],
  ['the Task tool', 'subagent dispatch'],
  ['Claude needs', 'the orchestrator needs'],
  ['orchestrator (Opus)', 'orchestrator'],
  ['Opus reads', 'The orchestrator reads'],
  ['Opus translates', 'The orchestrator translates'],
  ['causing Claude to respond', 'causing the model to respond'],
  // Codex skills have no argument substitution.
  ['$ARGUMENTS', 'the files or paths the user named after the trigger'],
  // Codex has no statusline: sentinel state is just tracking state, and
  // updates surface via the SessionStart hook's session message.
  ['flag file used by the statusline indicator', 'tracking flag file'],
  ['This clears the "⚠ Sentinel pending" warning from the status bar.',
   'This clears the pending-scan tracking state.'],
  ['(so the statusline can briefly show `✅ Sentinel clean`)',
   '(clearing the tracking state for the next scan)'],
  ['If an update is available, it appears in the statusline:',
   'If an update is available (from the cached check in `hydra/cache/hydra-update-check.json`), the SessionStart hook surfaces it as a session message:'],
  ['🐉 │ Opus │ Ctx: 37% ████░░░░░░ │ $0.42 │ my-project │ ⚡ v1.2.0 available',
   '🐉 Hydra update available: 2.5.0 → 2.6.0. Run /hydra:update to update.'],
];

function rewrite(text) {
  for (const [from, to] of REWRITES) text = text.split(from).join(to);
  // Invocation vocabulary (C12): /hydra:stats and bare hydra:stats → $hydra-stats.
  return text.replace(/\/?\bhydra:([a-z-]+)/g, '$$hydra-$1');
}

function prepare(srcFile) {
  return rewrite(applyTokens(fs.readFileSync(srcFile, 'utf8'), TOKENS));
}

// ── Agents (C1/C2/C3) ────────────────────────────────────────────────────────

const WRITE_TOOLS = ['Write', 'Edit', 'MultiEdit'];

function parseFrontmatter(text, fileName) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n/.exec(text);
  if (!m) throw new Error(`No frontmatter in ${fileName}`);
  return { fm: m[1].split(/\r?\n/), body: text.slice(m[0].length) };
}

function transformAgent(text, fileName) {
  const { fm, body } = parseFrontmatter(text, fileName);

  let name = null;
  let model = null;
  let tools = [];
  const descLines = [];

  for (let i = 0; i < fm.length; i++) {
    const kv = /^([A-Za-z-]+):(.*)$/.exec(fm[i]);
    if (!kv) continue;
    const key = kv[1];
    const val = kv[2].trim();
    if (key === 'name') name = val;
    else if (key === 'description') {
      // Folded block ('>'): unfold the indented continuation lines.
      while (i + 1 < fm.length && (/^\s/.test(fm[i + 1]) || fm[i + 1] === '')) {
        const line = fm[++i].trim();
        if (line) descLines.push(line);
      }
      if (val && val !== '>') descLines.unshift(val);
    } else if (key === 'tools') tools = val.split(',').map((s) => s.trim()).filter(Boolean);
    else if (key === 'model') model = val;
    // color / memory: no Codex equivalent — dropped (F21 note).
  }

  if (!name || !model) throw new Error(`Missing name/model in ${fileName}`);
  const tier = MODEL_MAP[model];
  if (!tier) throw new Error(`No Codex model mapping for '${model}' in ${fileName}`);

  const description = descLines.join(' ').replace(/\s+/g, ' ').trim();
  const canWrite = tools.some((t) => WRITE_TOOLS.includes(t));
  const canShell = tools.includes('Bash');
  const readOnly = !canWrite && !canShell; // no Write/Edit/Bash → sandboxable

  // C3: no per-agent tools key exists — state intended limits in prose.
  const restrictions = [
    '',
    '## Tool Restrictions (Codex)',
    '',
    `Codex cannot enforce per-agent tool limits, so treat this as a hard rule: this agent is intended to use only ${tools.join(', ')} (Claude-tool vocabulary).` +
      (canWrite ? '' : ' Never create or modify files.') +
      (canShell ? '' : ' Never run shell commands.'),
    '',
  ].join('\n');

  const instructions = body.trimEnd() + '\n' + restrictions;
  if (instructions.includes("'''")) {
    throw new Error(`Agent body contains ''' — breaks TOML literal string (${fileName})`);
  }

  const lines = [
    `name = ${JSON.stringify(name)}`,
    `description = ${JSON.stringify(description)}`,
    `model = ${JSON.stringify(tier.model)}`,
  ];
  if (tier.effort) lines.push(`model_reasoning_effort = ${JSON.stringify(tier.effort)}`);
  // sandbox_mode: read-only ONLY when the tool list proves it; NEVER "inherit"
  // (invalid — C2 refutation). Inheriting = omitting the key entirely.
  if (readOnly) lines.push('sandbox_mode = "read-only"');
  lines.push(`developer_instructions = '''`, instructions, `'''`, '');
  return lines.join('\n');
}

// ── Command skills (C12) ─────────────────────────────────────────────────────

function splitCommand(text, fileName) {
  const { fm, body } = parseFrontmatter(text, fileName);
  const desc = fm.map((l) => /^description:\s*(.*)$/.exec(l)).find(Boolean);
  if (!desc) throw new Error(`No description in ${fileName}`);
  // allowed-tools / model frontmatter: no Codex skill equivalent — dropped.
  return { description: desc[1].trim(), body };
}

function skillMd(name, description, body) {
  return [
    '---',
    `name: ${name}`,
    `description: ${description} Invoke with $${name}.`,
    '---',
    '',
    body.trim(),
    '',
  ].join('\n');
}

// $hydra-stats is rebuilt from scratch: the Claude body embeds a bash+node -e
// script wired to Anthropic tiers. On Codex the report formatter lives inside
// the installed hydra-token-math.js hook.
const STATS_DESCRIPTION =
  'Show real token usage, delegation rate, and actual savings for the current Hydra session (parses Codex CLI rollout JSONL — no AI estimation).';

const STATS_BODY = `# Hydra Stats — Real Token Tracking (Codex CLI)

Show real token usage and savings for the current session by running the
installed Hydra helper. NO AI estimation — the helper parses the Codex CLI
rollout JSONL under ~/.codex/sessions/ directly.

## Run

Execute this exact command in the shell (works unchanged in POSIX shells and
Windows cmd):

\`\`\`bash
node -e "require(require('os').homedir()+'/.codex/hydra/hooks/hydra-token-math.js').printReport()"
\`\`\`

## Display

Print the command output EXACTLY as emitted. Do not summarize, reformat, or
add commentary. If it reports no session data, tell the user stats appear
after the session has recorded a few turns. If it reports that no token usage
was recorded, explain that some Codex surfaces (e.g. certain VS Code /
app-server sessions) do not emit token counts.

## Notes

- Baseline is all-Sol (gpt-5.6-sol pricing); delegated tiers are Luna and Terra.
- Cost formula: (input − cached) × in-price + cached × cache-price + output ×
  out-price. Reasoning tokens are a subset of output; cached a subset of input.
- Models without a published price (e.g. gpt-5.3-codex-spark) are listed as
  uncounted, never guessed.
`;

// The update skill must reinstall the codex payload non-interactively.
const UPDATE_REWRITES = [
  ['npx hail-hydra-cc@latest --global', 'npx hail-hydra-cc@latest --agent=codex --global --yes'],
];

// ── Emit ─────────────────────────────────────────────────────────────────────

const MARKER_BEGIN = '# BEGIN hydra (generated — do not edit)';
const MARKER_END = '# END hydra';

// AGENTS.md combined cap is 32 KiB (C13); our fragment must leave headroom.
const FRAGMENT_BUDGET = 12288;

// Sentinel trigger tokens must survive every transform byte-exact.
const TRIGGER_TOKENS = ['⚠️ HYDRA_SENTINEL_REQUIRED', '✅ HYDRA_NO_CODE_CHANGES'];

function emit() {
  const out = path.join(DIST, 'codex');

  // Agents → TOML.
  for (const f of listMd(path.join(CONTENT, 'agents'))) {
    write(
      path.join(out, 'agents', f.replace(/\.md$/, '.toml')),
      transformAgent(prepare(path.join(CONTENT, 'agents', f)), f)
    );
  }

  // Commands → skills/hydra-<cmd>/SKILL.md.
  for (const f of listMd(path.join(CONTENT, 'commands'))) {
    const cmd = f.replace(/\.md$/, '');
    const name = `hydra-${cmd}`;
    let md;
    if (cmd === 'stats') {
      md = skillMd(name, STATS_DESCRIPTION, STATS_BODY);
    } else {
      let { description, body } = splitCommand(prepare(path.join(CONTENT, 'commands', f)), f);
      if (cmd === 'update') for (const [a, b] of UPDATE_REWRITES) body = body.split(a).join(b);
      md = skillMd(name, description, body);
    }
    write(path.join(out, 'skills', name, 'SKILL.md'), md);
  }

  // Full protocol skill + stfu skill (skill names must be slugs on Codex).
  // The Task Completion Notification section instructs running hydra-notify.js,
  // which is never installed on Codex (the config.toml notify chain owns the
  // sound here) — strip it so the skill never points at a missing file.
  write(
    path.join(out, 'skills', 'hydra', 'SKILL.md'),
    prepare(path.join(CONTENT, 'SKILL.md'))
      .replace(/## Task Completion Notification\r?\n[\s\S]*?(?=## Reference Material)/, '')
  );
  write(
    path.join(out, 'skills', 'stfu-agents', 'SKILL.md'),
    prepare(path.join(CONTENT, 'skills', 'stfu-agents', 'SKILL.md'))
      .replace('name: STFU Agents', 'name: stfu-agents')
  );

  // References — installed to <base>/hydra/references/.
  for (const f of listMd(path.join(CONTENT, 'references'))) {
    write(path.join(out, 'references', f), prepare(path.join(CONTENT, 'references', f)));
  }

  // AGENTS.md fragment (markers included — the installer replaces/appends the
  // whole block between them).
  const core = prepare(path.join(CONTENT, 'skill-core.md')).trim();
  const fragment = [
    MARKER_BEGIN,
    core,
    '',
    '## Host Notes (Codex CLI)',
    '',
    '- Full protocol: `~/.agents/skills/hydra/SKILL.md` — read it when you need the complete Hydra playbook.',
    '- Hydra commands are skills invoked with a $ trigger: `$hydra-help`, `$hydra-stats`, `$hydra-guard`, ...',
    '- Agents are TOML definitions in `~/.codex/agents/`; delegation is description-driven.',
    MARKER_END,
    '',
  ].join('\n');
  const size = Buffer.byteLength(fragment, 'utf8');
  if (size > FRAGMENT_BUDGET) {
    throw new Error(`AGENTS-fragment.md is ${size} bytes — exceeds the ${FRAGMENT_BUDGET}-byte budget (C13)`);
  }
  write(path.join(out, 'AGENTS-fragment.md'), fragment);

  // hooks.json fragment (C6): command AND commandWindows, path prefix swapped
  // by the installer for the absolute hooks dir.
  const handler = (script) => ({
    type: 'command',
    command: `node "~/.codex/hydra/hooks/${script}"`,
    commandWindows: `node "~/.codex/hydra/hooks/${script}"`,
  });
  write(path.join(out, 'hooks-fragment.json'), JSON.stringify({
    hooks: {
      PostToolUse: [
        { matcher: 'Write|Edit|MultiEdit', hooks: [handler('hydra-auto-guard.js')] },
      ],
      SessionStart: [
        { hooks: [handler('hydra-check-update.js')] },
      ],
    },
  }, null, 2) + '\n');

  // Hooks — bundled self-contained from src/hooks/codex/.
  const hookSrcDir = path.join(ROOT, 'src', 'hooks', 'codex');
  for (const f of fs.readdirSync(hookSrcDir).filter((n) => n.endsWith('.js')).sort()) {
    write(path.join(out, 'hooks', f), bundleHook(path.join(hookSrcDir, f)));
  }
  fs.copyFileSync(
    path.join(ROOT, 'src', 'hooks', 'hydra-task-complete.wav'),
    path.join(out, 'hooks', 'hydra-task-complete.wav')
  );

  // ── Build-time validation ──────────────────────────────────────────────────
  for (const file of walkText(out)) {
    const text = fs.readFileSync(file, 'utf8');
    if (/\{\{HYDRA_[A-Z0-9_]+\}\}/.test(text)) throw new Error(`Unresolved token in ${file}`);
    if (text.includes('.claude')) throw new Error(`Unrewritten .claude path in ${file}`);
    if (text.includes('$ARGUMENTS')) throw new Error(`Unrewritten $ARGUMENTS in ${file}`);
    if (text.includes('sandbox_mode = "inherit"')) throw new Error(`Invalid sandbox_mode="inherit" in ${file}`);
  }
  for (const file of ['AGENTS-fragment.md', path.join('skills', 'hydra', 'SKILL.md')]) {
    const text = fs.readFileSync(path.join(out, file), 'utf8');
    for (const t of TRIGGER_TOKENS) {
      if (!text.includes(t)) throw new Error(`Trigger token '${t}' missing from ${file}`);
    }
  }
}

function walkText(dir) {
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walkText(full));
    else if (!entry.name.endsWith('.wav') && !full.includes(`${path.sep}hooks${path.sep}`)) files.push(full);
  }
  return files;
}

module.exports = { id: 'codex', emit, MARKER_BEGIN, MARKER_END, MODEL_MAP, FRAGMENT_BUDGET };
