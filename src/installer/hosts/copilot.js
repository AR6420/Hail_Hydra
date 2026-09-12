'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { writeFileAtomic } = require('../fsutil');

const DIST = path.resolve(__dirname, '..', '..', '..', 'dist', 'copilot');
const SKILL = path.join('skills', 'hail-hydra');
const MANIFEST = '.hydra-manifest.json';
const OWNED_FILE = /^(?:SKILL\.md|VERSION|references\/(?:roles\.json|hydra-[a-z-]+\.md)|scripts\/hydra-(?:control|usage)\.js)$/;

function checkPath(base, relative) {
  let current = path.resolve(base);
  for (const part of relative.split(/[\\/]/)) {
    current = path.join(current, part);
    try {
      if (fs.lstatSync(current).isSymbolicLink()) {
        throw new Error(`Refusing to follow a symlink in the Copilot payload: ${current}`);
      }
    } catch (err) {
      if (err.code !== 'ENOENT') throw err;
    }
  }
}

function configDir(override) {
  return override || path.join(os.homedir(), '.copilot');
}

function localDir() {
  return path.join(process.cwd(), '.github');
}

function bases(scope, override) {
  const global = [configDir(override), 'Global Copilot'];
  const local = [localDir(), 'Local Copilot'];
  if (scope === 'global') return [global];
  if (scope === 'local') return [local];
  if (scope === 'both') {
    const normalize = (dir) => process.platform === 'win32'
      ? path.resolve(dir).toLowerCase() : path.resolve(dir);
    return normalize(global[0]) === normalize(local[0]) ? [global] : [global, local];
  }
  throw new Error(`Unsupported Copilot scope '${scope}'`);
}

function distFiles(dir = path.join(DIST, SKILL), prefix = '') {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }
  return entries.flatMap((entry) => {
    const relative = prefix + entry.name;
    return entry.isDirectory()
      ? distFiles(path.join(dir, entry.name), relative + '/')
      : [relative];
  }).sort();
}

function recordedFiles(base) {
  checkPath(base, path.join(SKILL, MANIFEST));
  const file = path.join(base, SKILL, MANIFEST);
  let raw;
  try {
    raw = fs.readFileSync(file, 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT') return null;
    throw err;
  }
  let manifest;
  try {
    manifest = JSON.parse(raw);
  } catch (err) {
    throw new Error(`Cannot parse Copilot Hydra manifest ${file}: ${err.message}`);
  }
  if (!manifest || manifest.host !== 'copilot' || !Array.isArray(manifest.files) ||
      manifest.files.some((name) => typeof name !== 'string' || !OWNED_FILE.test(name))) {
    throw new Error(`Invalid Copilot Hydra manifest ${file}; no files removed`);
  }
  return manifest.files;
}

function buildManifest(base, version) {
  return distFiles().map((file) => {
    if (!OWNED_FILE.test(file)) throw new Error(`Unexpected Copilot payload file '${file}'`);
    return {
      absPath: path.join(DIST, SKILL, file),
      dest: path.join(base, SKILL, file),
      display: path.join(SKILL, file),
      ...(file === 'VERSION' ? { content: version + '\n' } : {}),
    };
  });
}

function install({ scope, configDirOverride, version, log }) {
  for (const [base, label] of bases(scope, configDirOverride)) {
    const entries = buildManifest(base, version);
    if (!entries.length) throw new Error("Copilot payload missing; run 'npm run build' first");
    for (const entry of entries) checkPath(base, path.relative(base, entry.dest));
    checkPath(base, path.join(SKILL, MANIFEST));
    log.header(`${label} (${base})`);
    // Record ownership first so uninstall also handles an interrupted install.
    fs.mkdirSync(path.join(base, SKILL), { recursive: true });
    writeFileAtomic(path.join(base, SKILL, MANIFEST), JSON.stringify({
      host: 'copilot',
      version,
      files: entries.map((entry) => path.relative(path.join(base, SKILL), entry.dest).split(path.sep).join('/')),
    }, null, 2) + '\n');
    for (const entry of entries) {
      fs.mkdirSync(path.dirname(entry.dest), { recursive: true });
      writeFileAtomic(entry.dest, entry.content === undefined
        ? fs.readFileSync(entry.absPath, 'utf8') : entry.content);
      log.file(entry.display, true);
    }
  }
  return { anyFailed: false, statusLineConfigured: false };
}

function uninstallTargets(override) {
  const targets = [];
  for (const [base, label] of bases('both', override)) {
    const recorded = recordedFiles(base);
    if (!recorded) continue;
    const files = new Set([...recorded, MANIFEST]);
    for (const file of files) {
      if (file !== MANIFEST && !OWNED_FILE.test(file)) {
        throw new Error(`Unexpected Copilot payload file '${file}'`);
      }
      checkPath(base, path.join(SKILL, file));
      const dest = path.join(base, SKILL, file);
      if (fs.existsSync(dest)) targets.push({ dest, display: dest, label });
    }
  }
  return targets;
}

function status(override) {
  const result = {};
  for (const [base, label] of bases('both', override)) {
    const files = [...new Set([...distFiles(), ...(recordedFiles(base) || [])])];
    const versionFile = path.join(base, SKILL, 'VERSION');
    result[label] = {
      installed: files.filter((file) => fs.existsSync(path.join(base, SKILL, file))).length,
      total: files.length,
      version: fs.existsSync(versionFile) ? fs.readFileSync(versionFile, 'utf8').trim() : null,
    };
  }
  return result;
}

module.exports = {
  id: 'copilot',
  label: 'GitHub Copilot CLI',
  distDir: DIST,
  payloadEntry: path.join(SKILL, 'SKILL.md'),
  automaticHooks: false,
  configDir,
  localDir,
  detect: () => fs.existsSync(configDir()),
  buildManifest,
  install,
  plan: (scope, override, version) => bases(scope, override).flatMap(([base]) =>
    [...buildManifest(base, version).map((entry) => entry.dest), path.join(base, SKILL, MANIFEST)]),
  hasAnyInstalled: (scope, override) => bases(scope, override).some(([base]) =>
    fs.existsSync(path.join(base, SKILL, 'SKILL.md'))),
  uninstallTargets,
  uninstallExtras() {},
  status,
  postInstallNotes: () => [
    'Run /skills reload in the current Copilot session, then /skills info hail-hydra.',
    'Use /hail-hydra <task> for this request only; unprefixed messages use the normal agent.',
    'One goal selects relevant heads automatically; deployment requires a clear, authorized target.',
    'Use /hail-hydra --help for explicit utilities and native usage/context guidance.',
    'Task modes: --mode turbo, balanced (default), or economy; your main model stays selected.',
    'Compatibility mode: skill loading is allowed; explicit-request-only routing relies on instructions.',
    'No automatic hooks, global instructions or persistent agent/model changes are installed.',
    'Model routing depends on native subagent support; cost and speed savings are not guaranteed.',
  ],
};
