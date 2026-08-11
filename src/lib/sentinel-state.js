'use strict';

// Hydra sentinel state — single owner of the tmpdir flag files shared by
// auto-guard (producer), sentinel-done (consumer), and statusline (reader).
// Every host uses Node's os.tmpdir() so producer and consumer always agree —
// this replaces the bash `${TMPDIR:-/tmp}` blocks that diverged from
// os.tmpdir() on Windows and left the "Sentinel pending" indicator stuck.

const fs = require('fs');
const path = require('path');
const os = require('os');

const SENTINEL_DIR = () => path.join(os.tmpdir(), 'hydra-sentinel');
const GUARD_DIR    = () => path.join(os.tmpdir(), 'hydra-guard');

const PENDING_MAX_AGE_MS = 600000; // 10 min — statusline stops showing pending
const CLEAN_MAX_AGE_MS   = 60000;  // 60 s  — statusline shows "clean" briefly

function pendingFile(sessionId) { return path.join(SENTINEL_DIR(), `${sessionId}-pending.json`); }
function scanMarker(sessionId)  { return path.join(SENTINEL_DIR(), `${sessionId}-last-scan`); }
function trackingFile(sessionId) { return path.join(GUARD_DIR(), `${sessionId}.txt`); }

// Producer side (auto-guard): record an edited file, refresh the pending flag,
// invalidate any prior clean marker.
// ponytail: unlocked read-modify-write — parallel hook processes can drop each
// other's path from `files` (statusline count only; the pending flag itself
// always survives). Upgrade to an O_APPEND line format or a lock file if the
// count ever needs to be exact. Temp+rename below only prevents torn JSON.
function markPending(sessionId, filePath) {
  const dir = SENTINEL_DIR();
  fs.mkdirSync(dir, { recursive: true });

  let pending = { files: [], created_at: Date.now() };
  try { pending = JSON.parse(fs.readFileSync(pendingFile(sessionId), 'utf8')); } catch {}
  if (!Array.isArray(pending.files)) pending.files = [];
  if (!pending.files.includes(filePath)) pending.files.push(filePath);
  pending.updated_at = Date.now();
  const target = pendingFile(sessionId);
  const tmp = `${target}.${process.pid}.tmp`;
  try {
    fs.writeFileSync(tmp, JSON.stringify(pending));
    fs.renameSync(tmp, target);
  } catch {
    try { fs.unlinkSync(tmp); } catch {}
    fs.writeFileSync(target, JSON.stringify(pending)); // win32: rename can fail if target is open
  }

  try {
    const marker = scanMarker(sessionId);
    if (fs.existsSync(marker)) fs.unlinkSync(marker);
  } catch {}
}

// Producer side (auto-guard): dedup-append to the guard tracking list.
function trackEditedFile(sessionId, filePath) {
  const dir = GUARD_DIR();
  fs.mkdirSync(dir, { recursive: true });
  const file = trackingFile(sessionId);
  let existing = '';
  try { existing = fs.readFileSync(file, 'utf8'); } catch {}
  if (!existing.split('\n').includes(filePath)) {
    fs.appendFileSync(file, filePath + '\n');
  }
}

// Consumer side (sentinel-done, run after a sentinel scan reports):
// clear pending + write the clean marker. When sessionId is unknown, clears
// the most recently modified pending flag instead (same fallback the old
// bash block documented).
function markScanned(sessionId) {
  const dir = SENTINEL_DIR();
  fs.mkdirSync(dir, { recursive: true });

  let sid = sessionId;
  if (!sid || sid === 'unknown') {
    let newest = null;
    try {
      for (const f of fs.readdirSync(dir)) {
        if (!f.endsWith('-pending.json')) continue;
        const full = path.join(dir, f);
        const m = fs.statSync(full).mtimeMs;
        if (!newest || m > newest.m) newest = { f, m };
      }
    } catch {}
    if (!newest) return false;
    sid = newest.f.replace(/-pending\.json$/, '');
  }

  try { fs.unlinkSync(pendingFile(sid)); } catch {}
  fs.writeFileSync(scanMarker(sid), String(Math.floor(Date.now() / 1000)));
  return true;
}

// Reader side (statusline): 'pending' | 'clean' | 'quiet' (+ pending count).
function readIndicator(sessionId) {
  try {
    const pFile = pendingFile(sessionId);
    if (fs.existsSync(pFile)) {
      const pending = JSON.parse(fs.readFileSync(pFile, 'utf8'));
      const count = pending.files?.length || 0;
      const age = Date.now() - (pending.updated_at || 0);
      if (count > 0 && age < PENDING_MAX_AGE_MS) return { state: 'pending', count };
      return { state: 'quiet' };
    }
    const marker = scanMarker(sessionId);
    if (fs.existsSync(marker)) {
      const markerMs = parseInt(fs.readFileSync(marker, 'utf8').trim(), 10) * 1000;
      if (Date.now() - markerMs < CLEAN_MAX_AGE_MS) return { state: 'clean' };
    }
  } catch {}
  return { state: 'quiet' };
}

module.exports = { markPending, trackEditedFile, markScanned, readIndicator, trackingFile };
