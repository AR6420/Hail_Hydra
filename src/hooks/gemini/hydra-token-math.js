#!/usr/bin/env node

// Shared helper: parse Gemini CLI session JSONL, compute per-tier usage,
// actual cost, and savings vs an all-Pro baseline.
//
// Used by:
//   - commands/hydra/stats.toml (runs printReport() via node -e)
//   - anything that require()s the installed file
//
// This is the GEMINI CLI host assembly on top of lib/token-math-core:
//   - session discovery per G18: ~/.gemini/projects.json registry →
//     tmp/<id>/.project_root marker → legacy sha256(cwd) hex dir
//     (Windows paths lowercased before compare/hash)
//   - parsing per G16/G17: type 'gemini' rows carry model +
//     tokens{input,output,cached,thoughts,tool}; nested subagent transcripts
//     at chats/<parentSessionId>/*.jsonl are included and counted as
//     delegated turns
//   - pricing per G23 (USD/1M, Standard tier). Simplifications, documented:
//     the Pro tier is priced via the gemini-3.1-pro-preview proxy row
//     (gemini-3-pro-preview has no published price); the >200k long-context
//     surcharge and explicit-cache storage fees are ignored.
//   - auth: always USD mode. On OAuth plans quotas meter REQUESTS (G24), so
//     the summary also carries `requests` (one per 'gemini' row) and
//     `authType` (from settings.json) and the report surfaces both.
//
// Token accounting: `cached` ⊂ `input` (cachedContentTokenCount is a subset
// of promptTokenCount); `thoughts` bill at the output rate; `tool` prompt
// tokens bill at the input rate. total = input + output + thoughts + tool.

const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

const { tierCost, emptyStats, makeSummary } = require('../../lib/token-math-core');

// Keyed by tier — getTier() owns the model→tier mapping. Every generation
// prices differently (G23), so each priced generation gets its own tier;
// generations without a published price go to unknownModels, never a
// neighboring tier's rate.
const PRICING = {
  'flash-lite':     { input: 0.10, output: 0.40,  cacheRead: 0.01 },
  'flash-lite-3.1': { input: 0.25, output: 1.50,  cacheRead: 0.025 },
  'flash':          { input: 0.30, output: 2.50,  cacheRead: 0.03 },
  'flash-3':        { input: 0.50, output: 3.00,  cacheRead: 0.05 },
  'flash-3.5':      { input: 1.50, output: 9.00,  cacheRead: 0.15 },
  'flash-3.6':      { input: 1.50, output: 7.50,  cacheRead: 0.15 },
  'pro-2.5':        { input: 1.25, output: 10.00, cacheRead: 0.125 },
  'pro':            { input: 2.00, output: 12.00, cacheRead: 0.20, proxyOf: 'gemini-3.1-pro-preview' },
};

const DELEGATED_TIERS = ['flash-lite', 'flash-lite-3.1', 'flash', 'flash-3', 'flash-3.5', 'flash-3.6'];
const TIERS = Object.keys(PRICING);
const BASELINE_TIER = 'pro';

const pricingConfig = { PRICING, TIERS, DELEGATED_TIERS, baselineTier: BASELINE_TIER };

// Exact generation matching — an unmatched generation returns null (reported
// as unknown/uncounted) rather than being billed at another generation's rate.
function getTier(model) {
  if (!model || !model.startsWith('gemini')) return null;
  if (model.startsWith('gemini-2.5-flash-lite')) return 'flash-lite';
  if (model.startsWith('gemini-3.1-flash-lite')) return 'flash-lite-3.1';
  if (model.startsWith('gemini-2.5-flash')) return 'flash';
  if (model.startsWith('gemini-3-flash')) return 'flash-3';       // gemini-3-flash-preview
  if (model.startsWith('gemini-3.5-flash')) return 'flash-3.5';
  if (model.startsWith('gemini-3.6-flash')) return 'flash-3.6';
  if (model.startsWith('gemini-2.5-pro')) return 'pro-2.5';
  if (model.startsWith('gemini-3-pro') || model.startsWith('gemini-3.1-pro')) return 'pro';
  return null;
}

function getPrice(model) {
  return PRICING[getTier(model)] || null;
}

// ── Session discovery (G18) ─────────────────────────────────────────────────

function configDir() {
  return process.env.GEMINI_CONFIG_DIR || path.join(os.homedir(), '.gemini');
}

