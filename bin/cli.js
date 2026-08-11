#!/usr/bin/env node
'use strict';

// ── Node version guard ────────────────────────────────────────────────────────
const nodeMajor = parseInt(process.version.slice(1).split('.')[0], 10);
if (nodeMajor < 16) {
  process.stderr.write(
    `\nError: hail-hydra-cc requires Node.js 16 or higher.\n` +
    `You have ${process.version}. Please upgrade: https://nodejs.org\n\n`
  );
  process.exit(1);
}

// ── Imports ───────────────────────────────────────────────────────────────────
const { program } = require('commander');
const { showLogo, VERSION } = require('../src/installer/display');
const installer = require('../src/installer');
const { runPrompts } = require('../src/installer/prompts');

// ── CLI definition ────────────────────────────────────────────────────────────
program
  .name('hail-hydra-cc')
  .description('Multi-headed speculative execution framework for AI coding CLIs')
  .version(VERSION, '-v, --version', 'Output the current version')
  .option('--agent <list>', 'Comma-separated target agents: claude,gemini,codex')
  .option('--claude', 'Target Claude Code (alias for --agent=claude)')
  .option('--gemini', 'Target Gemini CLI (alias for --agent=gemini)')
  .option('--codex', 'Target Codex CLI (alias for --agent=codex)')
  .option('--all', 'Target every detected agent')
  .option('--global', 'Skip prompts, install for all projects')
  .option('--local', 'Skip prompts, install for this project only')
  .option('--both', 'Skip prompts, install to both locations')
  .option('--yes', 'Non-interactive: accept defaults (requires an agent selection on fresh installs)')
  .option('--dry-run', 'Print planned writes without writing anything')
  .option('--config-dir <path>', 'Override the config directory (single agent only)')
  .option('--uninstall', 'Remove all Hydra files')
  .option('--status', "Show what's currently installed and where")
  .addHelpText('after', `
Examples:
  npx hail-hydra-cc                          Interactive installation (recommended)
  npx hail-hydra-cc --global                 Install for Claude Code — no prompts
  npx hail-hydra-cc --agent=claude --global  Same, explicit agent
  npx hail-hydra-cc --all --global --yes     Every detected agent, non-interactive
  npx hail-hydra-cc --dry-run --all          Preview what would be written
  npx hail-hydra-cc --status                 Check installation status
  npx hail-hydra-cc --uninstall              Remove all Hydra files
`);

// Resolve the agent selection from flags. Returns null when no agent flag was
// given (interactive → prompt; non-interactive → claude for v2 compatibility).
function resolveAgentFlags(options) {
  const ids = [];
  if (options.agent) {
    for (const raw of String(options.agent).split(',')) {
      const id = raw.trim().toLowerCase();
      if (id) ids.push(id);
    }
  }
  for (const id of ['claude', 'gemini', 'codex']) {
    if (options[id] && !ids.includes(id)) ids.push(id);
  }
  if (options.all) {
    for (const host of installer.availableHosts()) {
      if (host.detect() && !ids.includes(host.id)) ids.push(host.id);
    }
    if (ids.length === 0) ids.push('claude'); // nothing detected — sane default
  }
  return ids.length ? ids : null;
}

// ── Main action ───────────────────────────────────────────────────────────────
program.action(async (options) => {
  showLogo();

  try {
    const agentIds = resolveAgentFlags(options);
    const scopeFlag =
      options.global ? 'global' :
      options.local ? 'local' :
      options.both ? 'both' : null;

    if (options.status) {
      await installer.showStatus({ hostIds: agentIds, configDirOverride: options.configDir || null });
      return;
    }

    if (options.uninstall) {
      await installer.runUninstall({
        hostIds: agentIds,
        configDirOverride: options.configDir || null,
        interactive: !options.yes,
      });
      return;
    }

    if (options.dryRun) {
      await installer.runInstall({
        hostIds: agentIds || ['claude'],
        scope: scopeFlag || 'global',
        configDirOverride: options.configDir || null,
        dryRun: true,
      });
      return;
    }

    // Non-interactive paths: a scope flag or --yes skips prompts.
    if (scopeFlag || options.yes) {
      if (options.yes && !scopeFlag && !agentIds) {
        // BMAD-style contract: --yes alone on a fresh install is ambiguous.
        throw new Error('--yes requires an agent selection (--agent=..., --claude/--gemini/--codex, or --all)');
      }
      await installer.runInstall({
        hostIds: agentIds || ['claude'], // v2 compatibility: bare --global targets Claude Code
        scope: scopeFlag || 'global',
        configDirOverride: options.configDir || null,
        nonInteractive: true,
      });
      return;
    }

    // No flags — interactive prompts.
    const answer = await runPrompts(installer.availableHosts());
    if (answer) {
      await installer.runInstall({
        hostIds: agentIds || answer.hostIds,
        scope: answer.scope,
        configDirOverride: options.configDir || null,
      });
    }
  } catch (err) {
    const chalk = require('chalk');

    if (err.code === 'EACCES') {
      console.error(
        chalk.red('\n  ✖ Permission denied.') +
        chalk.gray(' Try:\n') +
        chalk.gray('    sudo npx hail-hydra-cc --global\n') +
        chalk.gray('    npx hail-hydra-cc --local  (no sudo needed)\n')
      );
    } else if (
      err.message &&
      (err.message.includes('User force closed') || err.message.includes('canceled'))
    ) {
      console.log(chalk.gray('\n  Installation cancelled.\n'));
    } else {
      console.error(chalk.red(`\n  ✖ Error: ${err.message}\n`));
      if (process.env.DEBUG) console.error(err.stack);
    }

    process.exit(1);
  }
});

program.parseAsync(process.argv);
