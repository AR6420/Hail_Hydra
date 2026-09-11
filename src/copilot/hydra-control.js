#!/usr/bin/env node
'use strict';

const fs = require('fs');
const https = require('https');
const path = require('path');

const DEFAULT_ROOT = path.resolve(__dirname, '..');
const SKILL_NAME = 'hail-hydra';
const MANIFEST_FILE = '.hydra-manifest.json';
const ROLES_FILE = 'references/roles.json';
const UTILITY_GUIDE_FILES = [
  'references/hydra-commands.md',
  'references/hydra-measurements.md',
];
const UTILITY_GUIDE_SET = new Set(UTILITY_GUIDE_FILES);
const REQUIRED_MANIFEST_FILES = [
  'SKILL.md',
  'VERSION',
  ROLES_FILE,
  ...UTILITY_GUIDE_FILES,
  'scripts/hydra-control.js',
  'scripts/hydra-usage.js',
];
const MAX_MAP_BYTES = 10 * 1024 * 1024;
const MAX_GRAPH_FILES = 20000;
const MAX_RELATIONS = 4096;
const MAX_ENV_VARS = 2048;
const MAX_REGISTRY_BYTES = 65536;
const REGISTRY_TIMEOUT_MS = 5000;
const LATEST_URL = 'https://registry.npmjs.org/hail-hydra-cc/latest';
const ROLE_FILE_RE = /^references\/hydra-[a-z-]+\.md$/;
const ROLE_NAME_RE = /^hydra-[a-z-]+$/;
const MANIFEST_ENTRY_RE = /^(?:SKILL\.md|VERSION|references\/roles\.json|references\/hydra-[a-z-]+\.md|scripts\/hydra-control\.js|scripts\/hydra-usage\.js)$/;
const BASIC_SEMVER_RE = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/;
const ENV_VAR_NAME_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;
const HELP_FLAGS = [
  { flag: '--help', usage: '--help', helperCommand: 'help', nativeHelper: true, description: 'Show explicit /hail-hydra management routes.' },
  { flag: '--status', usage: '--status', helperCommand: 'status', nativeHelper: true, description: 'Inspect the installed Copilot Hydra skill payload.' },
  { flag: '--stats', usage: '--stats [receipt]', nativeHelper: false, description: 'Instruction route for usage or receipt analysis.' },
  { flag: '--compare', usage: '--compare <normal> <hydra>', nativeHelper: false, description: 'Instruction route for before/after task comparison.' },
  { flag: '--map', usage: '--map [rebuild|file]', helperCommand: 'map <map-json> [project-relative-file]', nativeHelper: true, description: 'Inspect an explicit dependency map JSON file; rebuild is instruction-only.' },
  { flag: '--preflight', usage: '--preflight', nativeHelper: false, description: 'Instruction route for readiness checks.' },
  { flag: '--guard', usage: '--guard [files]', nativeHelper: false, description: 'Instruction route for focused integration checks.' },
  { flag: '--quiet', usage: '--quiet <goal>', nativeHelper: false, description: 'Instruction route for reduced-chatter execution.' },
  { flag: '--stfu', usage: '--stfu <goal>', nativeHelper: false, description: 'Instruction route for terse execution.' },
  { flag: '--update', usage: '--update', helperCommand: 'check-update', nativeHelper: true, description: 'Check npm for a newer hail-hydra-cc release.' },
  { flag: '--report', usage: '--report [bug|feature|feedback]', helperCommand: 'report [bug|feature|feedback]', nativeHelper: true, description: 'Return official issue links only; never submits.' },
  { flag: '--memory', usage: '--memory', nativeHelper: false, description: 'Instruction route for memory/context handling.' },
  { flag: '--context', usage: '--context', nativeHelper: false, description: 'Instruction route for context inspection.' },
  { flag: '--notify', usage: '--notify <goal>', helperCommand: 'notify <success|failure>', nativeHelper: true, description: 'Emit one terminal bell plus a concise status note.' },
];
const INSTRUCTION_ONLY_FLAGS = new Set(HELP_FLAGS.filter((item) => !item.nativeHelper).map((item) => item.flag));
const REPORT_LINKS = {
  bug: {
    kind: 'bug',
    url: 'https://github.com/AR6420/Hail_Hydra/issues/new?template=bug_report.md&labels=bug',
  },
  feature: {
    kind: 'feature',
    url: 'https://github.com/AR6420/Hail_Hydra/issues/new?template=feature_request.md&labels=enhancement',
  },
  feedback: {
    kind: 'feedback',
    url: 'https://github.com/AR6420/Hail_Hydra/issues/new?template=feedback.md&labels=feedback',
  },
};

