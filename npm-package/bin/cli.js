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
const { program }     = require('commander');
const { showLogo }    = require('../src/display');
const installer       = require('../src/installer');
const { runPrompts }  = require('../src/prompts');
const { VERSION }     = require('../src/display');

// ── CLI definition ────────────────────────────────────────────────────────────
program
  .name('hail-hydra-cc')
  .description('Multi-headed speculative execution framework for Claude Code')
  .version(VERSION, '-v, --version', 'Output the current version')
  .option('--global',    'Skip prompts, install to ~/.claude/ (all projects)')
  .option('--local',     'Skip prompts, install to ./.claude/ (this project)')
  .option('--both',      'Skip prompts, install to both locations')
  .option('--uninstall', 'Remove all Hydra files from global and local locations')
  .option('--status',    "Show what's currently installed and where")
  .addHelpText('after', `
Examples:
  npx hail-hydra-cc              Interactive installation (recommended)
  npx hail-hydra-cc --global     Install globally — no prompts
  npx hail-hydra-cc --local      Install locally  — no prompts
  npx hail-hydra-cc --both       Install both     — no prompts
  npx hail-hydra-cc --status     Check installation status
  npx hail-hydra-cc --uninstall  Remove all Hydra files

What gets installed:
  ~/.claude/agents/              7 Hydra agent .md files
  ~/.claude/hydra/SKILL.md       Core framework instructions
  ~/.claude/hydra/references/    Model capabilities & routing guides
`);

// ── Main action ───────────────────────────────────────────────────────────────
program.action(async (options) => {
  showLogo();

  try {
    if (options.status) {
      await installer.showStatus();
      return;
    }

    if (options.uninstall) {
      await installer.runUninstall({ interactive: true });
      return;
    }

    if (options.global) {
      await installer.runInstall('global');
      return;
    }

    if (options.local) {
      await installer.runInstall('local');
      return;
    }

    if (options.both) {
      await installer.runInstall('both');
      return;
    }

    // No flags — run interactive prompts
    const scope = await runPrompts();
    if (scope) {
      await installer.runInstall(scope);
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
