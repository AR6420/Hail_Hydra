#!/usr/bin/env node

// Shared helper: parse Claude Code session JSONL, compute per-tier usage,
// actual cost, and savings vs all-Opus baseline.
//
// Used by:
//   - hooks/hydra-statusline.js  (cached, every statusline refresh)
//   - commands/hydra/stats.md    (fresh, on /hydra:stats invocation)

const fs = require('fs');
const path = require('path');
const os = require('os');

// Keyed by tier, not model prefix — getTier() owns the model→tier mapping, so
// new point releases (opus-5, sonnet-5, ...) need no change here. Only add an
// entry when Anthropic ships a genuinely new tier.
const PRICING = {
  haiku:  { input: 1,  output: 5  },
  sonnet: { input: 3,  output: 15 },
  opus:   { input: 5,  output: 25 },
  fable:  { input: 10, output: 50 }
};

// Tiers cheaper than the Opus baseline. Fable is deliberately excluded — it
// costs more than Opus, so routing to it is an escalation, not a delegation.
const DELEGATED_TIERS = ['haiku', 'sonnet'];
const TIERS = Object.keys(PRICING);

function getPrice(model) {
  return PRICING[getTier(model)] || null;
}

function getTier(model) {
  if (model.startsWith('claude-haiku'))  return 'haiku';
  if (model.startsWith('claude-sonnet')) return 'sonnet';
  if (model.startsWith('claude-opus'))   return 'opus';
  if (model.startsWith('claude-fable'))  return 'fable';
  if (model.startsWith('claude-mythos')) return 'fable';  // same pricing as Fable
  return null;
}

function findActiveSessionFile() {
  try {
    const configDir = process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');
    const projectsDir = path.join(configDir, 'projects');
    if (!fs.existsSync(projectsDir)) return null;

    const cwd = process.cwd();
    // Claude Code names project dirs by replacing every non-alphanumeric char
    // (including the leading separator) with '-'. Match that exactly — do NOT
    // strip the leading dash, or exact matches fail for underscore/special paths.
    const slug = cwd.replace(/[^a-zA-Z0-9-]/g, '-');

    let sessionDir = path.join(projectsDir, slug);
    if (!fs.existsSync(sessionDir)) {
      const all = fs.readdirSync(projectsDir);
      // Normalize basename the same way (underscores/specials → dashes) so the
      // endsWith fallback compares like-for-like.
      const baseSlug = path.basename(cwd).replace(/[^a-zA-Z0-9-]/g, '-').toLowerCase();
      const match = all.find(d => d === slug)
                 || all.find(d => d.toLowerCase() === slug.toLowerCase())
                 || all.find(d => d.toLowerCase().endsWith(baseSlug));
      if (!match) {
        if (process.env.HYDRA_DEBUG === '1') {
          console.error('[hydra-token-math] No session dir matched.');
          console.error('  cwd:', cwd);
          console.error('  computed slug:', slug);
          console.error('  projects dir contents:',
            fs.existsSync(projectsDir) ? fs.readdirSync(projectsDir).slice(0, 10) : '(none)');
        }
        return null;
      }
      sessionDir = path.join(projectsDir, match);
    }

    const files = fs.readdirSync(sessionDir)
      .filter(f => f.endsWith('.jsonl'))
      .map(f => ({ p: path.join(sessionDir, f), m: fs.statSync(path.join(sessionDir, f)).mtimeMs }))
      .sort((a, b) => b.m - a.m);

    return files.length > 0 ? files[0].p : null;
  } catch (e) {
    return null;
  }
}

function parseSession(sessionFile) {
  const stats = {};
  for (const tier of TIERS) {
    stats[tier] = { input: 0, output: 0, cache_read: 0, cache_create: 0, turns: 0 };
  }
  const unknownModels = new Set();
  let totalTurns = 0;

  try {
    const lines = fs.readFileSync(sessionFile, 'utf8').split('\n').filter(Boolean);
    for (const line of lines) {
      try {
        const obj = JSON.parse(line);
        if (obj.type !== 'assistant' || !obj.message || !obj.message.usage) continue;
        const model = obj.message.model || '';
        const tier = getTier(model);
        if (!tier) { if (model) unknownModels.add(model); continue; }
        const u = obj.message.usage;
        stats[tier].input        += u.input_tokens || 0;
        stats[tier].output       += u.output_tokens || 0;
        stats[tier].cache_read   += u.cache_read_input_tokens || 0;
        stats[tier].cache_create += u.cache_creation_input_tokens || 0;
        stats[tier].turns        += 1;
        totalTurns               += 1;
      } catch (e) { /* skip malformed line */ }
    }
  } catch (e) { /* file unreadable */ }

  return { stats, totalTurns, unknownModels };
}

function tierCost(s, p) {
  if (!p) return 0;
  const inputCost     = ((s.input + s.cache_create) * p.input) / 1_000_000;
  const cacheReadCost = (s.cache_read * p.input * 0.1) / 1_000_000;
  const outputCost    = (s.output * p.output) / 1_000_000;
  return inputCost + cacheReadCost + outputCost;
}

function asOpusCost(s) {
  return tierCost(s, PRICING.opus);
}

function computeSummary() {
  const sessionFile = findActiveSessionFile();
  if (!sessionFile) return { available: false };

  const { stats, totalTurns, unknownModels } = parseSession(sessionFile);
  if (totalTurns === 0) return { available: false };

  const costs = {};
  let actualCost = 0;
  let hypotheticalCost = 0;
  for (const tier of TIERS) {
    costs[tier] = tierCost(stats[tier], PRICING[tier]);
    actualCost += costs[tier];
    hypotheticalCost += asOpusCost(stats[tier]);
  }

  const savedUSD = Math.max(0, hypotheticalCost - actualCost);
  const savedPct = hypotheticalCost > 0 ? (savedUSD / hypotheticalCost) * 100 : 0;

  const delegatedTurns = DELEGATED_TIERS.reduce((n, t) => n + stats[t].turns, 0);
  const delegationRate = totalTurns > 0 ? (delegatedTurns / totalTurns) * 100 : 0;

  return {
    available: true,
    sessionFile,
    totalTurns,
    stats,
    costs,
    // Named aliases kept for existing consumers (/hydra:stats reads these).
    haikuCost: costs.haiku, sonnetCost: costs.sonnet,
    opusCost: costs.opus,   fableCost: costs.fable,
    actualCost, hypotheticalCost,
    savedUSD, savedPct,
    delegatedTurns, delegationRate,
    unknownModels
  };
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

module.exports = {
  computeSummary,
  computeSummaryCached,
  parseSession,
  findActiveSessionFile,
  tierCost,
  asOpusCost,
  getTier,
  getPrice,
  PRICING,
  TIERS,
  DELEGATED_TIERS
};
