#!/usr/bin/env node
'use strict';

/**
 * Hydra Task Completion Notification (Copilot CLI)
 *
 * Plays a short notification sound when Copilot CLI finishes a task.
 * Cross-platform playback lives in lib/notify-core.
 */

const path = require('path');
const os = require('os');

const { playSound } = require('../../lib/notify-core');

// Drain stdin to prevent EPIPE when the host pipes hook data
process.stdin.resume();
process.stdin.on('data', () => {});
process.stdin.on('end', () => {});

const configDir = process.env.COPILOT_CONFIG_DIR || path.join(os.homedir(), '.copilot');
playSound(path.join(configDir, 'hydra', 'hooks', 'hydra-task-complete.wav'));

process.exit(0);