class HydraControlError extends Error {
  constructor(message) {
    super(message);
    this.name = 'HydraControlError';
  }
}

function isPlainObject(value) {
  return Boolean(value) && Object.getPrototypeOf(value) === Object.prototype;
}

function fail(message) {
  throw new HydraControlError(message);
}

function splitRelativePath(relativePath) {
  return String(relativePath).split(/[\\/]+/).filter(Boolean);
}

function ensureRoot(root) {
  const resolved = path.resolve(root || DEFAULT_ROOT);
  let stat;
  try {
    stat = fs.lstatSync(resolved);
  } catch (err) {
    if (err.code === 'ENOENT') fail(`Hydra skill root not found: ${resolved}`);
    throw err;
  }
  if (!stat.isDirectory()) fail(`Hydra skill root is not a directory: ${resolved}`);
  if (stat.isSymbolicLink()) fail(`Refusing to inspect a symlinked Hydra skill root: ${resolved}`);
  return resolved;
}

function assertNoSymlink(root, relativePath) {
  let current = root;
  for (const segment of splitRelativePath(relativePath)) {
    current = path.join(current, segment);
    let stat;
    try {
      stat = fs.lstatSync(current);
    } catch (err) {
      if (err.code === 'ENOENT') return;
      throw err;
    }
    if (stat.isSymbolicLink()) fail(`Refusing to follow a symlink in the Hydra skill: ${current}`);
  }
}

function readManagedText(root, relativePath, label) {
  assertNoSymlink(root, relativePath);
  const filePath = path.join(root, ...splitRelativePath(relativePath));
  let stat;
  try {
    stat = fs.lstatSync(filePath);
  } catch (err) {
    if (err.code === 'ENOENT') fail(`Hydra installation is incomplete: missing ${label} (${relativePath}).`);
    throw err;
  }
  if (stat.isSymbolicLink()) fail(`Refusing to follow a symlink in the Hydra skill: ${filePath}`);
  if (!stat.isFile()) fail(`Hydra installation is incomplete: ${label} is not a regular file (${relativePath}).`);
  return fs.readFileSync(filePath, 'utf8');
}

function readJsonText(text, label) {
  try {
    return JSON.parse(text);
  } catch {
    fail(`Cannot parse ${label}.`);
  }
}

function readManagedJson(root, relativePath, label) {
  return readJsonText(readManagedText(root, relativePath, label), label);
}

function parseSemver(version) {
  const match = BASIC_SEMVER_RE.exec(String(version || '').trim());
  if (!match) return null;
  const prerelease = match[4] ? match[4].split('.') : [];
  for (const part of prerelease) {
    if (/^\d+$/.test(part) && part.length > 1 && part.startsWith('0')) return null;
  }
  return {
    raw: match[0],
    major: match[1],
    minor: match[2],
    patch: match[3],
    prerelease,
  };
}

function isNumericIdentifier(value) {
  return /^(0|[1-9]\d*)$/.test(value);
}

function compareNumericIdentifiers(left, right) {
  if (left.length !== right.length) return left.length < right.length ? -1 : 1;
  if (left === right) return 0;
  return left < right ? -1 : 1;
}

function parseRequiredSemver(version, label) {
  const parsed = parseSemver(version);
  if (!parsed) fail(`Invalid ${label}: expected semver.`);
  return parsed;
}

