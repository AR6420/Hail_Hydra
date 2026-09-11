'use strict';

const fs = require('fs');
const path = require('path');
const { CONTENT, DIST, VERSION, write, listMd } = require('./shared');

const MODEL_MAP = {
  haiku: { tier: 'cheap', preferredModel: 'gpt-5-mini' },
  sonnet: { tier: 'mid', preferredModel: 'gpt-5.4' },
};

const CAPABILITIES = {
  Read: 'read files',
  Write: 'write files',
  Edit: 'edit files',
  Bash: 'run shell commands',
  Glob: 'find files',
  Grep: 'search text',
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
    'Do not delegate again, start another CLI, or create persistent memories.',
    'Use the host-native shell and tools; never assume Bash on Windows.',
    'Only build a codebase map when explicitly requested. Verify cached data.',
    'Do not mutate git state or contact live services without user authorization.',
    'Never expose secret values. Report failures and incomplete checks explicitly.',
    '',
  ].join('\n');
  return {
    role: { name: name[1], ...tier, instructions: `references/${fileName}` },
    body: boundary + '\n' + body.trim() + '\n',
  };
}

function emit() {
  const out = path.join(DIST, 'copilot', 'skills', 'hail-hydra');
  const roles = [];
  for (const file of listMd(path.join(CONTENT, 'agents'))) {
    const { role, body } = transformRole(
      fs.readFileSync(path.join(CONTENT, 'agents', file), 'utf8'), file);
    roles.push(role);
    write(path.join(out, role.instructions), body);
  }
  write(path.join(out, 'references', 'roles.json'), JSON.stringify(roles, null, 2) + '\n');
  write(path.join(out, 'SKILL.md'), fs.readFileSync(path.join(CONTENT, 'copilot', 'SKILL.md'), 'utf8'));
  write(path.join(out, 'VERSION'), VERSION + '\n');
}

module.exports = { id: 'copilot', emit, transformRole, MODEL_MAP };
