'use strict';

// Codex CLI host installer.
//
// Layout (from dist/codex/):
//   <base>/agents/hydra-*.toml        (per scope; C1 — whole-file overwrite)
//   <base>/hydra/VERSION + manifest.json (per scope)
//   <user>/hydra/hooks/*.js + wav     (always user-level)
//   <skills root>/<name>/SKILL.md     (C12 — skills are USER-level:
//                                      ~/.agents/skills. TEST SEAM: when
//                                      configDirOverride is set, skills go to
//                                      <override>/.agents/skills so tests
//                                      never touch the real home dir.)
//   <user>/hooks.json                 JSON merge — dedupe entries whose
//                                      command/commandWindows mention 'hydra-'
//                                      (C6); file deleted when empty on
//                                      uninstall. Hooks stay INERT until the
//                                      user runs /hooks once to trust them
//                                      (C9 — trust hashes cannot be pre-written).
//   <user>/AGENTS.md                  marker block from AGENTS-fragment.md
//                                      (created if missing — C13)
//   <user>/config.toml                MARKER-BLOCK TEXT SURGERY ONLY (C15 —
//                                      the file holds hooks.state trust hashes
//                                      and MCP config; no comment-preserving
//                                      TOML lib exists, so we never parse-
//                                      rewrite it). Two mutations:
//                                        · notify chain (C11): the top-level
//                                          `notify` key is single-valued and
//                                          often occupied. An existing single-
//                                          line value is saved to
//                                          hydra/notify-prev.json AND commented
//                                          in place with '# hydra-prev: ';
//                                          our replacement lives in a marker
//                                          block INSERTED AT THE TOP of the
//                                          file (top-level keys appended at
//                                          EOF would bind to the last [table]).
//                                        · [features] hooks = true (C10): when
//                                          no [features] table exists, a
//                                          marker block APPENDED AT EOF carries
//                                          it; when one exists, a single
//                                          `hooks = true # hydra` line is
//                                          inserted into that table (a second
//                                          [features] header would be invalid
//                                          TOML). Uninstall reverses every
//                                          edit byte-exactly.

const fs = require('fs');
const path = require('path');
const os = require('os');

const { sha256 } = require('../manifest');
const { writeFileAtomic, readUserJson, isPlainObject } = require('../fsutil');

const DIST = path.resolve(__dirname, '..', '..', '..', 'dist', 'codex');

const HOOK_FILES = [
  'hydra-auto-guard.js',
  'hydra-check-update.js',
  'hydra-notify-chain.js',
  'hydra-sentinel-done.js',
  'hydra-token-math.js',
];
const BINARY_HOOKS = ['hydra-task-complete.wav'];

// Must match src/generator/emit-codex.js (the fragment file carries them).
const MARKER_BEGIN = '# BEGIN hydra (generated — do not edit)';
const MARKER_END = '# END hydra';

// Prefix used inside dist/codex/hooks-fragment.json, swapped for the
// machine-absolute hooks dir at install time.
const FRAGMENT_HOOKS_PREFIX = '~/.codex/hydra/hooks';

function configDir(override) {
  return override || process.env.CODEX_HOME || path.join(os.homedir(), '.codex');
}

// C12: user skills live in ~/.agents/skills (NOT ~/.codex/skills — that dir
// is system/curated). Test seam: a configDirOverride relocates the skills
// root under the override so tests stay inside their scratch dir.
function skillsRoot(override) {
  return override
    ? path.join(override, '.agents', 'skills')
    : path.join(os.homedir(), '.agents', 'skills');
}

function hooksDir(override) {
  return path.join(configDir(override), 'hydra', 'hooks');
}

function detect() {
  return fs.existsSync(configDir());
}

