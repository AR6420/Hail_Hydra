'use strict';

const chalk = require('chalk');

const VERSION = require('../package.json').version;

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

function showInstallComplete(statusLineConfigured = true) {
  console.log();
  console.log(chalk.cyan.bold('  \uD83D\uDC09 Hail Hydra! Framework deployed and ready.'));
  console.log(chalk.gray('  ' + '\u2500'.repeat(45)));
  console.log(chalk.green(`    \u2714 7 agents installed`));
  console.log(chalk.green(`    \u2714 7 slash commands installed`));
  console.log(chalk.green(`    \u2714 3 hooks registered`));
  if (statusLineConfigured) {
    console.log(chalk.green(`    \u2714 StatusLine configured`));
  } else {
    console.log(chalk.yellow(`    \u26a0 StatusLine skipped (existing config preserved)`));
  }
  console.log(chalk.green(`    \u2714 Version tracked (${VERSION})`));
  console.log();
  console.log(chalk.gray('  Quick start:  /hydra:help'));
  console.log(chalk.gray('  Check status: /hydra:status'));
  console.log(chalk.gray('  GitHub: https://github.com/AR6420/Hail_Hydra'));
  console.log();
}

function showStatusTable(globalStatus, localStatus) {
  const os = require('os');
  const path = require('path');
  const fs = require('fs');

  function fileExists(p) {
    try { fs.accessSync(p, fs.constants.F_OK); return true; } catch { return false; }
  }

  const divider = chalk.gray('  ' + '\u2500'.repeat(50));

  console.log();
  console.log(chalk.bold('  Installation Status'));
  console.log(divider);

  const locations = [
    { label: 'Global  (~/.claude/)', status: globalStatus },
    { label: 'Local   (./.claude/)', status: localStatus },
  ];

  for (const { label, status } of locations) {
    console.log();
    console.log(chalk.bold(`  ${label}`));

    const anyInstalled =
      status.agents.some((a) => a.installed) ||
      status.skill ||
      status.references.some((r) => r.installed) ||
      (status.commands && status.commands.some((c) => c.installed)) ||
      status.version;

    if (!anyInstalled) {
      console.log(chalk.gray('    (not installed)'));
      continue;
    }

    for (const agent of status.agents) {
      const dot = agent.model === 'Haiku' ? chalk.green('\uD83D\uDFE2') : chalk.blue('\uD83D\uDD35');
      const name = chalk.bold(agent.display.split('\u2014')[0].trim());
      const role = chalk.gray('\u2014 ' + agent.display.split('\u2014')[1].trim());
      if (agent.installed) {
        console.log(`    ${dot} ${chalk.green('\u2714')} ${name} ${role}`);
      } else {
        console.log(`    ${dot} ${chalk.gray('\u2716')} ${chalk.gray(name)} ${chalk.gray(role + ' (not installed)')}`);
      }
    }

    if (status.skill) {
      console.log(chalk.green('    \u2714 SKILL.md'));
    } else {
      console.log(chalk.gray('    \u2716 SKILL.md (not installed)'));
    }

    for (const ref of status.references) {
      if (ref.installed) {
        console.log(chalk.green(`    \u2714 ${ref.name}`));
      } else {
        console.log(chalk.gray(`    \u2716 ${ref.name} (not installed)`));
      }
    }

    // Commands
    if (status.commands) {
      for (const cmd of status.commands) {
        if (cmd.installed) {
          console.log(chalk.green(`    \u2714 ${cmd.name}`));
        } else {
          console.log(chalk.gray(`    \u2716 ${cmd.name} (not installed)`));
        }
      }
    }

    // Version
    if (status.version) {
      console.log(chalk.green(`    \u2714 hydra/VERSION (${status.version})`));
    } else {
      console.log(chalk.gray('    \u2716 hydra/VERSION (not installed)'));
    }
  }

  // Global hooks (always ~/.claude/hooks/)
  console.log();
  console.log(chalk.bold('  Global Hooks (~/.claude/hooks/)'));
  const hookKeys = ['hydra-check-update', 'hydra-statusline', 'hydra-auto-guard'];
  for (const key of hookKeys) {
    const dest = path.join(os.homedir(), '.claude', 'hooks', `${key}.js`);
    if (fileExists(dest)) {
      console.log(chalk.green(`    \u2714 ${key}.js`));
    } else {
      console.log(chalk.gray(`    \u2716 ${key}.js (not installed)`));
    }
  }

  console.log();
}

module.exports = { showLogo, showInstallHeader, showFileInstalled, showInstallComplete, showStatusTable, VERSION };
