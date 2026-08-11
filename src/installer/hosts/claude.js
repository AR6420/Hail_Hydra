'use strict';

// Claude Code host installer — behavior-identical to the v2.x installer
// (payload files per scope, hooks + settings.json always global, statusLine
// only if absent or hydra-owned), now reading from dist/claude/ and honoring
// CLAUDE_CONFIG_DIR everywhere.

const fs = require('fs');
const path = require('path');
const os = require('os');

const { writeManifest, readManifest } = require('../manifest');

const DIST = path.resolve(__dirname, '..', '..', '..', 'dist', 'claude');

const HOOK_FILES = [
  'hydra-check-update.js',
  'hydra-statusline.js',
  'hydra-token-math.js',
  'hydra-auto-guard.js',
  'hydra-notify.js',
  'hydra-sentinel-done.js',
];
const BINARY_HOOKS = ['hydra-task-complete.wav'];

function configDir(override) {
  return override || process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');
}

function detect() {
  return fs.existsSync(configDir());
}

function bases(scope, override) {
  const globalBase = configDir(override);
  const localBase = path.join(process.cwd(), '.claude');
  if (scope === 'both') return [[globalBase, 'Global (~/.claude/)'], [localBase, 'Local (./.claude/)']];
  if (scope === 'local') return [[localBase, 'Local (./.claude/)']];
  return [[globalBase, 'Global (~/.claude/)']];
}

// Payload manifest for one base — mirrors the v2 layout exactly.
function buildManifest(base, version) {
  const entries = [];
  const add = (relSrc, dest, display) =>
    entries.push({ absPath: path.join(DIST, relSrc), dest, display, relPath: relSrc });

  for (const f of fs.readdirSync(path.join(DIST, 'agents')).sort()) {
    add(`agents/${f}`, path.join(base, 'agents', f), `agents/${f}`);
  }
  add('SKILL.md', path.join(base, 'skills', 'hydra', 'SKILL.md'), 'skills/hydra/SKILL.md');
  add('skills/stfu-agents/SKILL.md', path.join(base, 'skills', 'stfu-agents', 'SKILL.md'), 'skills/stfu-agents/SKILL.md');
  for (const f of fs.readdirSync(path.join(DIST, 'references')).sort()) {
    add(`references/${f}`, path.join(base, 'skills', 'hydra', 'references', f), `references/${f}`);
  }
  for (const f of fs.readdirSync(path.join(DIST, 'commands', 'hydra')).sort()) {
    add(`commands/hydra/${f}`, path.join(base, 'commands', 'hydra', f), `commands/hydra/${f}`);
  }
  entries.push({
    content: version,
    dest: path.join(base, 'skills', 'hydra', 'VERSION'),
    display: 'skills/hydra/VERSION',
    relPath: 'VERSION',
  });
  return entries;
}

function writeEntry(entry) {
  fs.mkdirSync(path.dirname(entry.dest), { recursive: true });
  if (entry.content !== undefined) {
    fs.writeFileSync(entry.dest, entry.content, 'utf8');
  } else {
    fs.copyFileSync(entry.absPath, entry.dest);
  }
}

// Hook payload + settings registration — always global.
function installHooks({ configDirOverride, log }) {
  const hooksDir = path.join(configDir(configDirOverride), 'hooks');
  fs.mkdirSync(hooksDir, { recursive: true });

  for (const f of [...HOOK_FILES, ...BINARY_HOOKS]) {
    const dest = path.join(hooksDir, f);
    try {
      fs.copyFileSync(path.join(DIST, 'hooks', f), dest);
      try { fs.chmodSync(dest, 0o755); } catch {}
      log.file(`hooks/${f}`, true);
    } catch (err) {
      log.file(`hooks/${f}`, false, err.message);
    }
  }
}

// Command strings registered in settings.json. Default install keeps the v2
// literal '~/.claude/hooks/...' form (proven across platforms); an explicit
// CLAUDE_CONFIG_DIR/--config-dir install writes absolute paths instead.
function hookCommand(script, configDirOverride) {
  const dir = configDirOverride || process.env.CLAUDE_CONFIG_DIR;
  if (dir) return `node "${path.join(dir, 'hooks', script)}"`;
  return `node ~/.claude/hooks/${script}`;
}

function registerHooksInSettings({ configDirOverride }) {
  const settingsFile = path.join(configDir(configDirOverride), 'settings.json');

  let settings = {};
  try { settings = JSON.parse(fs.readFileSync(settingsFile, 'utf8')); } catch {}

  if (!settings.hooks) settings.hooks = {};
  if (!settings.hooks.SessionStart) settings.hooks.SessionStart = [];
  if (!settings.hooks.PostToolUse) settings.hooks.PostToolUse = [];
  if (!settings.hooks.Notification) settings.hooks.Notification = [];

  const isHydraHook = (entry) =>
    Array.isArray(entry.hooks) && entry.hooks.some((h) => h.command && h.command.includes('hydra-'));

  // Remove stale Hydra entries (clean reinstall)
  settings.hooks.SessionStart = settings.hooks.SessionStart.filter((x) => !isHydraHook(x));
  settings.hooks.PostToolUse = settings.hooks.PostToolUse.filter((x) => !isHydraHook(x));
  settings.hooks.Notification = settings.hooks.Notification.filter((x) => !isHydraHook(x));

  settings.hooks.SessionStart.push({
    hooks: [{ type: 'command', command: hookCommand('hydra-check-update.js', configDirOverride) }],
  });
  settings.hooks.PostToolUse.push({
    matcher: 'Write|Edit|MultiEdit',
    hooks: [{ type: 'command', command: hookCommand('hydra-auto-guard.js', configDirOverride) }],
  });
  settings.hooks.Notification.push({
    hooks: [{ type: 'command', command: hookCommand('hydra-notify.js', configDirOverride) }],
  });

  let statusLineConfigured = false;
  if (!settings.statusLine || (settings.statusLine.command && settings.statusLine.command.includes('hydra-'))) {
    settings.statusLine = {
      type: 'command',
      command: hookCommand('hydra-statusline.js', configDirOverride),
      padding: 0,
    };
    statusLineConfigured = true;
  }

  fs.mkdirSync(path.dirname(settingsFile), { recursive: true });
  fs.writeFileSync(settingsFile, JSON.stringify(settings, null, 2));
  return { statusLineConfigured };
}