function validateManifest(root) {
  const manifestPath = path.join(root, MANIFEST_FILE);
  if (!fs.existsSync(manifestPath)) {
    fail(`Hydra skill is not installed at ${root}: missing ${MANIFEST_FILE}. Run the installed scripts\\hydra-control.js copy.`);
  }
  const manifest = readManagedJson(root, MANIFEST_FILE, MANIFEST_FILE);
  if (!isPlainObject(manifest) || !Array.isArray(manifest.files)) {
    fail(`Invalid Hydra manifest at ${manifestPath}: expected an object with host, version, and files.`);
  }
  if (manifest.host !== 'copilot') {
    fail(`Invalid Hydra manifest at ${manifestPath}: expected host "copilot".`);
  }
  const manifestVersion = parseRequiredSemver(manifest.version, 'manifest version').raw;
  const files = [];
  const fileSet = new Set();
  for (const entry of manifest.files) {
    if (typeof entry !== 'string' || !MANIFEST_ENTRY_RE.test(entry)) {
      fail(`Invalid Hydra manifest at ${manifestPath}: owned files must match the allowlist.`);
    }
    if (fileSet.has(entry)) {
      fail(`Invalid Hydra manifest at ${manifestPath}: duplicate owned files are not allowed.`);
    }
    fileSet.add(entry);
    files.push(entry);
  }
  for (const required of REQUIRED_MANIFEST_FILES) {
    if (!fileSet.has(required)) {
      fail(`Hydra installation is incomplete: ${required} is not recorded in ${MANIFEST_FILE}.`);
    }
  }
  return { files: files.sort(), fileSet, manifestVersion };
}

function readFrontmatter(text) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(text);
  if (!match) fail('Invalid SKILL.md: frontmatter is required.');
  const frontmatter = Object.create(null);
  for (const line of match[1].split(/\r?\n/)) {
    if (!line.trim()) continue;
    const split = line.indexOf(':');
    if (split === -1) continue;
    frontmatter[line.slice(0, split).trim()] = line.slice(split + 1).trim();
  }
  return frontmatter;
}

function parseBooleanField(frontmatter, key) {
  if (!Object.prototype.hasOwnProperty.call(frontmatter, key)) {
    fail(`Invalid SKILL.md: missing ${key} frontmatter.`);
  }
  if (frontmatter[key] === 'true') return true;
  if (frontmatter[key] === 'false') return false;
  fail(`Invalid SKILL.md: ${key} must be true or false.`);
}

function validateActivationBoundary(skillText) {
  const frontmatter = readFrontmatter(skillText);
  if (frontmatter.name !== SKILL_NAME) {
    fail(`Invalid SKILL.md: expected name ${SKILL_NAME}.`);
  }
  if (!parseBooleanField(frontmatter, 'user-invocable') ||
      !parseBooleanField(frontmatter, 'disable-model-invocation')) {
    fail('Invalid SKILL.md: expected manual-only activation for hail-hydra.');
  }
  return true;
}

function validateRolesCatalog(root, ownedFiles) {
  const rolesPath = path.join(root, ...splitRelativePath(ROLES_FILE));
  const roles = readManagedJson(root, ROLES_FILE, ROLES_FILE);
  if (!Array.isArray(roles)) fail(`Invalid role catalogue at ${rolesPath}: expected an array.`);
  if (!roles.length) fail(`Invalid role catalogue at ${rolesPath}: expected at least one role.`);
  const seenNames = new Set();
  const seenInstructions = new Set();
  for (const role of roles) {
    if (!isPlainObject(role) || typeof role.name !== 'string' || typeof role.instructions !== 'string') {
      fail(`Invalid role catalogue at ${rolesPath}: each role needs string name and instructions fields.`);
    }
    if (!ROLE_NAME_RE.test(role.name) || role.instructions !== `references/${role.name}.md`) {
      fail(`Invalid role catalogue at ${rolesPath}: role references must be exact Hydra reference files.`);
    }
    if (!ROLE_FILE_RE.test(role.instructions) || UTILITY_GUIDE_SET.has(role.instructions)) {
      fail(`Invalid role catalogue at ${rolesPath}: utility guides are not catalogue roles.`);
    }
    if (seenNames.has(role.name) || seenInstructions.has(role.instructions)) {
      fail(`Invalid role catalogue at ${rolesPath}: duplicate roles are not allowed.`);
    }
    if (!ownedFiles.has(role.instructions)) {
      fail(`Hydra installation is incomplete: ${role.instructions} is not owned by ${MANIFEST_FILE}.`);
    }
    seenNames.add(role.name);
    seenInstructions.add(role.instructions);
  }
  return roles;
}

function ensureOwnedFilesPresent(root, files) {
  for (const relativePath of files) {
    readManagedText(root, relativePath, relativePath);
  }
}

