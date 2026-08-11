'use strict';

const chalk = require('chalk');

// Interactive install flow: host multi-select (detected hosts pre-checked),
// then scope, then a confirm with the agent preview.

async function runPrompts(availableHosts) {
  const inquirer = require('inquirer');

  // ── Prompt 1: Which coding agents ────────────────────────────────────────

  let hostIds = ['claude'];
  if (availableHosts.length > 1) {
    const answer = await inquirer.prompt([{
      type: 'checkbox',
      name: 'hosts',
      message: 'Which coding agents?',
      choices: availableHosts.map((h) => ({
        name: `${h.label}${h.detect() ? chalk.gray('  (detected)') : ''}`,
        value: h.id,
        checked: h.detect(),
      })),
      validate: (picked) => picked.length > 0 || 'Select at least one agent',
    }]);
    hostIds = answer.hosts;
  }

  // ── Prompt 2: Installation scope ─────────────────────────────────────────

  const { scope } = await inquirer.prompt([{
    type: 'list',
    name: 'scope',
    message: 'Where would you like to install?',
    choices: [
      { name: 'Global  — available in all projects', value: 'global', short: 'Global' },
      { name: 'Local   — this project only', value: 'local', short: 'Local' },
      { name: 'Both    — install to both locations', value: 'both', short: 'Both' },
    ],
    default: 0,
  }]);

  // ── Prompt 3: Confirmation with agent preview ────────────────────────────

  console.log();
  console.log(chalk.bold('  This will install 10 Hydra agents + SKILL.md + reference docs.'));
  console.log();
  console.log('  Agents:');

  const agentList = [
    { dot: chalk.green('🟢'), name: 'hydra-scout (cheap tier)         ', role: 'Codebase exploration' },
    { dot: chalk.green('🟢'), name: 'hydra-runner (cheap tier)        ', role: 'Test execution & validation' },
    { dot: chalk.green('🟢'), name: 'hydra-scribe (cheap tier)        ', role: 'Documentation writing' },
    { dot: chalk.green('🟢'), name: 'hydra-guard (cheap tier)         ', role: 'Auto-protection & safety' },
    { dot: chalk.green('🟢'), name: 'hydra-git (cheap tier)           ', role: 'Git operations' },
    { dot: chalk.green('🟢'), name: 'hydra-sentinel-scan (cheap tier) ', role: 'Fast integration sweep' },
    { dot: chalk.green('🟢'), name: 'hydra-preflight (cheap tier)     ', role: 'Environment preflight check' },
    { dot: chalk.blue('🔵'), name: 'hydra-coder (mid tier)           ', role: 'Code implementation' },
    { dot: chalk.blue('🔵'), name: 'hydra-analyst (mid tier)         ', role: 'Code review & debugging' },
    { dot: chalk.blue('🔵'), name: 'hydra-sentinel (mid tier)        ', role: 'Deep integration analysis' },
  ];

  for (const a of agentList) {
    console.log(`    ${a.dot} ${chalk.bold(a.name)} — ${chalk.gray(a.role)}`);
  }

  console.log();

  const { proceed } = await inquirer.prompt([{
    type: 'confirm',
    name: 'proceed',
    message: 'Proceed?',
    default: true,
  }]);

  if (!proceed) {
    console.log(chalk.gray('\n  Installation cancelled.\n'));
    return null;
  }

  console.log();
  return { hostIds, scope };
}

module.exports = { runPrompts };
