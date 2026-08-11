'use strict';

// Hydra token-math core — host-agnostic cost/savings math.
// Knows nothing about where session logs live or what models are called;
// adapters supply {stats, totalTurns, unknownModels} plus a pricing config:
//   { PRICING: {tier: {input, output}}, TIERS, DELEGATED_TIERS, baselineTier }
// Cache-read is billed at 10% of the tier's input price on every host we
// support (Anthropic / Google / OpenAI all publish ~this ratio; per-host
// tables may override via price.cacheRead when the ratio differs).

function tierCost(s, p) {
  if (!p) return 0;
  const cacheReadRate = typeof p.cacheRead === 'number' ? p.cacheRead : p.input * 0.1;
  const inputCost     = ((s.input + s.cache_create) * p.input) / 1_000_000;
  const cacheReadCost = (s.cache_read * cacheReadRate) / 1_000_000;
  const outputCost    = (s.output * p.output) / 1_000_000;
  return inputCost + cacheReadCost + outputCost;
}

function emptyStats(TIERS) {
  const stats = {};
  for (const tier of TIERS) {
    stats[tier] = { input: 0, output: 0, cache_read: 0, cache_create: 0, turns: 0 };
  }
  return stats;
}

// Build the full summary object from parsed per-tier stats.
// Returns the same shape hydra-token-math has always exported, with
// `${tier}Cost` aliases generated for every tier so existing consumers
// (statusline, /hydra:stats) keep working unmodified.
function makeSummary({ stats, totalTurns, unknownModels, sessionFile, pricing }) {
  const { PRICING, TIERS, DELEGATED_TIERS, baselineTier } = pricing;

  const costs = {};
  let actualCost = 0;
  let hypotheticalCost = 0;
  for (const tier of TIERS) {
    costs[tier] = tierCost(stats[tier], PRICING[tier]);
    actualCost += costs[tier];
    hypotheticalCost += tierCost(stats[tier], PRICING[baselineTier]);
  }

  const savedUSD = Math.max(0, hypotheticalCost - actualCost);
  const savedPct = hypotheticalCost > 0 ? (savedUSD / hypotheticalCost) * 100 : 0;

  const delegatedTurns = DELEGATED_TIERS.reduce((n, t) => n + stats[t].turns, 0);
  const delegationRate = totalTurns > 0 ? (delegatedTurns / totalTurns) * 100 : 0;

  const summary = {
    available: true,
    sessionFile,
    totalTurns,
    stats,
    costs,
    actualCost, hypotheticalCost,
    savedUSD, savedPct,
    delegatedTurns, delegationRate,
    unknownModels,
  };
  // Named aliases kept for existing consumers (/hydra:stats reads these).
  for (const tier of TIERS) summary[`${tier}Cost`] = costs[tier];
  return summary;
}

module.exports = { tierCost, emptyStats, makeSummary };