function inspectStatus(root) {
  const resolvedRoot = ensureRoot(root);
  const { files, fileSet, manifestVersion } = validateManifest(resolvedRoot);
  ensureOwnedFilesPresent(resolvedRoot, files);
  const version = parseRequiredSemver(readManagedText(resolvedRoot, 'VERSION', 'VERSION'), 'installed VERSION').raw;
  if (manifestVersion !== version) {
    fail(`Hydra installation is incomplete: ${MANIFEST_FILE} version does not match VERSION.`);
  }
  validateActivationBoundary(readManagedText(resolvedRoot, 'SKILL.md', 'SKILL.md'));
  const roles = validateRolesCatalog(resolvedRoot, fileSet);
  return {
    command: 'status',
    installed: true,
    version,
    roleCount: roles.length,
    ownedFileCount: files.length,
    activationManualOnly: true,
    hooksInstalledByThisIntegration: false,
  };
}

function normalizeGraphPath(value, label) {
  if (typeof value !== 'string') fail(`Invalid ${label}: expected a string.`);
  const normalized = value.trim().replace(/\\/g, '/');
  if (!normalized || normalized.startsWith('/') || /^[A-Za-z]:/.test(normalized) || normalized.startsWith('//')) {
    fail(`Invalid ${label}: expected a project-relative path.`);
  }
  const parts = normalized.split('/');
  if (parts.some((part) => !part || part === '.' || part === '..')) {
    fail(`Invalid ${label}: path traversal is not allowed.`);
  }
  return parts.join('/');
}

function normalizeStringArray(value, label, pathLike, maxItems) {
  if (!Array.isArray(value)) fail(`Invalid ${label}: expected an array.`);
  if (value.length > maxItems) fail(`Invalid ${label}: too many entries.`);
  const seen = new Set();
  const normalized = [];
  for (const item of value) {
    if (typeof item !== 'string') fail(`Invalid ${label}: entries must be strings.`);
    const next = pathLike ? normalizeGraphPath(item, label) : item.trim();
    if (!next) fail(`Invalid ${label}: empty entries are not allowed.`);
    if (seen.has(next)) continue;
    seen.add(next);
    normalized.push(next);
  }
  return normalized;
}

function parseEnvVarIndex(value, sourceLabel) {
  if (value === undefined) return new Map();
  if (!isPlainObject(value)) fail(`Invalid map data in ${sourceLabel}: env_vars must be an object when present.`);
  const entries = Object.entries(value);
  if (entries.length > MAX_ENV_VARS) fail(`Invalid map data in ${sourceLabel}: too many env_vars entries.`);
  const envVars = new Map();
  for (const [name, references] of entries) {
    if (!ENV_VAR_NAME_RE.test(name)) {
      fail(`Invalid map data in ${sourceLabel}: env_vars names must be canonical environment variable names.`);
    }
    envVars.set(name, normalizeStringArray(references, `${name} env_vars`, true, MAX_RELATIONS));
  }
  return envVars;
}

