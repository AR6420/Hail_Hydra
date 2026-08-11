'use strict';

// Hydra notify core — cross-platform sound playback.
// macOS: afplay · Windows: PowerShell SoundPlayer · Linux: paplay → aplay.
// Host entries supply the installed wav path.

const fs = require('fs');
const { spawn } = require('child_process');

function playSound(wavFile) {
  if (!fs.existsSync(wavFile)) return;

  const platform = process.platform;
  try {
    let child;

    if (platform === 'darwin') {
      child = spawn('afplay', [wavFile], { detached: true, stdio: 'ignore' });
    } else if (platform === 'win32') {
      child = spawn('powershell', [
        '-NoProfile', '-NonInteractive', '-Command',
        `(New-Object Media.SoundPlayer '${wavFile.replace(/'/g, "''")}').PlaySync()`,
      ], { detached: true, stdio: 'ignore', windowsHide: true });
    } else {
      const paplay = spawn('paplay', [wavFile], { detached: true, stdio: 'ignore' });
      paplay.on('error', () => {
        const aplay = spawn('aplay', [wavFile], { detached: true, stdio: 'ignore' });
        aplay.unref();
        aplay.on('error', () => {});
      });
      paplay.unref();
      return;
    }

    if (child) child.unref();
  } catch {
    // Notification sound is non-critical — never fail the hook.
  }
}

module.exports = { playSound };
