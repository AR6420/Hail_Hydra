'use strict';

// Gemini CLI host installer.
//
// Layout (from dist/gemini/):
//   <base>/agents/hydra-*.md          (per scope; G1)
//   <base>/commands/hydra/*.toml      (per scope; G14)
//   <base>/hydra/SKILL.md + VERSION + skills/stfu-agents/SKILL.md (per scope)
//   <user>/hydra/hooks/*.js + wav     (ALWAYS user-level: settings.json
//                                      command strings must stay byte-stable
//                                      at a stable path — G12)
//   <user>/settings.json "hooks"      AfterTool (write_file|replace),
//                                      SessionStart (startup), Notification —
//                                      entries named 'hydra-*', deduped on the
//                                      hydra- prefix before push (G7/G25)
//   <user>/GEMINI.md                  marker block from GEMINI-fragment.md
//                                      (loaded every prompt — G15)
//
// configDir: GEMINI_CONFIG_DIR is a hydra-specific courtesy override — Gemini
// CLI itself defines no such env var. Precedence: --config-dir flag > env >
// ~/.gemini (same chain as the Claude host).

const fs = require('fs');
const path = require('path');
const os = require('os');

const { sha256 } = require('../manifest');
const { writeFileAtomic, readUserJson, isPlainObject } = require('../fsutil');

const DIST = path.resolve(__dirname, '..', '..', '..', 'dist', 'gemini');

// Tolerant dist listing — status/uninstall must degrade gracefully when
// dist/ is missing; install fails fast on that upfront in installer/index.js.
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
const HOOK_EVENTS = ['AfterTool', 'SessionStart', 'Notification'];

// Must match src/generator/emit-gemini.js (the fragment file carries them).
const MARKER_BEGIN = '# BEGIN hydra (generated — do not edit)';
const MARKER_END = '# END hydra';

function configDir(override) {
  return override || process.env.GEMINI_CONFIG_DIR || path.join(os.homedir(), '.gemini');
}

function detect() {
  return fs.existsSync(configDir());
}

function bases(scope, override) {
  const globalBase = configDir(override);
  const localBase = path.join(process.cwd(), '.gemini');
  if (scope === 'both') return [[globalBase, 'Global (~/.gemini/)'], [localBase, 'Local (./.gemini/)']];
  if (scope === 'local') return [[localBase, 'Local (./.gemini/)']];
  return [[globalBase, 'Global (~/.gemini/)']];
}

