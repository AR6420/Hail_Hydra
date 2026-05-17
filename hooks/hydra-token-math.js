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

const PRICING = {
  'claude-haiku-4':  { input: 1, output: 5 },
  'claude-sonnet-4': { input: 3, output: 15 },
  'claude-opus-4':   { input: 5, output: 25 }
};

function getPrice(model) {
  for (const prefix in PRICING) {
    if (model.startsWith(prefix)) return PRICING[prefix];
  }
  return null;
}

function getTier(model) {
  if (model.startsWith('claude-haiku'))  return 'haiku';
  if (model.startsWith('claude-sonnet')) return 'sonnet';
  if (model.startsWith('claude-opus'))   return 'opus';
  return null;
}

function findActiveSessionFile() {
  try {
    const configDir = process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');
    const projectsDir = path.join(configDir, 'projects');
    if (!fs.existsSync(projectsDir)) return null;

    const cwd = process.cwd();
    const slug = cwd.replace(/[^a-zA-Z0-9-]/g, '-').replace(/^-+/, '');

    let sessionDir = path.join(projectsDir, slug);
    if (!fs.existsSync(sessionDir)) {
      const all = fs.readdirSync(projectsDir);
      const match = all.find(d => d.toLowerCase() === slug.toLowerCase())
                 || all.find(d => d.toLowerCase().endsWith(path.basename(cwd).toLowerCase()));
      if (!match) return null;
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
  const stats = {
    haiku:  { input: 0, output: 0, cache_read: 0, cache_create: 0, turns: 0 },
    sonnet: { input: 0, output: 0, cache_read: 0, cache_create: 0, turns: 0 },
    opus:   { input: 0, output: 0, cache_read: 0, cache_create: 0, turns: 0 }
  };
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
  return tierCost(s, PRICING['claude-opus-4']);
}

function computeSummary() {
  const sessionFile = findActiveSessionFile();
  if (!sessionFile) return { available: false };

  const { stats, totalTurns, unknownModels } = parseSession(sessionFile);
  if (totalTurns === 0) return { available: false };

  const haikuCost  = tierCost(stats.haiku,  PRICING['claude-haiku-4']);
  const sonnetCost = tierCost(stats.sonnet, PRICING['claude-sonnet-4']);
  const opusCost   = tierCost(stats.opus,   PRICING['claude-opus-4']);
  const actualCost = haikuCost + sonnetCost + opusCost;

  const hypotheticalCost =
    asOpusCost(stats.haiku) + asOpusCost(stats.sonnet) + asOpusCost(stats.opus);

  const savedUSD = Math.max(0, hypotheticalCost - actualCost);
  const savedPct = hypotheticalCost > 0 ? (savedUSD / hypotheticalCost) * 100 : 0;

  const delegatedTurns = stats.haiku.turns + stats.sonnet.turns;
  const delegationRate = totalTurns > 0 ? (delegatedTurns / totalTurns) * 100 : 0;

  return {
    available: true,
    sessionFile,
    totalTurns,
    stats,
    haikuCost, sonnetCost, opusCost,
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
  PRICING
};