function deregisterHooks({ configDirOverride, log }) {
  const settingsFile = path.join(configDir(configDirOverride), 'settings.json');
  try {
    const settings = JSON.parse(fs.readFileSync(settingsFile, 'utf8'));
    const isHydraHook = (entry) =>
      Array.isArray(entry.hooks) && entry.hooks.some((h) => h.command && h.command.includes('hydra-'));

    for (const event of ['SessionStart', 'PostToolUse', 'Notification']) {
      if (settings.hooks?.[event]) {
        settings.hooks[event] = settings.hooks[event].filter((x) => !isHydraHook(x));
        if (!settings.hooks[event].length) delete settings.hooks[event];
      }
    }
    if (settings.hooks && !Object.keys(settings.hooks).length) delete settings.hooks;
    if (settings.statusLine?.command?.includes('hydra-')) delete settings.statusLine;

    fs.writeFileSync(settingsFile, JSON.stringify(settings, null, 2));
    log.ok('Hooks deregistered from settings.json');
  } catch (err) {
    log.warn(`Could not update settings.json: ${err.message}`);
  }
}

// ── Host interface ───────────────────────────────────────────────────────────

module.exports = {
  id: 'claude',
  label: 'Claude Code',
  detect,
  configDir,

  hasAnyInstalled(scope, configDirOverride, version) {
    return bases(scope, configDirOverride).some(([base]) =>
      buildManifest(base, version).some((e) => fs.existsSync(e.dest)));
  },

  plan(scope, configDirOverride, version) {
    // For --dry-run: everything install() would write.
    const writes = [];
    for (const [base, label] of bases(scope, configDirOverride)) {
      for (const e of buildManifest(base, version)) writes.push(`[${label}] ${e.dest}`);
    }
    const hooksDir = path.join(configDir(configDirOverride), 'hooks');
    for (const f of [...HOOK_FILES, ...BINARY_HOOKS]) writes.push(`[hooks] ${path.join(hooksDir, f)}`);
    writes.push(`[settings] ${path.join(configDir(configDirOverride), 'settings.json')} (hooks + statusLine)`);
    return writes;
  },

  install({ scope, configDirOverride, version, log }) {
    let anyFailed = false;

    for (const [base, label] of bases(scope, configDirOverride)) {
      log.header(label);
      const entries = buildManifest(base, version);
      for (const entry of entries) {
        try {
          writeEntry(entry);
          log.file(entry.display, true);
        } catch (err) {
          log.file(entry.display, false, err.message);
          anyFailed = true;
        }
      }
      try {
        writeManifest(base, { version, host: 'claude', files: entries.map((e) => ({ path: e.dest, content: e.content, absPath: e.absPath })) });
      } catch { /* manifest is best-effort */ }
      log.blank();
    }

    installHooks({ configDirOverride, log });
    const { statusLineConfigured } = registerHooksInSettings({ configDirOverride });

    return { anyFailed, statusLineConfigured };
  },

  uninstallTargets(configDirOverride, version) {
    const targets = [];
    for (const [base, label] of bases('both', configDirOverride)) {
      for (const e of buildManifest(base, version)) {
        if (fs.existsSync(e.dest)) targets.push({ label, dest: e.dest, display: e.display });
      }
      const manifestFile = path.join(base, 'skills', 'hydra', 'manifest.json');
      if (fs.existsSync(manifestFile)) targets.push({ label, dest: manifestFile, display: 'skills/hydra/manifest.json' });
    }
    const hooksDir = path.join(configDir(configDirOverride), 'hooks');
    for (const f of [...HOOK_FILES, ...BINARY_HOOKS]) {
      const dest = path.join(hooksDir, f);
      if (fs.existsSync(dest)) targets.push({ label: 'Hooks', dest, display: `hooks/${f}` });
    }
    const cacheFile = path.join(configDir(configDirOverride), 'cache', 'hydra-update-check.json');
    if (fs.existsSync(cacheFile)) targets.push({ label: 'Cache', dest: cacheFile, display: 'cache/hydra-update-check.json' });
    return targets;
  },

  uninstallExtras({ configDirOverride, log }) {
    deregisterHooks({ configDirOverride, log });
  },

  postInstallNotes() {
    return [
      'Quick start:  /hydra:help',
      'Build map:    /hydra:map rebuild',
      'Check status: /hydra:status',
    ];
  },

  status(configDirOverride, version) {
    const result = {};
    for (const [base, label] of bases('both', configDirOverride)) {
      const entries = buildManifest(base, version);
      result[label] = {
        installed: entries.filter((e) => fs.existsSync(e.dest)).length,
        total: entries.length,
        version: (() => {
          try { return fs.readFileSync(path.join(base, 'skills', 'hydra', 'VERSION'), 'utf8').trim(); }
          catch { return null; }
        })(),
        manifest: readManifest(base),
      };
    }
    const hooksDir = path.join(configDir(configDirOverride), 'hooks');
    result.hooks = HOOK_FILES.map((f) => ({ file: f, installed: fs.existsSync(path.join(hooksDir, f)) }));
    return result;
  },
};
