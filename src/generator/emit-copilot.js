'use strict';

// GitHub Copilot CLI emitter — dist/copilot/ payload:
//   agents/hydra-*.md          frontmatter transformed (tool + model maps,
//                              color/memory dropped, Copilot overlay added)
//   skills/hail-hydra/SKILL.md full protocol skill, /hail-hydra namespace
//   skills/stfu-agents/SKILL.md
//   commands/*.md              10 commands as sub-skill files
//   references/*.md            routing guide + model capabilities
//   COPILOT-fragment.md        marker-block orchestration core (from
//                              content/skill-core.md) merged into
//                              ~/.copilot/instructions.md
//   hooks/*.js + wav           bundled from src/hooks/copilot/
//
// Installed layout (see src/installer/hosts/copilot.js):
//   <base>/agents/*.md · <base>/hydra/{VERSION,hooks/,cache/,references/,
//   skills/,commands/} · <base>/instructions.md marker block ·
//   <base>/settings.json hooks registration.

const fs = require('fs');
const path = require('path');

const { ROOT, CONTENT, DIST, write, applyTokens, listMd } = require('./shared');
const { bundleHook } = require('./bundle');

const TOKENS = {
  HYDRA_HOOKS_DIR_SH: '${COPILOT_CONFIG_DIR:-$HOME/.copilot}/hydra/hooks',
  HYDRA_SENTINEL_DONE_CMD:
    `node -e "require(require('os').homedir()+'/.copilot/hydra/hooks/hydra-sentinel-done.js')"`,
};

// Claude tool name → Copilot tool name. Copilot CLI tools follow a similar
// naming to Claude Code.
const TOOL_MAP = {
  Read: 'Read',
  Write: 'Write',
  Edit: 'Edit',
  Bash: 'Bash',
  Glob: 'Glob',
  Grep: 'Grep',
  WebFetch: 'WebFetch',
  WebSearch: 'WebSearch',
};

// Claude model tier → Copilot model. Copilot uses its own model routing
// with modelSelection: latest-suitable-available. Tier labels are advisory.
const MODEL_MAP = {
  haiku: 'gpt-5-mini',
  sonnet: 'gpt-5.4',
};

// Ordered literal rewrites applied to every text payload.
const REWRITES = [
  ['~/.claude/skills/hydra/config/', '~/.copilot/hydra/config/'],
  ['.claude/skills/hydra/config/', '.copilot/hydra/config/'],
  ['~/.claude/skills/hydra/VERSION', '~/.copilot/hydra/VERSION'],
  ['~/.claude/skills/hydra/SKILL.md', '~/.copilot/hydra/skills/hail-hydra/SKILL.md'],
  ['~/.claude/commands/hydra/', '~/.copilot/hydra/commands/'],
  ['.claude/commands/hydra/*.md', '.copilot/hydra/commands/*.md'],
  ['~/.claude/hooks/', '~/.copilot/hydra/hooks/'],
  ['skills/stfu-agents/SKILL.md', '~/.copilot/hydra/skills/stfu-agents/SKILL.md'],
  ['references/routing-guide.md', '~/.copilot/hydra/references/routing-guide.md'],
  ['references/model-capabilities.md', '~/.copilot/hydra/references/model-capabilities.md'],
  ['agents/hydra-*.md', 'agents/hydra-*.md'],
  ['.claude/', '.copilot/'],
  ['.claude', '.copilot'],
  ['CLAUDE.md', 'instructions.md'],
  ['Claude Code', 'Copilot CLI'],
  ['PostToolUse hook', 'PostToolUse hook'],
  ['via the Task tool', 'via subagent dispatch'],
  ['every Task tool call', 'every subagent dispatch'],
  ['Task tool dispatch', 'subagent dispatch'],
  ['the Task tool', 'subagent dispatch'],
  ['Claude needs', 'the orchestrator needs'],
  ['orchestrator (Opus)', 'orchestrator'],
  ['Opus reads', 'The orchestrator reads'],
  ['Opus translates', 'The orchestrator translates'],
  ['causing Claude to respond', 'causing the model to respond'],
  ['$ARGUMENTS', 'the files or paths the user named after the trigger'],
  ['flag file used by the statusline indicator', 'tracking flag file'],
  ['This clears the "⚠ Sentinel pending" warning from the status bar.',
   'This clears the pending-scan tracking state.'],
  ['(so the statusline can briefly show `✅ Sentinel clean`)',
   '(clearing the tracking state for the next scan)'],
  ['If an update is available, it appears in the statusline:',
   'If an update is available (from the cached check in `hydra/cache/hydra-update-check.json`), the SessionStart hook surfaces it as a session message:'],
  ['🐉 │ Opus │ Ctx: 37% ████░░░░░░ │ $0.42 │ my-project │ ⚡ v1.2.0 available',
   '🐉 Hydra update available: 2.5.0 → 2.6.0. Run /hail-hydra --update to update.'],
];

