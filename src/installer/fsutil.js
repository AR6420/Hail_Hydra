'use strict';

// Shared filesystem helpers for the host installers.

const fs = require('fs');

// Atomic write for user-owned config files: write a temp file in the same
// directory, then rename over the target (atomic on the same volume on both
// Windows and POSIX) so a crash mid-write can never truncate the user's file.
function writeFileAtomic(file, data) {
  const tmp = `${file}.hydra-tmp`;
  fs.writeFileSync(tmp, data, 'utf8');
  fs.renameSync(tmp, file);
}

// Read + parse a user-owned JSON config file, tolerating a UTF-8 BOM.
// Returns { exists, data } when the file parses (exists is false when the
// file is missing — distinct from a file containing literal `null`), or
// { exists: true, error } when it exists but cannot be parsed — callers
// must then leave the file alone instead of clobbering it.
function readUserJson(file) {
  let raw;
  try { raw = fs.readFileSync(file, 'utf8'); } catch { return { exists: false, data: null }; }
  try { return { exists: true, data: JSON.parse(raw.replace(/^﻿/, '')) }; }
  catch (err) { return { exists: true, error: err.message }; }
}

const isPlainObject = (v) => typeof v === 'object' && v !== null && !Array.isArray(v);

module.exports = { writeFileAtomic, readUserJson, isPlainObject };