function parseMapObject(payload, sourceLabel) {
  if (!isPlainObject(payload)) fail(`Invalid map data in ${sourceLabel}: expected a JSON object.`);
  if (!isPlainObject(payload._meta)) fail(`Invalid map data in ${sourceLabel}: missing _meta object.`);
  const meta = payload._meta;
  if (!Number.isInteger(meta.file_count) || meta.file_count < 0) {
    fail(`Invalid map data in ${sourceLabel}: _meta.file_count must be a non-negative integer.`);
  }
  if (typeof meta.git_hash !== 'string' || !meta.git_hash.trim()) {
    fail(`Invalid map data in ${sourceLabel}: _meta.git_hash must be a string.`);
  }
  if (typeof meta.built_at !== 'string' || !meta.built_at.trim()) {
    fail(`Invalid map data in ${sourceLabel}: _meta.built_at must be a string.`);
  }
  if (Object.prototype.hasOwnProperty.call(meta, 'coverage') &&
      meta.coverage !== 'complete' && meta.coverage !== 'partial') {
    fail(`Invalid map data in ${sourceLabel}: _meta.coverage must be complete or partial.`);
  }
  if (!isPlainObject(payload.files)) fail(`Invalid map data in ${sourceLabel}: files must be an object.`);
  const entries = Object.entries(payload.files);
  if (entries.length > MAX_GRAPH_FILES) fail(`Invalid map data in ${sourceLabel}: too many files.`);
  const files = new Map();
  for (const [rawFile, rawInfo] of entries) {
    const file = normalizeGraphPath(rawFile, 'map file path');
    if (!isPlainObject(rawInfo)) fail(`Invalid map data in ${sourceLabel}: each file entry must be an object.`);
    if (files.has(file)) fail(`Invalid map data in ${sourceLabel}: duplicate file paths are not allowed.`);
    if (!Object.prototype.hasOwnProperty.call(rawInfo, 'imports') ||
        !Object.prototype.hasOwnProperty.call(rawInfo, 'imported_by')) {
      fail(`Invalid map data in ${sourceLabel}: each file entry needs imports and imported_by arrays.`);
    }
    if (Object.prototype.hasOwnProperty.call(rawInfo, 'risk') && typeof rawInfo.risk !== 'string') {
      fail(`Invalid map data in ${sourceLabel}: ${file} risk must be a string when present.`);
    }
    if (Object.prototype.hasOwnProperty.call(rawInfo, 'test_coverage') && typeof rawInfo.test_coverage !== 'string') {
      fail(`Invalid map data in ${sourceLabel}: ${file} test_coverage must be a string when present.`);
    }
    files.set(file, {
      imports: normalizeStringArray(rawInfo.imports, `${file} imports`, true, MAX_RELATIONS),
      importedBy: normalizeStringArray(rawInfo.imported_by, `${file} imported_by`, true, MAX_RELATIONS),
      testedBy: Object.prototype.hasOwnProperty.call(rawInfo, 'tested_by')
        ? normalizeStringArray(rawInfo.tested_by, `${file} tested_by`, true, MAX_RELATIONS)
        : [],
      fileEnvVars: Object.prototype.hasOwnProperty.call(rawInfo, 'env_vars')
        ? normalizeStringArray(rawInfo.env_vars, `${file} env_vars`, false, MAX_ENV_VARS)
        : [],
      declaredRiskMetadata: Object.prototype.hasOwnProperty.call(rawInfo, 'risk') ? rawInfo.risk : null,
      testCoverageMetadata: Object.prototype.hasOwnProperty.call(rawInfo, 'test_coverage') ? rawInfo.test_coverage : null,
    });
  }
  if (meta.file_count !== files.size) {
    fail(`Invalid map data in ${sourceLabel}: _meta.file_count does not match the files object.`);
  }
  return {
    meta: {
      fileCount: meta.file_count,
      gitHash: meta.git_hash.trim(),
      builtAt: meta.built_at.trim(),
      coverage: Object.prototype.hasOwnProperty.call(meta, 'coverage') ? meta.coverage : null,
    },
    files,
    envVars: parseEnvVarIndex(payload.env_vars, sourceLabel),
  };
}

function readMapFile(mapFile) {
  const absolute = path.resolve(mapFile);
  let stat;
  try {
    stat = fs.statSync(absolute);
  } catch (err) {
    if (err.code === 'ENOENT') fail(`Dependency map not found: ${absolute}`);
    throw err;
  }
  if (!stat.isFile()) fail(`Dependency map is not a regular file: ${absolute}`);
  if (stat.size > MAX_MAP_BYTES) fail(`Dependency map exceeds the 10MB limit: ${absolute}`);
  return {
    path: absolute,
    map: parseMapObject(readJsonText(fs.readFileSync(absolute, 'utf8'), `dependency map ${absolute}`), absolute),
  };
}

function directRisk(count) {
  if (count <= 1) return 'low';
  if (count <= 3) return 'medium';
  if (count <= 6) return 'high';
  return 'critical';
}