function bases(scope, override) {
  const globalBase = configDir(override);
  const localBase = path.join(process.cwd(), '.codex');
  if (scope === 'both') return [[globalBase, 'Global (~/.codex/)'], [localBase, 'Local (./.codex/)']];
  if (scope === 'local') return [[localBase, 'Local (./.codex/)']];
  return [[globalBase, 'Global (~/.codex/)']];
}

function distSkillNames() {
  try { return fs.readdirSync(path.join(DIST, 'skills')).sort(); } catch { return []; }
}

// Per-scope payload: agents + VERSION. Skills/hooks/AGENTS.md/config.toml are
// user-level and handled separately.
function buildManifest(base, version) {
  const entries = [];
  // Tolerant listing — status/uninstall must degrade gracefully when dist/
  // is missing; install fails fast on that upfront in installer/index.js.
  let agentFiles = [];
  try { agentFiles = fs.readdirSync(path.join(DIST, 'agents')).sort(); } catch {}
  for (const f of agentFiles) {
    entries.push({
      absPath: path.join(DIST, 'agents', f),
      dest: path.join(base, 'agents', f),
      display: `agents/${f}`,
    });
  }
  let refFiles = [];
  try { refFiles = fs.readdirSync(path.join(DIST, 'references')).sort(); } catch {}
  for (const f of refFiles) {
    entries.push({
      absPath: path.join(DIST, 'references', f),
      dest: path.join(base, 'hydra', 'references', f),
      display: `hydra/references/${f}`,
    });
  }
  entries.push({
    content: version,
    dest: path.join(base, 'hydra', 'VERSION'),
    display: 'hydra/VERSION',
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

function writeCodexManifest(base, version, entries) {
  const manifest = {
    version,
    host: 'codex',
    installedAt: new Date().toISOString(),
    files: entries.map((e) => ({
      path: e.dest,
      sha256: sha256(e.content !== undefined ? Buffer.from(e.content, 'utf8') : fs.readFileSync(e.absPath)),
    })),
  };
  fs.mkdirSync(path.dirname(manifestPath(base)), { recursive: true });
  fs.writeFileSync(manifestPath(base), JSON.stringify(manifest, null, 2));
}

function readCodexManifest(base) {
  try { return JSON.parse(fs.readFileSync(manifestPath(base), 'utf8')); } catch { return null; }
}

// ── Skills (user-level, C12) ────────────────────────────────────────────────

function installSkills({ configDirOverride, log }) {
  const root = skillsRoot(configDirOverride);
  let anyFailed = false;
  for (const name of distSkillNames()) {
    const dest = path.join(root, name, 'SKILL.md');
    try {
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.copyFileSync(path.join(DIST, 'skills', name, 'SKILL.md'), dest);
      log.file(`skills/${name}/SKILL.md`, true);
    } catch (err) {
      log.file(`skills/${name}/SKILL.md`, false, err.message);
      anyFailed = true;
    }
  }
  return anyFailed;
}

// ── Hook files (user-level) ─────────────────────────────────────────────────

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

// ── hooks.json merge (C6) ───────────────────────────────────────────────────

const isHydraEntry = (entry) =>
  entry && Array.isArray(entry.hooks) && entry.hooks.some(
    (h) => h && ((h.command || '').includes('hydra-') || (h.commandWindows || '').includes('hydra-'))
  );

function hooksJsonPath(configDirOverride) {
  return path.join(configDir(configDirOverride), 'hooks.json');
}

function registerHooksJson({ configDirOverride, log }) {
  const file = hooksJsonPath(configDirOverride);
  const dir = hooksDir(configDirOverride);

  // Never clobber a file we can't faithfully round-trip: on parse failure or
  // an unexpected shape, warn and skip registration (file left untouched).
  const { exists, data, error } = readUserJson(file);
  if (error) {
    log.warn(`hooks.json could not be parsed (${error}) — hook registration skipped, file left untouched`);
    return { failed: true };
  }
  const json = exists ? data : {};
  if (!isPlainObject(json) || (json.hooks !== undefined && !isPlainObject(json.hooks))) {
    log.warn('hooks.json has an unexpected shape — hook registration skipped, file left untouched');
    return { failed: true };
  }

  const frag = JSON.parse(fs.readFileSync(path.join(DIST, 'hooks-fragment.json'), 'utf8'));
  for (const event of Object.keys(frag.hooks)) {
    if (json.hooks && json.hooks[event] !== undefined && !Array.isArray(json.hooks[event])) {
      log.warn(`hooks.json hooks.${event} is not an array — hook registration skipped, file left untouched`);
      return { failed: true };
    }
  }
  if (!json.hooks) json.hooks = {};

  // Fully-native path (no mixed separators — the command string should be
  // byte-stable and shell-friendly on this machine).
  const resolve = (s) => (s || '').split(FRAGMENT_HOOKS_PREFIX + '/').join(dir + path.sep);

  for (const [event, entries] of Object.entries(frag.hooks)) {
    json.hooks[event] = (json.hooks[event] || []).filter((e) => !isHydraEntry(e));
    for (const entry of entries) {
      json.hooks[event].push({
        ...entry,
        hooks: entry.hooks.map((h) => ({
          ...h,
          command: resolve(h.command),
          commandWindows: resolve(h.commandWindows),
        })),
      });
    }
  }

  fs.mkdirSync(path.dirname(file), { recursive: true });
  writeFileAtomic(file, JSON.stringify(json, null, 2) + '\n');
  return { failed: false };
}

function deregisterHooksJson({ configDirOverride, log }) {
  const file = hooksJsonPath(configDirOverride);
  try {
    if (!fs.existsSync(file)) return;
    const { data: json, error } = readUserJson(file);
    if (error) { log.warn(`Could not update hooks.json: ${error}`); return; }
    if (!isPlainObject(json)) return; // nothing of ours in it
    if (json.hooks) {
      for (const event of Object.keys(json.hooks)) {
        json.hooks[event] = json.hooks[event].filter((e) => !isHydraEntry(e));
        if (!json.hooks[event].length) delete json.hooks[event];
      }
      if (!Object.keys(json.hooks).length) delete json.hooks;
    }
    if (!Object.keys(json).length) {
      fs.unlinkSync(file); // nothing left but our scaffolding — remove the file
      log.ok('hooks.json removed (contained only Hydra entries)');
    } else {
      writeFileAtomic(file, JSON.stringify(json, null, 2) + '\n');
      log.ok('Hydra entries removed from hooks.json');
    }
  } catch (err) {
    log.warn(`Could not update hooks.json: ${err.message}`);
  }
}

// ── AGENTS.md marker block (user-level; C13) ────────────────────────────────

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// The block body must never cross another BEGIN marker — with a stray BEGIN
// in the file, a greedy-ish span would swallow user text up to the real END.
const NOT_BEGIN = () => `(?:(?!${escapeRe(MARKER_BEGIN)})[\\s\\S])*?`;
const BLOCK_RE = () => new RegExp(`${escapeRe(MARKER_BEGIN)}${NOT_BEGIN()}${escapeRe(MARKER_END)}\\n?`, 'g');

// Corrupted (unbalanced) markers mean we can't tell where our block ends —
// refuse to touch the file rather than risk eating user content.
function markersBalanced(text) {
  return text.split(MARKER_BEGIN).length === text.split(MARKER_END).length;
}

function writeContextBlock({ configDirOverride, log }) {
  const file = path.join(configDir(configDirOverride), 'AGENTS.md');
  const block = fs.readFileSync(path.join(DIST, 'AGENTS-fragment.md'), 'utf8').trim() + '\n';

  let text = '';
  try { text = fs.readFileSync(file, 'utf8'); } catch {}

  if (!markersBalanced(text)) {
    log.warn('AGENTS.md hydra markers are unbalanced — file left untouched (fix the markers and re-run)');
    return false;
  }

  text = text.replace(BLOCK_RE(), '').trimEnd();
  text = text ? `${text}\n\n${block}` : block;

  fs.mkdirSync(path.dirname(file), { recursive: true });
  writeFileAtomic(file, text);
  log.ok('AGENTS.md hydra block written');
  return true;
}

function removeContextBlock({ configDirOverride, log }) {
  const file = path.join(configDir(configDirOverride), 'AGENTS.md');
  try {
    if (!fs.existsSync(file)) return;
    const text = fs.readFileSync(file, 'utf8');
    if (!markersBalanced(text)) {
      log.warn('AGENTS.md hydra markers are unbalanced — file left untouched');
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
    log.ok('AGENTS.md hydra block removed');
  } catch (err) {
    log.warn(`Could not update AGENTS.md: ${err.message}`);
  }
}

// ── config.toml text surgery (C10/C11/C15) ──────────────────────────────────
//
// Pure text→text functions, exported for direct fixture testing. Every edit
// is reversible byte-exactly:
//   · marker blocks are inserted whole and stripped whole;
//   · a displaced user line gets a '# hydra-prev: ' prefix, stripped on
//     uninstall;
//   · lines we add inside a user table carry a ' # hydra' suffix and are
//     deleted on uninstall.

const HYDRA_LINE_RE = /^[^\n]* # hydra\n/gm;
const TOP_BLOCK_RE = () => new RegExp(`^${escapeRe(MARKER_BEGIN)}\\n${NOT_BEGIN()}${escapeRe(MARKER_END)}\\n\\n?`);
const EOF_BLOCK_RE = () => new RegExp(`\\n${escapeRe(MARKER_BEGIN)}\\n${NOT_BEGIN()}${escapeRe(MARKER_END)}\\n?$`);

function stripHydraArtifacts(text) {
  text = text.replace(TOP_BLOCK_RE(), '');
  text = text.replace(EOF_BLOCK_RE(), ''); // includes the separator \n we appended
  text = text.replace(BLOCK_RE(), ''); // stragglers (blocks moved by the user)
  text = text.replace(HYDRA_LINE_RE, '');
  return text;
}

// Best-effort argv parse of a single-line `notify = [ ... ]` TOML value.
// Handles basic ("...", JSON-compatible escapes) and literal ('...') strings.
// Returns null when nothing parseable — the chain shim then skips spawning.
function parseNotifyArgv(line) {
  const m = /^notify\s*=\s*\[([\s\S]*)\]\s*(#.*)?$/.exec(line.trim());
  if (!m) return null;
  const parts = [];
  const re = /"((?:[^"\\]|\\.)*)"|'([^']*)'/g;
  let mm;
  while ((mm = re.exec(m[1]))) {
    try {
      parts.push(mm[1] !== undefined ? JSON.parse(`"${mm[1]}"`) : mm[2]);
    } catch { return null; }
  }
  return parts.length ? parts : null;
}

function tomlPathString(p) {
  return p.includes("'") ? JSON.stringify(p) : `'${p}'`;
}

// Install-side surgery. notifyChainScript = absolute path of the installed
// hydra-notify-chain.js. Returns { text, savedNotify, notifySkipped }.
function applyConfigToml(text, { notifyChainScript }) {
  text = stripHydraArtifacts(text);
  let savedNotify = null;
  let notifySkipped = false;

  // ── notify chain (C11) — operate on the top-level region only ─────────────
  // TOML allows leading whitespace before keys and table headers, so the
  // anchors tolerate indentation; a notify-looking line the strict parse
  // can't own falls back to notifySkipped (never a duplicate key).
  const firstTable = text.search(/^[ \t]*\[/m);
  const topRegion = firstTable === -1 ? text : text.slice(0, firstTable);
  const notifyLines = topRegion.match(/^[ \t]*notify[ \t]*=[^\n]*$/gm) || [];

  if (notifyLines.length > 1) {
    // Two top-level notify keys is already invalid TOML — we can't own it.
    notifySkipped = true;
  } else if (notifyLines.length === 1) {
    const line = notifyLines[0];
    if (line.includes('hydra-notify-chain')) {
      // A stale copy of our own line outside the marker block — drop it.
      text = text.replace(line + '\n', '').replace(line, '');
    } else if (/^notify\s*=\s*\[[^\]]*\]\s*(#.*)?$/.test(line.trim())) {
      // Newest save wins: drop older saved copies, then comment this one out
      // in place. (Restoring two notify lines would be duplicate-key TOML.)
      text = text.replace(/^# hydra-prev: [ \t]*notify[^\n]*\n/gm, '');
      savedNotify = { line, argv: parseNotifyArgv(line) };
      // Function replacement — user text may contain `$&`-style sequences.
      text = text.replace(line, () => `# hydra-prev: ${line}`);
    } else {
      // Multi-line notify array — commenting one line would corrupt the file,
      // and adding ours would be a duplicate key. Leave the user's intact.
      notifySkipped = true;
    }
  }

  if (!notifySkipped) {
    const notifyLine = `notify = ["node", ${tomlPathString(notifyChainScript)}]`;
    text = `${MARKER_BEGIN}\n${notifyLine}\n${MARKER_END}\n\n${text}`;
  }

  // ── [features] hooks = true (C10) ─────────────────────────────────────────
  // NB: [^\S\n] = whitespace-but-not-newline — a bare \s* would swallow the
  // line terminator in multiline mode and drag it into the match. The header
  // may be indented and carry a trailing comment — both are valid TOML, and
  // missing them would append a duplicate [features] table (invalid TOML).
  const featHeader = /^[ \t]*\[features\][^\S\n]*(?:#[^\n]*)?$/m.exec(text);
  if (featHeader) {
    const bodyStart = Math.min(featHeader.index + featHeader[0].length + 1, text.length);
    const rest = text.slice(bodyStart);
    const nextTable = rest.search(/^[ \t]*\[/m);
    const body = nextTable === -1 ? rest : rest.slice(0, nextTable);
    const hooksLine = /^[ \t]*hooks[^\S\n]*=[^\S\n]*(.+?)[^\S\n]*$/m.exec(body);
    if (!hooksLine) {
      text = text.slice(0, bodyStart) + 'hooks = true # hydra\n' + text.slice(bodyStart);
    } else if (hooksLine[1] !== 'true') {
      const swapped = body.replace(hooksLine[0], () => `# hydra-prev: ${hooksLine[0]}\nhooks = true # hydra`);
      text = text.slice(0, bodyStart) + swapped + (nextTable === -1 ? '' : rest.slice(nextTable));
    } // hooks = true already active → nothing to do
  } else {
    if (text.length && !text.endsWith('\n')) text += '\n';
    text += `\n${MARKER_BEGIN}\n[features]\nhooks = true\n${MARKER_END}\n`;
  }

  return { text, savedNotify, notifySkipped };
}

// Uninstall-side surgery. pruneStatePath: when set (our hooks.json was fully
// removed), [hooks.state.'<path>:...'] entries — header line + trusted_hash
// line (C9 snake_case shape) — are deleted. When our hooks.json still exists
// (user kept non-hydra entries in it), trust state is left alone: entry
// indexes reshuffle and Codex re-prompts on the next /hooks review anyway.
function cleanConfigToml(text, { pruneStatePath = null } = {}) {
  text = stripHydraArtifacts(text);
  text = text.replace(/^# hydra-prev: /gm, '');
  if (pruneStatePath) {
    // Header line + its trusted_hash line + one trailing blank line (C9 shape).
    const stateRe = new RegExp(
      `\\[hooks\\.state\\.(['"])${escapeRe(pruneStatePath)}:[^\\]]*\\1\\]\\r?\\n(?:trusted_hash[^\\n]*\\n?)?(?:\\r?\\n)?`,
      'gi'
    );
    text = text.replace(stateRe, '');
  }
  return text;
}

function configTomlPath(configDirOverride) {
  return path.join(configDir(configDirOverride), 'config.toml');
}

function notifyPrevPath(configDirOverride) {
  return path.join(configDir(configDirOverride), 'hydra', 'notify-prev.json');
}

function mutateConfigToml({ configDirOverride, log }) {
  const file = configTomlPath(configDirOverride);
  let text = '';
  try { text = fs.readFileSync(file, 'utf8'); } catch {}

  const { text: next, savedNotify, notifySkipped } = applyConfigToml(text, {
    notifyChainScript: path.join(hooksDir(configDirOverride), 'hydra-notify-chain.js'),
  });

  if (savedNotify) {
    const prevFile = notifyPrevPath(configDirOverride);
    // Newest save wins — but never silently: name the command being discarded.
    try {
      const prev = JSON.parse(fs.readFileSync(prevFile, 'utf8'));
      if (prev && prev.line && prev.line !== savedNotify.line) {
        log.warn(`Discarding previously saved notify command (${prev.line.trim()}) — newest save wins`);
      }
    } catch {}
    fs.mkdirSync(path.dirname(prevFile), { recursive: true });
    fs.writeFileSync(prevFile, JSON.stringify(savedNotify, null, 2));
    log.ok('Existing notify command saved (will be chained after the Hydra sound)');
  }
  if (notifySkipped) {
    log.warn('config.toml notify could not be owned as a single-line array — left untouched; Hydra sound notifications disabled');
  }

  fs.mkdirSync(path.dirname(file), { recursive: true });
  writeFileAtomic(file, next);
  log.ok('config.toml hydra blocks written ([features] hooks, notify chain)');
}

function cleanConfig({ configDirOverride, log }) {
  const file = configTomlPath(configDirOverride);
  try {
    if (!fs.existsSync(file)) return;
    const jsonGone = !fs.existsSync(hooksJsonPath(configDirOverride));
    const text = fs.readFileSync(file, 'utf8');
    const cleaned = cleanConfigToml(text, {
      pruneStatePath: jsonGone ? hooksJsonPath(configDirOverride) : null,
    });
    if (cleaned === text) return; // nothing of ours in the file — leave it alone
    if (cleaned.trim() === '') {
      // Everything in the file was ours (install created it) — remove it
      // rather than leaving an empty config.toml behind.
      fs.unlinkSync(file);
    } else {
      writeFileAtomic(file, cleaned);
    }
    log.ok('config.toml restored (hydra blocks removed, previous notify reinstated)');
  } catch (err) {
    log.warn(`Could not update config.toml: ${err.message}`);
  }
}

// ── Host interface ───────────────────────────────────────────────────────────

module.exports = {
  id: 'codex',
  label: 'Codex CLI',
  detect,
  configDir,
  distDir: DIST,

  hasAnyInstalled(scope, configDirOverride, version) {
    return bases(scope, configDirOverride).some(([base]) =>
      buildManifest(base, version).some((e) => fs.existsSync(e.dest))) ||
      distSkillNames().some((n) => fs.existsSync(path.join(skillsRoot(configDirOverride), n, 'SKILL.md')));
  },

  plan(scope, configDirOverride, version) {
    const writes = [];
    for (const [base, label] of bases(scope, configDirOverride)) {
      for (const e of buildManifest(base, version)) writes.push(`[${label}] ${e.dest}`);
    }
    const root = skillsRoot(configDirOverride);
    for (const n of distSkillNames()) writes.push(`[skills] ${path.join(root, n, 'SKILL.md')}`);
    const dir = hooksDir(configDirOverride);
    for (const f of [...HOOK_FILES, ...BINARY_HOOKS]) writes.push(`[hooks] ${path.join(dir, f)}`);
    writes.push(`[hooks] ${hooksJsonPath(configDirOverride)} (PostToolUse, SessionStart — trust via /hooks)`);
    writes.push(`[context] ${path.join(configDir(configDirOverride), 'AGENTS.md')} (hydra marker block)`);
    writes.push(`[config] ${configTomlPath(configDirOverride)} (marker blocks: [features] hooks, notify chain)`);
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
      try { writeCodexManifest(base, version, entries); } catch { /* best-effort */ }
      log.blank();
    }

    if (installSkills({ configDirOverride, log })) anyFailed = true;
    installHooks({ configDirOverride, log });
    if (registerHooksJson({ configDirOverride, log }).failed) anyFailed = true;
    if (!writeContextBlock({ configDirOverride, log })) anyFailed = true;
    mutateConfigToml({ configDirOverride, log });

    return { anyFailed, statusLineConfigured: false }; // Codex has no statusline
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
    const root = skillsRoot(configDirOverride);
    for (const n of distSkillNames()) {
      const dest = path.join(root, n, 'SKILL.md');
      if (fs.existsSync(dest)) targets.push({ label: 'Skills', dest, display: `skills/${n}/SKILL.md` });
    }
    const dir = hooksDir(configDirOverride);
    for (const f of [...HOOK_FILES, ...BINARY_HOOKS]) {
      const dest = path.join(dir, f);
      if (fs.existsSync(dest)) targets.push({ label: 'Hooks', dest, display: `hydra/hooks/${f}` });
    }
    for (const [dest, display] of [
      [notifyPrevPath(configDirOverride), 'hydra/notify-prev.json'],
      [path.join(configDir(configDirOverride), 'hydra', 'cache', 'hydra-update-check.json'), 'hydra/cache/hydra-update-check.json'],
    ]) {
      if (fs.existsSync(dest)) targets.push({ label: 'Cache', dest, display });
    }
    return targets;
  },

  uninstallExtras({ configDirOverride, log }) {
    deregisterHooksJson({ configDirOverride, log });
    removeContextBlock({ configDirOverride, log });
    cleanConfig({ configDirOverride, log }); // after hooks.json removal — state pruning checks it
    // Sweep now-empty skill dirs (rmdir only — a user's own files inside a
    // skill dir survive) and the hydra-OWNED entries under <config>/hydra/;
    // user files there (e.g. hydra/config/) must survive the uninstall.
    const root = skillsRoot(configDirOverride);
    for (const n of distSkillNames()) {
      try { fs.rmdirSync(path.join(root, n)); } catch {}
    }
    const hydraDir = path.join(configDir(configDirOverride), 'hydra');
    for (const owned of ['hooks', 'cache', 'references', 'VERSION', 'manifest.json', 'notify-prev.json']) {
      try { fs.rmSync(path.join(hydraDir, owned), { recursive: true, force: true }); } catch {}
    }
    try { fs.rmdirSync(hydraDir); } catch {}
  },

  postInstallNotes() {
    return [
      'REQUIRED: run /hooks inside Codex once to review and trust the Hydra hooks (they stay inert until then).',
      'Commands are skills invoked with a $ trigger: $hydra-help, $hydra-stats, $hydra-guard, $hydra-status, ...',
      'Restart Codex CLI to pick up the new agents and skills.',
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
        manifest: readCodexManifest(base),
      };
    }
    const root = skillsRoot(configDirOverride);
    const names = distSkillNames();
    result.Skills = {
      installed: names.filter((n) => fs.existsSync(path.join(root, n, 'SKILL.md'))).length,
      total: names.length,
    };
    const dir = hooksDir(configDirOverride);
    result.hooks = HOOK_FILES.map((f) => ({ file: f, installed: fs.existsSync(path.join(dir, f)) }));
    return result;
  },

  // Exported for direct fixture testing of the config.toml text surgery.
  applyConfigToml,
  cleanConfigToml,
  parseNotifyArgv,
};