function normalizePath(p) {
  const resolved = path.resolve(p);
  return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
}

function resolveProjectId(cwd) {
  const base = configDir();
  const norm = normalizePath(cwd);

  // 1. Registry: ~/.gemini/projects.json { projects: { <normalized path>: <shortId> } }
  try {
    const reg = JSON.parse(fs.readFileSync(path.join(base, 'projects.json'), 'utf8'));
    for (const [p, id] of Object.entries(reg.projects || {})) {
      if (normalizePath(p) === norm) return id;
    }
  } catch (e) { /* no registry */ }

  // 2. Marker: ~/.gemini/tmp/<id>/.project_root holds the owning path.
  try {
    const tmpDir = path.join(base, 'tmp');
    for (const d of fs.readdirSync(tmpDir)) {
      try {
        const owner = fs.readFileSync(path.join(tmpDir, d, '.project_root'), 'utf8').trim();
        if (owner && normalizePath(owner) === norm) return d;
      } catch (e) { /* no marker in this dir */ }
    }
  } catch (e) { /* no tmp dir */ }

  // 3. Legacy: dir named sha256 hex of the normalized path.
  const hash = crypto.createHash('sha256').update(norm).digest('hex');
  if (fs.existsSync(path.join(base, 'tmp', hash))) return hash;

  return null;
}

// Newest-mtime top-level session-*.jsonl in tmp/<id>/chats/ (subagent
// transcripts live in SUBdirectories and are attached separately).
function findActiveSessionFile() {
  try {
    const id = resolveProjectId(process.cwd());
    if (!id) return null;
    const chats = path.join(configDir(), 'tmp', id, 'chats');
    const files = fs.readdirSync(chats)
      .filter((f) => f.endsWith('.jsonl'))
      .map((f) => path.join(chats, f))
      .filter((p) => fs.statSync(p).isFile())
      .map((p) => ({ p, m: fs.statSync(p).mtimeMs }))
      .sort((a, b) => b.m - a.m);
    return files.length > 0 ? files[0].p : null;
  } catch (e) {
    return null;
  }
}

// Nested subagent transcripts: chats/<sessionId>/*.jsonl, where sessionId
// comes from the main file's line-1 metadata (G16).
function subagentFiles(mainFile) {
  try {
    const firstLine = fs.readFileSync(mainFile, 'utf8').split('\n', 1)[0];
    const meta = JSON.parse(firstLine);
    if (!meta.sessionId) return [];
    const dir = path.join(path.dirname(mainFile), meta.sessionId);
    return fs.readdirSync(dir)
      .filter((f) => f.endsWith('.jsonl'))
      .sort()
      .map((f) => path.join(dir, f));
  } catch (e) {
    return [];
  }
}

// ── Parsing (G16/G17) ───────────────────────────────────────────────────────

// Parse ONE transcript file. Counts only appended type:'gemini' rows (one per
// API response = one request); rows replayed inside $set snapshots are not
// re-counted.
function parseSession(sessionFile) {
  const stats = emptyStats(TIERS);
  const unknownModels = new Set();
  let totalTurns = 0;

  try {
    const lines = fs.readFileSync(sessionFile, 'utf8').split('\n').filter(Boolean);
    for (const line of lines) {
      try {
        const obj = JSON.parse(line);
        if (obj.type !== 'gemini' || !obj.tokens) continue;
        const model = obj.model || '';
        const tier = getTier(model);
        if (!tier) { if (model) unknownModels.add(model); continue; }
        const t = obj.tokens;
        const input = t.input || 0;
        const cached = t.cached || 0;
        stats[tier].input      += Math.max(0, input - cached) + (t.tool || 0);
        stats[tier].cache_read += cached;
        stats[tier].output     += (t.output || 0) + (t.thoughts || 0);
        stats[tier].turns      += 1;
        totalTurns             += 1;
      } catch (e) { /* skip malformed line */ }
    }
  } catch (e) { /* file unreadable */ }

  return { stats, totalTurns, unknownModels };
}

function readAuthType() {
  try {
    const settings = JSON.parse(fs.readFileSync(path.join(configDir(), 'settings.json'), 'utf8'));
    return (settings.security && settings.security.auth && settings.security.auth.selectedType) || null;
  } catch (e) {
    return null;
  }
}