function rewrite(text) {
  for (const [from, to] of REWRITES) text = text.split(from).join(to);
  // Invocation vocabulary: /hydra:stats → /hail-hydra --stats.
  return text.replace(/\/?\bhydra:([a-z-]+)/g, '/hail-hydra --$1');
}

function prepare(srcFile) {
  return rewrite(applyTokens(fs.readFileSync(srcFile, 'utf8'), TOKENS));
}

// ── Agents ─────────────────────────────────────────────────────────────────

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
    // color / memory: no Copilot equivalent — dropped.
  }

  if (!name || !model) throw new Error(`Missing name/model in ${fileName}`);
  if (!MODEL_MAP[model]) throw new Error(`No Copilot model mapping for '${model}' in ${fileName}`);

  const mapped = [];
  const dropped = [];
  for (const t of tools) (TOOL_MAP[t] ? mapped : dropped).push(TOOL_MAP[t] || t);

  if (dropped.length) {
    body =
      `> **Copilot note:** the tool(s) ${dropped.join(', ')} have no Copilot CLI ` +
      `equivalent and were removed from this agent's tool list. Work within the ` +
      `remaining tools.\n\n` + body;
  }

  const overlay =
    '\n\nContinue until the task is completely resolved. If required context ' +
    'is missing, report the gap — do not fabricate data.\n';

  return [
    '---',
    `name: ${name}`,
    ...descLines,
    `tools: ${mapped.join(', ')}`,
    `model: ${MODEL_MAP[model]}`,
    '---',
    '',
  ].join('\n') + body.replace(/\s*$/, '') + overlay;
}

// ── Commands ───────────────────────────────────────────────────────────────

// /hail-hydra --stats is rebuilt from scratch for the Copilot host.
const STATS_DESCRIPTION =
  'Show real token usage, delegation rate, and actual savings for the current Hydra session (Copilot CLI).';

const STATS_BODY = `# Hydra Stats — Real Token Tracking (Copilot CLI)

Show real token usage and savings for the current session by running the
installed Hydra helper. NO AI estimation — the helper reads session data
directly.

## Run

Execute this exact command in the shell:

\`\`\`bash
node -e "require(require('os').homedir()+'/.copilot/hydra/hooks/hydra-token-math.js').printReport()"
\`\`\`

## Display

Print the command output EXACTLY as emitted. Do not summarize, reformat, or
add commentary. If it reports no session data, tell the user stats appear
after the session has recorded a few turns.
`;

// The update command must reinstall the copilot payload non-interactively.
const UPDATE_REWRITES = [
  ['npx hail-hydra-cc@latest --global', 'npx hail-hydra-cc@latest --agent=copilot --global --yes'],
];

// ── Emit ───────────────────────────────────────────────────────────────────

const MARKER_BEGIN = '# BEGIN hydra (generated — do not edit)';
const MARKER_END = '# END hydra';

const TRIGGER_TOKENS = ['⚠️ HYDRA_SENTINEL_REQUIRED', '✅ HYDRA_NO_CODE_CHANGES'];

