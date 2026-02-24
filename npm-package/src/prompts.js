'use strict';

const chalk = require('chalk');

async function runPrompts() {
  const inquirer = require('inquirer');

  // ── Prompt 1: Installation scope ─────────────────────────────────────────

  const { scope } = await inquirer.prompt([
    {
      type:    'list',
      name:    'scope',
      message: 'Where would you like to install?',
      choices: [
        {
          name:  'Global  (~/.claude/) — available in all projects',
          value: 'global',
          short: 'Global',
        },
        {
          name:  'Local   (./.claude/) — this project only',
          value: 'local',
          short: 'Local',
        },
        {
          name:  'Both    — install to both locations',
          value: 'both',
          short: 'Both',
        },
      ],
      default: 0,
    },
  ]);

  // ── Prompt 2: Confirmation with agent preview ─────────────────────────────

  console.log();
  console.log(chalk.bold('  This will install 7 Hydra agents + SKILL.md + reference docs.'));
  console.log();
  console.log('  Agents:');

  const agentList = [
    { dot: chalk.green('🟢'), name: 'hydra-scout (Haiku)   ', role: 'Codebase exploration' },
    { dot: chalk.green('🟢'), name: 'hydra-runner (Haiku)  ', role: 'Test execution & validation' },
    { dot: chalk.green('🟢'), name: 'hydra-scribe (Haiku)  ', role: 'Documentation writing' },
    { dot: chalk.green('🟢'), name: 'hydra-guard (Haiku)   ', role: 'Auto-protection & safety' },
    { dot: chalk.green('🟢'), name: 'hydra-git (Haiku)     ', role: 'Git operations' },
    { dot: chalk.blue('🔵'),  name: 'hydra-coder (Sonnet)  ', role: 'Code implementation' },
    { dot: chalk.blue('🔵'),  name: 'hydra-analyst (Sonnet)', role: 'Code review & debugging' },
  ];

  for (const a of agentList) {
    console.log(`    ${a.dot} ${chalk.bold(a.name)} — ${chalk.gray(a.role)}`);
  }

  console.log();

  const { proceed } = await inquirer.prompt([
    {
      type:    'confirm',
      name:    'proceed',
      message: 'Proceed?',
      default: true,
    },
  ]);

  if (!proceed) {
    console.log(chalk.gray('\n  Installation cancelled.\n'));
    return null;
  }

  console.log();
  return scope;
}

module.exports = { runPrompts };
