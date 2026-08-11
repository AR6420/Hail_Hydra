#!/usr/bin/env node
'use strict';

/**
 * Hydra Notify Chain (Codex CLI)
 *
 * Codex's `notify` config.toml key is single-valued and often already
 * occupied (e.g. the Codex desktop companion exe) — C11. The installer swaps
 * the key for this shim and saves the previous value to
 * <config>/hydra/notify-prev.json; this shim plays the Hydra sound, then
 * re-fires the previous command with the same payload so nothing the user
 * had configured is lost. Restored verbatim on uninstall.
 *
 * Contract (C11): Codex appends the notification payload JSON as the FINAL
 * argv element, fire-and-forget. This script must never throw and never
 * block — everything is best-effort, detached, exit 0.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const { playSound } = require('../../lib/notify-core');

const configDir = process.env.CODEX_HOME || path.join(os.homedir(), '.codex');

try {
  playSound(path.join(configDir, 'hydra', 'hooks', 'hydra-task-complete.wav'));
} catch { /* sound is non-critical */ }

try {
  const prev = JSON.parse(fs.readFileSync(path.join(configDir, 'hydra', 'notify-prev.json'), 'utf8'));
  if (Array.isArray(prev.argv) && prev.argv.length > 0) {
    // Payload = final argv element (only when Codex actually passed one).
    const payload = process.argv.length > 2 ? process.argv[process.argv.length - 1] : null;
    const args = payload !== null ? [...prev.argv.slice(1), payload] : prev.argv.slice(1);
    const child = spawn(prev.argv[0], args, { detached: true, stdio: 'ignore', windowsHide: true });
    child.on('error', () => {});
    child.unref();
  }
} catch { /* no previous notify command saved — nothing to chain */ }

process.exit(0);
