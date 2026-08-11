'use strict';

// Gemini CLI emitter — dist/gemini/ payload:
//   agents/hydra-*.md          frontmatter transformed per G1/G2 (tool + model
//                              maps, color/memory dropped)
//   commands/hydra/*.toml      G14 TOML commands (description + prompt)
//   GEMINI-fragment.md         marker-block orchestration core (from
//                              content/skill-core.md) appended to ~/.gemini/GEMINI.md
//   SKILL.md                   full skill, conservative vocabulary rewrite
//   skills/stfu-agents/SKILL.md
//   hooks/*.js + wav           bundled from src/hooks/gemini/
//
// Installed layout (see src/installer/hosts/gemini.js):
//   <base>/agents/, <base>/commands/hydra/, <base>/hydra/{SKILL.md,VERSION,
//   skills/,hooks/,cache/}. Hooks always live at the USER level so the
//   settings.json command strings stay byte-stable (G12 fingerprint concern).

const fs = require('fs');
const path = require('path');

const { ROOT, CONTENT, DIST, write, applyTokens, listMd } = require('./shared');
const { bundleHook } = require('./bundle');

// Shell expression for the installed hooks dir. GEMINI_CONFIG_DIR is a
// hydra-specific courtesy (Gemini CLI defines no such env var natively).
// Bash-shaped like the Claude value — see emit-claude.js.
const TOKENS = {
  HYDRA_HOOKS_DIR_SH: '${GEMINI_CONFIG_DIR:-$HOME/.gemini}/hydra/hooks',
  // Full sentinel-done invocation. Gemini's run_shell_command uses PowerShell/
  // cmd on Windows, where bash `${VAR:-...}` / `/dev/null` / `|| true` all
  // break — the node -e form works unchanged in every shell (same pattern as
  // the stats command). The hook is silent and always exits 0.
  HYDRA_SENTINEL_DONE_CMD:
    `node -e "require(require('os').homedir()+'/.gemini/hydra/hooks/hydra-sentinel-done.js')"`,
};

// Claude tool name → Gemini built-in tool name (G5). Anything absent here
// (e.g. Task) is dropped from the agent's tool list with a note in the body.
const TOOL_MAP = {
  Read: 'read_file',
  Write: 'write_file',
  Edit: 'replace',
  Bash: 'run_shell_command',
  Glob: 'glob',
  Grep: 'grep_search',
  WebFetch: 'web_fetch',
  WebSearch: 'google_web_search',
};

// Claude model tier → Gemini model id. Expensive tier stays 'inherit'
// implicitly (no Hydra agent pins it). Pro pins would fail on unpaid
// API-key auth (G24) — never map to a Pro model here.
const MODEL_MAP = {
  haiku: 'gemini-2.5-flash',
  sonnet: 'gemini-3-flash-preview',
};

// Ordered literal rewrites applied to every text payload. Specific path
// rewrites (layout changes) first, then generic .claude → .gemini catch-alls,
// then conservative vocabulary fixes (host name, context file, literal tool
// references). Model-tier prose (Haiku/Sonnet/Opus as tier labels) is left
// as-is per the conservative rule.
const REWRITES = [
  ['~/.claude/skills/hydra/config/', '~/.gemini/hydra/config/'],
  ['.claude/skills/hydra/config/', '.gemini/hydra/config/'],
  ['~/.claude/skills/hydra/VERSION', '~/.gemini/hydra/VERSION'],
  ['.claude/commands/hydra/*.md', '.gemini/commands/hydra/*.toml'],
  ['~/.claude/commands/hydra/', '~/.gemini/commands/hydra/'],
  ['~/.claude/hooks/', '~/.gemini/hydra/hooks/'],
  ['skills/stfu-agents/SKILL.md', '~/.gemini/hydra/skills/stfu-agents/SKILL.md'],
  // References install under <base>/hydra/references/ on this host.
  ['references/routing-guide.md', '~/.gemini/hydra/references/routing-guide.md'],
  ['references/model-capabilities.md', '~/.gemini/hydra/references/model-capabilities.md'],
  // Must run before the bare .claude catch-all mangles the URL.
  ['https://platform.claude.com/docs/en/about-claude/pricing', 'the Anthropic pricing docs'],
  ['.claude/', '.gemini/'],   // agents/, hydra/ (map), */.claude/* find filters
  ['.claude', '.gemini'],     // bare mentions (ignore lists)
  ['CLAUDE.md', 'GEMINI.md'],
  ['Claude Code', 'Gemini CLI'],
  ['PostToolUse hook', 'AfterTool hook'],
  ['via the Task tool', 'via subagent dispatch'],
  ['every Task tool call', 'every subagent dispatch'],
  ['Task tool dispatch', 'subagent dispatch'],
  ['the Task tool', 'subagent dispatch'],
  ['Claude needs', 'the orchestrator needs'],
  ['orchestrator (Opus)', 'orchestrator'],
  ['Opus reads', 'The orchestrator reads'],
  ['Opus translates', 'The orchestrator translates'],
  ['causing Claude to respond', 'causing the model to respond'],
  // Gemini TOML commands substitute {{args}}; $ARGUMENTS is Claude-only.
  ['$ARGUMENTS', '{{args}}'],
  // Gemini has no statusline (G20): sentinel state is just tracking state,
  // and updates surface via the SessionStart hook's session message.
  ['flag file used by the statusline indicator', 'tracking flag file'],
  ['This clears the "⚠ Sentinel pending" warning from the status bar.',
   'This clears the pending-scan tracking state.'],
  ['(so the statusline can briefly show `✅ Sentinel clean`)',
   '(clearing the tracking state for the next scan)'],
  ['If an update is available, it appears in the statusline:',
   'If an update is available (from the cached check in `hydra/cache/hydra-update-check.json`), the SessionStart hook surfaces it as a session message:'],
  ['🐉 │ Opus │ Ctx: 37% ████░░░░░░ │ $0.42 │ my-project │ ⚡ v1.2.0 available',
   '🐉 Hydra update available: 3.0.0 → 3.1.0. Run /hydra:update to update.'],
];

