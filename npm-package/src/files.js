'use strict';

/**
 * All Hydra framework files are bundled inside the npm package under the
 * files/ directory. Reading them at require-time guarantees:
 *  - No network requests — works fully offline
 *  - No write-time escaping headaches for markdown content
 *  - Standard npm bundling via the "files" field in package.json
 */

const fs = require('fs');
const path = require('path');

const FILES_DIR = path.join(__dirname, '..', 'files');

function readBundled(relPath) {
  return fs.readFileSync(path.join(FILES_DIR, relPath), 'utf8');
}

const agents = {
  'hydra-scout': {
    content: readBundled('agents/hydra-scout.md'),
    model: 'Haiku',
    display: 'hydra-scout (Haiku)    — Codebase exploration',
  },
  'hydra-runner': {
    content: readBundled('agents/hydra-runner.md'),
    model: 'Haiku',
    display: 'hydra-runner (Haiku)   — Test execution & validation',
  },
  'hydra-scribe': {
    content: readBundled('agents/hydra-scribe.md'),
    model: 'Haiku',
    display: 'hydra-scribe (Haiku)   — Documentation writing',
  },
  'hydra-coder': {
    content: readBundled('agents/hydra-coder.md'),
    model: 'Sonnet',
    display: 'hydra-coder (Sonnet)   — Code implementation',
  },
  'hydra-analyst': {
    content: readBundled('agents/hydra-analyst.md'),
    model: 'Sonnet',
    display: 'hydra-analyst (Sonnet) — Code review & debugging',
  },
  'hydra-guard': {
    content: readBundled('agents/hydra-guard.md'),
    model: 'Haiku',
    display: 'hydra-guard (Haiku)    — Auto-protection & safety',
  },
  'hydra-git': {
    content: readBundled('agents/hydra-git.md'),
    model: 'Haiku',
    display: 'hydra-git (Haiku)      — Git operations',
  },
};

const skill = readBundled('SKILL.md');

const references = {
  'routing-guide': readBundled('references/routing-guide.md'),
  'model-capabilities': readBundled('references/model-capabilities.md'),
};

const commands = {
  'update':   readBundled('commands/hydra/update.md'),
  'status':   readBundled('commands/hydra/status.md'),
  'help':     readBundled('commands/hydra/help.md'),
  'config':   readBundled('commands/hydra/config.md'),
  'guard':    readBundled('commands/hydra/guard.md'),
  'quiet':    readBundled('commands/hydra/quiet.md'),
  'verbose':  readBundled('commands/hydra/verbose.md'),
};

const hooks = {
  'hydra-check-update': readBundled('hooks/hydra-check-update.js'),
  'hydra-statusline':   readBundled('hooks/hydra-statusline.js'),
  'hydra-auto-guard':   readBundled('hooks/hydra-auto-guard.js'),
};

module.exports = { agents, skill, references, commands, hooks };
