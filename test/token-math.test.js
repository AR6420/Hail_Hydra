#!/usr/bin/env node

// Self-check for hydra-token-math. No framework — run it directly:
//   node test/token-math.test.js
// Exits non-zero on the first failed assertion.
//
// Tests the BUILT artifact (dist/claude/hooks/hydra-token-math.js) — the
// exact file users run — so it also proves the bundler produces a working
// module. Run `npm run build` first (npm test does).

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const tm = require('../dist/claude/hooks/hydra-token-math.js');
const { makeSummary } = require('../src/lib/token-math-core');

const near = (a, b, msg) => assert.ok(Math.abs(a - b) < 1e-9, `${msg}: ${a} != ${b}`);

// --- model → family (tier) mapping ----------------------------------------
assert.strictEqual(tm.getTier('claude-haiku-4-5-20251001'), 'haiku');
assert.strictEqual(tm.getTier('claude-sonnet-4-6'), 'sonnet');
assert.strictEqual(tm.getTier('claude-sonnet-5'), 'sonnet');
assert.strictEqual(tm.getTier('claude-opus-4-8'), 'opus');
assert.strictEqual(tm.getTier('claude-opus-5'), 'opus');
assert.strictEqual(tm.getTier('claude-opus-5[1m]'), 'opus');
assert.strictEqual(tm.getTier('claude-fable-5'), 'fable');
assert.strictEqual(tm.getTier('claude-mythos-5'), 'fable');
assert.strictEqual(tm.getTier('gpt-4'), null);
assert.strictEqual(tm.getTier(''), null);
// No published price → unknown, not Fable.
assert.strictEqual(tm.getTier('claude-mythos-preview'), null);
// Below the lowest known generation → unknown.
assert.strictEqual(tm.getTier('claude-haiku-3-5'), null);

// --- model → generation mapping -------------------------------------------
const gen = (m) => (tm.getGeneration(m) || {}).gen || null;
const GEN_CASES = {
  'claude-haiku-4-5': 'haiku-4.5',
  'claude-haiku-4-5-20251001': 'haiku-4.5',   // date suffix is not a minor
  'claude-haiku-5-5': 'haiku-5.5',
  'claude-haiku-5-7': 'haiku-5.5',            // unknown newer point release
  'claude-sonnet-4-20250514': 'sonnet-4',
  'claude-sonnet-4-6': 'sonnet-4',
  'claude-sonnet-5': 'sonnet-5',
  'claude-sonnet-5-5': 'sonnet-5.5',
  'claude-opus-4-20250514': 'opus-4',
  'claude-opus-4-1': 'opus-4',
  'claude-opus-4-5': 'opus-4.5',
  'claude-opus-4-8': 'opus-4.5',
  'claude-opus-5': 'opus-4.5',
  'claude-opus-5[1m]': 'opus-4.5',
  'claude-opus-5-5': 'opus-5.5',
  'claude-opus-6': 'opus-5.5',
  'claude-fable-5': 'fable-5',
  'claude-mythos-5': 'fable-5',
  'claude-fable-5-1': 'fable-5.1',
  'claude-mythos-5-1': 'fable-5.1',
  'claude-mythos-preview': null,
  'claude-haiku-3-5': null,
  'claude-3-5-haiku-20241022': null
};
for (const [m, g] of Object.entries(GEN_CASES)) assert.strictEqual(gen(m), g, m);

// --- getPrice tracks the generation ---------------------------------------
assert.deepStrictEqual(tm.getPrice('claude-opus-5'), { input: 5, output: 25, cacheWrite: 6.25, cacheWrite1h: 10, cacheRead: 0.50 });
assert.deepStrictEqual(tm.getPrice('claude-opus-5-5'), { input: 4, output: 20, cacheWrite: 5, cacheWrite1h: 8, cacheRead: 0.20 });
assert.deepStrictEqual(tm.getPrice('claude-opus-4-1'), { input: 15, output: 75, cacheWrite: 18.75, cacheWrite1h: 30, cacheRead: 1.50 });
assert.deepStrictEqual(tm.getPrice('claude-sonnet-4-6'), { input: 3, output: 15, cacheWrite: 3.75, cacheWrite1h: 6, cacheRead: 0.30 });
assert.deepStrictEqual(tm.getPrice('claude-sonnet-5'), { input: 2, output: 10, cacheWrite: 2.50, cacheWrite1h: 4, cacheRead: 0.20 });
assert.deepStrictEqual(tm.getPrice('claude-sonnet-5-5'), { input: 2, output: 10, cacheWrite: 2.50, cacheWrite1h: 4, cacheRead: 0.10 });
assert.deepStrictEqual(tm.getPrice('claude-haiku-4-5-20251001'), { input: 1, output: 5, cacheWrite: 1.25, cacheWrite1h: 2, cacheRead: 0.10 });
assert.deepStrictEqual(tm.getPrice('claude-haiku-5-5'), { input: 0.10, output: 0.50, cacheWrite: 0.125, cacheWrite1h: 0.20, cacheRead: 0.01 });
assert.deepStrictEqual(tm.getPrice('claude-fable-5'), { input: 10, output: 50, cacheWrite: 12.5, cacheWrite1h: 20, cacheRead: 1.00 });
assert.deepStrictEqual(tm.getPrice('claude-mythos-5-1'), { input: 10, output: 50, cacheWrite: 12.5, cacheWrite1h: 20, cacheRead: 0.25 });
assert.strictEqual(tm.getPrice('claude-mythos-preview'), null);
assert.strictEqual(tm.getPrice('gpt-4'), null);

