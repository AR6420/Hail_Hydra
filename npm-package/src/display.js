'use strict';

const chalk = require('chalk');

const VERSION = '1.0.0';

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

function showInstallComplete() {
  console.log();
  console.log(chalk.cyan.bold('  🐉 Hail Hydra! 5 heads deployed and ready.'));
  console.log();
  console.log(chalk.gray('  Launch Claude Code to start using the framework.'));
  console.log(chalk.gray('  GitHub: https://github.com/AR6420/Hail_Hydra'));
  console.log();
}

function showStatusTable(globalStatus, localStatus) {
  const divider = chalk.gray('  ' + '─'.repeat(50));

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
      status.references.some((r) => r.installed);

    if (!anyInstalled) {
      console.log(chalk.gray('    (not installed)'));
      continue;
    }

    for (const agent of status.agents) {
      const dot = agent.model === 'Haiku' ? chalk.green('🟢') : chalk.blue('🔵');
      const name = chalk.bold(agent.display.split('—')[0].trim());
      const role = chalk.gray('— ' + agent.display.split('—')[1].trim());
      if (agent.installed) {
        console.log(`    ${dot} ${chalk.green('✔')} ${name} ${role}`);
      } else {
        console.log(`    ${dot} ${chalk.gray('✖')} ${chalk.gray(name)} ${chalk.gray(role + ' (not installed)')}`);
      }
    }

    if (status.skill) {
      console.log(chalk.green('    ✔ SKILL.md'));
    } else {
      console.log(chalk.gray('    ✖ SKILL.md (not installed)'));
    }

    for (const ref of status.references) {
      if (ref.installed) {
        console.log(chalk.green(`    ✔ ${ref.name}`));
      } else {
        console.log(chalk.gray(`    ✖ ${ref.name} (not installed)`));
      }
    }
  }

  console.log();
}

module.exports = { showLogo, showInstallHeader, showFileInstalled, showInstallComplete, showStatusTable, VERSION };
