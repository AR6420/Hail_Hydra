'use strict';

// Micro-bundler for hook files.
//
// Installed hooks run standalone from the host's hooks dir (e.g.
// `node ~/.claude/hooks/hydra-auto-guard.js`), so they cannot require() the
// package's src/ tree. This inlines every relative require that resolves
// inside the repo into a single self-contained file.
//
// Rules:
//   - `require('./x')` / `require('../lib/x')` that resolves to an existing
//     file is inlined (recursively).
//   - Relative requires that do NOT resolve (e.g. a runtime sibling in the
//     installed dir) are left untouched.
//   - Bare requires (fs, path, os, child_process) are left untouched.
//
// No deps, deterministic output, ~80 lines. Not a general bundler — it only
// needs to handle our own plain-CommonJS sources (string-literal requires,
// no dynamic paths, no cycles in practice, cycle-guarded anyway).

const fs = require('fs');
const path = require('path');

const REQUIRE_RE = /require\((['"])(\.{1,2}\/[^'"]+)\1\)/g;

function resolveRelative(fromFile, rel) {
  let resolved = path.resolve(path.dirname(fromFile), rel);
  if (fs.existsSync(resolved) && fs.statSync(resolved).isFile()) return resolved;
  if (fs.existsSync(resolved + '.js')) return resolved + '.js';
  return null;
}

function stripShebang(code) {
  return code.replace(/^#!.*\r?\n/, '');
}

function bundleHook(entryPath) {
  const modules = new Map(); // absPath -> { id, code }
  let nextId = 0;

  function processFile(absPath) {
    if (modules.has(absPath)) return modules.get(absPath).id;
    const id = `m${nextId++}`;
    modules.set(absPath, { id, code: null }); // reserve first — cycle guard

    let code = stripShebang(fs.readFileSync(absPath, 'utf8'));
    code = code.replace(REQUIRE_RE, (match, q, rel) => {
      const resolved = resolveRelative(absPath, rel);
      if (!resolved) return match; // runtime sibling — leave for the installed dir
      const depId = processFile(resolved);
      return `__hydra_require('${depId}')`;
    });

    modules.get(absPath).code = code;
    return id;
  }

  const entryId = processFile(entryPath);

  const parts = [];
  parts.push('#!/usr/bin/env node');
  parts.push("'use strict';");
  parts.push('// GENERATED FILE — built from src/ by `npm run build`. Do not edit;');
  parts.push('// changes are overwritten on the next hydra install/update.');
  parts.push('const __hydra_modules = {};');
  parts.push('const __hydra_cache = {};');
  parts.push('function __hydra_require(id) {');
  parts.push('  if (__hydra_cache[id]) return __hydra_cache[id].exports;');
  parts.push('  const module = { exports: {} };');
  parts.push('  __hydra_cache[id] = module;');
  parts.push('  __hydra_modules[id](module, module.exports);');
  parts.push('  return __hydra_cache[id].exports;');
  parts.push('}');

  for (const [absPath, { id, code }] of modules) {
    const rel = path.relative(process.cwd(), absPath).split(path.sep).join('/');
    parts.push(`__hydra_modules['${id}'] = function (module, exports) { // ${rel}`);
    parts.push(code);
    parts.push('};');
  }

  // Attach the entry's exports so the generated file works both as an
  // executable hook AND as a require()-able module (stats.md and the
  // statusline require hydra-token-math this way).
  parts.push(`module.exports = __hydra_require('${entryId}');`);
  parts.push('');

  return parts.join('\n');
}

module.exports = { bundleHook };
