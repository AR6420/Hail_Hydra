#!/usr/bin/env node
'use strict';

/**
 * Hydra Sentinel Done — invoked by the orchestrator (or a sentinel agent's
 * final step) after a sentinel scan reports. Clears the sentinel-pending flag
 * and writes the last-scan marker so the statusline shows "✅ Sentinel clean".
 *
 * Usage: node hydra-sentinel-done.js [session-id]
 * Falls back to the host session env var, then to clearing the most recently
 * modified pending flag.
 *
 * v2.5.0: replaces the bash `${TMPDIR:-/tmp}` blocks in agent markdown —
 * bash tmpdir and Node's os.tmpdir() disagree on Windows, which left the
 * "Sentinel pending" indicator stuck. This helper shares lib/sentinel-state
 * with the producer (auto-guard), so both sides always use the same paths.
 */

const sentinel = require('../../lib/sentinel-state');

const sessionId =
  process.argv[2] ||
  process.env.CLAUDE_SESSION_ID ||
  process.env.GEMINI_SESSION_ID ||
  process.env.CODEX_SESSION_ID ||
  'unknown';

try {
  sentinel.markScanned(sessionId);
} catch {
  // Never block the agent's report on state cleanup.
}
process.exit(0);