function computeSummary() {
  const mainFile = findActiveSessionFile();
  if (!mainFile) return { available: false };

  const subFiles = subagentFiles(mainFile);
  const stats = emptyStats(TIERS);
  const unknownModels = new Set();
  let totalTurns = 0;
  let subagentTurns = 0;

  for (const file of [mainFile, ...subFiles]) {
    const parsed = parseSession(file);
    for (const tier of TIERS) {
      for (const k of ['input', 'output', 'cache_read', 'cache_create', 'turns']) {
        stats[tier][k] += parsed.stats[tier][k];
      }
    }
    totalTurns += parsed.totalTurns;
    if (file !== mainFile) subagentTurns += parsed.totalTurns;
    for (const m of parsed.unknownModels) unknownModels.add(m);
  }

  if (totalTurns === 0) return { available: false };

  const summary = makeSummary({ stats, totalTurns, unknownModels, sessionFile: mainFile, pricing: pricingConfig });

  // Gemini refinement: subagent transcripts are the honest delegation signal
  // (Auto routing can put MAIN turns on flash — those are not delegations).
  summary.delegatedTurns = subagentTurns;
  summary.delegationRate = totalTurns > 0 ? (subagentTurns / totalTurns) * 100 : 0;
  summary.subagentSessions = subFiles.length;
  summary.requests = totalTurns;      // one 'gemini' row = one API request (G24)
  summary.authType = readAuthType();
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

// ── Report (consumed by /hydra:stats) ───────────────────────────────────────

function fmt(n) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'k';
  return String(n);
}

const TIER_LABELS = {
  'flash-lite':     '🟢 Flash-Lite',
  'flash-lite-3.1': '🟢 Lite 3.1  ',
  'flash':          '🟢 Flash 2.5 ',
  'flash-3':        '🔵 Flash 3   ',
  'flash-3.5':      '🔵 Flash 3.5 ',
  'flash-3.6':      '🔵 Flash 3.6 ',
  'pro-2.5':        '🟣 Pro 2.5   ',
  'pro':            '🟣 Pro       ',
};

function formatReport(summary) {
  const bar = '━'.repeat(40);
  const out = [];

  if (!summary.available) {
    return [
      '🐉 Hydra Stats (Gemini CLI)',
      bar,
      'No session data for this project yet.',
      'Stats appear once the session has recorded a few turns.',
    ].join('\n');
  }

  out.push('');
  out.push('🐉 Hydra Stats (Gemini CLI)');
  out.push(bar);
  out.push('Session: ' + path.basename(summary.sessionFile));
  out.push('Turns:   ' + summary.totalTurns + '  (requests: ' + summary.requests + ')');
  out.push(bar);
  out.push('');
  for (const tier of TIERS) {
    const s = summary.stats[tier];
    if (s.turns === 0) continue;
    out.push(
      TIER_LABELS[tier] + ' (' + s.turns + ' turns):  ' +
      fmt(s.input + s.cache_read) + ' in / ' + fmt(s.output) + ' out  → $' +
      summary.costs[tier].toFixed(3)
    );
  }
  out.push(bar);
  out.push('');
  out.push('Delegation rate:    ' + summary.delegationRate.toFixed(1) + '% (' +
    summary.delegatedTurns + '/' + summary.totalTurns + ' turns in ' +
    summary.subagentSessions + ' subagent transcript(s))');
  out.push('Actual cost:        $' + summary.actualCost.toFixed(3));
  out.push('All-Pro baseline:   $' + summary.hypotheticalCost.toFixed(3) + '  (gemini-3.1-pro-preview proxy pricing)');
  out.push(bar);
  out.push('💰 Saved:           $' + summary.savedUSD.toFixed(3) + ' (' + summary.savedPct.toFixed(1) + '%)');
  out.push(bar);
  if (summary.authType && String(summary.authType).startsWith('oauth')) {
    out.push('');
    out.push('Auth: ' + summary.authType + ' — OAuth quotas meter REQUESTS/day,');
    out.push('not token dollars. This session used ' + summary.requests + ' request(s).');
  }
  if (summary.unknownModels && summary.unknownModels.size > 0) {
    out.push('');
    out.push('⚠️  Unknown models (not counted): ' + Array.from(summary.unknownModels).join(', '));
  }
  out.push('');
  out.push('Reads Gemini CLI session JSONL directly. No AI estimation.');
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
  resolveProjectId,
  subagentFiles,
  tierCost,
  getTier,
  getPrice,
  formatReport,
  printReport,
  PRICING,
  TIERS,
  DELEGATED_TIERS,
};