function inspectMap(mapFile, selectedFile) {
  const loaded = readMapFile(mapFile);
  const fileNames = Array.from(loaded.map.files.keys()).sort();
  const reverse = new Map(fileNames.map((file) => [file, []]));
  let importEdgeCount = 0;
  let testedByReferenceCount = 0;
  let envVarReferenceCount = 0;
  let fileEnvVarReferenceCount = 0;
  let unresolvedImportCount = 0;

  for (const references of loaded.map.envVars.values()) {
    envVarReferenceCount += references.length;
  }
  for (const [file, info] of loaded.map.files.entries()) {
    importEdgeCount += info.imports.length;
    testedByReferenceCount += info.testedBy.length;
    fileEnvVarReferenceCount += info.fileEnvVars.length;
    for (const imported of info.imports) {
      if (reverse.has(imported)) reverse.get(imported).push(file);
      else unresolvedImportCount++;
    }
  }
  for (const dependents of reverse.values()) dependents.sort();

  const result = {
    command: 'map',
    mapFile: loaded.path,
    freshness: 'not_checked',
    coverageStatus: loaded.map.meta.coverage || 'unknown',
    meta: {
      declaredFileCount: loaded.map.meta.fileCount,
      gitHash: loaded.map.meta.gitHash,
      builtAt: loaded.map.meta.builtAt,
    },
    summary: {
      fileCount: fileNames.length,
      importEdgeCount,
      testedByReferenceCount,
      envVarNameCount: loaded.map.envVars.size,
      envVarReferenceCount,
      fileEnvVarReferenceCount,
      unresolvedImportCount,
    },
  };

  if (selectedFile !== undefined) {
    const normalized = normalizeGraphPath(selectedFile, 'selected file');
    if (!loaded.map.files.has(normalized)) {
      fail(`Dependency map does not contain ${normalized}.`);
    }
    const fileInfo = loaded.map.files.get(normalized);
    const directDependents = (reverse.get(normalized) || []).filter((file) => file !== normalized);
    const seen = new Set();
    const enqueued = new Set(directDependents);
    const queue = directDependents.slice();
    const transitiveDependents = [];
    for (let index = 0; index < queue.length; index++) {
      const next = queue[index];
      if (next === normalized || seen.has(next)) continue;
      seen.add(next);
      transitiveDependents.push(next);
      for (const dependent of reverse.get(next) || []) {
        if (dependent !== normalized && !seen.has(dependent) && !enqueued.has(dependent)) {
          enqueued.add(dependent);
          queue.push(dependent);
        }
      }
    }
    const envVarNames = [];
    for (const [name, references] of loaded.map.envVars.entries()) {
      if (references.includes(normalized)) envVarNames.push(name);
    }
    envVarNames.sort();
    result.selection = {
      file: normalized,
      imports: fileInfo.imports.slice(),
      testedByReferences: fileInfo.testedBy.slice(),
      testCoverageMetadata: fileInfo.testCoverageMetadata,
      declaredRiskMetadata: fileInfo.declaredRiskMetadata,
      envVarNames,
      fileEnvVarReferences: fileInfo.fileEnvVars.slice(),
      unresolvedImportCount: fileInfo.imports.filter((item) => !loaded.map.files.has(item)).length,
      directDependentCount: directDependents.length,
      directDependents,
      transitiveDependentCount: transitiveDependents.length,
      transitiveDependents,
      risk: directRisk(directDependents.length),
    };
  }
  return result;
}

function comparePrerelease(left, right) {
  for (let i = 0; i < Math.max(left.length, right.length); i++) {
    if (i >= left.length) return -1;
    if (i >= right.length) return 1;
    const a = left[i];
    const b = right[i];
    if (a === b) continue;
    const aNum = isNumericIdentifier(a);
    const bNum = isNumericIdentifier(b);
    if (aNum && bNum) return compareNumericIdentifiers(a, b);
    if (aNum !== bNum) return aNum ? -1 : 1;
    return a < b ? -1 : 1;
  }
  return 0;
}

function compareSemver(left, right) {
  const major = compareNumericIdentifiers(left.major, right.major);
  if (major) return major;
  const minor = compareNumericIdentifiers(left.minor, right.minor);
  if (minor) return minor;
  const patch = compareNumericIdentifiers(left.patch, right.patch);
  if (patch) return patch;
  if (!left.prerelease.length && !right.prerelease.length) return 0;
  if (!left.prerelease.length) return 1;
  if (!right.prerelease.length) return -1;
  return comparePrerelease(left.prerelease, right.prerelease);
}

function compareVersions(installedVersion, latestVersion) {
  const installed = parseSemver(installedVersion);
  if (!installed) fail('Invalid installed version: expected semver.');
  const latest = parseSemver(latestVersion);
  if (!latest) fail('Invalid latest version: expected semver.');
  const order = compareSemver(installed, latest);
  return {
    installed: installed.raw,
    latest: latest.raw,
    latestIsNewer: order < 0,
    updateAvailable: order < 0,
    downgrade: false,
    comparison: order < 0 ? 'latest_is_newer' : order > 0 ? 'installed_is_newer' : 'equal',
  };
}

