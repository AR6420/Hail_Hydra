---
description: Show real token usage, delegation rate, and actual savings for the current Hydra session (parses Claude Code session JSONL — no AI estimation)
allowed-tools: Bash, Read
---

# Hydra Stats — Real Token Tracking

Read the active Claude Code session log and compute actual token usage and
savings. NO AI estimation — pure JSONL parsing.

## How It Works

Claude Code writes every conversation turn to a JSONL file at
`~/.claude/projects/{project-slug}/{session-id}.jsonl` (or
`$CLAUDE_CONFIG_DIR/projects/...` if overridden). The slug is the absolute
project path with path separators (`/`, `\`, `:`) replaced by `-` and any
leading `-` stripped.

Each assistant turn line includes a `message.usage` object with
`input_tokens`, `output_tokens`, `cache_read_input_tokens`,
`cache_creation_input_tokens`, and the `model` ID. We aggregate by model
tier and price it.

## Pricing (per 1M tokens, verified 2026-05 for Claude 4.x)

| Tier   | Input | Output | Cache read |
|--------|-------|--------|------------|
| Haiku  | $1    | $5     | 10% of input |
| Sonnet | $3    | $15    | 10% of input |
| Opus   | $5    | $25    | 10% of input |

Edit the `pricing` map below if Anthropic publishes new prices.

## Run

Execute this single Node command (works on Windows, macOS, Linux):

```bash
node -e "
const fs = require('fs');
const path = require('path');
const os = require('os');

const configDir = process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');
const projectsDir = path.join(configDir, 'projects');

if (!fs.existsSync(projectsDir)) {
  console.log('No Claude Code projects directory found at ' + projectsDir);
  process.exit(0);
}

// Slug = absolute cwd with /, \\, : replaced by -, leading - stripped
const cwd = process.cwd();
const slug = cwd.replace(/[\\\\/:]/g, '-').replace(/^-+/, '');

// Try exact match first, then case-insensitive substring fallback
let sessionDir = path.join(projectsDir, slug);
if (!fs.existsSync(sessionDir)) {
  const all = fs.readdirSync(projectsDir);
  const match = all.find(d => d.toLowerCase() === slug.toLowerCase())
             || all.find(d => d.toLowerCase().endsWith(path.basename(cwd).toLowerCase()));
  if (match) sessionDir = path.join(projectsDir, match);
}

if (!fs.existsSync(sessionDir)) {
  console.log('No session data for this project yet.');
  console.log('Looked in: ' + sessionDir);
  process.exit(0);
}

const files = fs.readdirSync(sessionDir)
  .filter(f => f.endsWith('.jsonl'))
  .map(f => ({ f, mtime: fs.statSync(path.join(sessionDir, f)).mtimeMs }))
  .sort((a, b) => b.mtime - a.mtime);

if (files.length === 0) {
  console.log('No session JSONL files found in ' + sessionDir);
  process.exit(0);
}

const sessionFile = path.join(sessionDir, files[0].f);
const lines = fs.readFileSync(sessionFile, 'utf8').split('\n').filter(Boolean);

const pricing = {
  'claude-haiku-4':  { input: 1, output: 5 },
  'claude-sonnet-4': { input: 3, output: 15 },
  'claude-opus-4':   { input: 5, output: 25 }
};

const stats = {
  haiku:  { input: 0, output: 0, cache_read: 0, cache_create: 0, turns: 0 },
  sonnet: { input: 0, output: 0, cache_read: 0, cache_create: 0, turns: 0 },
  opus:   { input: 0, output: 0, cache_read: 0, cache_create: 0, turns: 0 }
};
const unknownModels = new Set();
let totalAssistantTurns = 0;

for (const line of lines) {
  try {
    const obj = JSON.parse(line);
    if (obj.type !== 'assistant' || !obj.message || !obj.message.usage) continue;
    const model = obj.message.model || '';
    const usage = obj.message.usage;
    let tier = null;
    if (model.startsWith('claude-haiku'))  tier = 'haiku';
    else if (model.startsWith('claude-sonnet')) tier = 'sonnet';
    else if (model.startsWith('claude-opus'))   tier = 'opus';
    if (!tier) { if (model) unknownModels.add(model); continue; }
    stats[tier].input        += usage.input_tokens || 0;
    stats[tier].output       += usage.output_tokens || 0;
    stats[tier].cache_read   += usage.cache_read_input_tokens || 0;
    stats[tier].cache_create += usage.cache_creation_input_tokens || 0;
    stats[tier].turns        += 1;
    totalAssistantTurns      += 1;
  } catch (e) { /* skip malformed */ }
}

function cost(s, p) {
  const inputCost  = ((s.input + s.cache_create) * p.input + s.cache_read * p.input * 0.1) / 1_000_000;
  const outputCost = (s.output * p.output) / 1_000_000;
  return inputCost + outputCost;
}
const haikuCost  = cost(stats.haiku,  pricing['claude-haiku-4']);
const sonnetCost = cost(stats.sonnet, pricing['claude-sonnet-4']);
const opusCost   = cost(stats.opus,   pricing['claude-opus-4']);
const actualCost = haikuCost + sonnetCost + opusCost;

function asOpus(s) {
  const p = pricing['claude-opus-4'];
  return ((s.input + s.cache_create) * p.input + s.cache_read * p.input * 0.1 + s.output * p.output) / 1_000_000;
}
const hypotheticalCost = asOpus(stats.haiku) + asOpus(stats.sonnet) + asOpus(stats.opus);
const savedUSD = hypotheticalCost - actualCost;
const savedPct = hypotheticalCost > 0 ? (savedUSD / hypotheticalCost * 100) : 0;

const totalDelegations = stats.haiku.turns + stats.sonnet.turns;
const delegationRate   = totalAssistantTurns > 0 ? (totalDelegations / totalAssistantTurns * 100) : 0;

function fmt(n) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + 'M';
  if (n >= 1_000)     return (n / 1_000).toFixed(1) + 'k';
  return n.toString();
}

