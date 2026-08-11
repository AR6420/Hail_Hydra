'use strict';

const chalk = require('chalk');

const VERSION = require('../../package.json').version;

// Block-character ASCII art — render in two-tone cyan/green for visual impact
const LOGO_TOP = `
 ██╗  ██╗██╗   ██╗██████╗ ██████╗  █████╗
 ██║  ██║╚██╗ ██╔╝██╔══██╗██╔══██╗██╔══██╗
 ███████║ ╚████╔╝ ██║  ██║██████╔╝███████║`;

const LOGO_BOT = ` ██╔══██║  ╚██╔╝  ██║  ██║██╔══██╗██╔══██║
 ██║  ██║   ██║   ██████╔╝██║  ██║██║  ██║
 ╚═╝  ╚═╝   ╚═╝   ╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═╝`;

function showLogo() {
  console.log(chalk.cyan(LOGO_TOP));
  console.log(chalk.green(LOGO_BOT));
  console.log();
  console.log(chalk.bold.white(`  Hail Hydra v${VERSION}`));
  console.log(chalk.gray('  A multi-headed speculative execution framework for Claude Code.'));
  console.log(chalk.gray('  Inspired by speculative decoding — same quality, 3x faster, 70% cheaper.'));
  console.log();
}

function showInstallHeader(label) {
  console.log(chalk.bold(`  Installing to ${label}...`));
  console.log();
}

function showFileInstalled(displayName, success, errorMsg) {
  if (success) {
    console.log(chalk.green(`    ✔ Installed ${displayName}`));
  } else {
    console.log(chalk.red(`    ✖ Failed: ${displayName} — ${errorMsg}`));
  }
}

function showInstallComplete(statusLineConfigured = true, notes = null) {
  console.log();
  console.log(chalk.cyan.bold('  \uD83D\uDC09 Hail Hydra! Framework deployed and ready.'));
  console.log(chalk.gray('  ' + '\u2500'.repeat(45)));
  console.log(chalk.green(`    \u2714 10 agents installed`));
  console.log(chalk.green(`    \u2714 12 slash commands installed`));
  console.log(chalk.green(`    \u2714 Hooks registered (auto-guard, update check, notify)`));
  if (statusLineConfigured) {
    console.log(chalk.green(`    \u2714 StatusLine configured`));
  } else {
    console.log(chalk.yellow(`    \u26a0 StatusLine skipped (existing config preserved)`));
  }
  console.log(chalk.green(`    \u2714 Sentinel pipeline active`));
  console.log(chalk.green(`    \u2714 Codebase map ready (run /hydra:map rebuild)`));
  console.log(chalk.green(`    \u2714 Version tracked (${VERSION})`));
  console.log();
  if (notes && notes.length) {
    for (const note of notes) console.log(chalk.gray(`  ${note}`));
  } else {
    console.log(chalk.gray('  Quick start:  /hydra:help'));
    console.log(chalk.gray('  Build map:    /hydra:map rebuild'));
    console.log(chalk.gray('  Check status: /hydra:status'));
  }
  console.log(chalk.gray('  GitHub: https://github.com/AR6420/Hail_Hydra'));
  console.log();
}

module.exports = { showLogo, showInstallHeader, showFileInstalled, showInstallComplete, VERSION };
