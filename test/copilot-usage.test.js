#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const SCRIPT = path.join(ROOT, 'src', 'copilot', 'hydra-usage.js');
const usage = require(SCRIPT);
const SCRATCH = fs.mkdtempSync(path.join(__dirname, 'copilot-usage-'));

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function makeReceipt(label, overrides) {
  const receipt = {
    schemaVersion: 1,
    label,
    workloadId: 'workload-001',
    startingCommit: 'abcdef0',
    mainModel: 'gpt-5.6-terra',
    environmentId: 'win-node16',
    verification: 'passed',
    includesSubagents: true,
    nativeSource: 'manual_imported_native_snapshot',
    elapsedSeconds: 120,
    usage: {
      input: 1000,
      output: 200,
      cached: 50,
    },
    credit: {
      unit: 'ai_credits',
      value: 10,
    },
    context: {
      beforeTokens: 4000,
      afterTokens: 6000,
    },
  };

  if (!overrides) return receipt;

  for (const [key, value] of Object.entries(overrides)) {
    if (key === 'usage') {
      receipt.usage = value === null ? null : { ...receipt.usage, ...value };
      continue;
    }
    if (key === 'credit') {
      receipt.credit = value === null ? null : { ...receipt.credit, ...value };
      continue;
    }
    if (key === 'context') {
      receipt.context = value === null ? null : { ...receipt.context, ...value };
      continue;
    }
    receipt[key] = value;
  }

  return receipt;
}

function writeJsonFile(name, value) {
  const file = path.join(SCRATCH, name);
  fs.writeFileSync(file, JSON.stringify(value, null, 2));
  return file;
}

function writeTextFile(name, value) {
  const file = path.join(SCRATCH, name);
  fs.writeFileSync(file, value);
  return file;
}

function cli(args, expectedStatus = 0) {
  const result = spawnSync(process.execPath, [SCRIPT, ...args], {
    cwd: ROOT,
    encoding: 'utf8',
    timeout: 30000,
  });
  assert.strictEqual(result.status, expectedStatus, result.stdout + result.stderr);
  return result;
}

