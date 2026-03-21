#!/usr/bin/env node
'use strict';

/**
 * Hydra Task Completion Notification
 *
 * Plays a short notification sound when Claude Code finishes a task.
 * Cross-platform: macOS (afplay), Windows (PowerShell), Linux (paplay/aplay).
 *
 * Called by Claude Code's Notification hook — stdin receives JSON from
 * the hook system, which we drain and discard to prevent EPIPE errors.
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

// Drain stdin to prevent EPIPE when Claude Code pipes hook data
process.stdin.resume();
process.stdin.on('data', () => {});
process.stdin.on('end', () => {});

const wavFile = path.join(os.homedir(), '.claude', 'hooks', 'hydra-task-complete.wav');

// Bail silently if the sound file is missing
if (!fs.existsSync(wavFile)) {
  process.exit(0);
}

const platform = process.platform;

try {
  let child;

  if (platform === 'darwin') {
    // macOS
    child = spawn('afplay', [wavFile], {
      detached: true,
      stdio: 'ignore',
    });
  } else if (platform === 'win32') {
    // Windows — use PowerShell to play the .wav
    child = spawn('powershell', [
      '-NoProfile', '-NonInteractive', '-Command',
      `(New-Object Media.SoundPlayer '${wavFile.replace(/'/g, "''")}').PlaySync()`,
    ], {
      detached: true,
      stdio: 'ignore',
      windowsHide: true,
    });
  } else {
    // Linux — try paplay (PulseAudio) first, fall back to aplay (ALSA)
    const paplay = spawn('paplay', [wavFile], {
      detached: true,
      stdio: 'ignore',
    });

    paplay.on('error', () => {
      // paplay not available, try aplay
      const aplay = spawn('aplay', [wavFile], {
        detached: true,
        stdio: 'ignore',
      });
      aplay.unref();
      aplay.on('error', () => {}); // silently ignore if neither works
    });

    paplay.unref();
    process.exit(0);
  }

  if (child) {
    child.unref();
  }
} catch {
  // Silently ignore errors — notification sound is non-critical
}

process.exit(0);
