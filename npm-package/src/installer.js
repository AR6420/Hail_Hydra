'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const chalk = require('chalk');

const { agents, skill, references, commands, hooks } = require('./files');
const { showInstallHeader, showFileInstalled, showInstallComplete, showStatusTable, VERSION } = require('./display');

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
    display: 'skills/hydra/SKILL.md',
    content: skill,
    dest:    path.join(base, 'skills', 'hydra', 'SKILL.md'),
  };

  const refEntries = Object.entries(references).map(([key, content]) => ({
    type:    'reference',
    key,
    display: `references/${key}.md`,
    content,
    dest:    path.join(base, 'skills', 'hydra', 'references', `${key}.md`),
  }));

  const commandEntries = Object.entries(commands).map(([key, content]) => ({
    type:    'command',
    key,
    display: `commands/hydra/${key}.md`,
    content,
    dest:    path.join(base, 'commands', 'hydra', `${key}.md`),
  }));

  const versionEntry = {
    type:    'version',
    key:     'VERSION',
    display: 'skills/hydra/VERSION',
    content: VERSION,
    dest:    path.join(base, 'skills', 'hydra', 'VERSION'),
  };

  return [...agentEntries, skillEntry, ...refEntries, ...commandEntries, versionEntry];
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

// ── Hooks & settings ─────────────────────────────────────────────────────────

function installHooks() {
  const hooksDir = path.join(GLOBAL_BASE, 'hooks');
  ensureDir(hooksDir);

  for (const [key, content] of Object.entries(hooks)) {
    const dest = path.join(hooksDir, `${key}.js`);
    try {
      writeFileSafe(dest, content);
      try { fs.chmodSync(dest, 0o755); } catch {}
      showFileInstalled(`hooks/${key}.js`, true);
    } catch (err) {
      showFileInstalled(`hooks/${key}.js`, false, err.message);
    }
  }
}

function registerHooksInSettings() {
  const settingsFile = path.join(GLOBAL_BASE, 'settings.json');

  let settings = {};
  try {
    settings = JSON.parse(fs.readFileSync(settingsFile, 'utf8'));
  } catch {}

  if (!settings.hooks) settings.hooks = {};
  if (!settings.hooks.SessionStart) settings.hooks.SessionStart = [];
  if (!settings.hooks.PostToolUse)  settings.hooks.PostToolUse  = [];

  const isHydraHook = (entry) =>
    Array.isArray(entry.hooks) && entry.hooks.some(h => h.command && h.command.includes('hydra-'));

  // Remove stale Hydra entries (clean reinstall)
  settings.hooks.SessionStart = settings.hooks.SessionStart.filter(x => !isHydraHook(x));
  settings.hooks.PostToolUse  = settings.hooks.PostToolUse.filter(x => !isHydraHook(x));

  settings.hooks.SessionStart.push({
    hooks: [{ type: 'command', command: 'node ~/.claude/hooks/hydra-check-update.js' }]
  });

  settings.hooks.PostToolUse.push({
    matcher: 'Write|Edit|MultiEdit',
    hooks:   [{ type: 'command', command: 'node ~/.claude/hooks/hydra-auto-guard.js' }]
  });

  let statusLineConfigured = false;
  if (!settings.statusLine || (settings.statusLine.command && settings.statusLine.command.includes('hydra-'))) {
    settings.statusLine = {
      type: 'command',
      command: 'node ~/.claude/hooks/hydra-statusline.js',
      padding: 0,
    };
    statusLineConfigured = true;
  }

  writeFileSafe(settingsFile, JSON.stringify(settings, null, 2));
  return { statusLineConfigured };
}

function deregisterHooks() {
  const settingsFile = path.join(GLOBAL_BASE, 'settings.json');

  try {
    let settings = JSON.parse(fs.readFileSync(settingsFile, 'utf8'));

    const isHydraHook = (entry) =>
      Array.isArray(entry.hooks) && entry.hooks.some(h => h.command && h.command.includes('hydra-'));

    if (settings.hooks?.SessionStart) {
      settings.hooks.SessionStart = settings.hooks.SessionStart.filter(x => !isHydraHook(x));
      if (!settings.hooks.SessionStart.length) delete settings.hooks.SessionStart;
    }
    if (settings.hooks?.PostToolUse) {
      settings.hooks.PostToolUse = settings.hooks.PostToolUse.filter(x => !isHydraHook(x));
      if (!settings.hooks.PostToolUse.length) delete settings.hooks.PostToolUse;
    }
    if (settings.hooks && !Object.keys(settings.hooks).length) delete settings.hooks;

    if (settings.statusLine?.command?.includes('hydra-')) delete settings.statusLine;

    writeFileSafe(settingsFile, JSON.stringify(settings, null, 2));
    console.log(chalk.green('  \u2714 Hooks deregistered from settings.json'));
  } catch (err) {
    console.log(chalk.yellow(`  \u26a0 Could not update settings.json: ${err.message}`));
  }
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

  // Hooks and settings are always global (once, not per-base)
  installHooks();
  const { statusLineConfigured } = registerHooksInSettings();

  if (!anyFailed) {
    showInstallComplete(statusLineConfigured);
  } else {
    console.log(chalk.yellow('  \u26a0 Some files failed to install. Check errors above.\n'));
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

  // Remove hook .js files from ~/.claude/hooks/
  for (const key of Object.keys(hooks)) {
    const dest = path.join(GLOBAL_BASE, 'hooks', `${key}.js`);
    if (fileExists(dest)) {
      try { fs.unlinkSync(dest); console.log(chalk.green(`  \u2714 Removed hooks/${key}.js`)); }
      catch (err) { console.log(chalk.red(`  \u2716 Failed: hooks/${key}.js \u2014 ${err.message}`)); }
    }
  }

  // Remove cache file
  const cacheFile = path.join(GLOBAL_BASE, 'cache', 'hydra-update-check.json');
  if (fileExists(cacheFile)) {
    try { fs.unlinkSync(cacheFile); } catch {}
  }

  deregisterHooks();

  console.log();
  if (failed === 0) {
    console.log(chalk.cyan.bold('  \uD83D\uDC09 All heads severed. Hydra sleeps.\n'));
  } else {
    console.log(chalk.yellow(`  \u26a0 ${removed} removed, ${failed} failed.\n`));
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

  const commandEntries = manifest.filter((e) => e.type === 'command').map((e) => ({
    name:      e.display,
    installed: fileExists(e.dest),
  }));

  const versionEntry = manifest.find((e) => e.type === 'version');

  return {
    agents:     agentEntries,
    skill:      skillEntry ? fileExists(skillEntry.dest) : false,
    references: refEntries,
    commands:   commandEntries,
    version:    versionEntry ? (fileExists(versionEntry.dest) ? fs.readFileSync(versionEntry.dest, 'utf8').trim() : null) : null,
  };
}

async function showStatus() {
  const globalStatus = getStatus(GLOBAL_BASE);
  const localStatus  = getStatus(LOCAL_BASE);
  showStatusTable(globalStatus, localStatus);
}

module.exports = { runInstall, runUninstall, showStatus };