function readInstalledVersion(root) {
  return inspectStatus(root).version;
}

function fetchLatestVersion(getImpl, options) {
  const getter = typeof getImpl === 'function' ? getImpl : https.get;
  const settings = isPlainObject(options) ? options : {};
  const timeoutMs = Number.isInteger(settings.timeoutMs) && settings.timeoutMs > 0
    ? settings.timeoutMs : REGISTRY_TIMEOUT_MS;
  const maxBytes = Number.isInteger(settings.maxBytes) && settings.maxBytes > 0
    ? settings.maxBytes : MAX_REGISTRY_BYTES;

  return new Promise((resolve, reject) => {
    let settled = false;
    let request = null;
    let timer = null;

    const done = (err, value) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      if (err) reject(err);
      else resolve(value);
    };

    timer = setTimeout(() => {
      if (request && typeof request.destroy === 'function') request.destroy();
      done(new HydraControlError('Update check failed: request timed out.'));
    }, timeoutMs);

    try {
      request = getter(LATEST_URL, {
        headers: {
          Accept: 'application/json',
          'User-Agent': 'hail-hydra-control',
        },
      }, (response) => {
        response.on('error', (err) => done(new HydraControlError(`Update check failed: ${err.message}`)));
        const statusCode = response.statusCode || 0;
        if (statusCode >= 300 && statusCode < 400) {
          if (typeof response.resume === 'function') response.resume();
          done(new HydraControlError('Update check failed: redirects are not allowed.'));
          return;
        }
        if (statusCode !== 200) {
          if (typeof response.resume === 'function') response.resume();
          done(new HydraControlError(`Update check failed: registry returned HTTP ${statusCode}.`));
          return;
        }
        const advertised = Number(response.headers && response.headers['content-length']);
        if (Number.isFinite(advertised) && advertised > maxBytes) {
          if (typeof response.resume === 'function') response.resume();
          done(new HydraControlError('Update check failed: registry response was too large.'));
          return;
        }
        let completed = false;
        let body = '';
        let bytes = 0;
        if (typeof response.setEncoding === 'function') response.setEncoding('utf8');
        response.on('data', (chunk) => {
          if (settled) return;
          bytes += Buffer.byteLength(chunk, 'utf8');
          if (bytes > maxBytes) {
            if (request && typeof request.destroy === 'function') request.destroy();
            done(new HydraControlError('Update check failed: registry response was too large.'));
            return;
          }
          body += chunk;
        });
        response.on('aborted', () => done(new HydraControlError('Update check failed: response was aborted.')));
        response.on('close', () => {
          if (!completed && !settled) {
            done(new HydraControlError('Update check failed: response closed early.'));
          }
        });
        response.on('end', () => {
          if (settled) return;
          completed = true;
          let payload;
          try {
            payload = readJsonText(body, 'the npm registry response');
          } catch (err) {
            done(err);
            return;
          }
          if (!isPlainObject(payload) || typeof payload.version !== 'string' || !payload.version.trim()) {
            done(new HydraControlError('Update check failed: registry response did not contain a version string.'));
            return;
          }
          done(null, { version: payload.version.trim() });
        });
      });
    } catch (err) {
      done(new HydraControlError(`Update check failed: ${err.message}`));
      return;
    }

    if (!request || typeof request.on !== 'function') {
      done(new HydraControlError('Update check failed: invalid HTTPS client.'));
      return;
    }
    request.on('error', (err) => done(new HydraControlError(`Update check failed: ${err.message}`)));
  });
}

async function checkUpdate(root, fetchLatest) {
  const installed = readInstalledVersion(root);
  const latestResponse = await Promise.resolve((fetchLatest || fetchLatestVersion)());
  if (!latestResponse || typeof latestResponse.version !== 'string' || !latestResponse.version.trim()) {
    fail('Update check failed: registry response did not contain a version string.');
  }
  return { command: 'check-update', ...compareVersions(installed, latestResponse.version.trim()) };
}