// --- tierCost -------------------------------------------------------------
// 1M input at $5, 1M cache_create (5-min write) $6.25, 1M cache_read $0.50,
// 1M output $25 (Opus 4.5).
const cost = tm.tierCost(
  { input: 1e6, output: 1e6, cache_read: 1e6, cache_create: 1e6 },
  tm.PRICING['opus-4.5']
);
near(cost, 5 + 6.25 + 0.5 + 25, 'tierCost');
assert.strictEqual(tm.tierCost({ input: 1, output: 1, cache_read: 0, cache_create: 0 }, null), 0);

// 1-hour cache writes bill at 2x input: 600k at 1.25x + 400k at 2x.
const splitCost = tm.tierCost(
  { input: 0, output: 0, cache_read: 0, cache_create: 1e6, cache_create_1h: 4e5 },
  tm.PRICING['opus-4.5']
);
near(splitCost, 0.6 * 6.25 + 0.4 * 10, '1h-split tierCost');

// A pricing table without cacheWrite keys bills writes at plain input price
// (the pre-surcharge behavior other hosts rely on).
const plainCost = tm.tierCost(
  { input: 0, output: 0, cache_read: 0, cache_create: 1e6 },
  { input: 5, output: 25 }
);
near(plainCost, 5, 'no-surcharge tierCost');

// Fable costs more than every Opus generation it coexists with — the
// property that makes it an escalation rather than a delegation.
const usage = { input: 1e6, output: 1e6, cache_read: 0, cache_create: 0 };
assert.strictEqual(tm.tierCost(usage, tm.PRICING['fable-5']), 2 * tm.tierCost(usage, tm.PRICING['opus-4.5']));
assert.ok(tm.tierCost(usage, tm.PRICING['fable-5.1']) > tm.tierCost(usage, tm.PRICING['opus-5.5']));

// --- parseSession ---------------------------------------------------------
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hydra-test-'));
let fixtureN = 0;
const writeFixture = (lines) => {
  const p = path.join(tmpDir, `session-${fixtureN++}.jsonl`);
  fs.writeFileSync(p, lines.join('\n'));
  return p;
};
const turnU = (model, input, output) => JSON.stringify({
  type: 'assistant',
  message: { model, usage: { input_tokens: input, output_tokens: output, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 } }
});
const turn = (model, out) => turnU(model, 1000, out);

const fixture = writeFixture([
  turn('claude-haiku-4-5', 100),
  turn('claude-opus-5', 200),
  turn('claude-fable-5', 300),
  // 1h-TTL cache-write breakdown must be tallied for the 2x surcharge.
  JSON.stringify({
    type: 'assistant',
    message: { model: 'claude-opus-5', usage: {
      input_tokens: 0, output_tokens: 0, cache_read_input_tokens: 0,
      cache_creation_input_tokens: 500,
      cache_creation: { ephemeral_5m_input_tokens: 200, ephemeral_1h_input_tokens: 300 }
    } }
  }),
  turn('gpt-4', 400),                      // unknown → excluded, not crashed on
  turn('claude-mythos-preview', 400),      // no published price → unknown
  turn('claude-haiku-3-5', 400),           // below known generations → unknown
  '{ not json',                            // malformed → skipped
  JSON.stringify({ type: 'user', message: {} })  // non-assistant → skipped
]);

const { stats, totalTurns, unknownModels, baselineGen } = tm.parseSession(fixture);
assert.strictEqual(totalTurns, 4, 'unknown/malformed/user lines must not count');
assert.strictEqual(stats.haiku.turns, 1);
assert.strictEqual(stats.opus.turns, 2);
assert.strictEqual(stats.fable.turns, 1);
assert.strictEqual(stats.opus.cache_create, 500, 'cache-write total tallied');
assert.strictEqual(stats.opus.cache_create_1h, 300, '1h cache-write subset tallied');
assert.strictEqual(stats.sonnet.turns, 0);
assert.strictEqual(stats.fable.output, 300, 'fable turns must be tallied, not dropped');
assert.deepStrictEqual(Array.from(unknownModels), ['gpt-4', 'claude-mythos-preview', 'claude-haiku-3-5']);
// Per-line cost at each line's generation price.
near(stats.haiku.cost, (1000 * 1 + 100 * 5) / 1e6, 'haiku-4.5 cost');
near(stats.opus.cost, (1000 * 5 + 200 * 25 + 200 * 6.25 + 300 * 10) / 1e6, 'opus-4.5 cost');
near(stats.fable.cost, (1000 * 10 + 300 * 50) / 1e6, 'fable-5 cost');
// Baseline = the session's Opus generation (opus-5 → opus-4.5).
assert.strictEqual(baselineGen, 'opus-4.5');
near(stats.haiku.baselineCost, (1000 * 5 + 100 * 25) / 1e6, 'haiku baseline at opus-4.5');
near(stats.opus.baselineCost, stats.opus.cost, 'opus baseline equals its own cost');

