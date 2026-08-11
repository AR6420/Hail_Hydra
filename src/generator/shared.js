'use strict';

// Shared generator utilities used by every per-host emitter
// (src/generator/emit-<host>.js). Emitters own their host's token values,
// tool/model maps, and output layout; this module owns paths and mechanics.

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const CONTENT = path.join(ROOT, 'content');
const DIST = path.join(ROOT, 'dist');
const VERSION = require(path.join(ROOT, 'package.json')).version;

function write(dest, content) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, content, 'utf8');
}

// Replace {{HYDRA_*}} tokens. Throws on unknown tokens so a typo fails the
// build instead of shipping a literal '{{HYDRA_...}}'.
function applyTokens(text, tokens) {
  return text.replace(/\{\{(HYDRA_[A-Z0-9_]+)\}\}/g, (m, name) => {
    const value = tokens[name];
    if (value === undefined) {
      throw new Error(`Unknown generator token {{${name}}}`);
    }
    return value;
  });
}

function emitText(srcFile, destFile, tokens) {
  const text = applyTokens(fs.readFileSync(srcFile, 'utf8'), tokens);
  if (/\{\{HYDRA_[A-Z0-9_]+\}\}/.test(text)) {
    throw new Error(`Unresolved generator token left in ${destFile}`);
  }
  write(destFile, text);
}

function listMd(dir) {
  return fs.readdirSync(dir).filter((f) => f.endsWith('.md')).sort();
}

module.exports = { ROOT, CONTENT, DIST, VERSION, write, applyTokens, emitText, listMd };