function rewrite(text) {
  for (const [from, to] of REWRITES) text = text.split(from).join(to);
  return text;
}

function prepare(srcFile) {
  return rewrite(applyTokens(fs.readFileSync(srcFile, 'utf8'), TOKENS));
}

// ── Agents ───────────────────────────────────────────────────────────────────

function transformAgent(text, fileName) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n/.exec(text);
  if (!m) throw new Error(`No frontmatter in ${fileName}`);
  const fmLines = m[1].split(/\r?\n/);
  let body = text.slice(m[0].length);

  let name = null;
  let model = null;
  let tools = [];
  const descLines = [];

  for (let i = 0; i < fmLines.length; i++) {
    const kv = /^([A-Za-z-]+):(.*)$/.exec(fmLines[i]);
    if (!kv) continue;
    const key = kv[1];
    const val = kv[2].trim();
    if (key === 'name') name = val;
    else if (key === 'description') {
      descLines.push(fmLines[i]);
      while (i + 1 < fmLines.length && (/^\s/.test(fmLines[i + 1]) || fmLines[i + 1] === '')) {
        descLines.push(fmLines[++i]);
      }
    } else if (key === 'tools') tools = val.split(',').map((s) => s.trim()).filter(Boolean);
    else if (key === 'model') model = val;
    // color / memory / anything else: no Gemini equivalent — dropped.
  }

  if (!name || !model) throw new Error(`Missing name/model in ${fileName}`);
  if (!MODEL_MAP[model]) throw new Error(`No Gemini model mapping for '${model}' in ${fileName}`);

  const mapped = [];
  const dropped = [];
  for (const t of tools) (TOOL_MAP[t] ? mapped : dropped).push(TOOL_MAP[t] || t);

  if (dropped.length) {
    body =
      `> **Gemini note:** the Claude tool(s) ${dropped.join(', ')} have no Gemini CLI ` +
      `equivalent and were removed from this agent's tool list. Work within the ` +
      `remaining tools.\n\n` + body;
  }

  return [
    '---',
    `name: ${name}`,
    ...descLines,
    'tools:',
    ...mapped.map((t) => `  - ${t}`),
    `model: ${MODEL_MAP[model]}`,
    '---',
    '',
  ].join('\n') + body;
}

// ── Commands ─────────────────────────────────────────────────────────────────

// TOML literal multi-line strings ('''...''') take no escapes, so bodies with
// backslashes/ANSI sequences survive verbatim. Only ''' itself is forbidden.
function commandToml(description, body) {
  if (body.includes("'''")) throw new Error("Command body contains ''' — breaks TOML literal string");
  return `description = ${JSON.stringify(description)}\n\nprompt = '''\n${body.trim()}\n'''\n`;
}

function splitCommand(text, fileName) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n/.exec(text);
  if (!m) throw new Error(`No frontmatter in ${fileName}`);
  const desc = /^description:\s*(.*)$/m.exec(m[1]);
  if (!desc) throw new Error(`No description in ${fileName}`);
  // allowed-tools / model frontmatter have no TOML equivalent — dropped.
  return { description: desc[1].trim(), body: text.slice(m[0].length) };
}

// /hydra:stats is rebuilt from scratch: the Claude body embeds a large bash+
// node -e script wired to ~/.claude paths and Anthropic tiers. On Gemini the
// report formatter lives inside the installed hydra-token-math.js hook, so
// the prompt just instructs the model to run it via run_shell_command
// (!{...} was avoided: it fires a confirmation dialog per invocation and adds
// shell-escaping constraints for zero benefit here).
const STATS_DESCRIPTION =
  'Show real token usage, request count, delegation rate, and actual savings for the current Hydra session (parses Gemini CLI session JSONL — no AI estimation)';

