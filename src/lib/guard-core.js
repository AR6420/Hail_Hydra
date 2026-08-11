'use strict';

// Hydra auto-guard core — host-agnostic substantial-edit heuristic and
// directive text. The per-host hook entry normalizes its stdin payload to
// {sessionId, toolKind, filePath, oldStr, newStr} and hands it here.
//
// toolKind: 'write' (whole-file write) | 'multiedit' | 'edit' (string replace)

const fs = require('fs');
const path = require('path');

const sentinel = require('./sentinel-state');

function isSubstantial({ toolKind, oldStr, newStr }) {
  if (toolKind === 'write' || toolKind === 'multiedit') return true;
  const oldLines = ((oldStr || '').match(/\n/g) || []).length;
  const newLines = ((newStr || '').match(/\n/g) || []).length;
  return oldLines > 5 || newLines > 5 ||
         (oldStr || '').length > 200 || (newStr || '').length > 200;
}

// Best-effort risk lookup from the project codebase map.
// configDirName is the host's project config dir ('.claude' | '.gemini' | '.codex').
function riskNote(filePath, configDirName) {
  try {
    const mapPath = path.join(process.cwd(), configDirName, 'hydra', 'codebase-map.json');
    if (!fs.existsSync(mapPath)) return '';
    const map = JSON.parse(fs.readFileSync(mapPath, 'utf8'));
    const relPath = path.relative(process.cwd(), filePath).split(path.sep).join('/');
    const fileEntry = map.files && map.files[relPath];
    if (fileEntry && fileEntry.risk) {
      return ` Risk: ${fileEntry.risk} (${fileEntry.dependents_count || 0} dependents).`;
    }
  } catch {}
  return '';
}

// Full guard pass: track the edit, refresh sentinel state, and return the
// directive text to inject (or null for trivial edits). Kept under ~500
// tokens by construction — Codex caps injected context (~2500-token default),
// and short directives survive on every host.
function processEdit({ sessionId, toolKind, filePath, oldStr, newStr, configDirName }) {
  if (!filePath) return null;
  const sid = sessionId || 'unknown';

  sentinel.trackEditedFile(sid, filePath);
  sentinel.markPending(sid, filePath);

  if (!isSubstantial({ toolKind, oldStr, newStr })) return null;

  const note = riskNote(filePath, configDirName);
  return `🐉 Hydra Auto-Guard: Substantial change to ${path.basename(filePath)}.${note} Dispatch hydra-sentinel-scan to verify integration before presenting results to the user.`;
}

module.exports = { isSubstantial, riskNote, processEdit };
