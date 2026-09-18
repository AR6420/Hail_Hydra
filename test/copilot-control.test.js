#!/usr/bin/env node
'use strict';

const assert = require('assert');
const { spawnSync } = require('child_process');
const { EventEmitter } = require('events');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const CONTROL_PATH = path.join(ROOT, 'src', 'copilot', 'hydra-control.js');
const control = require(CONTROL_PATH);
const ROLE_NAMES = [
  'hydra-analyst',
  'hydra-architect',
  'hydra-coder',
  'hydra-git',
  'hydra-guard',
  'hydra-preflight',
  'hydra-researcher',
  'hydra-runner',
  'hydra-scout',
  'hydra-scribe',
  'hydra-sentinel',
  'hydra-sentinel-scan',
];
const UTILITY_GUIDE_FILES = [
  'hydra-commands.md',
  'hydra-continuity.md',
  'hydra-measurements.md',
  'hydra-modes.md',
  'hydra-quality.md',
];
const SKILL_TEXT = '---\nname: hail-hydra\n---\n';
const SCRATCH = path.join(ROOT, 'test', `.tmp-copilot-control-${process.pid}-${Date.now()}`);

fs.mkdirSync(SCRATCH, { recursive: true });

let seq = 0;
function freshDir(prefix) {
  const dir = path.join(SCRATCH, `${prefix}-${seq++}`);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function writeText(filePath, text) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, text);
}

function writeJson(filePath, value) {
  writeText(filePath, JSON.stringify(value, null, 2) + '\n');
}

function defaultRoles() {
  return ROLE_NAMES.map((name) => ({
    name,
    tier: name === 'hydra-architect' || name === 'hydra-researcher' ? 'mid' : 'cheap',
    tierIsHint: true,
    modelSelection: 'latest-suitable-available',
    instructions: `references/${name}.md`,
  }));
}

function defaultManifestFiles() {
  return [
    'SKILL.md',
    'VERSION',
    'references/roles.json',
    ...ROLE_NAMES.map((name) => `references/${name}.md`),
    ...UTILITY_GUIDE_FILES.map((name) => `references/${name}`),
    'scripts/hydra-control.js',
    'scripts/hydra-usage.js',
  ];
}

function createInstalledRoot(options = {}) {
  const root = freshDir('install');
  const version = options.version || '2.5.2';
  const manifestFiles = options.manifestFiles || defaultManifestFiles();
  const roles = options.roles || defaultRoles();
  const skillText = options.skillText || SKILL_TEXT;
  const manifestVersion = options.manifestVersion || version;
  const manifestHost = options.manifestHost === undefined ? 'copilot' : options.manifestHost;

  writeText(path.join(root, 'SKILL.md'), skillText);
  writeText(path.join(root, 'VERSION'), `${version}\n`);
  writeJson(path.join(root, 'references', 'roles.json'), roles);
  for (const name of ROLE_NAMES) {
    writeText(path.join(root, 'references', `${name}.md`), `# ${name}\n`);
  }
  for (const name of UTILITY_GUIDE_FILES) {
    writeText(path.join(root, 'references', name), `# ${name}\n`);
  }
  writeText(path.join(root, 'scripts', 'hydra-usage.js'), 'module.exports = { usage: true };\n');
  fs.copyFileSync(CONTROL_PATH, path.join(root, 'scripts', 'hydra-control.js'));
  writeJson(path.join(root, '.hydra-manifest.json'), {
    host: manifestHost,
    version: manifestVersion,
    files: manifestFiles,
  });
  return root;
}

function runCli(scriptPath, args, expectedStatus) {
  const result = spawnSync(process.execPath, [scriptPath, ...args], {
    cwd: ROOT,
    encoding: 'utf8',
    timeout: 15000,
  });
  if (expectedStatus !== undefined) {
    assert.strictEqual(result.status, expectedStatus, result.stdout + result.stderr);
  }
  return result;
}

function jsonAfterBell(output) {
  const bellCount = (output.match(/\u0007/g) || []).length;
  assert.strictEqual(bellCount, 1, 'exactly one terminal bell');
  return JSON.parse(output.replace('\u0007', ''));
}

function makeCaptureIo() {
  let stdout = '';
  let stderr = '';
  return {
    io: {
      stdout: { write: (chunk) => { stdout += String(chunk); } },
      stderr: { write: (chunk) => { stderr += String(chunk); } },
    },
    stdout: () => stdout,
    stderr: () => stderr,
  };
}

function createFakeRequest() {
  const request = new EventEmitter();
  request.destroyed = false;
  request.destroy = () => {
    request.destroyed = true;
    request.emit('close');
  };
  return request;
}

