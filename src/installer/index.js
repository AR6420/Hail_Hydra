'use strict';

// hydra-core installer orchestration — resolves target hosts, delegates to
// per-host modules under hosts/. Adding a host = adding one module and
// registering it here; the CLI and prompts pick it up automatically.

const chalk = require('chalk');

const { showInstallHeader, showFileInstalled, showInstallComplete, VERSION } = require('./display');

// Host registry. Phase 2 adds gemini, Phase 3 adds codex.
const HOSTS = {
  claude: require('./hosts/claude'),
};

const log = {
  header: (label) => showInstallHeader(label),
  file: (name, ok, err) => showFileInstalled(name, ok, err),
  ok: (msg) => console.log(chalk.green(`  ✔ ${msg}`)),
  warn: (msg) => console.log(chalk.yellow(`  ⚠ ${msg}`)),
  blank: () => console.log(),
};

function availableHosts() {
  return Object.values(HOSTS);
}

function resolveHosts(ids) {
  const out = [];
  for (const id of ids) {
    if (!HOSTS[id]) {
      const known = Object.keys(HOSTS).join(', ');
      throw new Error(`Unknown or unsupported agent '${id}'. Available in this build: ${known}`);
    }
    if (!out.includes(HOSTS[id])) out.push(HOSTS[id]);
  }
  return out;
}

async function runInstall({ hostIds = ['claude'], scope = 'global', configDirOverride = null, nonInteractive = false, dryRun = false } = {}) {
  const hosts = resolveHosts(hostIds);

  if (configDirOverride && hosts.length > 1) {
    throw new Error('--config-dir can only be used with a single --agent');
  }

  if (dryRun) {
    console.log(chalk.bold('\n  Dry run — planned writes:\n'));
    for (const host of hosts) {
      console.log(chalk.bold(`  ${host.label}:`));
      for (const line of host.plan(scope, configDirOverride, VERSION)) {
        console.log(chalk.gray(`    ${line}`));
      }
      console.log();
    }
    return;
  }

  // Overwrite confirmation (interactive only)
  const anyExisting = hosts.some((h) => h.hasAnyInstalled(scope, configDirOverride, VERSION));
  if (anyExisting && !nonInteractive) {
    const inquirer = require('inquirer');
    const { overwrite } = await inquirer.prompt([{
      type: 'confirm',
      name: 'overwrite',
      message: 'Hydra already installed. Overwrite?',
      default: true,
    }]);
    if (!overwrite) {
      console.log(chalk.gray('\n  Installation cancelled.\n'));
      return;
    }
    console.log();
  }

  const notes = [];
  let anyFailed = false;
  let statusLineConfigured = false;

  for (const host of hosts) {
    if (hosts.length > 1) console.log(chalk.bold.cyan(`\n  ── ${host.label} ──\n`));
    const result = host.install({ scope, configDirOverride, version: VERSION, log });
    if (result.anyFailed) anyFailed = true;
    if (result.statusLineConfigured) statusLineConfigured = true;
    for (const note of host.postInstallNotes()) notes.push(`[${host.label}] ${note}`);
  }

  if (!anyFailed) {
    showInstallComplete(statusLineConfigured, hosts.length > 1 ? notes : null);
  } else {
    console.log(chalk.yellow('  ⚠ Some files failed to install. Check errors above.\n'));
  }
}

async function runUninstall({ hostIds = null, configDirOverride = null, interactive = true } = {}) {
  // Default: every registered host that has anything installed.
  const hosts = hostIds ? resolveHosts(hostIds) : availableHosts();

  const toRemove = [];
  for (const host of hosts) {
    for (const t of host.uninstallTargets(configDirOverride, VERSION)) {
      toRemove.push({ ...t, host });
    }
  }

  if (toRemove.length === 0) {
    console.log(chalk.gray('\n  No Hydra files found. Nothing to remove.\n'));
    return;
  }

  console.log('\n  The following Hydra files will be removed:\n');
  for (const item of toRemove) {
    console.log(chalk.gray(`    [${item.host.label} · ${item.label}] ${item.display}`));
  }
  console.log();

  if (interactive) {
    const inquirer = require('inquirer');
    const { confirm } = await inquirer.prompt([{
      type: 'confirm',
      name: 'confirm',
      message: `Remove ${toRemove.length} Hydra file(s)?`,
      default: false,
    }]);
    if (!confirm) {
      console.log(chalk.gray('\n  Uninstall cancelled.\n'));
      return;
    }
    console.log();
  }

  const fs = require('fs');
  let removed = 0;
  let failed = 0;
  for (const item of toRemove) {
    try {
      fs.unlinkSync(item.dest);
      console.log(chalk.green(`  ✔ Removed ${item.display}`));
      removed++;
    } catch (err) {
      console.log(chalk.red(`  ✖ Failed to remove ${item.display}: ${err.message}`));
      failed++;
    }
  }

  for (const host of hosts) {
    host.uninstallExtras({ configDirOverride, log });
  }

  console.log();
  if (failed === 0) {
    console.log(chalk.cyan.bold('  🐉 All heads severed. Hydra sleeps.\n'));
  } else {
    console.log(chalk.yellow(`  ⚠ ${removed} removed, ${failed} failed.\n`));
  }
}

async function showStatus({ hostIds = null, configDirOverride = null } = {}) {
  const hosts = hostIds ? resolveHosts(hostIds) : availableHosts();
  for (const host of hosts) {
    console.log(chalk.bold(`\n  ${host.label}${host.detect() ? '' : chalk.gray(' (not detected)')}`));
    const status = host.status(configDirOverride, VERSION);
    for (const [section, info] of Object.entries(status)) {
      if (section === 'hooks') {
        const on = info.filter((h) => h.installed).length;
        console.log(`    hooks: ${on}/${info.length} installed`);
      } else {
        const v = info.version ? ` (v${info.version})` : '';
        console.log(`    ${section}: ${info.installed}/${info.total} files${v}`);
      }
    }
  }
  console.log();
}

module.exports = { runInstall, runUninstall, showStatus, availableHosts, HOSTS };