function splitCommand(text, fileName) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n/.exec(text);
  if (!m) throw new Error(`No frontmatter in ${fileName}`);
  const desc = /^description:\s*(.*)$/m.exec(m[1]);
  if (!desc) throw new Error(`No description in ${fileName}`);
  return { description: desc[1].trim(), body: text.slice(m[0].length) };
}

function emit() {
  const out = path.join(DIST, 'copilot');

  // Agents — Markdown with transformed frontmatter.
  for (const f of listMd(path.join(CONTENT, 'agents'))) {
    write(path.join(out, 'agents', f), transformAgent(prepare(path.join(CONTENT, 'agents', f)), f));
  }

  // Commands — keep as Markdown with frontmatter.
  for (const f of listMd(path.join(CONTENT, 'commands'))) {
    const name = f.replace(/\.md$/, '');
    let md;
    if (name === 'stats') {
      md = [
        '---',
        `name: hydra-${name}`,
        `description: ${STATS_DESCRIPTION}`,
        '---',
        '',
        STATS_BODY.trim(),
        '',
      ].join('\n');
    } else {
      let { description, body } = splitCommand(prepare(path.join(CONTENT, 'commands', f)), f);
      if (name === 'update') for (const [a, b] of UPDATE_REWRITES) body = body.split(a).join(b);
      md = [
        '---',
        `name: hydra-${name}`,
        `description: ${description}`,
        '---',
        '',
        body.trim(),
        '',
      ].join('\n');
    }
    write(path.join(out, 'commands', f), md);
  }

  // Full protocol skill + stfu skill.
  write(path.join(out, 'skills', 'hail-hydra', 'SKILL.md'), prepare(path.join(CONTENT, 'SKILL.md')));
  write(
    path.join(out, 'skills', 'stfu-agents', 'SKILL.md'),
    prepare(path.join(CONTENT, 'skills', 'stfu-agents', 'SKILL.md'))
  );

  // References.
  for (const f of listMd(path.join(CONTENT, 'references'))) {
    write(path.join(out, 'references', f), prepare(path.join(CONTENT, 'references', f)));
  }

  // Instructions.md fragment (marker block for the context file).
  const core = prepare(path.join(CONTENT, 'skill-core.md')).trim();
  const fragment = [
    MARKER_BEGIN,
    core,
    '',
    '## Host Notes (Copilot CLI)',
    '',
    '- Full protocol: `hydra/skills/hail-hydra/SKILL.md` under your Copilot config dir — read it when you need the complete Hydra playbook.',
    '- Hydra commands: `/hail-hydra --help`, `/hail-hydra --stats`, `/hail-hydra --guard`, ...',
    '- Agents are Markdown definitions in the agents/ directory; delegation is description-driven.',
    '- Model selection is advisory (`tierIsHint: true`): use the latest suitable available model within cost constraints.',
    MARKER_END,
    '',
  ].join('\n');
  write(path.join(out, 'COPILOT-fragment.md'), fragment);

  // Hooks — bundled self-contained from src/hooks/copilot/.
  const hookSrcDir = path.join(ROOT, 'src', 'hooks', 'copilot');
  for (const f of fs.readdirSync(hookSrcDir).filter((n) => n.endsWith('.js')).sort()) {
    write(path.join(out, 'hooks', f), bundleHook(path.join(hookSrcDir, f)));
  }
  fs.copyFileSync(
    path.join(ROOT, 'src', 'hooks', 'hydra-task-complete.wav'),
    path.join(out, 'hooks', 'hydra-task-complete.wav')
  );

  // ── Build-time validation ────────────────────────────────────────────────
  for (const file of walkText(out)) {
    const text = fs.readFileSync(file, 'utf8');
    if (/\{\{HYDRA_[A-Z0-9_]+\}\}/.test(text)) throw new Error(`Unresolved token in ${file}`);
    if (text.includes('.claude')) throw new Error(`Unrewritten .claude path in ${file}`);
  }
  for (const file of ['COPILOT-fragment.md', path.join('skills', 'hail-hydra', 'SKILL.md')]) {
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

module.exports = { id: 'copilot', emit, MARKER_BEGIN, MARKER_END, TOOL_MAP, MODEL_MAP };