// parseSession on a missing file returns zeroed stats rather than throwing.
const empty = tm.parseSession(path.join(os.tmpdir(), 'hydra-does-not-exist.jsonl'));
assert.strictEqual(empty.totalTurns, 0);
for (const tier of tm.TIERS) assert.strictEqual(empty.stats[tier].turns, 0);

// --- Haiku 5.5 100k band: decided per request, not per session ------------
// Prompt = input + cache_read + cache_creation. 100k exactly stays short.
const band = tm.parseSession(writeFixture([
  turnU('claude-haiku-5-5', 100000, 1000),                // short: 0.01 + 0.0005
  turnU('claude-haiku-5-5', 150000, 1000),                // long:  0.075 + 0.0025
  JSON.stringify({ type: 'assistant', message: { model: 'claude-haiku-5-5', usage: {
    input_tokens: 1000, output_tokens: 0, cache_read_input_tokens: 100000, cache_creation_input_tokens: 0
  } } })                                                  // long via cache: 0.0005 + 0.005
]));
near(band.stats.haiku.cost, 0.0105 + 0.0775 + 0.0055, 'haiku-5.5 per-request band');

// --- baseline generation --------------------------------------------------
// Most-used Opus generation wins (2x opus-4.5 vs 1x opus-5.5).
const mixedOpus = tm.parseSession(writeFixture([
  turnU('claude-opus-4-5', 1000, 0),
  turnU('claude-opus-4-6', 1000, 0),
  turnU('claude-opus-5-5', 1000, 0),
  turnU('claude-haiku-4-5', 1e6, 0)
]));
assert.strictEqual(mixedOpus.baselineGen, 'opus-4.5');
near(mixedOpus.stats.haiku.baselineCost, 5, 'haiku baseline at opus-4.5 input price');
// No Opus in the session → Opus 5.5.
const noOpus = tm.parseSession(writeFixture([turnU('claude-haiku-4-5', 1e6, 0)]));
assert.strictEqual(noOpus.baselineGen, 'opus-5.5');
near(noOpus.stats.haiku.baselineCost, 4, 'haiku baseline at opus-5.5 input price');

// --- end-to-end savings on a current-generation session -------------------
// haiku-5.5 10k/1k    → 0.0015  (baseline opus-5.5 0.06)
// haiku-5.5 150k/1k   → 0.0775  (long band; baseline 0.62)
// sonnet-5.5 20k/2k   → 0.06    (baseline 0.12)
// opus-5.5 10k/1k     → 0.06    (baseline 0.06)
// actual 0.199, baseline 0.86, saved 0.661 (76.9%).
const mixed = tm.parseSession(writeFixture([
  turnU('claude-haiku-5-5', 10000, 1000),
  turnU('claude-haiku-5-5', 150000, 1000),
  turnU('claude-sonnet-5-5', 20000, 2000),
  turnU('claude-opus-5-5', 10000, 1000)
]));
const summary = makeSummary({ ...mixed, sessionFile: 'x', pricing: { PRICING: tm.PRICING, TIERS: tm.TIERS, DELEGATED_TIERS: tm.DELEGATED_TIERS, baselineTier: 'opus-5.5' } });
near(summary.actualCost, 0.199, 'actualCost');
near(summary.hypotheticalCost, 0.86, 'hypotheticalCost');
near(summary.savedUSD, 0.661, 'savedUSD');
near(summary.haikuCost, 0.079, 'haikuCost alias');
assert.strictEqual(summary.delegatedTurns, 3);

// --- delegation semantics -------------------------------------------------
assert.deepStrictEqual(tm.DELEGATED_TIERS, ['haiku', 'sonnet']);
assert.deepStrictEqual(tm.TIERS, ['haiku', 'sonnet', 'opus', 'fable']);
assert.ok(!tm.DELEGATED_TIERS.includes('fable'), 'fable is an escalation, not a delegation');
assert.ok(!tm.DELEGATED_TIERS.includes('opus'), 'opus is the baseline, not a delegation');

console.log('hydra-token-math: all checks passed');
