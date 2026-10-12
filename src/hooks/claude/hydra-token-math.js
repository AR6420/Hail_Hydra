#!/usr/bin/env node

// Shared helper: parse Claude Code session JSONL, compute per-tier usage,
// actual cost, and savings vs all-Opus baseline.
//
// Used by:
//   - hydra-statusline.js (installed sibling; cached, every refresh)
//   - commands/hydra/stats.md (fresh, on /hydra:stats invocation)
//
// This is the CLAUDE CODE host assembly: Anthropic pricing + tier map +
// ~/.claude session-log discovery, on top of the host-agnostic math in
// lib/token-math-core. The exported API is stable — do not rename fields.

const fs = require('fs');
const path = require('path');
const os = require('os');

const { tierCost, emptyStats, makeSummary } = require('../../lib/token-math-core');

// Keyed by GENERATION (current prices, verified 2026-10): point releases of
// one generation share a price, but generations within a family differ.
// getGeneration() owns the model→generation mapping via GENERATIONS below;
// only add an entry when Anthropic publishes a new price.
// USD per 1M tokens. cacheWrite = 5-min TTL write, cacheWrite1h = 1-hour TTL
// write, cacheRead = cache hit.
const PRICING = {
  'haiku-4.5':      { input: 1,    output: 5,    cacheWrite: 1.25,  cacheWrite1h: 2,    cacheRead: 0.10 },
  // Haiku 5.5 bills by request size: prompts over 100k tokens use the long band.
  'haiku-5.5':      { input: 0.10, output: 0.50, cacheWrite: 0.125, cacheWrite1h: 0.20, cacheRead: 0.01 },
  'haiku-5.5-long': { input: 0.50, output: 2.50, cacheWrite: 0.625, cacheWrite1h: 1.00, cacheRead: 0.05 },
  'sonnet-4':       { input: 3,    output: 15,   cacheWrite: 3.75,  cacheWrite1h: 6,    cacheRead: 0.30 },
  'sonnet-5':       { input: 2,    output: 10,   cacheWrite: 2.50,  cacheWrite1h: 4,    cacheRead: 0.20 },
  'sonnet-5.5':     { input: 2,    output: 10,   cacheWrite: 2.50,  cacheWrite1h: 4,    cacheRead: 0.10 },
  'opus-4':         { input: 15,   output: 75,   cacheWrite: 18.75, cacheWrite1h: 30,   cacheRead: 1.50 },
  'opus-4.5':       { input: 5,    output: 25,   cacheWrite: 6.25,  cacheWrite1h: 10,   cacheRead: 0.50 },
  'opus-5.5':       { input: 4,    output: 20,   cacheWrite: 5,     cacheWrite1h: 8,    cacheRead: 0.20 },
  'fable-5':        { input: 10,   output: 50,   cacheWrite: 12.5,  cacheWrite1h: 20,   cacheRead: 1.00 },
  'fable-5.1':      { input: 10,   output: 50,   cacheWrite: 12.5,  cacheWrite1h: 20,   cacheRead: 0.25 }
};

// Per family, [minVersionCode, generation] newest first; version code is
// major*100+minor. The first threshold the model reaches wins, so newer
// unknown point releases fall to the newest known generation; anything below
// the lowest threshold (e.g. claude-haiku-3-5) is an unknown model.
const GENERATIONS = {
  haiku:  [[505, 'haiku-5.5'], [405, 'haiku-4.5']],
  sonnet: [[505, 'sonnet-5.5'], [500, 'sonnet-5'], [400, 'sonnet-4']],
  opus:   [[505, 'opus-5.5'], [405, 'opus-4.5'], [400, 'opus-4']],
  fable:  [[501, 'fable-5.1'], [500, 'fable-5']]
};
// (?![0-9]) keeps a date suffix (claude-opus-4-20250514) from reading as a minor.
const MODEL_RE = /^claude-(haiku|sonnet|opus|fable|mythos)-(\d+)(?:-(\d{1,2})(?![0-9]))?/;
const HAIKU_LONG_PROMPT = 100000;

// Report families. Fable is deliberately excluded from delegation — it costs
// more than Opus, so routing to it is an escalation, not a delegation.
const TIERS = ['haiku', 'sonnet', 'opus', 'fable'];
const DELEGATED_TIERS = ['haiku', 'sonnet'];
// Baseline generation when the session used no Opus at all.
const DEFAULT_BASELINE_GEN = 'opus-5.5';

const pricingConfig = { PRICING, TIERS, DELEGATED_TIERS, baselineTier: DEFAULT_BASELINE_GEN };