// Payload manifest for one base (agents + commands + skill files; hooks and
// settings/GEMINI.md are handled separately, always at user level).
function buildManifest(base, version) {
  const entries = [];
  const add = (relSrc, dest, display) =>
    entries.push({ absPath: path.join(DIST, relSrc), dest, display, relPath: relSrc });

  for (const f of distFiles('agents')) {
    add(`agents/${f}`, path.join(base, 'agents', f), `agents/${f}`);
  }
  for (const f of distFiles('commands', 'hydra')) {
    add(`commands/hydra/${f}`, path.join(base, 'commands', 'hydra', f), `commands/hydra/${f}`);
  }
  add('SKILL.md', path.join(base, 'hydra', 'SKILL.md'), 'hydra/SKILL.md');
  add('skills/stfu-agents/SKILL.md', path.join(base, 'hydra', 'skills', 'stfu-agents', 'SKILL.md'), 'hydra/skills/stfu-agents/SKILL.md');
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

// Manifest lives at <base>/hydra/manifest.json (the shared manifest module
// hardcodes Claude's skills/hydra/ path, so this host writes its own).
function manifestPath(base) {
  return path.join(base, 'hydra', 'manifest.json');
}

function writeGeminiManifest(base, version, entries) {
  const manifest = {
    version,
    host: 'gemini',
    installedAt: new Date().toISOString(),
    files: entries.map((e) => ({
      path: e.dest,
      sha256: sha256(e.content !== undefined ? Buffer.from(e.content, 'utf8') : fs.readFileSync(e.absPath)),
    })),
  };
  fs.mkdirSync(path.dirname(manifestPath(base)), { recursive: true });
  fs.writeFileSync(manifestPath(base), JSON.stringify(manifest, null, 2));
}

function readGeminiManifest(base) {
  try { return JSON.parse(fs.readFileSync(manifestPath(base), 'utf8')); } catch { return null; }
}

// ── Hooks (always user-level) ────────────────────────────────────────────────

function hooksDir(override) {
  return path.join(configDir(override), 'hydra', 'hooks');
}

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

// Absolute path (not '~'): Gemini executes hook commands through the platform
// shell, and cmd.exe on Windows does not expand '~'. The string is stable
// across reinstalls on the same machine, which is what fingerprinting cares
// about (G12).
function hookCommand(script, configDirOverride) {
  return `node "${path.join(hooksDir(configDirOverride), script)}"`;
}

const isHydraEntry = (entry) =>
  entry && Array.isArray(entry.hooks) && entry.hooks.some(
    (h) => h && ((h.name && String(h.name).startsWith('hydra-')) || (h.command && h.command.includes('hydra-')))
  );

function registerHooksInSettings({ configDirOverride, log }) {
  const settingsFile = path.join(configDir(configDirOverride), 'settings.json');

  // Never clobber a file we can't faithfully round-trip: on parse failure or
  // an unexpected shape, warn and skip registration (file left untouched).
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

  settings.hooks.AfterTool.push({
    matcher: 'write_file|replace',
    hooks: [{ name: 'hydra-auto-guard', type: 'command', command: hookCommand('hydra-auto-guard.js', configDirOverride) }],
  });
  settings.hooks.SessionStart.push({
    matcher: 'startup',
    hooks: [{ name: 'hydra-check-update', type: 'command', command: hookCommand('hydra-check-update.js', configDirOverride) }],
  });
  settings.hooks.Notification.push({
    hooks: [{ name: 'hydra-notify', type: 'command', command: hookCommand('hydra-notify.js', configDirOverride) }],
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
    if (!isPlainObject(settings)) return; // missing or nothing of ours in it
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

// ── GEMINI.md marker block (always user-level; G15) ─────────────────────────

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// The block body must never cross another BEGIN marker — with a stray BEGIN
// in the file, a greedy-ish span would swallow user text up to the real END.
const BLOCK_RE = () =>
  new RegExp(`${escapeRe(MARKER_BEGIN)}(?:(?!${escapeRe(MARKER_BEGIN)})[\\s\\S])*?${escapeRe(MARKER_END)}\\n?`, 'g');

// Corrupted (unbalanced) markers mean we can't tell where our block ends —
// refuse to touch the file rather than risk eating user content.
function markersBalanced(text) {
  return text.split(MARKER_BEGIN).length === text.split(MARKER_END).length;
}

function writeContextBlock({ configDirOverride, log }) {
  const file = path.join(configDir(configDirOverride), 'GEMINI.md');
  const block = fs.readFileSync(path.join(DIST, 'GEMINI-fragment.md'), 'utf8').trim() + '\n';

  let text = '';
  try { text = fs.readFileSync(file, 'utf8'); } catch {}

  if (!markersBalanced(text)) {
    log.warn('GEMINI.md hydra markers are unbalanced — file left untouched (fix the markers and re-run)');
    return false;
  }

  // Strip every existing hydra block, then append exactly one.
  text = text.replace(BLOCK_RE(), '').trimEnd();
  text = text ? `${text}\n\n${block}` : block;

  fs.mkdirSync(path.dirname(file), { recursive: true });
  writeFileAtomic(file, text);
  log.ok('GEMINI.md hydra block written');
  return true;
}

function removeContextBlock({ configDirOverride, log }) {
  const file = path.join(configDir(configDirOverride), 'GEMINI.md');
  try {
    if (!fs.existsSync(file)) return;
    const text = fs.readFileSync(file, 'utf8');
    if (!markersBalanced(text)) {
      log.warn('GEMINI.md hydra markers are unbalanced — file left untouched');
      return;
    }
    const cleaned = text.replace(BLOCK_RE(), '').trimEnd();
    if (cleaned === text.trimEnd()) return; // no hydra block — leave the file alone
    if (cleaned === '') {
      // The file held only our block (install created it) — remove it.
      fs.unlinkSync(file);
    } else {
      writeFileAtomic(file, cleaned + '\n');
    }
    log.ok('GEMINI.md hydra block removed');
  } catch (err) {
    log.warn(`Could not update GEMINI.md: ${err.message}`);
  }
}

// ── Host interface ───────────────────────────────────────────────────────────

module.exports = {
  id: 'gemini',
  label: 'Gemini CLI',
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
    writes.push(`[context] ${path.join(configDir(configDirOverride), 'GEMINI.md')} (hydra marker block)`);
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
      try { writeGeminiManifest(base, version, entries); } catch { /* best-effort */ }
      log.blank();
    }

    installHooks({ configDirOverride, log });
    if (registerHooksInSettings({ configDirOverride, log }).failed) anyFailed = true;
    if (!writeContextBlock({ configDirOverride, log })) anyFailed = true;

    return { anyFailed, statusLineConfigured: false }; // Gemini has no statusline (G20)
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
    // Sweep hydra-OWNED entries under <user>/hydra/ only — user files there
    // (e.g. hydra/config/hydra.config.md) must survive; the trailing rmdir
    // removes the dir when nothing else remains.
    const hydraDir = path.join(configDir(configDirOverride), 'hydra');
    for (const owned of ['hooks', 'cache', 'skills', 'SKILL.md', 'VERSION', 'manifest.json']) {
      try { fs.rmSync(path.join(hydraDir, owned), { recursive: true, force: true }); } catch {}
    }
    try { fs.rmdirSync(hydraDir); } catch {}
  },

  postInstallNotes() {
    return [
      'Quick start:  /hydra:help   (inside Gemini CLI)',
      'Live stats:   /hydra:stats',
      'Restart Gemini CLI (or run /commands reload) to pick up the new commands.',
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
        manifest: readGeminiManifest(base),
      };
    }
    const dir = hooksDir(configDirOverride);
    result.hooks = HOOK_FILES.map((f) => ({ file: f, installed: fs.existsSync(path.join(dir, f)) }));
    return result;
  },
};