const STATS_BODY = `# Hydra Stats — Real Token Tracking (Gemini CLI)

Show real token usage, request counts, and savings for the current session by
running the installed Hydra helper. NO AI estimation — the helper parses the
Gemini CLI session JSONL under ~/.gemini/tmp/<project>/chats/ directly.

## Run

Execute this exact command with run_shell_command (the node -e form works
unchanged in POSIX shells and Windows cmd):

\`\`\`bash
node -e "require(require('os').homedir()+'/.gemini/hydra/hooks/hydra-token-math.js').printReport()"
\`\`\`

## Display

Print the command output EXACTLY as emitted. Do not summarize, reformat, or
add commentary. If it reports no session data, tell the user stats appear
after the session has recorded a few turns.

## Notes

- Baseline is all-Pro: Pro-tier turns are priced via gemini-3.1-pro-preview
  as a proxy (gemini-3-pro-preview has no published price).
- Delegation rate counts turns recorded in subagent transcripts.
- On OAuth (Google account / Code Assist) plans, daily quotas meter REQUESTS,
  not token dollars — the request count line is the number that matters there.
`;

// The update command must reinstall the gemini payload non-interactively.
const UPDATE_REWRITES = [
  ['npx hail-hydra-cc@latest --global', 'npx hail-hydra-cc@latest --agent=gemini --global --yes'],
];

// ── Emit ─────────────────────────────────────────────────────────────────────

const MARKER_BEGIN = '# BEGIN hydra (generated — do not edit)';
const MARKER_END = '# END hydra';

// Sentinel trigger tokens must survive every transform byte-exact (emoji
// included) or the protocol silently dies on this host.
const TRIGGER_TOKENS = ['⚠️ HYDRA_SENTINEL_REQUIRED', '✅ HYDRA_NO_CODE_CHANGES'];

function emit() {
  const out = path.join(DIST, 'gemini');

  // Agents.
  for (const f of listMd(path.join(CONTENT, 'agents'))) {
    write(path.join(out, 'agents', f), transformAgent(prepare(path.join(CONTENT, 'agents', f)), f));
  }

  // Commands → TOML.
  for (const f of listMd(path.join(CONTENT, 'commands'))) {
    const name = f.replace(/\.md$/, '');
    let toml;
    if (name === 'stats') {
      toml = commandToml(STATS_DESCRIPTION, STATS_BODY);
    } else {
      let { description, body } = splitCommand(prepare(path.join(CONTENT, 'commands', f)), f);
      if (name === 'update') for (const [a, b] of UPDATE_REWRITES) body = body.split(a).join(b);
      toml = commandToml(description, body);
    }
    write(path.join(out, 'commands', 'hydra', `${name}.toml`), toml);
  }

  // GEMINI.md fragment (markers included — the installer replaces/appends the
  // whole block between them).
  const core = prepare(path.join(CONTENT, 'skill-core.md')).trim();
  const fragment = [
    MARKER_BEGIN,
    core,
    '',
    '## Host Notes (Gemini CLI)',
    '',
    '- Full protocol: `hydra/SKILL.md` under your Gemini config dir (project `./.gemini/` first, then `~/.gemini/`) — read it when you need the complete Hydra playbook.',
    '- Hydra commands are native: `/hydra:help`, `/hydra:stats`, `/hydra:guard`, ...',
    '- Force a specific head with `@hydra-<name>`; otherwise delegation is description-driven.',
    MARKER_END,
    '',
  ].join('\n');
  write(path.join(out, 'GEMINI-fragment.md'), fragment);

  // Full skill + stfu skill.
  write(path.join(out, 'SKILL.md'), prepare(path.join(CONTENT, 'SKILL.md')));
  write(
    path.join(out, 'skills', 'stfu-agents', 'SKILL.md'),
    prepare(path.join(CONTENT, 'skills', 'stfu-agents', 'SKILL.md'))
  );

  // References — installed to <base>/hydra/references/.
  for (const f of listMd(path.join(CONTENT, 'references'))) {
    write(path.join(out, 'references', f), prepare(path.join(CONTENT, 'references', f)));
  }

  // Hooks — bundled self-contained from src/hooks/gemini/.
  const hookSrcDir = path.join(ROOT, 'src', 'hooks', 'gemini');
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
    if (text.includes('$ARGUMENTS')) throw new Error(`Unrewritten $ARGUMENTS (Gemini uses {{args}}) in ${file}`);
  }
  for (const file of ['GEMINI-fragment.md', 'SKILL.md']) {
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

module.exports = { id: 'gemini', emit, MARKER_BEGIN, MARKER_END, TOOL_MAP, MODEL_MAP };
