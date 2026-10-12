#!/usr/bin/env node

// Shared helper: parse Codex CLI rollout JSONL, compute per-tier usage,
// actual cost, and savings vs the session's main-model baseline.
//
// Used by:
//   - the $hydra-stats skill (runs printReport() via node -e)
//   - anything that require()s the installed file
//
// This is the CODEX CLI host assembly on top of lib/token-math-core:
//   - session discovery per C19: scan ~/.codex/sessions/YYYY/MM/DD newest-
//     first, read line 1 (session_meta), match payload.cwd against the
//     current directory (case-insensitive compare on win32). session_index/
//     history.jsonl carry no cwd, so the scan is the only route.
//   - parsing per C16/C17: turn_context rows carry the model; event_msg
//     token_count rows carry payload.info.{total_token_usage,last_token_usage}
//     with {input_tokens, cached_input_tokens, output_tokens,
//     reasoning_output_tokens}. reasoning ⊂ output, cached ⊂ input — never
//     added separately.
//
//     ACCOUNTING DECISION: total_token_usage is CUMULATIVE, and the final row
//     of a session can be a verbatim repeat (verified against live rollouts),
//     so summing last_token_usage double-counts. We therefore consume
//     total_token_usage as per-row DELTAS (repeat rows delta to zero and are
//     skipped); if a delta goes negative (counter reset), the row's totals
//     are taken as a fresh baseline. last_token_usage is only a fallback while
//     NO total_token_usage baseline has been seen — after that, last-only rows
//     are ignored (their tokens arrive in the next cumulative delta).
//   - info can be null for individual rows or ENTIRE sessions (some vscode /
//     app-server surfaces — C17): those sessions produce an explicit
//     "no usage data" result ({available:false, noUsageData:true}), never NaN.
//   - pricing: PRICING is keyed by exact model id (current OpenAI list
//     prices, USD/1M). Ids are normalized by stripping a dated suffix
//     (-2026-09-01 / -20260901) and applying ALIASES; newer GPT-6 point
//     releases (gpt-6.N-luna|sol|astra) price at the newest known model in
//     that line. Anything else (gpt-5.3-codex-spark, codex-mini, retired
//     gpt-5.4*) is reported as unknown/uncounted, never guessed.
//     Baseline = the session's most-used non-delegated model (default
//     gpt-6.1-sol, the Codex CLI default); delegated = DELEGATED_TIERS.
//
// Cost formula (C17/C21), realized through lib tierCost with explicit
// cacheRead prices (stats.input already excludes cached tokens):
//   costUSD = ((input − cached)·Pin + cached·Pcache + output·Pout) / 1e6

const fs = require('fs');
const path = require('path');
const os = require('os');

const { tierCost, emptyStats, makeSummary } = require('../../lib/token-math-core');

const PRICING = {
  'gpt-6-astra':   { input: 10.00, output: 50.00, cacheRead: 1.00 },
  'gpt-6.1-sol':   { input: 2.00,  output: 10.00, cacheRead: 0.10 },
  'gpt-6-sol':     { input: 2.00,  output: 10.00, cacheRead: 0.20 },
  'gpt-6-luna':    { input: 0.10,  output: 0.50,  cacheRead: 0.01 },
  'gpt-5.6-sol':   { input: 4.00,  output: 20.00, cacheRead: 0.40 },
  'gpt-5.6-terra': { input: 2.00,  output: 12.00, cacheRead: 0.20 },
  'gpt-5.6-luna':  { input: 0.20,  output: 1.20,  cacheRead: 0.02 },
  'gpt-5.5':       { input: 5.00,  output: 30.00, cacheRead: 0.50 },
  'gpt-5.3-codex': { input: 1.75,  output: 14.00, cacheRead: 0.175 },
};

const ALIASES = { 'gpt-5.6': 'gpt-5.6-sol' };
// Newest known model per GPT-6 line — unlisted point releases price here.
const GPT6_LATEST = { sol: 'gpt-6.1-sol', luna: 'gpt-6-luna', astra: 'gpt-6-astra' };

const DELEGATED_TIERS = ['gpt-6-luna', 'gpt-6-sol', 'gpt-5.6-luna', 'gpt-5.6-terra'];
const TIERS = Object.keys(PRICING);
const DEFAULT_BASELINE = 'gpt-6.1-sol';

// Model id → PRICING key, or null when unpriced. Name kept for API stability.
function getTier(model) {
  if (!model) return null;
  let id = model.replace(/-(\d{4}-\d{2}-\d{2}|\d{8})$/, '');
  id = ALIASES[id] || id;
  if (PRICING[id]) return id;
  const m = /^gpt-6\.(\d+)-(luna|sol|astra)$/.exec(id);
  return m ? GPT6_LATEST[m[2]] : null;
}

