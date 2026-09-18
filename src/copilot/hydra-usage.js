#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const SCHEMA_VERSION = 1;
const MAX_FILE_BYTES = 64 * 1024;
const USAGE =
  'usage: hydra-usage.js report <receipt.json> | compare <normal.json> <hydra.json> | template';

const LABELS = new Set(['normal', 'hydra']);
const VERIFICATIONS = new Set(['passed', 'failed', 'incomplete']);
const CREDIT_UNITS = new Set(['ai_credits', 'premium_requests', 'USD']);

const WORKLOAD_ID_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;
const COMMIT_RE = /^[A-Fa-f0-9]{7,40}$/;
const MODEL_RE = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const ID_RE = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/;

function isPlainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function requirePlainObject(value, fieldName) {
  if (!isPlainObject(value)) throw new Error(fieldName + ' must be an object');
  return value;
}

function requireNullablePlainObject(value, fieldName) {
  if (value === null) return null;
  if (!isPlainObject(value)) throw new Error(fieldName + ' must be an object or null');
  return value;
}

function rejectUnsupportedFields(value, allowedFields, fieldName) {
  const allowed = new Set(allowedFields);
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) throw new Error(fieldName + ' has unsupported fields');
  }
}

function requireBoolean(value, fieldName) {
  if (typeof value !== 'boolean') throw new Error(fieldName + ' must be a boolean');
  return value;
}

function requireEnum(value, allowedValues, fieldName) {
  if (typeof value !== 'string' || !allowedValues.has(value)) {
    throw new Error(fieldName + ' is invalid');
  }
  return value;
}

function requirePattern(value, pattern, fieldName) {
  if (typeof value !== 'string' || !pattern.test(value)) {
    throw new Error(fieldName + ' is invalid');
  }
  return value;
}

function validateNonNegativeIntegerOrNull(value, fieldName) {
  if (value === null) return null;
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(fieldName + ' must be a non-negative integer or null');
  }
  return value;
}

function validateNonNegativeNumberOrNull(value, fieldName) {
  if (value === null) return null;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new Error(fieldName + ' must be a non-negative number or null');
  }
  return value === 0 ? 0 : value;
}

function normalizeNegativeZero(value) {
  return Object.is(value, -0) ? 0 : value;
}

function normalizeComputedFinite(value) {
  if (!Number.isFinite(value)) return null;
  if (value === 0 || Number.isSafeInteger(value) || Math.abs(value) > Number.MAX_SAFE_INTEGER) {
    return normalizeNegativeZero(value);
  }
  return normalizeNegativeZero(Number(value.toPrecision(15)));
}

function subtractOrNull(left, right) {
  if (left === null || right === null) return null;
  return normalizeNegativeZero(left - right);
}

function computeDifference(normalValue, hydraValue) {
  const difference = normalValue - hydraValue;
  if (!Number.isFinite(difference)) return { value: null, reason: 'difference_out_of_range' };
  return { value: normalizeComputedFinite(difference), reason: null };
}

function computeSavingsPercent(normalValue, hydraValue) {
  if (normalValue === 0) return { value: null, reason: 'baseline_zero' };

  const ratio = hydraValue / normalValue;
  if (!Number.isFinite(ratio)) return { value: null, reason: 'percentage_out_of_range' };

  const scaled = 1 - ratio;
  if (!Number.isFinite(scaled) || Math.abs(scaled) > Number.MAX_VALUE / 100) {
    return { value: null, reason: 'percentage_out_of_range' };
  }

  const percent = scaled * 100;
  if (!Number.isFinite(percent)) return { value: null, reason: 'percentage_out_of_range' };
  return { value: normalizeComputedFinite(percent), reason: null };
}