try {
  const zeroReceipt = makeReceipt('normal', {
    elapsedSeconds: 0,
    usage: { input: 0, output: 0, cached: 0 },
    credit: { unit: 'premium_requests', value: 0 },
    context: { beforeTokens: 0, afterTokens: 0 },
  });
  const validatedZero = usage.validateReceipt(zeroReceipt);
  assert.strictEqual(validatedZero.elapsedSeconds, 0);
  assert.strictEqual(validatedZero.usage.input, 0);
  assert.strictEqual(validatedZero.usage.output, 0);
  assert.strictEqual(validatedZero.usage.cached, 0);
  assert.strictEqual(validatedZero.credit.value, 0);
  assert.strictEqual(validatedZero.context.beforeTokens, 0);
  assert.strictEqual(validatedZero.context.afterTokens, 0);

  const templateResult = cli(['template']);
  const template = JSON.parse(templateResult.stdout);
  assert.strictEqual(template.mainModel, 'replace-with-main-model');
  assert.strictEqual(template.environmentId, 'replace-with-environment');
  assert.strictEqual(template.nativeSource, 'manual_imported_native_snapshot');
  const templateSummary = usage.summarizeReceipt(template);
  assert.strictEqual(templateSummary.kind, 'hydra_usage_report');
  assert.strictEqual(templateSummary.receipt.verification, 'incomplete');
  assert.strictEqual(templateSummary.comparisonReadiness.ready, false);
  assert.deepStrictEqual(templateSummary.comparisonReadiness.reasons.sort(), [
    'subagent_coverage_not_confirmed',
    'verification_incomplete',
  ].sort());
  assert.strictEqual(templateSummary.measurement.automaticObservation, false);
  assert.strictEqual(templateSummary.measurement.sourceType, 'manual_imported_receipt');

  const normalReceipt = makeReceipt('normal');
  const hydraReceipt = makeReceipt('hydra', {
    elapsedSeconds: 90,
    usage: { input: 700, output: 250, cached: 25 },
    credit: { unit: 'ai_credits', value: 8 },
    context: { beforeTokens: 3500, afterTokens: 5000 },
  });

  const normalFile = writeJsonFile('normal.json', normalReceipt);
  const hydraFile = writeJsonFile('hydra.json', hydraReceipt);

  const report = JSON.parse(cli(['report', normalFile]).stdout);
  assert.strictEqual(report.kind, 'hydra_usage_report');
  assert.strictEqual(report.receipt.label, 'normal');
  assert.strictEqual(report.measurement.nativeUiAuthoritative, true);
  assert.strictEqual(report.measurement.usageSource, 'manual_imported_native_snapshot');

  const compared = usage.compareReceipts(clone(normalReceipt), clone(hydraReceipt));
  assert.strictEqual(compared.kind, 'hydra_usage_comparison');
  assert.strictEqual(compared.metrics.elapsedSeconds.savings, 30);
  assert.strictEqual(compared.metrics.elapsedSeconds.savingsPercent, 25);
  assert.strictEqual(compared.metrics.usage.input.savings, 300);
  assert.strictEqual(compared.metrics.usage.input.savingsPercent, 30);
  assert.strictEqual(compared.metrics.usage.output.savings, -50);
  assert.strictEqual(compared.metrics.usage.output.savingsPercent, -25);
  assert.strictEqual(compared.metrics.usage.cached.savings, 25);
  assert.strictEqual(compared.metrics.usage.cached.savingsPercent, 50);
  assert.strictEqual(compared.metrics.credit.savings, 2);
  assert.strictEqual(compared.metrics.credit.savingsPercent, 20);
  assert.strictEqual(compared.context.normal.windowDeltaTokens, 2000);
  assert.strictEqual(compared.context.hydra.windowDeltaTokens, 1500);
  assert.strictEqual(compared.context.crossRun.beforeDifferenceTokens, 500);
  assert.strictEqual(compared.context.crossRun.afterDifferenceTokens, 1000);
  assert.strictEqual(compared.measurement.counterfactualEstimate, false);
  assert.strictEqual(compared.measurement.cachedTokensRolledIntoInput, false);

  const comparedCli = JSON.parse(cli(['compare', normalFile, hydraFile]).stdout);
  assert.strictEqual(comparedCli.metrics.elapsedSeconds.savingsPercent, 25);
  assert.strictEqual(comparedCli.metrics.usage.output.savingsPercent, -25);
  assert.strictEqual(comparedCli.measurement.sourceType, 'manual_imported_receipts');

  const zeroBaseline = usage.compareReceipts(
    makeReceipt('normal', { usage: { cached: 0 } }),
    makeReceipt('hydra', { usage: { cached: 5 } })
  );
  assert.strictEqual(zeroBaseline.metrics.usage.cached.savings, -5);
  assert.strictEqual(zeroBaseline.metrics.usage.cached.savingsPercent, null);
  assert.strictEqual(zeroBaseline.metrics.usage.cached.savingsPercentReason, 'baseline_zero');

  const mixedCreditUnits = usage.compareReceipts(
    makeReceipt('normal'),
    makeReceipt('hydra', { credit: { unit: 'USD', value: 1.25 } })
  );
  assert.strictEqual(mixedCreditUnits.metrics.credit.savings, null);
  assert.strictEqual(mixedCreditUnits.metrics.credit.savingsReason, 'unit_mismatch');
  assert.strictEqual(mixedCreditUnits.metrics.credit.savingsPercentReason, 'unit_mismatch');

  const missingMetrics = usage.compareReceipts(
    makeReceipt('normal', {
      elapsedSeconds: null,
      usage: { output: null, cached: null },
      credit: null,
      context: null,
    }),
    makeReceipt('hydra', {
      elapsedSeconds: 90,
      usage: { output: 25, cached: 10 },
      credit: null,
      context: null,
    })
  );
  assert.strictEqual(missingMetrics.metrics.elapsedSeconds.savings, null);
  assert.strictEqual(missingMetrics.metrics.elapsedSeconds.savingsReason, 'missing_value');
  assert.strictEqual(missingMetrics.metrics.usage.output.savingsPercentReason, 'missing_value');
  assert.strictEqual(missingMetrics.metrics.usage.cached.savingsReason, 'missing_value');
  assert.strictEqual(missingMetrics.metrics.credit.savingsReason, 'missing_value');
  assert.strictEqual(missingMetrics.context.normal, null);
  assert.strictEqual(missingMetrics.context.hydra, null);
  assert.strictEqual(missingMetrics.context.crossRun.afterDifferenceTokens, null);

  const hugeNormal = makeReceipt('normal', {
    elapsedSeconds: Number.MAX_VALUE,
    credit: { unit: 'USD', value: Number.MAX_VALUE },
  });
  const hugeHydra = makeReceipt('hydra', {
    elapsedSeconds: Number.MAX_VALUE / 2,
    credit: { unit: 'USD', value: Number.MAX_VALUE / 4 },
  });
  const hugeNormalFile = writeJsonFile('huge-normal.json', hugeNormal);
  const hugeHydraFile = writeJsonFile('huge-hydra.json', hugeHydra);
  const hugeCompared = JSON.parse(cli(['compare', hugeNormalFile, hugeHydraFile]).stdout);
  assert.ok(Number.isFinite(hugeCompared.metrics.elapsedSeconds.savings));
  assert.strictEqual(hugeCompared.metrics.elapsedSeconds.savingsPercent, 50);
  assert.ok(Number.isFinite(hugeCompared.metrics.credit.savings));
  assert.strictEqual(hugeCompared.metrics.credit.savingsPercent, 75);

  const tinyBaseline = usage.compareReceipts(
    makeReceipt('normal', { elapsedSeconds: Number.MIN_VALUE }),
    makeReceipt('hydra', { elapsedSeconds: 1 })
  );
  assert.strictEqual(tinyBaseline.metrics.elapsedSeconds.savings, -1);
  assert.strictEqual(tinyBaseline.metrics.elapsedSeconds.savingsPercent, null);
  assert.strictEqual(tinyBaseline.metrics.elapsedSeconds.savingsPercentReason, 'percentage_out_of_range');

  assert.throws(
    () => usage.compareReceipts(
      makeReceipt('normal'),
      makeReceipt('hydra', { workloadId: 'workload-002' })
    ),
    /workloadId/
  );
  assert.throws(
    () => usage.compareReceipts(
      makeReceipt('normal', { startingCommit: '1234567' }),
      makeReceipt('hydra', { startingCommit: '1234568' })
    ),
    /startingCommit/
  );
  assert.throws(
    () => usage.compareReceipts(
      makeReceipt('normal', { mainModel: 'replace-with-main-model-a' }),
      makeReceipt('hydra', { mainModel: 'replace-with-main-model-b' })
    ),
    /mainModel/
  );
  assert.throws(
    () => usage.compareReceipts(
      makeReceipt('normal', { environmentId: 'env-a' }),
      makeReceipt('hydra', { environmentId: 'env-b' })
    ),
    /environmentId/
  );

  assert.throws(
    () => usage.compareReceipts(
      makeReceipt('normal', { verification: 'failed' }),
      makeReceipt('hydra')
    ),
    /verification/
  );

  assert.throws(
    () => usage.compareReceipts(
      makeReceipt('normal'),
      makeReceipt('hydra', { includesSubagents: false })
    ),
    /includesSubagents/
  );
  assert.throws(
    () => usage.compareReceipts(
      makeReceipt('normal', { verification: 'incomplete' }),
      makeReceipt('hydra')
    ),
    /verification/
  );
  assert.throws(
    () => usage.compareReceipts(
      makeReceipt('hydra'),
      makeReceipt('hydra')
    ),
    /label normal/
  );
  assert.throws(
    () => usage.compareReceipts(
      makeReceipt('normal'),
      makeReceipt('normal')
    ),
    /label hydra/
  );

  assert.throws(
    () => usage.validateReceipt(makeReceipt('normal', { schemaVersion: 2 })),
    /schemaVersion/
  );
  assert.throws(
    () => usage.validateReceipt(makeReceipt('normal', { usage: { input: -1 } })),
    /usage\.input/
  );
  assert.throws(
    () => usage.validateReceipt(makeReceipt('normal', { usage: { input: NaN } })),
    /usage\.input/
  );
  assert.throws(
    () => usage.validateReceipt(makeReceipt('normal', { usage: { output: Infinity } })),
    /usage\.output/
  );
  assert.throws(
    () => usage.validateReceipt(makeReceipt('normal', { usage: { cached: 1.5 } })),
    /usage\.cached/
  );

  const wrongArity = cli(['compare', normalFile], 1);
  assert.strictEqual(wrongArity.stdout, '');
  assert.match(wrongArity.stderr, /usage:/);

  const secret = 'TOP-SECRET-DO-NOT-ECHO';
  const badFile = writeJsonFile('bad.json', {
    ...makeReceipt('normal'),
    leak: secret,
  });
  const badReport = cli(['report', badFile], 1);
  assert.strictEqual(badReport.stdout, '');
  assert.ok(!badReport.stderr.includes(secret), 'stderr must not echo receipt content');

  const malformedFile = writeTextFile('malformed.json', '{"schemaVersion":1,"note":"TOP-SECRET');
  const malformedReport = cli(['report', malformedFile], 1);
  assert.strictEqual(malformedReport.stdout, '');
  assert.ok(!malformedReport.stderr.includes('TOP-SECRET'), 'stderr must not echo malformed JSON');

  const oversizedFile = writeTextFile('oversized.json', 'x'.repeat(65537));
  const oversizedReport = cli(['report', oversizedFile], 1);
  assert.strictEqual(oversizedReport.stdout, '');
  assert.match(oversizedReport.stderr, /65536/);

  console.log('copilot-usage: all checks passed');
} finally {
  fs.rmSync(SCRATCH, { recursive: true, force: true });
}