// Baseline = most-used (by turns) non-delegated model in the session.
function baselineModel(stats) {
  let best = DEFAULT_BASELINE;
  let bestTurns = 0;
  for (const t of TIERS) {
    if (DELEGATED_TIERS.includes(t) || !stats[t]) continue;
    if (stats[t].turns > bestTurns) { best = t; bestTurns = stats[t].turns; }
  }
  return best;
}

function getPrice(model) {
  return PRICING[getTier(model)] || null;
}

// ── Session discovery (C19) ─────────────────────────────────────────────────

function configDir() {
  return process.env.CODEX_HOME || path.join(os.homedir(), '.codex');
}

function normalizePath(p) {
  const resolved = path.resolve(p);
  return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
}

// First line of a (potentially huge) rollout file without reading it all.
const FIRST_LINE_MAX = 262144;
function readFirstLine(file) {
  let fd = null;
  try {
    fd = fs.openSync(file, 'r');
    const buf = Buffer.alloc(FIRST_LINE_MAX);
    const bytes = fs.readSync(fd, buf, 0, FIRST_LINE_MAX, 0);
    const chunk = buf.slice(0, bytes);
    const nl = chunk.indexOf(0x0a);
    if (nl === -1 && bytes === FIRST_LINE_MAX) return null; // absurd line — skip
    return chunk.slice(0, nl === -1 ? bytes : nl).toString('utf8');
  } catch (e) {
    return null;
  } finally {
    if (fd !== null) try { fs.closeSync(fd); } catch (e) {}
  }
}

function sessionCwd(file) {
  try {
    const meta = JSON.parse(readFirstLine(file));
    if (meta && meta.type === 'session_meta' && meta.payload && meta.payload.cwd) {
      return meta.payload.cwd;
    }
  } catch (e) { /* malformed line 1 */ }
  return null;
}

// Newest rollout whose session_meta cwd matches the working directory.
// sessions/YYYY/MM/DD dirs and rollout-<ISO-ts>-<uuid>.jsonl names both sort
// chronologically, so descending name order = newest first.
function findActiveSessionFile(cwd = process.cwd()) {
  const norm = normalizePath(cwd);
  const root = path.join(configDir(), 'sessions');
  const listDesc = (dir) => {
    try { return fs.readdirSync(dir).sort().reverse(); } catch (e) { return []; }
  };
  for (const year of listDesc(root)) {
    for (const month of listDesc(path.join(root, year))) {
      for (const day of listDesc(path.join(root, year, month))) {
        const dayDir = path.join(root, year, month, day);
        for (const f of listDesc(dayDir).filter((n) => n.endsWith('.jsonl'))) {
          const file = path.join(dayDir, f);
          const scwd = sessionCwd(file);
          if (scwd && normalizePath(scwd) === norm) return file;
        }
      }
    }
  }
  return null;
}

// ── Parsing (C16/C17) ───────────────────────────────────────────────────────

// Parse ONE rollout file. Model attribution = nearest preceding turn_context.
// Returns per-tier stats plus row counters so callers can distinguish
// "no token rows at all" from "token rows present but info always null".
function parseSession(sessionFile) {
  const stats = emptyStats(TIERS);
  const unknownModels = new Set();
  let totalTurns = 0;
  let tokenRows = 0; // token_count rows seen
  let usageRows = 0; // rows that contributed usage (non-null info, non-zero delta)
  let currentModel = null;
  let prev = null;   // last cumulative total_token_usage snapshot

  try {
    const lines = fs.readFileSync(sessionFile, 'utf8').split('\n').filter(Boolean);
    for (const line of lines) {
      let obj;
      try { obj = JSON.parse(line); } catch (e) { continue; }

      if (obj.type === 'turn_context' && obj.payload && obj.payload.model) {
        currentModel = obj.payload.model;
        continue;
      }
      if (obj.type !== 'event_msg' || !obj.payload || obj.payload.type !== 'token_count') continue;

      tokenRows += 1;
      const info = obj.payload.info;
      if (!info) continue; // C17: info:null rows carry no usage

      const total = info.total_token_usage;
      const last = info.last_token_usage;
      let dIn, dCached, dOut;
      if (total) {
        const cur = {
          input: total.input_tokens || 0,
          cached: total.cached_input_tokens || 0,
          output: total.output_tokens || 0,
        };
        if (prev && cur.input >= prev.input && cur.cached >= prev.cached && cur.output >= prev.output) {
          dIn = cur.input - prev.input;
          dCached = cur.cached - prev.cached;
          dOut = cur.output - prev.output;
        } else {
          // First row, or a counter reset — take the totals as fresh.
          dIn = cur.input; dCached = cur.cached; dOut = cur.output;
        }
        prev = cur;
      } else if (last && !prev) {
        // Fallback only while NO cumulative baseline exists: once a
        // total_token_usage row has been seen, a last-only row's tokens are
        // already contained in the next cumulative delta — billing it too
        // would double-count.
        dIn = last.input_tokens || 0;
        dCached = last.cached_input_tokens || 0;
        dOut = last.output_tokens || 0;
      } else {
        continue;
      }

      if (dIn + dOut === 0) continue; // repeat/no-op row — nothing billed

      usageRows += 1;
      const tier = getTier(currentModel);
      if (!tier) {
        if (currentModel) unknownModels.add(currentModel);
        continue;
      }
      // cached ⊂ input; reasoning ⊂ output (C17) — clamp defensively.
      const cached = Math.min(dCached, dIn);
      stats[tier].input      += dIn - cached;
      stats[tier].cache_read += cached;
      stats[tier].output     += dOut;
      stats[tier].turns      += 1;
      totalTurns             += 1;
    }
  } catch (e) { /* file unreadable */ }

  return { stats, totalTurns, unknownModels, tokenRows, usageRows };
}