function buildTemplateReceipt() {
  return {
    schemaVersion: SCHEMA_VERSION,
    label: 'normal',
    workloadId: 'replace-with-workload',
    startingCommit: '0123456789abcdef',
    mainModel: 'replace-with-main-model',
    environmentId: 'replace-with-environment',
    verification: 'incomplete',
    includesSubagents: false,
    nativeSource: 'manual_imported_native_snapshot',
    elapsedSeconds: null,
    usage: {
      input: null,
      output: null,
      cached: null,
    },
    credit: {
      unit: 'ai_credits',
      value: null,
    },
    context: {
      beforeTokens: null,
      afterTokens: null,
    },
  };
}

// validateObject walks an ordered field spec once: plain-object/null check,
// then reject unsupported fields, then validate each field in spec order.
// `name` doubles as the object-type label ('receipt must be an object') and,
// for nested objects, the field-path prefix ('usage.input'); the root spec
// ('receipt') keeps bare field names to match the original per-field errors.
function validateObject(value, name, nullable, spec) {
  if (nullable) {
    value = requireNullablePlainObject(value, name);
    if (value === null) return null;
  } else {
    value = requirePlainObject(value, name);
  }
  const fields = Object.keys(spec);
  rejectUnsupportedFields(value, fields, name);
  const prefix = name === 'receipt' ? '' : `${name}.`;
  const result = {};
  for (const field of fields) {
    result[field] = spec[field](value[field], `${prefix}${field}`);
  }
  return result;
}

const USAGE_SPEC = {
  input: (v, fieldPath) => validateNonNegativeIntegerOrNull(v, fieldPath),
  output: (v, fieldPath) => validateNonNegativeIntegerOrNull(v, fieldPath),
  cached: (v, fieldPath) => validateNonNegativeIntegerOrNull(v, fieldPath),
};

const CREDIT_SPEC = {
  unit: (v, fieldPath) => requireEnum(v, CREDIT_UNITS, fieldPath),
  value: (v, fieldPath) => validateNonNegativeNumberOrNull(v, fieldPath),
};

const CONTEXT_SPEC = {
  beforeTokens: (v, fieldPath) => validateNonNegativeIntegerOrNull(v, fieldPath),
  afterTokens: (v, fieldPath) => validateNonNegativeIntegerOrNull(v, fieldPath),
};

const ROOT_SPEC = {
  schemaVersion: (v) => {
    if (v !== SCHEMA_VERSION) throw new Error('unsupported schemaVersion');
    return SCHEMA_VERSION;
  },
  label: (v, fieldPath) => requireEnum(v, LABELS, fieldPath),
  workloadId: (v, fieldPath) => requirePattern(v, WORKLOAD_ID_RE, fieldPath),
  startingCommit: (v, fieldPath) => requirePattern(v, COMMIT_RE, fieldPath).toLowerCase(),
  mainModel: (v, fieldPath) => requirePattern(v, MODEL_RE, fieldPath),
  environmentId: (v, fieldPath) => requirePattern(v, ID_RE, fieldPath),
  verification: (v, fieldPath) => requireEnum(v, VERIFICATIONS, fieldPath),
  includesSubagents: (v, fieldPath) => requireBoolean(v, fieldPath),
  nativeSource: (v, fieldPath) => requirePattern(v, ID_RE, fieldPath),
  elapsedSeconds: (v, fieldPath) => validateNonNegativeNumberOrNull(v, fieldPath),
  usage: (v) => validateObject(v, 'usage', false, USAGE_SPEC),
  credit: (v) => validateObject(v, 'credit', true, CREDIT_SPEC),
  context: (v) => validateObject(v, 'context', true, CONTEXT_SPEC),
};

function validateReceipt(receipt) {
  return validateObject(receipt, 'receipt', false, ROOT_SPEC);
}

function deriveContext(context) {
  if (context === null) return null;
  return {
    beforeTokens: context.beforeTokens,
    afterTokens: context.afterTokens,
    windowDeltaTokens: subtractOrNull(context.afterTokens, context.beforeTokens),
  };
}

function comparisonReadiness(receipt) {
  const reasons = [];
  if (receipt.verification === 'failed') reasons.push('verification_failed');
  if (receipt.verification === 'incomplete') reasons.push('verification_incomplete');
  if (!receipt.includesSubagents) reasons.push('subagent_coverage_not_confirmed');
  return {
    ready: reasons.length === 0,
    reasons,
  };
}

