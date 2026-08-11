#!/usr/bin/env node
'use strict';

/**
 * Hydra Sentinel Done (Codex CLI) — invoked by the orchestrator after a
 * sentinel scan reports. Clears the sentinel-pending flag and writes the
 * last-scan marker. Shares lib/sentinel-state with the producer
 * (hydra-auto-guard) so both sides always agree on os.tmpdir() paths.
 *
 * Usage: node hydra-sentinel-done.js [session-id]
 * Falls back to CODEX_SESSION_ID, then to clearing the most recently
 * modified pending flag.
 */

const sentinel = require('../../lib/sentinel-state');

const sessionId =
  process.argv[2] ||
  process.env.CODEX_SESSION_ID ||
  process.env.CLAUDE_SESSION_ID ||
  'unknown';

try {
  sentinel.markScanned(sessionId);
} catch {
  // Never block the agent's report on state cleanup.
}
process.exit(0);
