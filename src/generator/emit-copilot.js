'use strict';

const fs = require('fs');
const path = require('path');
const { ROOT, CONTENT, DIST, VERSION, write, listMd } = require('./shared');

const MODEL_MAP = {
  haiku: { tier: 'cheap', tierIsHint: true, modelSelection: 'latest-suitable-available' },
  sonnet: { tier: 'mid', tierIsHint: true, modelSelection: 'latest-suitable-available' },
};

const CAPABILITIES = {
  Read: 'read files',
  Write: 'write files',
  Edit: 'edit files',
  Bash: 'run shell commands',
  Glob: 'find files',
  Grep: 'search text',
  WebSearch: 'search the public web',
  WebFetch: 'fetch public web pages',
};

function transformRole(text, fileName) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n/.exec(text);
  if (!match) throw new Error(`No frontmatter in ${fileName}`);
  const name = /^name:\s*(\S+)\s*$/m.exec(match[1]);
  const model = /^model:\s*(\S+)\s*$/m.exec(match[1]);
  if (!name || name[1] !== fileName.replace(/\.md$/, '')) {
    throw new Error(`Missing or mismatched name in ${fileName}`);
  }
  const tier = model && MODEL_MAP[model[1]];
  if (!tier) throw new Error(`No Copilot tier mapping in ${fileName}`);
  const toolLine = /^tools:\s*(.+)$/m.exec(match[1]);
  const tools = toolLine ? toolLine[1].trim().split(/,\s*/) : [];
  if (!tools.length || tools.some((tool) => !CAPABILITIES[tool])) {
    throw new Error(`Missing or unsupported tool capability in ${fileName}`);
  }
  const canResearch = tools.includes('WebSearch') || tools.includes('WebFetch');

  let body = text.slice(match[0].length);
  // These sections assume Claude's memory, hooks or always-on protocol.
  body = body.replace(/^## (?:Your Memory|Cleanup|Collaboration)\r?\n[\s\S]*?(?=^## |(?![\s\S]))/gm, '');
  body = body.replace(/^### After Building [^\r\n]*\r?\n[\s\S]*?(?=^## |(?![\s\S]))/gm, '');
  body = body.replace(/\.claude/g, '.github');
  body = body.replace(/\bClaude(?: Code)?\b/g, 'Copilot');

  if (name[1] === 'hydra-preflight') {
    body = fs.readFileSync(path.join(CONTENT, 'copilot', 'preflight.md'), 'utf8');
  }
  if (name[1] === 'hydra-scout') {
    body = body.replace(/\*\*Freshness check\*\*[\s\S]*?(?=\*\*Full build\*\*)/,
      'Build or refresh a map only when explicitly requested. A cached map is a hint, ' +
      'not proof: check current files and uncommitted changes before relying on it.\n\n');
  }
  if (name[1] === 'hydra-guard') {
    const advisoryRule = /- \*\*Never block delivery\.\*\*[\s\S]*?(?=\r?\n- |\r?\n## |$)/;
    if (!advisoryRule.test(body)) {
      throw new Error('Copilot guard delivery rule needs review after canonical prompt changes');
    }
    body = body.replace(advisoryRule,
      '- **Flag delivery blockers.** Report confirmed serious findings to the main agent. ' +
      'It must resolve them or report blocked work before completion/deployment; ' +
      'a quick scan does not approve release. Mark partial or timed-out scans incomplete, ' +
      'not clean, and identify the unchecked scope.\n');
    const resultContract = 'result: clean|issues_found';
    if (!body.includes(resultContract)) {
      throw new Error('Copilot guard result contract needs review after canonical prompt changes');
    }
    body = body.replace(resultContract, resultContract + '|incomplete');
  }
  if (/\{\{HYDRA_[A-Z0-9_]+\}\}/.test(body)) {
    throw new Error(`Unresolved host-specific token in ${fileName}`);
  }
  const boundary = [
    '## Copilot invocation limits',
    '',
    `Allowed capabilities (use host-native tools): ${tools.map((tool) => CAPABILITIES[tool]).join(', ')}.`,
    ...(tools.includes('Bash') ? [] : ['Do not execute shell commands.']),
    ...(tools.some((tool) => tool === 'Write' || tool === 'Edit') ? [] :
      ['Do not directly edit files. Any shell mutation must be explicitly authorized by the task.']),
    'These are role instructions, not extra permissions or a sandbox.',
    'Follow the parent /hail-hydra invocation scope, budget and permissions.',
    'Report work beyond your assigned capability to the main agent; do not guess or approve release.',
    'Do not delegate again, start another CLI, or create persistent memories.',
    'Use the host-native shell and tools; never assume Bash on Windows.',
    'Only build a codebase map when explicitly requested. Verify cached data.',
    canResearch
      ? 'Do not mutate git state or operate on private or deployment services without user authorization.'
      : 'Do not mutate git state or contact live services without user authorization.',
    'Never expose secret values. Report failures and incomplete checks explicitly.',
    '',
  ].join('\n');
  return {
    role: { name: name[1], ...tier, instructions: `references/${fileName}` },
    body: boundary + '\n' + body.trim() + '\n',
  };
}

function loadRoles(directories) {
  const definitions = [];
  const names = new Set();
  for (const directory of directories) {
    for (const file of listMd(directory)) {
      const definition = transformRole(fs.readFileSync(path.join(directory, file), 'utf8'), file);
      if (names.has(definition.role.name)) {
        throw new Error(`Duplicate Copilot role '${definition.role.name}'`);
      }
      names.add(definition.role.name);
      definitions.push(definition);
    }
  }
  return definitions.sort((a, b) =>
    a.role.instructions < b.role.instructions ? -1 : a.role.instructions > b.role.instructions ? 1 : 0);
}

function emit() {
  const out = path.join(DIST, 'copilot', 'skills', 'hail-hydra');
  const definitions = loadRoles([
    path.join(CONTENT, 'agents'),
    path.join(CONTENT, 'copilot', 'agents'),
  ]);
  for (const { role, body } of definitions) {
    write(path.join(out, role.instructions), body);
  }
  write(path.join(out, 'references', 'roles.json'),
    JSON.stringify(definitions.map(({ role }) => role), null, 2) + '\n');
  for (const name of ['commands', 'measurements', 'quality', 'modes', 'continuity']) {
    write(path.join(out, 'references', `hydra-${name}.md`),
      fs.readFileSync(path.join(CONTENT, 'copilot', `${name}.md`), 'utf8'));
  }
  for (const name of ['control', 'usage']) {
    write(path.join(out, 'scripts', `hydra-${name}.js`),
      fs.readFileSync(path.join(ROOT, 'src', 'copilot', `hydra-${name}.js`), 'utf8'));
  }
  write(path.join(out, 'SKILL.md'), fs.readFileSync(path.join(CONTENT, 'copilot', 'SKILL.md'), 'utf8'));
  write(path.join(out, 'VERSION'), VERSION + '\n');
}

module.exports = { id: 'copilot', emit, transformRole, loadRoles, MODEL_MAP };