// → { family, gen }, or null for unknown models. mythos-preview has no
// published price, so it stays unknown rather than borrowing Fable's.
function getGeneration(model) {
  const m = MODEL_RE.exec(model || '');
  if (!m) return null;
  const family = m[1] === 'mythos' ? 'fable' : m[1];
  const code = Number(m[2]) * 100 + Number(m[3] || 0);
  const hit = GENERATIONS[family].find(([min]) => code >= min);
  return hit ? { family, gen: hit[1] } : null;
}

// Haiku 5.5's band is decided per request from the full prompt size.
function lineGen(gen, u) {
  if (gen !== 'haiku-5.5') return gen;
  const prompt = (u.input_tokens || 0) + (u.cache_read_input_tokens || 0) + (u.cache_creation_input_tokens || 0);
  return prompt > HAIKU_LONG_PROMPT ? 'haiku-5.5-long' : gen;
}

// Generation price for a model (Haiku 5.5: the <=100k band).
function getPrice(model) {
  const g = getGeneration(model);
  return g ? PRICING[g.gen] : null;
}

function getTier(model) {
  const g = getGeneration(model);
  return g ? g.family : null;
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
  const stats = emptyStats(TIERS);
  const unknownModels = new Set();
  let totalTurns = 0;
  // Generations differ in price, so cost is billed per line. The baseline
  // Opus generation is only known once the whole file is read, so each line
  // is also priced against every Opus generation and one is picked at the end.
  const opusGens = GENERATIONS.opus.map(([, g]) => g);
  const opusTurns = {};
  const baseline = {};
  for (const tier of TIERS) {
    stats[tier].cost = 0;
    baseline[tier] = {};
    for (const og of opusGens) baseline[tier][og] = 0;
  }

  try {
    const lines = fs.readFileSync(sessionFile, 'utf8').split('\n').filter(Boolean);
    for (const line of lines) {
      try {
        const obj = JSON.parse(line);
        if (obj.type !== 'assistant' || !obj.message || !obj.message.usage) continue;
        const model = obj.message.model || '';
        const g = getGeneration(model);
        if (!g) { if (model) unknownModels.add(model); continue; }
        const tier = g.family;
        const u = obj.message.usage;
        const lineUsage = {
          input: u.input_tokens || 0,
          output: u.output_tokens || 0,
          cache_read: u.cache_read_input_tokens || 0,
          cache_create: u.cache_creation_input_tokens || 0,
          cache_create_1h: (u.cache_creation && u.cache_creation.ephemeral_1h_input_tokens) || 0
        };
        stats[tier].cost += tierCost(lineUsage, PRICING[lineGen(g.gen, u)]);
        for (const og of opusGens) baseline[tier][og] += tierCost(lineUsage, PRICING[og]);
        if (tier === 'opus') opusTurns[g.gen] = (opusTurns[g.gen] || 0) + 1;
        stats[tier].input        += u.input_tokens || 0;
        stats[tier].output       += u.output_tokens || 0;
        stats[tier].cache_read   += u.cache_read_input_tokens || 0;
        stats[tier].cache_create += u.cache_creation_input_tokens || 0;
        // Newer session logs break cache writes down by TTL; track the 1-hour
        // subset so tierCost can bill it at 2x instead of 1.25x. Legacy logs
        // without the breakdown bill the whole lump at 1.25x (5-min default).
        stats[tier].cache_create_1h = (stats[tier].cache_create_1h || 0) +
          ((u.cache_creation && u.cache_creation.ephemeral_1h_input_tokens) || 0);
        stats[tier].turns        += 1;
        totalTurns               += 1;
      } catch (e) { /* skip malformed line */ }
    }
  } catch (e) { /* file unreadable */ }

  // Baseline = the session's most-used Opus generation (by turns).
  let baselineGen = DEFAULT_BASELINE_GEN;
  for (const og of opusGens) {
    if ((opusTurns[og] || 0) > (opusTurns[baselineGen] || 0)) baselineGen = og;
  }
  for (const tier of TIERS) stats[tier].baselineCost = baseline[tier][baselineGen];

  return { stats, totalTurns, unknownModels, baselineGen };
}

// Aggregated stats carry no per-line generation, so this prices them at the
// default baseline (Opus 5.5); parseSession's baselineCost is the exact figure.
function asOpusCost(s) {
  return tierCost(s, PRICING[DEFAULT_BASELINE_GEN]);
}

function computeSummary() {
  const sessionFile = findActiveSessionFile();
  if (!sessionFile) return { available: false };

  const { stats, totalTurns, unknownModels } = parseSession(sessionFile);
  if (totalTurns === 0) return { available: false };

  return makeSummary({ stats, totalTurns, unknownModels, sessionFile, pricing: pricingConfig });
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
  getGeneration,
  PRICING,
  TIERS,
  DELEGATED_TIERS
};