function computeSummary() {
  const sessionFile = findActiveSessionFile();
  if (!sessionFile) return { available: false };

  const parsed = parseSession(sessionFile);
  if (parsed.totalTurns === 0) {
    // C17: whole sessions can be info:null (vscode / app-server surfaces).
    if (parsed.tokenRows > 0 && parsed.usageRows === 0) {
      return { available: false, noUsageData: true, sessionFile };
    }
    return { available: false };
  }

  const baselineTier = baselineModel(parsed.stats);
  const summary = makeSummary({
    stats: parsed.stats,
    totalTurns: parsed.totalTurns,
    unknownModels: parsed.unknownModels,
    sessionFile,
    pricing: { PRICING, TIERS, DELEGATED_TIERS, baselineTier },
  });
  summary.baselineModel = baselineTier;
  return summary;
}

let _cache = null;
let _cacheExpiry = 0;
const CACHE_TTL_MS = 15000;

function computeSummaryCached() {
  const now = Date.now();
  if (_cache && now < _cacheExpiry) return _cache;
  _cache = computeSummary();
  _cacheExpiry = now + CACHE_TTL_MS;
  return _cache;
}

// ── Report (consumed by $hydra-stats) ───────────────────────────────────────

function fmt(n) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'k';
  return String(n);
}

function formatReport(summary) {
  const bar = '━'.repeat(40);
  const out = [];

  if (!summary.available) {
    if (summary.noUsageData) {
      return [
        '🐉 Hydra Stats (Codex CLI)',
        bar,
        'No token usage recorded for this session.',
        'This Codex surface (e.g. some VS Code / app-server sessions) does',
        'not emit token counts — cost math is impossible, not zero.',
      ].join('\n');
    }
    return [
      '🐉 Hydra Stats (Codex CLI)',
      bar,
      'No session data for this project yet.',
      'Stats appear once the session has recorded a few turns.',
    ].join('\n');
  }

  out.push('');
  out.push('🐉 Hydra Stats (Codex CLI)');
  out.push(bar);
  out.push('Session: ' + path.basename(summary.sessionFile));
  out.push('Turns:   ' + summary.totalTurns);
  out.push(bar);
  out.push('');
  for (const tier of TIERS) {
    const s = summary.stats[tier];
    if (s.turns === 0) continue;
    out.push(
      (DELEGATED_TIERS.includes(tier) ? '🟢 ' : '🟣 ') + tier + ' (' + s.turns + ' turns):  ' +
      fmt(s.input + s.cache_read) + ' in / ' + fmt(s.output) + ' out  → $' +
      summary.costs[tier].toFixed(3)
    );
  }
  out.push(bar);
  out.push('');
  out.push('Delegation rate:    ' + summary.delegationRate.toFixed(1) + '% (' +
    summary.delegatedTurns + '/' + summary.totalTurns + ' turns delegated)');
  out.push('Actual cost:        $' + summary.actualCost.toFixed(3));
  out.push('Baseline (' + summary.baselineModel + '): $' + summary.hypotheticalCost.toFixed(3));
  out.push(bar);
  out.push('💰 Saved:           $' + summary.savedUSD.toFixed(3) + ' (' + summary.savedPct.toFixed(1) + '%)');
  out.push(bar);
  if (summary.unknownModels && summary.unknownModels.size > 0) {
    out.push('');
    out.push('⚠️  Unpriced models (not counted): ' + Array.from(summary.unknownModels).join(', '));
  }
  out.push('');
  out.push('Reads Codex CLI rollout JSONL directly. No AI estimation.');
  return out.join('\n');
}

function printReport() {
  console.log(formatReport(computeSummary()));
}

// Direct execution (`node hydra-token-math.js`) prints the report. argv-based
// because the installed file is a bundle whose synthetic module object never
// equals require.main.
if ((process.argv[1] || '').endsWith('hydra-token-math.js')) {
  printReport();
}

module.exports = {
  computeSummary,
  computeSummaryCached,
  parseSession,
  findActiveSessionFile,
  sessionCwd,
  tierCost,
  getTier,
  getPrice,
  baselineModel,
  formatReport,
  printReport,
  PRICING,
  TIERS,
  DELEGATED_TIERS,
};