function createFakeResponse(statusCode, headers) {
  const response = new EventEmitter();
  response.statusCode = statusCode;
  response.headers = headers || {};
  response.resume = () => {};
  response.setEncoding = () => {};
  return response;
}

async function main() {
  const sourceText = fs.readFileSync(CONTROL_PATH, 'utf8');
  assert.ok(!/require\((['"])\./.test(sourceText), 'helper is standalone with no relative imports');

  const help = control.getHelp();
  assert.strictEqual(help.command, 'help');
  assert.deepStrictEqual(help.supportedHelperCommands, ['help', 'status', 'mode', 'map', 'check-update', 'report', 'notify']);
  assert.strictEqual(help.flags.find((item) => item.flag === '--notify').usage, '--notify <goal>');
  assert.strictEqual(help.flags.find((item) => item.flag === '--update').helperCommand, 'check-update');
  const modeHelp = help.flags.find((item) => item.flag === '--mode');
  assert.strictEqual(modeHelp.usage, '--mode <turbo|balanced|economy> <goal>');
  assert.strictEqual(modeHelp.helperCommand, 'mode [turbo|balanced|economy] [--expanded] [--max-agents N] [--max-dispatches N]');
  assert.strictEqual(modeHelp.nativeHelper, true);
  for (const flag of ['--max-agents', '--max-dispatches']) {
    const modifier = help.flags.find((item) => item.flag === flag);
    assert.strictEqual(modifier.usage, `${flag} <N>`);
    assert.strictEqual(modifier.nativeHelper, false);
    assert.strictEqual(modifier.helperCommand, undefined);
  }
  assert.match(help.notes.join('\n'), /balanced is the default.*task-local/i);
  assert.match(help.notes.join('\n'), /does not mean a mode is active in the current shell/i);
  assert.match(help.notes.join('\n'), /host and user hard limits still apply/i);
  assert.match(help.notes.join('\n'), /quality, security, correctness, and permission checks/i);
  assert.match(help.notes.join('\n'), /do not guarantee host capacity/i);
  assert.match(help.notes.join('\n'), /beyond documented balanced expansion, complexity alone does not raise ceilings or promote modes/i);

  const expectedPolicies = {
    economy: {
      limits: { maxConcurrentAgents: 1, maxTotalDispatches: 3, maxImprovementRounds: 2 },
      workerPolicy: 'inexpensive-support-for-established-work',
      researchPolicy: 'required-evidence-minimal-optional-research',
      reviewPolicy: 'required-review-minimal-optional-polish',
      contextPolicy: 'compact-briefs-and-checkpoints',
    },
    balanced: {
      limits: { maxConcurrentAgents: 2, maxTotalDispatches: 6, maxImprovementRounds: 2 },
      workerPolicy: 'catalogue-default-models-with-tier-hints',
      researchPolicy: 'targeted-evidence-for-material-uncertainty',
      reviewPolicy: 'risk-based-review-and-bounded-improvement',
      contextPolicy: 'focused-briefs-and-checkpoints',
    },
    turbo: {
      limits: { maxConcurrentAgents: 8, maxTotalDispatches: 32, maxImprovementRounds: 2 },
      workerPolicy: 'quality-and-wall-clock-speed-over-cost',
      researchPolicy: 'broader-independent-evidence-when-useful',
      reviewPolicy: 'parallel-review-and-bounded-improvement',
      contextPolicy: 'largest-appropriate-supported-context-with-focused-briefs',
    },
  };
  function expectedMode(mode) {
    return {
      command: 'mode',
      mode,
      taskLocal: true,
      expanded: false,
      overridesApplied: false,
      mainModel: 'preserve-selection',
      qualityFloor: 'required-checks-and-serious-findings-block',
      contextContinuity: 'session-ledger-and-checkpoints',
      enforcement: 'instruction-guided-host-limits-apply',
      ...expectedPolicies[mode],
    };
  }
  for (const name of Object.keys(expectedPolicies)) {
    const resolved = control.resolveMode(name);
    assert.deepStrictEqual(resolved, expectedMode(name));
    assert.deepStrictEqual(control.resolveMode(name, { expanded: false }), resolved);
    const overridden = control.resolveMode(name, { maxAgents: 100, maxDispatches: 1000 });
    assert.deepStrictEqual(overridden, {
      ...expectedMode(name),
      limits: { maxConcurrentAgents: 100, maxTotalDispatches: 1000, maxImprovementRounds: 2 },
      overridesApplied: true,
    }, 'user-requested ceilings do not promote modes or guarantee host capacity');
    const repeated = control.resolveMode(name);
    assert.notStrictEqual(repeated, resolved);
    assert.notStrictEqual(repeated.limits, resolved.limits);
    resolved.limits.maxConcurrentAgents = 999;
    resolved.limits.maxImprovementRounds = 999;
    resolved.workerPolicy = 'changed';
    resolved.mainModel = 'changed';
    assert.deepStrictEqual(control.resolveMode(name), expectedMode(name));
    assert.deepStrictEqual(control.resolveMode(), expectedMode('balanced'), 'no mode persists into the next task');
  }
  const expanded = control.resolveMode('balanced', { expanded: true });
  assert.deepStrictEqual(expanded, {
    ...expectedMode('balanced'),
    expanded: true,
    limits: { maxConcurrentAgents: 4, maxTotalDispatches: 12, maxImprovementRounds: 2 },
  });
  expanded.limits.maxTotalDispatches = 999;
  assert.strictEqual(control.resolveMode('balanced', { expanded: true }).limits.maxTotalDispatches, 12);
  assert.deepStrictEqual(control.resolveMode(), expectedMode('balanced'));
  assert.deepStrictEqual(control.resolveMode(undefined, undefined), expectedMode('balanced'));
  for (const name of ['economy', 'turbo']) {
    assert.throws(() => control.resolveMode(name, { expanded: true }), /only available for balanced/i);
  }
  assert.deepStrictEqual(control.resolveMode('balanced', { expanded: true, maxAgents: 3, maxDispatches: 5 }), {
    ...expectedMode('balanced'),
    expanded: true,
    limits: { maxConcurrentAgents: 3, maxTotalDispatches: 5, maxImprovementRounds: 2 },
    overridesApplied: true,
  });
  assert.deepStrictEqual(control.resolveMode(undefined, { maxAgents: 3, maxDispatches: 5 }), {
    ...expectedMode('balanced'),
    limits: { maxConcurrentAgents: 3, maxTotalDispatches: 5, maxImprovementRounds: 2 },
    overridesApplied: true,
  });
  assert.strictEqual(control.resolveMode('balanced', { maxAgents: 2 }).overridesApplied, true);
  assert.strictEqual(control.resolveMode('balanced', { maxAgents: 1 }).limits.maxTotalDispatches, 6);
  assert.strictEqual(control.resolveMode('balanced', { maxDispatches: 1000 }).limits.maxConcurrentAgents, 2);
  assert.deepStrictEqual(control.resolveMode('economy', {
    maxAgents: Number.MAX_SAFE_INTEGER,
    maxDispatches: Number.MAX_SAFE_INTEGER,
  }).limits, {
    maxConcurrentAgents: Number.MAX_SAFE_INTEGER,
    maxTotalDispatches: Number.MAX_SAFE_INTEGER,
    maxImprovementRounds: 2,
  });
  const options = { expanded: true, maxAgents: 3, maxDispatches: 5 };
  const fromOptions = control.resolveMode('balanced', options);
  assert.deepStrictEqual(options, { expanded: true, maxAgents: 3, maxDispatches: 5 });
  options.maxAgents = 100;
  assert.strictEqual(fromOptions.limits.maxConcurrentAgents, 3);

  for (const name of ['', 'Turbo', 'balanced ', 'MODE_SECRET', '__proto__', 'constructor', 'toString', null, 1, true, {}, [], Symbol('MODE_SECRET')]) {
    assert.throws(() => control.resolveMode(name), /Invalid mode\./);
  }
  for (const invalid of [null, [], 1, 'balanced', false, () => {}, new Date(), Object.create({ expanded: true })]) {
    assert.throws(() => control.resolveMode('balanced', invalid), /expected an object/i);
  }
  for (const invalid of [undefined, null, 'true', 'false', 0, 1, {}, []]) {
    assert.throws(() => control.resolveMode('balanced', { expanded: invalid }), /expected a boolean/i);
  }
  for (const invalid of [
    { goal: 'MODE_SECRET' },
    { MODE_SECRET: true },
    { maxConcurrentAgents: 3 },
    { maxTotalDispatches: 5 },
    { maxImprovementRounds: 3 },
    { constructor: true },
    JSON.parse('{"__proto__":true}'),
    { [Symbol('MODE_SECRET')]: true },
    Object.defineProperty({}, 'MODE_SECRET', { value: true }),
  ]) {
    assert.throws(() => control.resolveMode('balanced', invalid), /unknown option/i);
  }
  for (const key of ['maxAgents', 'maxDispatches']) {
    for (const invalid of [undefined, null, 0, -0, -1, 1.5, '3', true, NaN, Infinity, -Infinity, Number.MAX_SAFE_INTEGER + 1, 1n, {}, []]) {
      assert.throws(() => control.resolveMode('balanced', { [key]: invalid }), /positive safe integers/i);
    }
  }
  for (const invalid of [
    { maxAgents: 6, maxDispatches: 5 },
    { maxAgents: 7 },
    { maxDispatches: 1 },
    { expanded: true, maxAgents: 13 },
  ]) {
    assert.throws(() => control.resolveMode('balanced', invalid), /must not exceed/i);
  }

  assert.deepStrictEqual(control.parseArgs(['help']), { command: 'help' });
  assert.deepStrictEqual(control.parseArgs(['status']), { command: 'status' });
  assert.deepStrictEqual(control.parseArgs(['--status']), { command: 'status' });
  assert.deepStrictEqual(control.parseArgs(['map', 'x.json']), { command: 'map', mapFile: 'x.json', selectedFile: undefined });
  assert.deepStrictEqual(control.parseArgs(['check-update']), { command: 'check-update' });
  assert.deepStrictEqual(control.parseArgs(['report', 'feature']), { command: 'report', kind: 'feature' });
  assert.deepStrictEqual(control.parseArgs(['notify', 'success']), { command: 'notify', goal: 'success' });
  assert.deepStrictEqual(control.parseArgs(['mode']), { command: 'mode', mode: 'balanced', options: {} });
  assert.deepStrictEqual(control.parseArgs(['--mode', 'turbo']), { command: 'mode', mode: 'turbo', options: {} });
  assert.deepStrictEqual(control.parseArgs(['mode', '--expanded']), {
    command: 'mode', mode: 'balanced', options: { expanded: true },
  });
  assert.deepStrictEqual(control.parseArgs(['mode', '--max-agents', '3', '--max-dispatches', '5']), {
    command: 'mode', mode: 'balanced', options: { maxAgents: 3, maxDispatches: 5 },
  });
  assert.deepStrictEqual(control.parseArgs(['mode', 'balanced', '--max-dispatches', '5', '--expanded', '--max-agents', '3']), {
    command: 'mode', mode: 'balanced', options: { maxDispatches: 5, expanded: true, maxAgents: 3 },
  });
  for (const flag of ['--max-agents', '--max-dispatches']) {
    for (const value of [
      '', '0', '00', '01', '-1', '+1', '1.5', '1e2', '0x10', '1junk', ' 1', '1 ', '1\n', '1\r',
      '9007199254740992', 'Infinity', 'NaN', '1_000', '1,000', '１', 'MODE_SECRET',
    ]) {
      assert.throws(() => control.parseArgs(['mode', flag, value]), /positive safe integers in decimal form/i);
    }
  }

  const installedRoot = createInstalledRoot();
  const status = control.inspectStatus(installedRoot);
  assert.deepStrictEqual(status, {
    command: 'status',
    installed: true,
    version: '2.5.2',
    ownedFileCount: 22,
  });

  const installedStatus = runCli(path.join(installedRoot, 'scripts', 'hydra-control.js'), ['status'], 0);
  const installedStatusJson = JSON.parse(installedStatus.stdout);
  assert.strictEqual(installedStatusJson.version, '2.5.2');
  assert.strictEqual(installedStatusJson.installed, true);
  assert.strictEqual(installedStatusJson.ownedFileCount, 22);

  const installedHelp = runCli(path.join(installedRoot, 'scripts', 'hydra-control.js'), ['help'], 0);
  assert.strictEqual(JSON.parse(installedHelp.stdout).command, 'help');

  for (const script of [CONTROL_PATH, path.join(installedRoot, 'scripts', 'hydra-control.js')]) {
    for (const name of ['turbo', 'economy', 'balanced']) {
      const result = runCli(script, ['mode', name], 0);
      assert.deepStrictEqual(JSON.parse(result.stdout), expectedMode(name));
      assert.strictEqual(result.stderr, '');
    }
    const defaultMode = runCli(script, ['mode'], 0);
    assert.deepStrictEqual(JSON.parse(defaultMode.stdout), expectedMode('balanced'));
  }
  for (const [args, expected] of [
    [['--mode'], expectedMode('balanced')],
    [['--mode', 'turbo'], expectedMode('turbo')],
    [['mode', 'balanced', '--expanded'], control.resolveMode('balanced', { expanded: true })],
    [['mode', '--max-agents', '3', '--max-dispatches', '5'], control.resolveMode('balanced', { maxAgents: 3, maxDispatches: 5 })],
    [['mode', 'economy', '--max-dispatches', '1000', '--max-agents', '100'], control.resolveMode('economy', { maxAgents: 100, maxDispatches: 1000 })],
    [['mode', '--max-agents', '9007199254740991', '--max-dispatches', '9007199254740991'], control.resolveMode('balanced', {
      maxAgents: Number.MAX_SAFE_INTEGER,
      maxDispatches: Number.MAX_SAFE_INTEGER,
    })],
  ]) {
    const result = runCli(CONTROL_PATH, args, 0);
    assert.deepStrictEqual(JSON.parse(result.stdout), expected);
    assert.strictEqual(result.stderr, '');
  }

  for (const args of [
    ['mode', 'MODE_SECRET'],
    ['mode', 'balanced', 'MODE_SECRET'],
    ['--mode', 'balanced', 'MODE_SECRET'],
    ['mode', '--MODE_SECRET'],
    ['mode', '--max-agents', 'MODE_SECRET'],
    ['mode', '--max-agents', '3', 'balanced'],
    ['mode', '--expanded', 'balanced'],
    ['mode', 'turbo', '--expanded'],
    ['mode', 'economy', '--expanded'],
    ['mode', '--expanded', '--expanded'],
    ['mode', '--max-agents', '1', '--max-agents', '2'],
    ['mode', '--max-dispatches', '6', '--max-dispatches', '7'],
    ['mode', '--expanded', 'true'],
    ['mode', '--max-agents'],
    ['mode', '--max-dispatches'],
    ['mode', '--max-agents', '--max-dispatches', '5'],
    ['mode', '--max-agents=3'],
    ['mode', '--max-agents', '6', '--max-dispatches', '5'],
    ['mode', '--max-agents', '7'],
    ['mode', '--max-dispatches', '1'],
    ['mode', '--max-agents', '9007199254740992'],
    ['mode', '--max-agents', '1.5'],
    ['mode', '--max-agents', '1e2'],
    ['mode', '--max-agents', '-1'],
    ['mode', '--max-agents', '+1'],
    ['mode', '--max-agents', '01'],
    ['mode', '--max-agents', '1junk'],
    ['--max-agents', '1'],
    ['--max-dispatches', '5'],
  ]) {
    assert.throws(() => control.parseArgs(args), control.HydraControlError);
    const result = runCli(CONTROL_PATH, args, 1);
    assert.strictEqual(result.stdout, '');
    assert.ok(result.stderr.trim());
    assert.strictEqual(result.stderr.trim().split(/\r?\n/).length, 1);
    assert.ok(!result.stderr.includes('MODE_SECRET'));
  }

  {
    const guardedModules = [
      [fs, ['readFileSync', 'writeFileSync', 'appendFileSync', 'mkdirSync', 'openSync', 'renameSync', 'rmSync', 'unlinkSync']],
      [require('https'), ['get', 'request']],
      [require('child_process'), ['spawn', 'spawnSync', 'exec', 'execSync', 'execFile', 'execFileSync', 'fork']],
    ];
    const originals = [];
    try {
      for (const [module, methods] of guardedModules) {
        for (const method of methods) {
          originals.push([module, method, module[method]]);
          module[method] = () => { throw new Error(`Modes and help must not call ${method}.`); };
        }
      }
      for (const args of [
        ['help'],
        ['--help'],
        ['mode'],
        ['--mode', 'turbo'],
        ['mode', 'economy'],
        ['mode', '--expanded', '--max-agents', '3', '--max-dispatches', '5'],
      ]) {
        const capture = makeCaptureIo();
        assert.strictEqual(await control.main(args, capture.io, { root: path.join(SCRATCH, 'not-installed') }), 0);
        assert.ok(['help', 'mode'].includes(JSON.parse(capture.stdout()).command));
        assert.strictEqual(capture.stderr(), '');
      }
    } finally {
      for (const [module, method, original] of originals) module[method] = original;
    }
    assert.deepStrictEqual(control.inspectStatus(installedRoot), status, 'mode resolution does not change installed status');
  }

  const installedReport = runCli(path.join(installedRoot, 'scripts', 'hydra-control.js'), ['report', 'feature'], 0);
  assert.strictEqual(JSON.parse(installedReport.stdout).reports[0].kind, 'feature');

  const sourceStatus = runCli(CONTROL_PATH, ['status'], 1);
  assert.match(sourceStatus.stderr, /not installed/i);
  assert.strictEqual(sourceStatus.stdout, '');

  {
    const root = createInstalledRoot({ manifestFiles: [...defaultManifestFiles(), '../secret.txt'] });
    assert.throws(() => control.inspectStatus(root), /allowlist/i);
  }

  {
    const root = createInstalledRoot({ manifestFiles: defaultManifestFiles().concat('scripts/hydra-control.js') });
    assert.throws(() => control.inspectStatus(root), /duplicate/i);
  }

  {
    const root = createInstalledRoot({ manifestHost: 'other' });
    assert.throws(() => control.inspectStatus(root), /expected host "copilot"/i);
  }

  {
    const root = createInstalledRoot({ manifestVersion: '2.5.1' });
    assert.throws(() => control.inspectStatus(root), /does not match VERSION/i);
  }

  for (const name of UTILITY_GUIDE_FILES) {
    const root = createInstalledRoot();
    fs.unlinkSync(path.join(root, 'references', name));
    assert.throws(() => control.inspectStatus(root), (err) => err.message.includes(`missing references/${name}`));
  }

  for (const name of ['hydra-modes.md', 'hydra-continuity.md']) {
    const root = createInstalledRoot({
      manifestFiles: defaultManifestFiles().filter((file) => file !== `references/${name}`),
    });
    assert.throws(() => control.inspectStatus(root), (err) => err.message.includes(`${name} is not recorded`));
  }

  {
    const root = createInstalledRoot();
    const target = path.join(root, 'references-target');
    fs.renameSync(path.join(root, 'references'), target);
    let symlinkCreated = false;
    try {
      fs.symlinkSync(target, path.join(root, 'references'), 'junction');
      symlinkCreated = true;
    } catch (err) {
      if (!['EPERM', 'EACCES', 'ENOENT', 'UNKNOWN'].includes(err.code)) throw err;
      console.log(`copilot-control: symlink test skipped (${err.code})`);
      fs.renameSync(target, path.join(root, 'references'));
    }
    if (symlinkCreated) {
      assert.throws(() => control.inspectStatus(root), /symlink/i);
    }
  }

  {
    const mapFile = path.join(freshDir('map'), 'graph.json');
    const files = Object.create(null);
    files.__proto__ = { imports: ['src/a.js'], imported_by: [] };
    files['src/a.js'] = {
      imports: ['src/b.js', 'src/missing.js'],
      imported_by: ['ignored.js'],
      tested_by: ['test/a.test.js'],
      test_coverage: 'partial',
      env_vars: ['LEGACY_FLAG'],
      risk: 'medium',
    };
    files['src/b.js'] = { imports: ['src/c.js'], imported_by: [] };
    files['src/c.js'] = { imports: ['src/a.js'], imported_by: [] };
    files['src/d.js'] = { imports: ['src/a.js'], imported_by: [] };
    files['src/e.js'] = { imports: ['src/d.js'], imported_by: [] };
    writeJson(mapFile, {
      _meta: {
        file_count: 6,
        git_hash: 'abc1234',
        built_at: '2001-01-01T00:00:00.000Z',
        coverage: 'partial',
      },
      files,
      env_vars: {
        DATABASE_URL: ['src/a.js', 'src/b.js'],
        JWT_SECRET: ['src/c.js'],
      },
    });
    const result = control.inspectMap(mapFile, 'src/a.js');
    assert.strictEqual(result.freshness, 'not_checked');
    assert.strictEqual(result.coverageStatus, 'partial');
    assert.deepStrictEqual(result.summary, {
      fileCount: 6,
      importEdgeCount: 7,
      testedByReferenceCount: 1,
      envVarNameCount: 2,
      envVarReferenceCount: 3,
      fileEnvVarReferenceCount: 1,
      unresolvedImportCount: 1,
    });
    assert.deepStrictEqual(result.selection.directDependents, ['__proto__', 'src/c.js', 'src/d.js']);
    assert.deepStrictEqual(result.selection.transitiveDependents, ['__proto__', 'src/c.js', 'src/d.js', 'src/b.js', 'src/e.js']);
    assert.deepStrictEqual(result.selection.testedByReferences, ['test/a.test.js']);
    assert.strictEqual(result.selection.testCoverageMetadata, 'partial');
    assert.deepStrictEqual(result.selection.envVarNames, ['DATABASE_URL']);
    assert.deepStrictEqual(result.selection.fileEnvVarReferences, ['LEGACY_FLAG']);
    assert.strictEqual(result.selection.unresolvedImportCount, 1);
    assert.strictEqual(result.selection.risk, 'medium');
  }

  {
    const mapFile = path.join(freshDir('empty-map'), 'graph.json');
    writeJson(mapFile, {
      _meta: {
        file_count: 0,
        git_hash: 'empty',
        built_at: '1999-12-31T23:59:59.000Z',
      },
      files: {},
    });
    const result = control.inspectMap(mapFile);
    assert.deepStrictEqual(result.summary, {
      fileCount: 0,
      importEdgeCount: 0,
      testedByReferenceCount: 0,
      envVarNameCount: 0,
      envVarReferenceCount: 0,
      fileEnvVarReferenceCount: 0,
      unresolvedImportCount: 0,
    });
    assert.strictEqual(result.coverageStatus, 'unknown');
  }

  {
    const mapFile = path.join(freshDir('bad-map'), 'graph.json');
    writeText(mapFile, 'MAP_SECRET invalid json');
    try {
      control.inspectMap(mapFile);
      assert.fail('expected malformed map JSON to fail');
    } catch (err) {
      assert.match(err.message, /Cannot parse dependency map/i);
      assert.ok(!err.message.includes('MAP_SECRET'));
    }
  }

  {
    const mapFile = path.join(freshDir('bad-count'), 'graph.json');
    writeJson(mapFile, {
      _meta: {
        file_count: 2,
        git_hash: 'badcount',
        built_at: '2000-01-01T00:00:00.000Z',
      },
      files: {
        'src/a.js': { imports: [], imported_by: [] },
      },
    });
    assert.throws(() => control.inspectMap(mapFile), /file_count does not match/i);
  }

  {
    const mapFile = path.join(freshDir('bad-coverage'), 'graph.json');
    writeJson(mapFile, {
      _meta: {
        file_count: 1,
        git_hash: 'badcoverage',
        built_at: '2000-01-01T00:00:00.000Z',
        coverage: 'unknown',
      },
      files: {
        'src/a.js': { imports: [], imported_by: [] },
      },
    });
    assert.throws(() => control.inspectMap(mapFile), /complete or partial/i);
  }

  {
    const mapFile = path.join(freshDir('diamond-map'), 'graph.json');
    writeJson(mapFile, {
      _meta: {
        file_count: 4,
        git_hash: 'diamond',
        built_at: '2000-01-01T00:00:00.000Z',
        coverage: 'complete',
      },
      files: {
        'src/a.js': { imports: ['src/a.js'], imported_by: [] },
        'src/b.js': { imports: ['src/a.js'], imported_by: [] },
        'src/c.js': { imports: ['src/a.js'], imported_by: [] },
        'src/d.js': { imports: ['src/b.js', 'src/c.js'], imported_by: [] },
      },
    });
    const result = control.inspectMap(mapFile, 'src/a.js');
    assert.deepStrictEqual(result.selection.directDependents, ['src/b.js', 'src/c.js']);
    assert.deepStrictEqual(result.selection.transitiveDependents, ['src/b.js', 'src/c.js', 'src/d.js']);
    assert.strictEqual(result.selection.directDependentCount, 2);
    assert.strictEqual(result.selection.transitiveDependentCount, 3);
  }

  {
    const target = path.join(freshDir('map-target'), 'graph.json');
    writeJson(target, {
      _meta: { file_count: 0, git_hash: 'linked', built_at: '2000-01-01T00:00:00.000Z' },
      files: {},
    });
    const link = path.join(freshDir('map-link'), 'graph-link.json');
    let symlinkCreated = false;
    try {
      fs.symlinkSync(target, link, 'file');
      symlinkCreated = true;
    } catch (err) {
      if (!['EPERM', 'EACCES', 'ENOENT', 'UNKNOWN'].includes(err.code)) throw err;
      console.log(`copilot-control: map symlink test skipped (${err.code})`);
    }
    if (symlinkCreated) {
      assert.throws(() => control.inspectMap(link), /Dependency map must not be a symlink/i);
    }
  }

  const reportAll = control.getReportLinks();
  assert.deepStrictEqual(reportAll.reports, [
    {
      kind: 'bug',
      url: 'https://github.com/AR6420/Hail_Hydra/issues/new?template=bug_report.md&labels=bug',
    },
    {
      kind: 'feature',
      url: 'https://github.com/AR6420/Hail_Hydra/issues/new?template=feature_request.md&labels=enhancement',
    },
    {
      kind: 'feedback',
      url: 'https://github.com/AR6420/Hail_Hydra/issues/new?template=feedback.md&labels=feedback',
    },
  ]);

  const newer = control.compareVersions('2.5.2', '2.5.3');
  assert.strictEqual(newer.updateAvailable, true);
  assert.strictEqual(newer.latestIsNewer, true);
  assert.strictEqual(newer.comparison, 'latest_is_newer');

  const equal = control.compareVersions('2.5.2', '2.5.2');
  assert.strictEqual(equal.updateAvailable, false);
  assert.strictEqual(equal.comparison, 'equal');

  const older = control.compareVersions('2.5.3', '2.5.2');
  assert.strictEqual(older.updateAvailable, false);
  assert.strictEqual(older.downgrade, false);
  assert.strictEqual(older.comparison, 'installed_is_newer');

  const largeCore = control.compareVersions('9007199254740993.0.0', '9007199254740994.0.0');
  assert.strictEqual(largeCore.updateAvailable, true);
  assert.strictEqual(largeCore.latestIsNewer, true);

  const largePrerelease = control.compareVersions('1.0.0-beta.9007199254740994', '1.0.0-beta.9007199254740995');
  assert.strictEqual(largePrerelease.updateAvailable, true);
  assert.strictEqual(largePrerelease.latestIsNewer, true);

  const prereleaseNumericOrder = control.compareVersions('1.0.0-beta.10', '1.0.0-beta.2');
  assert.strictEqual(prereleaseNumericOrder.updateAvailable, false);
  assert.strictEqual(prereleaseNumericOrder.comparison, 'installed_is_newer');

  assert.throws(() => control.compareVersions('preview2.5.2', '2.5.1'), /Invalid installed version/i);
  assert.throws(() => control.compareVersions('2.5.2', 'latest'), /Invalid latest version/i);

  const updated = await control.checkUpdate(installedRoot, async () => ({ version: '2.6.0' }));
  assert.strictEqual(updated.installed, '2.5.2');
  assert.strictEqual(updated.latest, '2.6.0');
  assert.strictEqual(updated.updateAvailable, true);

  {
    const capture = makeCaptureIo();
    const exitCode = await control.main(['check-update'], capture.io, {
      root: installedRoot,
      fetchLatestVersion: async () => ({ version: '2.6.0' }),
    });
    assert.strictEqual(exitCode, 0);
    assert.strictEqual(JSON.parse(capture.stdout()).command, 'check-update');
    assert.strictEqual(capture.stderr(), '');
  }

  await assert.rejects(
    control.fetchLatestVersion((url, options, onResponse) => {
      const request = createFakeRequest();
      process.nextTick(() => {
        const response = createFakeResponse(200, {});
        onResponse(response);
        response.emit('data', 'REGISTRY_SECRET invalid json');
        response.emit('end');
      });
      return request;
    }, { timeoutMs: 100 }),
    (err) => {
      assert.match(err.message, /Cannot parse the npm registry response/i);
      assert.ok(!err.message.includes('REGISTRY_SECRET'));
      return true;
    }
  );

  await assert.rejects(
    control.fetchLatestVersion((url, options, onResponse) => {
      const request = createFakeRequest();
      process.nextTick(() => {
        const response = createFakeResponse(200, {});
        onResponse(response);
        response.emit('aborted');
      });
      return request;
    }, { timeoutMs: 100 }),
    /response was aborted/i
  );

  await assert.rejects(
    control.fetchLatestVersion(() => createFakeRequest(), { timeoutMs: 25 }),
    /request timed out/i
  );

  await assert.rejects(
    control.fetchLatestVersion((url, options, onResponse) => {
      const request = createFakeRequest();
      process.nextTick(() => {
        const response = createFakeResponse(302, {});
        onResponse(response);
        response.emit('error', new Error('late response failure'));
      });
      return request;
    }, { timeoutMs: 100 }),
    /redirects are not allowed/i
  );

  const badArity = runCli(CONTROL_PATH, ['notify'], 1);
  assert.match(badArity.stderr, /requires exactly one argument/i);
  assert.strictEqual(badArity.stdout, '');

  const unknown = runCli(CONTROL_PATH, ['totally-secret-command'], 1);
  assert.match(unknown.stderr, /Unknown command/i);
  assert.ok(!unknown.stderr.includes('totally-secret-command'));
  assert.strictEqual(unknown.stdout, '');

  const notify = runCli(CONTROL_PATH, ['notify', 'success'], 0);
  const notifyJson = jsonAfterBell(notify.stdout);
  assert.strictEqual(notifyJson.goal, 'success');
  assert.match(notifyJson.message, /may be suppressed/i);

  console.log('copilot-control: all checks passed');
}

main()
  .catch((err) => {
    console.error(err && err.stack ? err.stack : err);
    process.exitCode = 1;
  })
  .finally(() => {
    fs.rmSync(SCRATCH, { recursive: true, force: true });
  });