const bar = '━'.repeat(40);
console.log('');
console.log('🐉 Hydra Stats');
console.log(bar);
console.log('Session: ' + path.basename(sessionFile));
console.log('Turns:   ' + totalAssistantTurns);
console.log(bar);
console.log('');
console.log('🟢 Haiku  (' + stats.haiku.turns  + ' turns):  ' + fmt(stats.haiku.input  + stats.haiku.cache_create)  + ' in / ' + fmt(stats.haiku.output)  + ' out  → $' + haikuCost.toFixed(3));
console.log('🔵 Sonnet (' + stats.sonnet.turns + ' turns):  ' + fmt(stats.sonnet.input + stats.sonnet.cache_create) + ' in / ' + fmt(stats.sonnet.output) + ' out  → $' + sonnetCost.toFixed(3));
console.log('🟣 Opus   (' + stats.opus.turns   + ' turns):  ' + fmt(stats.opus.input   + stats.opus.cache_create)   + ' in / ' + fmt(stats.opus.output)   + ' out  → $' + opusCost.toFixed(3));
console.log(bar);
console.log('');
console.log('Delegation rate:    ' + delegationRate.toFixed(1) + '% (' + totalDelegations + '/' + totalAssistantTurns + ' turns)');
console.log('Actual cost:        $' + actualCost.toFixed(3));
console.log('All-Opus baseline:  $' + hypotheticalCost.toFixed(3));
console.log(bar);
console.log('💰 Saved:           $' + savedUSD.toFixed(3) + ' (' + savedPct.toFixed(1) + '%)');
console.log(bar);
console.log('');
console.log('Reads Claude Code session JSONL directly. No AI estimation.');
if (unknownModels.size > 0) {
  console.log('');
  console.log('⚠️  Unknown models (not counted): ' + Array.from(unknownModels).join(', '));
  console.log('    Update pricing map in ~/.claude/commands/hydra/stats.md');
}
"
```

## Display

Print the output exactly as the script emits. Do not summarize or reformat.

## Notes

- `All-Opus baseline` is the hypothetical cost if every turn (including
  Haiku and Sonnet ones) had been Opus. The savings show what Hydra's model
  routing actually saved this session.
- Stats are session-scoped. Future versions may add `--all` and `--since`.
- Cache-read pricing is 10% of input price (Anthropic prompt-caching rate
  for Claude 4.x as of 2026-05).