function summarizeReceipt(receipt) {
  const validated = validateReceipt(receipt);
  return {
    kind: 'hydra_usage_report',
    schemaVersion: SCHEMA_VERSION,
    receipt: validated,
    measurement: {
      sourceType: 'manual_imported_receipt',
      nativeUiAuthoritative: true,
      automaticObservation: false,
      elapsedSecondsSource: validated.elapsedSeconds === null ? 'unavailable' : 'manual_user_timed_wallclock',
      usageSource: 'manual_imported_native_snapshot',
      cachedTokensRolledIntoInput: false,
      contextReportedAsSavings: false,
      contextComparisonBasis: 'point_in_time_host_tokens',
    },
    comparisonReadiness: comparisonReadiness(validated),
    derivedContext: deriveContext(validated.context),
  };
}

function compareMetric(normalValue, hydraValue, unit) {
  const result = {
    unit,
    normal: normalValue,
    hydra: hydraValue,
    savings: null,
    savingsReason: null,
    savingsPercent: null,
    savingsPercentReason: null,
  };

  if (normalValue === null || hydraValue === null) {
    result.savingsReason = 'missing_value';
    result.savingsPercentReason = 'missing_value';
    return result;
  }

  const difference = computeDifference(normalValue, hydraValue);
  if (difference.reason) {
    result.savingsReason = difference.reason;
    result.savingsPercentReason = difference.reason;
    return result;
  }
  result.savings = difference.value;

  const percent = computeSavingsPercent(normalValue, hydraValue);
  if (percent.reason) {
    result.savingsPercentReason = percent.reason;
    return result;
  }

  result.savingsPercent = percent.value;
  return result;
}

function compareCredit(normalCredit, hydraCredit) {
  const result = {
    unit: null,
    normal: normalCredit,
    hydra: hydraCredit,
    savings: null,
    savingsReason: null,
    savingsPercent: null,
    savingsPercentReason: null,
  };

  if (normalCredit === null || hydraCredit === null) {
    result.savingsReason = 'missing_value';
    result.savingsPercentReason = 'missing_value';
    return result;
  }

  if (normalCredit.unit !== hydraCredit.unit) {
    result.savingsReason = 'unit_mismatch';
    result.savingsPercentReason = 'unit_mismatch';
    return result;
  }

  const metric = compareMetric(normalCredit.value, hydraCredit.value, normalCredit.unit);
  return {
    unit: normalCredit.unit,
    normal: normalCredit,
    hydra: hydraCredit,
    savings: metric.savings,
    savingsReason: metric.savingsReason,
    savingsPercent: metric.savingsPercent,
    savingsPercentReason: metric.savingsPercentReason,
  };
}

function requireComparableReceipt(receipt, expectedLabel, name) {
  if (receipt.label !== expectedLabel) throw new Error(name + ' receipt must have label ' + expectedLabel);
  if (receipt.verification !== 'passed') throw new Error(name + ' receipt verification must be passed');
  if (!receipt.includesSubagents) throw new Error(name + ' receipt must confirm includesSubagents');
}

function requireMatchingMetadata(normal, hydra) {
  for (const field of ['workloadId', 'startingCommit', 'mainModel', 'environmentId']) {
    if (normal[field] !== hydra[field]) throw new Error('receipt metadata mismatch: ' + field);
  }
}

