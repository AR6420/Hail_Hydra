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

// --- model → tier mapping -------------------------------------------------
// The whole point of keying PRICING by tier: point releases must map without
// touching the pricing table.
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

// --- getPrice tracks getTier ---------------------------------------------
// Regression: the old prefix-keyed table returned null for every 5-series ID.
assert.deepStrictEqual(tm.getPrice('claude-opus-5'), { input: 5, output: 25 });
assert.deepStrictEqual(tm.getPrice('claude-sonnet-5'), { input: 3, output: 15 });
assert.deepStrictEqual(tm.getPrice('claude-fable-5'), { input: 10, output: 50 });
assert.strictEqual(tm.getPrice('gpt-4'), null);

// --- tierCost -------------------------------------------------------------
// 1M input + 1M cache_create at $5, 1M cache_read at 10% of $5, 1M output at $25.
const cost = tm.tierCost(
  { input: 1e6, output: 1e6, cache_read: 1e6, cache_create: 1e6 },
  tm.PRICING.opus
);
assert.ok(Math.abs(cost - (5 + 5 + 0.5 + 25)) < 1e-9, `tierCost = ${cost}`);
assert.strictEqual(tm.tierCost({ input: 1, output: 1, cache_read: 0, cache_create: 0 }, null), 0);

// Fable costs exactly 2x Opus for identical usage — the property that makes it
// an escalation rather than a delegation.
const usage = { input: 1e6, output: 1e6, cache_read: 0, cache_create: 0 };
assert.strictEqual(tm.tierCost(usage, tm.PRICING.fable), 2 * tm.tierCost(usage, tm.PRICING.opus));

// --- parseSession ---------------------------------------------------------
const turn = (model, out) => JSON.stringify({
  type: 'assistant',
  message: { model, usage: { input_tokens: 1000, output_tokens: out, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 } }
});

const fixture = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'hydra-test-')), 'session.jsonl');
fs.writeFileSync(fixture, [
  turn('claude-haiku-4-5', 100),
  turn('claude-opus-5', 200),
  turn('claude-fable-5', 300),
  turn('gpt-4', 400),                      // unknown → excluded, not crashed on
  '{ not json',                            // malformed → skipped
  JSON.stringify({ type: 'user', message: {} })  // non-assistant → skipped
].join('\n'));

const { stats, totalTurns, unknownModels } = tm.parseSession(fixture);
assert.strictEqual(totalTurns, 3, 'unknown/malformed/user lines must not count');
assert.strictEqual(stats.haiku.turns, 1);
assert.strictEqual(stats.opus.turns, 1);
assert.strictEqual(stats.fable.turns, 1);
assert.strictEqual(stats.sonnet.turns, 0);
assert.strictEqual(stats.fable.output, 300, 'fable turns must be tallied, not dropped');
assert.deepStrictEqual(Array.from(unknownModels), ['gpt-4']);

// parseSession on a missing file returns zeroed stats rather than throwing.
const empty = tm.parseSession(path.join(os.tmpdir(), 'hydra-does-not-exist.jsonl'));
assert.strictEqual(empty.totalTurns, 0);
for (const tier of tm.TIERS) assert.strictEqual(empty.stats[tier].turns, 0);

// --- delegation semantics -------------------------------------------------
assert.deepStrictEqual(tm.DELEGATED_TIERS, ['haiku', 'sonnet']);
assert.ok(!tm.DELEGATED_TIERS.includes('fable'), 'fable is an escalation, not a delegation');
assert.ok(!tm.DELEGATED_TIERS.includes('opus'), 'opus is the baseline, not a delegation');

console.log('hydra-token-math: all checks passed');
