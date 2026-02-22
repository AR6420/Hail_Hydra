'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const chalk = require('chalk');

const { agents, skill, references } = require('./files');
const { showInstallHeader, showFileInstalled, showInstallComplete, showStatusTable } = require('./display');

// ── Install locations ────────────────────────────────────────────────────────

const GLOBAL_BASE = path.join(os.homedir(), '.claude');
const LOCAL_BASE  = path.join(process.cwd(), '.claude');

// ── File manifest ────────────────────────────────────────────────────────────

function buildManifest(base) {
  const agentEntries = Object.entries(agents).map(([key, info]) => ({
    type:     'agent',
    key,
    display:  info.display,
    model:    info.model,
    content:  info.content,
    dest:     path.join(base, 'agents', `${key}.md`),
  }));

  const skillEntry = {
    type:    'skill',
    key:     'SKILL.md',
    display: 'SKILL.md',
    content: skill,
    dest:    path.join(base, 'hydra', 'SKILL.md'),
  };

  const refEntries = Object.entries(references).map(([key, content]) => ({
    type:    'reference',
    key,
    display: `references/${key}.md`,
    content,
    dest:    path.join(base, 'hydra', 'references', `${key}.md`),
  }));

  return [...agentEntries, skillEntry, ...refEntries];
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function writeFileSafe(dest, content) {
  ensureDir(path.dirname(dest));
  fs.writeFileSync(dest, content, 'utf8');
}

function fileExists(filePath) {
  try {
    fs.accessSync(filePath, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function hasAnyInstalled(base) {
  return buildManifest(base).some((entry) => fileExists(entry.dest));
}

// ── Core install ─────────────────────────────────────────────────────────────

function installToBase(base, label) {
  showInstallHeader(label);

  const manifest = buildManifest(base);
  const results  = [];

  for (const entry of manifest) {
    try {
      writeFileSafe(entry.dest, entry.content);
      showFileInstalled(entry.display, true);
      results.push({ name: entry.display, success: true });
    } catch (err) {
      showFileInstalled(entry.display, false, err.message);
      results.push({ name: entry.display, success: false, error: err.message });
    }
  }

  console.log();
  return results;
}

// ── Public API ───────────────────────────────────────────────────────────────

async function runInstall(scope) {
  const inquirer = require('inquirer');

  const bases =
    scope === 'both'   ? [[GLOBAL_BASE, 'Global (~/.claude/)'], [LOCAL_BASE, 'Local (./.claude/)']] :
    scope === 'global' ? [[GLOBAL_BASE, 'Global (~/.claude/)']] :
                         [[LOCAL_BASE,  'Local (./.claude/)']];

  // Check for existing files and ask about overwrite
  const anyExisting = bases.some(([base]) => hasAnyInstalled(base));
  if (anyExisting) {
    const { overwrite } = await inquirer.prompt([
      {
        type:    'confirm',
        name:    'overwrite',
        message: 'Hydra agents already installed. Overwrite?',
        default: true,
      },
    ]);
    if (!overwrite) {
      console.log(chalk.gray('\n  Installation cancelled.\n'));
      return;
    }
    console.log();
  }

  let anyFailed = false;
  for (const [base, label] of bases) {
    const results = installToBase(base, label);
    if (results.some((r) => !r.success)) anyFailed = true;
  }

  if (!anyFailed) {
    showInstallComplete();
  } else {
    console.log(chalk.yellow('  ⚠ Some files failed to install. Check errors above.\n'));
  }
}

async function runUninstall({ interactive = true } = {}) {
  const bases = [
    [GLOBAL_BASE, 'Global (~/.claude/)'],
    [LOCAL_BASE,  'Local (./.claude/)'],
  ];

  // Collect files to remove
  const toRemove = [];
  for (const [base, label] of bases) {
    for (const entry of buildManifest(base)) {
      if (fileExists(entry.dest)) {
        toRemove.push({ label, dest: entry.dest, display: entry.display });
      }
    }
  }

  if (toRemove.length === 0) {
    console.log(chalk.gray('\n  No Hydra files found. Nothing to remove.\n'));
    return;
  }

  console.log('\n  The following Hydra files will be removed:\n');
  for (const item of toRemove) {
    console.log(chalk.gray(`    [${item.label}] ${item.display}`));
  }
  console.log();

  if (interactive) {
    const inquirer = require('inquirer');
    const { confirm } = await inquirer.prompt([
      {
        type:    'confirm',
        name:    'confirm',
        message: `Remove ${toRemove.length} Hydra file(s)?`,
        default: false,
      },
    ]);
    if (!confirm) {
      console.log(chalk.gray('\n  Uninstall cancelled.\n'));
      return;
    }
    console.log();
  }

  let removed = 0;
  let failed  = 0;
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

  console.log();
  if (failed === 0) {
    console.log(chalk.cyan.bold('  🐉 All heads severed. Hydra sleeps.\n'));
  } else {
    console.log(chalk.yellow(`  ⚠ ${removed} removed, ${failed} failed.\n`));
  }
}

function getStatus(base) {
  const manifest = buildManifest(base);

  const agentEntries = manifest.filter((e) => e.type === 'agent').map((e) => ({
    key:       e.key,
    display:   e.display,
    model:     e.model,
    installed: fileExists(e.dest),
  }));

  const skillEntry = manifest.find((e) => e.type === 'skill');

  const refEntries = manifest.filter((e) => e.type === 'reference').map((e) => ({
    name:      e.display,
    installed: fileExists(e.dest),
  }));

  return {
    agents:     agentEntries,
    skill:      skillEntry ? fileExists(skillEntry.dest) : false,
    references: refEntries,
  };
}

async function showStatus() {
  const globalStatus = getStatus(GLOBAL_BASE);
  const localStatus  = getStatus(LOCAL_BASE);
  showStatusTable(globalStatus, localStatus);
}

module.exports = { runInstall, runUninstall, showStatus };
