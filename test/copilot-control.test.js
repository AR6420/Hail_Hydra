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
const UTILITY_GUIDE_FILES = ['hydra-commands.md', 'hydra-measurements.md'];
const SKILL_TEXT = fs.readFileSync(path.join(ROOT, 'content', 'copilot', 'SKILL.md'), 'utf8');
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
  assert.deepStrictEqual(help.supportedHelperCommands, ['help', 'status', 'map', 'check-update', 'report', 'notify']);
  assert.strictEqual(help.flags.find((item) => item.flag === '--notify').usage, '--notify <goal>');
  assert.strictEqual(help.flags.find((item) => item.flag === '--update').helperCommand, 'check-update');

  assert.deepStrictEqual(control.parseArgs(['help']), { command: 'help' });
  assert.deepStrictEqual(control.parseArgs(['status']), { command: 'status' });
  assert.deepStrictEqual(control.parseArgs(['--status']), { command: 'status' });
  assert.deepStrictEqual(control.parseArgs(['map', 'x.json']), { command: 'map', mapFile: 'x.json', selectedFile: undefined });
  assert.deepStrictEqual(control.parseArgs(['check-update']), { command: 'check-update' });
  assert.deepStrictEqual(control.parseArgs(['report', 'feature']), { command: 'report', kind: 'feature' });
  assert.deepStrictEqual(control.parseArgs(['notify', 'success']), { command: 'notify', goal: 'success' });

  const installedRoot = createInstalledRoot();
  const status = control.inspectStatus(installedRoot);
  assert.deepStrictEqual(status, {
    command: 'status',
    installed: true,
    version: '2.5.2',
    roleCount: 12,
    ownedFileCount: 19,
    activationManualOnly: false,
    modelInvocationAllowed: true,
    activationPolicy: 'explicit-request-instructions',
    hooksInstalledByThisIntegration: false,
  });

  const installedStatus = runCli(path.join(installedRoot, 'scripts', 'hydra-control.js'), ['status'], 0);
  const installedStatusJson = JSON.parse(installedStatus.stdout);
  assert.strictEqual(installedStatusJson.version, '2.5.2');
  assert.strictEqual(installedStatusJson.roleCount, 12);
  assert.strictEqual(installedStatusJson.ownedFileCount, 19);

  const installedHelp = runCli(path.join(installedRoot, 'scripts', 'hydra-control.js'), ['help'], 0);
  assert.strictEqual(JSON.parse(installedHelp.stdout).command, 'help');

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

  {
    const root = createInstalledRoot();
    fs.unlinkSync(path.join(root, 'references', 'hydra-commands.md'));
    assert.throws(() => control.inspectStatus(root), /missing references\/hydra-commands\.md/i);
  }

  {
    const root = createInstalledRoot({
      skillText: SKILL_TEXT.replace('disable-model-invocation: false', 'disable-model-invocation: true'),
    });
    const strict = control.inspectStatus(root);
    assert.strictEqual(strict.activationManualOnly, true);
    assert.strictEqual(strict.modelInvocationAllowed, false);
    assert.strictEqual(strict.activationPolicy, 'host-manual-only');
  }

  {
    const root = createInstalledRoot({
      skillText: SKILL_TEXT.replace('user-invocable: true', 'user-invocable: false'),
    });
    assert.throws(() => control.inspectStatus(root), /must be user-invocable/i);
  }

  {
    const root = createInstalledRoot({
      skillText: SKILL_TEXT.replace('disable-model-invocation: false', 'disable-model-invocation: invalid'),
    });
    assert.throws(() => control.inspectStatus(root), /must be true or false/i);
  }

  {
    const root = createInstalledRoot({
      skillText: SKILL_TEXT.replace('name: hail-hydra', 'name: something-else'),
    });
    assert.throws(() => control.inspectStatus(root), /expected name hail-hydra/i);
  }

  {
    const root = createInstalledRoot({ roles: [] });
    assert.throws(() => control.inspectStatus(root), /at least one role/i);
  }

  {
    const root = createInstalledRoot({
      roles: [{
        name: 'hydra-commands',
        tier: 'cheap',
        modelSelection: 'latest-suitable-available',
        instructions: 'references/hydra-commands.md',
      }],
    });
    assert.throws(() => control.inspectStatus(root), /utility guides are not catalogue roles/i);
  }

  {
    const root = createInstalledRoot();
    writeText(path.join(root, 'references', 'roles.json'), 'ROLE_SECRET starts invalid json');
    try {
      control.inspectStatus(root);
      assert.fail('expected malformed roles.json to fail');
    } catch (err) {
      assert.match(err.message, /Cannot parse references\/roles\.json/i);
      assert.ok(!err.message.includes('ROLE_SECRET'));
    }
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
