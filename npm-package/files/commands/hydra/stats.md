---
description: Show real token usage, delegation rate, and actual savings for the current Hydra session (parses Claude Code session JSONL — no AI estimation)
allowed-tools: Bash, Read
---

# Hydra Stats — Real Token Tracking

Read the active Claude Code session log and compute actual token usage and
savings. NO AI estimation — pure JSONL parsing.

Math + JSONL parsing live in the shared helper at
`~/.claude/hooks/hydra-token-math.js`. Statusline and `/hydra:stats` both
call it so numbers stay consistent.

## Pricing (per 1M tokens, verified 2026-05 for Claude 4.x)

| Tier   | Input | Output | Cache read |
|--------|-------|--------|------------|
| Haiku  | $1    | $5     | 10% of input |
| Sonnet | $3    | $15    | 10% of input |
| Opus   | $5    | $25    | 10% of input |

Edit the `PRICING` map in `hydra-token-math.js` if Anthropic publishes new prices.

## Run

```bash
# Strikethrough capability detection — env-heuristic only.
USE_STRIKETHROUGH=0
[ "$TERM_PROGRAM" = "Apple_Terminal" ] && USE_STRIKETHROUGH=1
[ "$TERM_PROGRAM" = "iTerm.app" ]      && USE_STRIKETHROUGH=1
[ "$TERM_PROGRAM" = "vscode" ]         && USE_STRIKETHROUGH=1
[ -n "$KITTY_WINDOW_ID" ]              && USE_STRIKETHROUGH=1
[ "$TERM" = "alacritty" ]              && USE_STRIKETHROUGH=1
[ -n "$WEZTERM_PANE" ]                 && USE_STRIKETHROUGH=1
[ -n "$WT_SESSION" ]                   && USE_STRIKETHROUGH=1
# Known-incompatible terminals (force fallback, overrides green-list)
[ -n "$MSYSTEM" ]                      && USE_STRIKETHROUGH=0
[ -n "$CYGWIN" ]                       && USE_STRIKETHROUGH=0
echo "$TERM" | grep -q "cygwin"        && USE_STRIKETHROUGH=0
# User override
[ "$HYDRA_STRIKETHROUGH" = "0" ] && USE_STRIKETHROUGH=0
[ "$HYDRA_STRIKETHROUGH" = "1" ] && USE_STRIKETHROUGH=1

HYDRA_USE_STRIKETHROUGH="$USE_STRIKETHROUGH" node -e "
const path = require('path');
const os = require('os');
const helperPath = path.join(os.homedir(), '.claude', 'hooks', 'hydra-token-math.js');
let tokenMath;
try {
  tokenMath = require(helperPath);
} catch (e) {
  console.log('hydra-token-math.js not installed at ' + helperPath);
  console.log('Run: hail-hydra-cc  to (re)install Hydra hooks.');
  process.exit(0);
}

const summary = tokenMath.computeSummary();
if (!summary.available) {
  console.log('No session data for this project yet.');
  process.exit(0);
}

const useStrike = process.env.HYDRA_USE_STRIKETHROUGH === '1';
const STRIKE     = useStrike ? '\x1b[9m'  : '';
const STRIKE_OFF = useStrike ? '\x1b[29m' : '';
const GREEN = '\x1b[32m';
const BOLD  = '\x1b[1m';
const DIM   = '\x1b[2m';
const RESET = '\x1b[0m';

function fmt(n) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + 'M';
  if (n >= 1_000)     return (n / 1_000).toFixed(1) + 'k';
  return n.toString();
}

const { stats, totalTurns, haikuCost, sonnetCost, opusCost,
        actualCost, hypotheticalCost, savedUSD, savedPct,
        delegatedTurns, delegationRate, sessionFile, unknownModels } = summary;

const bar = '━'.repeat(40);

// No-delegation guidance branch — when no Hydra subagents dispatched OR savings below indicator threshold
if (delegatedTurns === 0 || savedUSD < 0.01) {
  console.log('');
  console.log('🐉 Hydra Stats');
  console.log(bar);
  console.log('Session: ' + path.basename(sessionFile));
  console.log('Turns:   ' + totalTurns);
  console.log(bar);
  console.log('');
  console.log('🟣 Opus  (' + stats.opus.turns + ' turns):  ' + fmt(stats.opus.input + stats.opus.cache_create) + ' in / ' + fmt(stats.opus.output) + ' out  → \$' + opusCost.toFixed(3));
  console.log(bar);
  console.log('');
  console.log('No Hydra subagent dispatches recorded in this session.');
  console.log('');
  console.log('Hydra works best when invoked explicitly. Try:');
  console.log('  /hydra:scout       — codebase exploration on Haiku');
  console.log('  /hydra:guard       — security scan on Haiku');
  console.log('  /hydra:preflight   — environment validation');
  console.log('  /hydra:map         — codebase dependency map');
  console.log('');
  console.log('Or include \"use hydra\" in prompts that involve multi-file');
  console.log('exploration, codebase analysis, or routine verification.');
  console.log(bar);
  if (unknownModels && unknownModels.size > 0) {
    console.log('');
    console.log('⚠️  Unknown models (not counted): ' + Array.from(unknownModels).join(', '));
  }
  process.exit(0);
}

console.log('');
console.log('🐉 Hydra Stats');
console.log(bar);
console.log('Session: ' + path.basename(sessionFile));
console.log('Turns:   ' + totalTurns);
console.log(bar);
console.log('');
console.log('🟢 Haiku  (' + stats.haiku.turns  + ' turns):  ' + fmt(stats.haiku.input  + stats.haiku.cache_create)  + ' in / ' + fmt(stats.haiku.output)  + ' out  → \$' + haikuCost.toFixed(3));
console.log('🔵 Sonnet (' + stats.sonnet.turns + ' turns):  ' + fmt(stats.sonnet.input + stats.sonnet.cache_create) + ' in / ' + fmt(stats.sonnet.output) + ' out  → \$' + sonnetCost.toFixed(3));
console.log('🟣 Opus   (' + stats.opus.turns   + ' turns):  ' + fmt(stats.opus.input   + stats.opus.cache_create)   + ' in / ' + fmt(stats.opus.output)   + ' out  → \$' + opusCost.toFixed(3));
console.log(bar);
console.log('');
console.log('Delegation rate:    ' + delegationRate.toFixed(1) + '% (' + delegatedTurns + '/' + totalTurns + ' turns)');

if (useStrike) {
  console.log('Was:                ' + DIM + STRIKE + '\$' + hypotheticalCost.toFixed(3) + STRIKE_OFF + RESET);
  console.log('Now:                ' + BOLD + GREEN + '\$' + actualCost.toFixed(3) + RESET);
} else {
  console.log('Actual cost:        \$' + actualCost.toFixed(3));
  console.log('All-Opus baseline:  \$' + hypotheticalCost.toFixed(3));
}
console.log(bar);
console.log('💰 ' + GREEN + 'Saved:           \$' + savedUSD.toFixed(3) + ' (' + savedPct.toFixed(1) + '%)' + RESET);
console.log(bar);
console.log('');
console.log('Reads Claude Code session JSONL directly. No AI estimation.');
if (unknownModels && unknownModels.size > 0) {
  console.log('');
  console.log('⚠️  Unknown models (not counted): ' + Array.from(unknownModels).join(', '));
  console.log('    Update PRICING map in ~/.claude/hooks/hydra-token-math.js');
}
"
```

## Display

Print the output exactly as the script emits. Do not summarize or reformat.

## Notes

- `All-Opus baseline` (or `Was:`) is hypothetical cost if every turn had been Opus.
- Stats are session-scoped.
- Cache-read pricing is 10% of input price (Anthropic prompt-caching rate, Claude 4.x, 2026-05).
- Strikethrough auto-detected from terminal env. Override: `HYDRA_STRIKETHROUGH=0` or `=1`.
