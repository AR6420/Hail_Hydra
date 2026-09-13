'use strict';

// GitHub Copilot CLI host installer.
//
// Layout (from dist/copilot/):
//   <base>/agents/hydra-*.md            (per scope)
//   <base>/hydra/VERSION + manifest.json (per scope)
//   <base>/hydra/references/*.md        (per scope)
//   <base>/hydra/commands/*.md          (per scope)
//   <base>/hydra/skills/hail-hydra/SKILL.md  (per scope)
//   <base>/hydra/skills/stfu-agents/SKILL.md (per scope)
//   <user>/hydra/hooks/*.js + wav       (always user-level)
//   <user>/settings.json "hooks"        PostToolUse, SessionStart, Stop
//   <user>/instructions.md              marker block from COPILOT-fragment.md

const fs = require('fs');
const path = require('path');
const os = require('os');

const { sha256 } = require('../manifest');
const { writeFileAtomic, readUserJson, isPlainObject } = require('../fsutil');

const DIST = path.resolve(__dirname, '..', '..', '..', 'dist', 'copilot');

function distFiles(...parts) {
  try { return fs.readdirSync(path.join(DIST, ...parts)).sort(); } catch { return []; }
}

const HOOK_FILES = [
  'hydra-auto-guard.js',
  'hydra-check-update.js',
  'hydra-notify.js',
  'hydra-sentinel-done.js',
  'hydra-token-math.js',
];
const BINARY_HOOKS = ['hydra-task-complete.wav'];
const HOOK_EVENTS = ['PostToolUse', 'SessionStart', 'Stop'];

const MARKER_BEGIN = '# BEGIN hydra (generated — do not edit)';
const MARKER_END = '# END hydra';

function configDir(override) {
  return override || process.env.COPILOT_CONFIG_DIR || path.join(os.homedir(), '.copilot');
}

function detect() {
  return fs.existsSync(configDir());
}

function bases(scope, override) {
  const globalBase = configDir(override);
  const localBase = path.join(process.cwd(), '.copilot');
  if (scope === 'both') return [[globalBase, 'Global (~/.copilot/)'], [localBase, 'Local (./.copilot/)']];
  if (scope === 'local') return [[localBase, 'Local (./.copilot/)']];
  return [[globalBase, 'Global (~/.copilot/)']];
}

function hooksDir(override) {
  return path.join(configDir(override), 'hydra', 'hooks');
}

