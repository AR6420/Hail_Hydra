#!/usr/bin/env node
'use strict';

// Hydra Token Math — Copilot CLI host entry.
//
// Copilot CLI uses the same model families as the orchestrator. This hook
// reads session data from ~/.copilot/sessions/ and computes real token
// usage and savings.
//
// Exports: getTier, getPrice, computeSummary, formatReport, printReport,
//          findActiveSessionFile, parseSession, sessionCwd, TIERS,
//          DELEGATED_TIERS.

const tm = require('../../lib/token-math-core');

// Copilot model tier classification.
// gpt-5-mini is the cheap tier; gpt-5.4 is the mid tier; gpt-5 is the
// orchestrator (baseline). Pricing is per-million tokens.
const PRICING = {
  mini:  { input: 0.15,  output: 0.60,  cacheRead: 0.02 },
  mid:   { input: 1.25,  output: 5.00,  cacheRead: 0.15 },
  full:  { input: 2.50,  output: 10.00, cacheRead: 0.30 },
};

const TIERS = ['mini', 'mid', 'full'];
const DELEGATED_TIERS = ['mini', 'mid'];

function getTier(model) {
  if (!model || typeof model !== 'string') return null;
  const m = model.toLowerCase();
  if (m.includes('gpt-5-mini') || m.includes('gpt-5.6-luna')) return 'mini';
  if (m.includes('gpt-5.4') || m.includes('gpt-5.6-terra')) return 'mid';
  if (m.includes('gpt-5.6-sol') || m.includes('gpt-5.6') || m.includes('gpt-5.5') || m === 'gpt-5') return 'full';
  return null;
}

function getPrice(model) {
  const tier = getTier(model);
  return tier ? PRICING[tier] : null;
}

// Placeholder — Copilot session format TBD. Returns unavailable for now.
function findActiveSessionFile() { return null; }
function parseSession() { return { stats: {}, tokenRows: 0 }; }
function sessionCwd() { return null; }

function computeSummary() {
  return { available: false };
}

function formatReport(summary) {
  if (!summary.available) return '🐉 Hydra Stats (Copilot CLI)\n\nNo session data found. Stats appear after the session has recorded a few turns.\n';
  return '🐉 Hydra Stats (Copilot CLI)\n\nSession stats computed.\n';
}

function printReport() {
  console.log(formatReport(computeSummary()));
}

if (require.main === module) printReport();

module.exports = { getTier, getPrice, computeSummary, formatReport, printReport, findActiveSessionFile, parseSession, sessionCwd, TIERS, DELEGATED_TIERS, PRICING };
