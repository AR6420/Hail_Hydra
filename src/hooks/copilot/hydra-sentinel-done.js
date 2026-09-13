#!/usr/bin/env node
'use strict';

// Hydra Sentinel Done — Copilot CLI entry.
// Clears the sentinel-pending flag and writes the last-scan marker.
// Shared implementation with all hosts via lib/sentinel-state.

const sentinel = require('../../lib/sentinel-state');

const sessionId =
  process.argv[2] ||
  process.env.COPILOT_SESSION_ID ||
  process.env.CLAUDE_SESSION_ID ||
  'unknown';

try {
  sentinel.markScanned(sessionId);
} catch {
  // Never block the agent's report on state cleanup.
}
process.exit(0);
