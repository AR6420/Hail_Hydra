#!/usr/bin/env node
'use strict';

/**
 * Hydra Task Completion Notification (Gemini CLI)
 *
 * Plays a short notification sound on Gemini's Notification hook event
 * (observability-only, G11). Cross-platform playback lives in lib/notify-core.
 * Emits nothing on stdout (G10 contract: pure JSON or empty).
 */

const path = require('path');
const os = require('os');

const { playSound } = require('../../lib/notify-core');

// Drain stdin to prevent EPIPE when the host pipes hook data
process.stdin.resume();
process.stdin.on('data', () => {});
process.stdin.on('end', () => {});

const configDir = process.env.GEMINI_CONFIG_DIR || path.join(os.homedir(), '.gemini');
playSound(path.join(configDir, 'hydra', 'hooks', 'hydra-task-complete.wav'));

process.exit(0);