function compareReceipts(normalReceipt, hydraReceipt) {
  const normal = validateReceipt(normalReceipt);
  const hydra = validateReceipt(hydraReceipt);

  requireComparableReceipt(normal, 'normal', 'normal');
  requireComparableReceipt(hydra, 'hydra', 'hydra');
  requireMatchingMetadata(normal, hydra);

  return {
    kind: 'hydra_usage_comparison',
    schemaVersion: SCHEMA_VERSION,
    workloadId: normal.workloadId,
    startingCommit: normal.startingCommit,
    mainModel: normal.mainModel,
    environmentId: normal.environmentId,
    receipts: {
      normal: { nativeSource: normal.nativeSource },
      hydra: { nativeSource: hydra.nativeSource },
    },
    measurement: {
      sourceType: 'manual_imported_receipts',
      nativeUiAuthoritative: true,
      automaticObservation: false,
      counterfactualEstimate: false,
      resultsDependOnMeasurementQuality: true,
      elapsedSecondsSource: 'manual_user_timed_wallclock_when_present',
      usageSource: 'manual_imported_native_snapshot',
      cachedTokensRolledIntoInput: false,
      contextReportedAsSavings: false,
      contextComparisonBasis: 'point_in_time_host_tokens',
    },
    formula: {
      savingsPercent: '(normal - hydra) / normal * 100',
    },
    metrics: {
      elapsedSeconds: compareMetric(normal.elapsedSeconds, hydra.elapsedSeconds, 'seconds'),
      usage: {
        input: compareMetric(normal.usage.input, hydra.usage.input, 'tokens'),
        output: compareMetric(normal.usage.output, hydra.usage.output, 'tokens'),
        cached: compareMetric(normal.usage.cached, hydra.usage.cached, 'tokens'),
      },
      credit: compareCredit(normal.credit, hydra.credit),
    },
    context: {
      comparisonBasis: 'point_in_time_host_tokens',
      reportedAsSavings: false,
      normal: deriveContext(normal.context),
      hydra: deriveContext(hydra.context),
      crossRun: {
        beforeDifferenceTokens: subtractOrNull(
          normal.context ? normal.context.beforeTokens : null,
          hydra.context ? hydra.context.beforeTokens : null
        ),
        afterDifferenceTokens: subtractOrNull(
          normal.context ? normal.context.afterTokens : null,
          hydra.context ? hydra.context.afterTokens : null
        ),
      },
    },
  };
}

function stripBom(text) {
  return text.charCodeAt(0) === 0xFEFF ? text.slice(1) : text;
}

function readReceiptFile(filePath) {
  const resolved = path.resolve(filePath);
  let stats;
  try {
    stats = fs.lstatSync(resolved);
  } catch (error) {
    if (error && error.code === 'ENOENT') throw new Error('receipt path must be a regular file');
    throw error;
  }

  if (stats.isSymbolicLink()) throw new Error('receipt path must not be a symlink');
  if (!stats.isFile()) throw new Error('receipt path must be a regular file');
  if (stats.size > MAX_FILE_BYTES) throw new Error('receipt file exceeds 65536 bytes');

  const text = fs.readFileSync(resolved, 'utf8');
  try {
    return JSON.parse(stripBom(text));
  } catch (error) {
    if (error instanceof SyntaxError) throw new Error('receipt file must contain valid JSON');
    throw error;
  }
}

function writeJson(value) {
  process.stdout.write(JSON.stringify(value, null, 2) + '\n');
}

function main(argv) {
  const args = argv.slice(2);
  if (args.length === 0) throw new Error(USAGE);

  const command = args[0];

  if (command === 'template') {
    if (args.length !== 1) throw new Error(USAGE);
    writeJson(buildTemplateReceipt());
    return;
  }

  if (command === 'report') {
    if (args.length !== 2) throw new Error(USAGE);
    writeJson(summarizeReceipt(readReceiptFile(args[1])));
    return;
  }

  if (command === 'compare') {
    if (args.length !== 3) throw new Error(USAGE);
    writeJson(compareReceipts(readReceiptFile(args[1]), readReceiptFile(args[2])));
    return;
  }

  throw new Error(USAGE);
}

if (require.main === module) {
  try {
    main(process.argv);
  } catch (error) {
    process.stderr.write((error && error.message ? error.message : 'hydra-usage failed') + '\n');
    process.exit(1);
  }
}

module.exports = {
  validateReceipt,
  summarizeReceipt,
  compareReceipts,
};
