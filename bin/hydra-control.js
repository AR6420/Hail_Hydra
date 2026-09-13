#!/usr/bin/env node
'use strict';

// hydra-control.js — Standalone mode resolver for Hydra's execution modes.
//
// Prints an inspectable fresh policy without starting agents, changing the
// main model, persisting a mode, or writing session memory. Invalid/duplicate
// options and inconsistent ceilings fail explicitly.
//
// Usage:
//   node hydra-control.js mode [name]       Print mode policy
//   node hydra-control.js mode              List all modes
//   node hydra-control.js roles             Print role catalogue

const MODES = {
  balanced: {
    name: 'balanced',
    description: 'Default cost/speed/context routing',
    maxAgents: 2,
    maxDispatches: 6,
    scaleUp: { maxAgents: 4, maxDispatches: 12, when: 'substantial independent work' },
    improvementRounds: 2,
  },
  turbo: {
    name: 'turbo',
    description: 'Favors quality and elapsed time with strong workers and broader research/review',
    maxAgents: 8,
    maxDispatches: 32,
    scaleUp: null,
    improvementRounds: 2,
  },
  economy: {
    name: 'economy',
    description: 'Favors existing designs, inexpensive support, fewer optional passes',
    maxAgents: 1,
    maxDispatches: 3,
    scaleUp: null,
    improvementRounds: 2,
  },
};

const ROLES = [
  { name: 'hydra-scout',         tier: 'cheap', purpose: 'Codebase exploration, file search, map building' },
  { name: 'hydra-runner',        tier: 'cheap', purpose: 'Test/build/lint execution and validation' },
  { name: 'hydra-scribe',        tier: 'cheap', purpose: 'Documentation, READMEs, comments, changelogs' },
  { name: 'hydra-guard',         tier: 'cheap', purpose: 'Security/quality scan after code changes' },
  { name: 'hydra-git',           tier: 'cheap', purpose: 'Git operations: commit, branch, diff, log' },
  { name: 'hydra-sentinel-scan', tier: 'cheap', purpose: 'Fast integration sweep after code changes' },
  { name: 'hydra-preflight',     tier: 'cheap', purpose: 'Environment detection, version probes, dep inventory' },
  { name: 'hydra-coder',         tier: 'mid',   purpose: 'Code writing, implementation, refactoring' },
  { name: 'hydra-analyst',       tier: 'mid',   purpose: 'Debugging, code review, architecture analysis' },
  { name: 'hydra-sentinel',      tier: 'mid',   purpose: 'Deep integration analysis when scan flags issues' },
  { name: 'hydra-architect',     tier: 'mid',   purpose: 'Backend/API/data-flow architecture advisory' },
  { name: 'hydra-researcher',    tier: 'mid',   purpose: 'Public library/API research and verification' },
];

function resolveMode(name, overrides = {}) {
  if (!name || name === 'balanced') name = 'balanced';
  const base = MODES[name];
  if (!base) {
    const valid = Object.keys(MODES).join(', ');
    throw new Error(`Invalid mode '${name}'. Valid modes: ${valid}`);
  }

  const policy = { ...base };

  if (overrides.maxAgents !== undefined) {
    const n = Number(overrides.maxAgents);
    if (!Number.isSafeInteger(n) || n < 1) {
      throw new Error(`--max-agents must be a positive integer, got '${overrides.maxAgents}'`);
    }
    policy.maxAgents = n;
  }
  if (overrides.maxDispatches !== undefined) {
    const n = Number(overrides.maxDispatches);
    if (!Number.isSafeInteger(n) || n < 1) {
      throw new Error(`--max-dispatches must be a positive integer, got '${overrides.maxDispatches}'`);
    }
    policy.maxDispatches = n;
  }

  if (policy.maxAgents > policy.maxDispatches) {
    throw new Error(`Inconsistent ceilings: maxAgents (${policy.maxAgents}) > maxDispatches (${policy.maxDispatches})`);
  }

  return policy;
}

function printMode(name, overrides) {
  try {
    const policy = resolveMode(name, overrides);
    console.log(JSON.stringify(policy, null, 2));
  } catch (err) {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  }
}

function printAllModes() {
  for (const [name, mode] of Object.entries(MODES)) {
    console.log(`  ${name}: ${mode.description} (${mode.maxAgents} workers / ${mode.maxDispatches} dispatches)`);
  }
}

function printRoles() {
  const cheapRoles = ROLES.filter((r) => r.tier === 'cheap');
  const midRoles = ROLES.filter((r) => r.tier === 'mid');

  console.log('Cheap tier:');
  for (const r of cheapRoles) {
    console.log(`  ${r.name.padEnd(22)} ${r.purpose}`);
  }
  console.log('\nMid tier:');
  for (const r of midRoles) {
    console.log(`  ${r.name.padEnd(22)} ${r.purpose}`);
  }
  console.log(`\n${ROLES.length} roles total (tierIsHint: true)`);
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const cmd = args[0];

  if (cmd === 'mode') {
    const name = args[1];
    if (!name) {
      printAllModes();
    } else {
      const overrides = {};
      for (let i = 2; i < args.length; i++) {
        const m = /^--max-agents=(\d+)$/.exec(args[i]);
        if (m) { overrides.maxAgents = m[1]; continue; }
        const d = /^--max-dispatches=(\d+)$/.exec(args[i]);
        if (d) { overrides.maxDispatches = d[1]; continue; }
        console.error(`Unknown option: ${args[i]}`);
        process.exit(1);
      }
      printMode(name, overrides);
    }
  } else if (cmd === 'roles') {
    printRoles();
  } else {
    console.log('Usage:');
    console.log('  hydra-control mode [name] [--max-agents=N] [--max-dispatches=N]');
    console.log('  hydra-control roles');
    process.exit(cmd ? 1 : 0);
  }
}

module.exports = { MODES, ROLES, resolveMode };