function buildManifest(base, version) {
  const entries = [];
  const add = (relSrc, dest, display) =>
    entries.push({ absPath: path.join(DIST, relSrc), dest, display, relPath: relSrc });

  for (const f of distFiles('agents')) {
    add(`agents/${f}`, path.join(base, 'agents', f), `agents/${f}`);
  }
  for (const f of distFiles('commands')) {
    add(`commands/${f}`, path.join(base, 'hydra', 'commands', f), `hydra/commands/${f}`);
  }
  // Skills.
  const skillFile = path.join(DIST, 'skills', 'hail-hydra', 'SKILL.md');
  if (fs.existsSync(skillFile)) {
    entries.push({
      absPath: skillFile,
      dest: path.join(base, 'hydra', 'skills', 'hail-hydra', 'SKILL.md'),
      display: 'hydra/skills/hail-hydra/SKILL.md',
      relPath: 'skills/hail-hydra/SKILL.md',
    });
  }
  const stfuFile = path.join(DIST, 'skills', 'stfu-agents', 'SKILL.md');
  if (fs.existsSync(stfuFile)) {
    entries.push({
      absPath: stfuFile,
      dest: path.join(base, 'hydra', 'skills', 'stfu-agents', 'SKILL.md'),
      display: 'hydra/skills/stfu-agents/SKILL.md',
      relPath: 'skills/stfu-agents/SKILL.md',
    });
  }
  for (const f of distFiles('references')) {
    add(`references/${f}`, path.join(base, 'hydra', 'references', f), `hydra/references/${f}`);
  }
  entries.push({
    content: version,
    dest: path.join(base, 'hydra', 'VERSION'),
    display: 'hydra/VERSION',
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

function manifestPath(base) {
  return path.join(base, 'hydra', 'manifest.json');
}

function writeCopilotManifest(base, version, entries) {
  const manifest = {
    version,
    host: 'copilot',
    installedAt: new Date().toISOString(),
    files: entries.map((e) => ({
      path: e.dest,
      sha256: sha256(e.content !== undefined ? Buffer.from(e.content, 'utf8') : fs.readFileSync(e.absPath)),
    })),
  };
  fs.mkdirSync(path.dirname(manifestPath(base)), { recursive: true });
  fs.writeFileSync(manifestPath(base), JSON.stringify(manifest, null, 2));
}

function readCopilotManifest(base) {
  try { return JSON.parse(fs.readFileSync(manifestPath(base), 'utf8')); } catch { return null; }
}

// ── Hooks (always user-level) ─────────────────────────────────────────────

function installHooks({ configDirOverride, log }) {
  const dir = hooksDir(configDirOverride);
  fs.mkdirSync(dir, { recursive: true });
  for (const f of [...HOOK_FILES, ...BINARY_HOOKS]) {
    const dest = path.join(dir, f);
    try {
      fs.copyFileSync(path.join(DIST, 'hooks', f), dest);
      try { fs.chmodSync(dest, 0o755); } catch {}
      log.file(`hydra/hooks/${f}`, true);
    } catch (err) {
      log.file(`hydra/hooks/${f}`, false, err.message);
    }
  }
}

function hookCommand(script, configDirOverride) {
  return `node "${path.join(hooksDir(configDirOverride), script)}"`;
}

const isHydraEntry = (entry) =>
  entry && Array.isArray(entry.hooks) && entry.hooks.some(
    (h) => h && ((h.command || '').includes('hydra-'))
  );

function registerHooksInSettings({ configDirOverride, log }) {
  const settingsFile = path.join(configDir(configDirOverride), 'settings.json');

  const { exists, data, error } = readUserJson(settingsFile);
  if (error) {
    log.warn(`settings.json could not be parsed (${error}) — hook registration skipped, file left untouched`);
    return { failed: true };
  }
  const settings = exists ? data : {};
  if (!isPlainObject(settings) || (settings.hooks !== undefined && !isPlainObject(settings.hooks))) {
    log.warn('settings.json has an unexpected shape — hook registration skipped, file left untouched');
    return { failed: true };
  }
  for (const event of HOOK_EVENTS) {
    if (settings.hooks && settings.hooks[event] !== undefined && !Array.isArray(settings.hooks[event])) {
      log.warn(`settings.json hooks.${event} is not an array — hook registration skipped, file left untouched`);
      return { failed: true };
    }
  }

  if (!settings.hooks) settings.hooks = {};
  for (const event of HOOK_EVENTS) {
    settings.hooks[event] = (settings.hooks[event] || []).filter((x) => !isHydraEntry(x));
  }

  settings.hooks.PostToolUse.push({
    matcher: 'Write|Edit|MultiEdit',
    hooks: [{ type: 'command', command: hookCommand('hydra-auto-guard.js', configDirOverride) }],
  });
  settings.hooks.SessionStart.push({
    hooks: [{ type: 'command', command: hookCommand('hydra-check-update.js', configDirOverride) }],
  });
  settings.hooks.Stop.push({
    hooks: [{ type: 'command', command: hookCommand('hydra-notify.js', configDirOverride) }],
  });

  fs.mkdirSync(path.dirname(settingsFile), { recursive: true });
  writeFileAtomic(settingsFile, JSON.stringify(settings, null, 2));
  return { failed: false };
}

function deregisterHooks({ configDirOverride, log }) {
  const settingsFile = path.join(configDir(configDirOverride), 'settings.json');
  try {
    const { data: settings, error } = readUserJson(settingsFile);
    if (error) { log.warn(`Could not update settings.json: ${error}`); return; }
    if (!isPlainObject(settings)) return;
    for (const event of HOOK_EVENTS) {
      if (settings.hooks?.[event]) {
        settings.hooks[event] = settings.hooks[event].filter((x) => !isHydraEntry(x));
        if (!settings.hooks[event].length) delete settings.hooks[event];
      }
    }
    if (settings.hooks && !Object.keys(settings.hooks).length) delete settings.hooks;
    writeFileAtomic(settingsFile, JSON.stringify(settings, null, 2));
    log.ok('Hooks deregistered from settings.json');
  } catch (err) {
    log.warn(`Could not update settings.json: ${err.message}`);
  }
}

// ── instructions.md marker block ──────────────────────────────────────────

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const BLOCK_RE = () =>
  new RegExp(`${escapeRe(MARKER_BEGIN)}(?:(?!${escapeRe(MARKER_BEGIN)})[\\s\\S])*?${escapeRe(MARKER_END)}\\n?`, 'g');

function markersBalanced(text) {
  return text.split(MARKER_BEGIN).length === text.split(MARKER_END).length;
}

function writeContextBlock({ configDirOverride, log }) {
  const file = path.join(configDir(configDirOverride), 'instructions.md');
  const block = fs.readFileSync(path.join(DIST, 'COPILOT-fragment.md'), 'utf8').trim() + '\n';

  let text = '';
  try { text = fs.readFileSync(file, 'utf8'); } catch {}

  if (!markersBalanced(text)) {
    log.warn('instructions.md hydra markers are unbalanced — file left untouched (fix the markers and re-run)');
    return false;
  }

  text = text.replace(BLOCK_RE(), '').trimEnd();
  text = text ? `${text}\n\n${block}` : block;

  fs.mkdirSync(path.dirname(file), { recursive: true });
  writeFileAtomic(file, text);
  log.ok('instructions.md hydra block written');
  return true;
}

function removeContextBlock({ configDirOverride, log }) {
  const file = path.join(configDir(configDirOverride), 'instructions.md');
  try {
    if (!fs.existsSync(file)) return;
    const text = fs.readFileSync(file, 'utf8');
    if (!markersBalanced(text)) {
      log.warn('instructions.md hydra markers are unbalanced — file left untouched');
      return;
    }
    const cleaned = text.replace(BLOCK_RE(), '').trimEnd();
    if (cleaned === text.trimEnd()) return;
    if (cleaned === '') {
      fs.unlinkSync(file);
    } else {
      writeFileAtomic(file, cleaned + '\n');
    }
    log.ok('instructions.md hydra block removed');
  } catch (err) {
    log.warn(`Could not update instructions.md: ${err.message}`);
  }
}

// ── Host interface ───────────────────────────────────────────────────────

module.exports = {
  id: 'copilot',
  label: 'Copilot CLI',
  detect,
  configDir,
  distDir: DIST,

  hasAnyInstalled(scope, configDirOverride, version) {
    return bases(scope, configDirOverride).some(([base]) =>
      buildManifest(base, version).some((e) => fs.existsSync(e.dest)));
  },

  plan(scope, configDirOverride, version) {
    const writes = [];
    for (const [base, label] of bases(scope, configDirOverride)) {
      for (const e of buildManifest(base, version)) writes.push(`[${label}] ${e.dest}`);
    }
    const dir = hooksDir(configDirOverride);
    for (const f of [...HOOK_FILES, ...BINARY_HOOKS]) writes.push(`[hooks] ${path.join(dir, f)}`);
    writes.push(`[settings] ${path.join(configDir(configDirOverride), 'settings.json')} (hooks: ${HOOK_EVENTS.join(', ')})`);
    writes.push(`[context] ${path.join(configDir(configDirOverride), 'instructions.md')} (hydra marker block)`);
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
      try { writeCopilotManifest(base, version, entries); } catch { /* best-effort */ }
      log.blank();
    }

    installHooks({ configDirOverride, log });
    if (registerHooksInSettings({ configDirOverride, log }).failed) anyFailed = true;
    if (!writeContextBlock({ configDirOverride, log })) anyFailed = true;

    return { anyFailed, statusLineConfigured: false };
  },

  uninstallTargets(configDirOverride, version) {
    const targets = [];
    for (const [base, label] of bases('both', configDirOverride)) {
      for (const e of buildManifest(base, version)) {
        if (fs.existsSync(e.dest)) targets.push({ label, dest: e.dest, display: e.display });
      }
      if (fs.existsSync(manifestPath(base))) {
        targets.push({ label, dest: manifestPath(base), display: 'hydra/manifest.json' });
      }
    }
    const dir = hooksDir(configDirOverride);
    for (const f of [...HOOK_FILES, ...BINARY_HOOKS]) {
      const dest = path.join(dir, f);
      if (fs.existsSync(dest)) targets.push({ label: 'Hooks', dest, display: `hydra/hooks/${f}` });
    }
    const cacheFile = path.join(configDir(configDirOverride), 'hydra', 'cache', 'hydra-update-check.json');
    if (fs.existsSync(cacheFile)) targets.push({ label: 'Cache', dest: cacheFile, display: 'hydra/cache/hydra-update-check.json' });
    return targets;
  },

  uninstallExtras({ configDirOverride, log }) {
    deregisterHooks({ configDirOverride, log });
    removeContextBlock({ configDirOverride, log });
    const hydraDir = path.join(configDir(configDirOverride), 'hydra');
    for (const owned of ['hooks', 'cache', 'skills', 'commands', 'references', 'VERSION', 'manifest.json']) {
      try { fs.rmSync(path.join(hydraDir, owned), { recursive: true, force: true }); } catch {}
    }
    try { fs.rmdirSync(hydraDir); } catch {}
  },

  postInstallNotes() {
    return [
      'Quick start:  /hail-hydra --help   (inside Copilot CLI)',
      'Check status: /hail-hydra --status',
      'Restart Copilot CLI to pick up the new agents.',
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
          try { return fs.readFileSync(path.join(base, 'hydra', 'VERSION'), 'utf8').trim(); }
          catch { return null; }
        })(),
        manifest: readCopilotManifest(base),
      };
    }
    const dir = hooksDir(configDirOverride);
    result.hooks = HOOK_FILES.map((f) => ({ file: f, installed: fs.existsSync(path.join(dir, f)) }));
    return result;
  },
};