function getHelp() {
  return {
    command: 'help',
    manualOnly: true,
    supportedHelperCommands: ['help', 'status', 'map', 'check-update', 'report', 'notify'],
    flags: HELP_FLAGS,
    notes: [
      'These are explicit /hail-hydra management routes, not native /hydra:* slash commands.',
      'No modes persist beyond the invoked task.',
    ],
  };
}

function getReportLinks(kind) {
  if (kind === undefined) {
    return { command: 'report', reports: [REPORT_LINKS.bug, REPORT_LINKS.feature, REPORT_LINKS.feedback] };
  }
  if (!Object.prototype.hasOwnProperty.call(REPORT_LINKS, kind)) {
    fail('Invalid report type. Expected bug, feature, or feedback.');
  }
  return { command: 'report', reports: [REPORT_LINKS[kind]] };
}

function buildNotification(goal) {
  if (goal !== 'success' && goal !== 'failure') {
    fail('Invalid notify goal. Expected success or failure.');
  }
  return {
    command: 'notify',
    goal,
    message: goal === 'success'
      ? 'Success notification bell sent; terminal audio may be suppressed.'
      : 'Failure notification bell sent; terminal audio may be suppressed.',
  };
}

function parseArgs(argv) {
  const args = Array.isArray(argv) ? argv.slice() : [];
  if (!args.length) return { command: 'help' };
  const [command, ...rest] = args;
  if (INSTRUCTION_ONLY_FLAGS.has(command)) {
    fail('This helper only supports help, status, map, check-update, report, and notify.');
  }
  switch (command) {
    case 'help':
    case '--help':
      if (rest.length) fail('help does not take arguments.');
      return { command: 'help' };
    case 'status':
    case '--status':
      if (rest.length) fail('status does not take arguments.');
      return { command: 'status' };
    case 'map':
    case '--map':
      if (rest.length < 1 || rest.length > 2) fail('map requires <map-json> and an optional [project-relative-file].');
      if (rest[0] === 'rebuild') {
        fail('map rebuild is an instruction route; this helper only inspects an explicit map JSON file.');
      }
      return { command: 'map', mapFile: rest[0], selectedFile: rest[1] };
    case 'check-update':
    case '--update':
      if (rest.length) fail('check-update does not take arguments.');
      return { command: 'check-update' };
    case 'report':
    case '--report':
      if (rest.length > 1) fail('report accepts at most one optional type.');
      return { command: 'report', kind: rest[0] };
    case 'notify':
    case '--notify':
      if (rest.length !== 1) fail('notify requires exactly one argument: success or failure.');
      return { command: 'notify', goal: rest[0] };
    default:
      fail('Unknown command. Use help.');
  }
}

function writeJson(stdout, payload, prefixBell) {
  const json = JSON.stringify(payload, null, 2) + '\n';
  stdout.write(prefixBell ? `\u0007${json}` : json);
}

async function main(argv, io, deps) {
  const output = io || { stdout: process.stdout, stderr: process.stderr };
  const root = deps && deps.root ? deps.root : DEFAULT_ROOT;
  try {
    const parsed = parseArgs(argv || process.argv.slice(2));
    let result;
    switch (parsed.command) {
      case 'help':
        result = getHelp();
        break;
      case 'status':
        result = inspectStatus(root);
        break;
      case 'map':
        result = inspectMap(parsed.mapFile, parsed.selectedFile);
        break;
      case 'check-update':
        result = await checkUpdate(root, deps && deps.fetchLatestVersion);
        break;
      case 'report':
        result = getReportLinks(parsed.kind);
        break;
      case 'notify':
        result = buildNotification(parsed.goal);
        break;
      default:
        fail('Unknown command. Use help.');
    }
    writeJson(output.stdout, result, parsed.command === 'notify');
    return 0;
  } catch (err) {
    output.stderr.write(`${err && err.message ? err.message : 'Unexpected error.'}\n`);
    return 1;
  }
}

if (require.main === module) {
  main().then((code) => {
    process.exitCode = code;
  });
}

module.exports = {
  DEFAULT_ROOT,
  HELP_FLAGS,
  REPORT_LINKS,
  HydraControlError,
  parseArgs,
  getHelp,
  parseSemver,
  inspectStatus,
  readMapFile,
  inspectMap,
  compareVersions,
  fetchLatestVersion,
  checkUpdate,
  getReportLinks,
  buildNotification,
  main,
};
