#!/usr/bin/env node
'use strict';

/**
 * Hydra Task Completion Notification (Claude Code)
 *
 * Plays a short notification sound when Claude Code finishes a task.
 * Cross-platform playback lives in lib/notify-core.
 *
 * Called by Claude Code's Notification hook — stdin receives JSON from
 * the hook system, which we drain and discard to prevent EPIPE errors.
 */

const path = require('path');
const os = require('os');

const { playSound } = require('../../lib/notify-core');

// Drain stdin to prevent EPIPE when the host pipes hook data
process.stdin.resume();
process.stdin.on('data', () => {});
process.stdin.on('end', () => {});

const configDir = process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');
playSound(path.join(configDir, 'hooks', 'hydra-task-complete.wav'));

process.exit(0);
