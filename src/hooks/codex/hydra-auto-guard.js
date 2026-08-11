#!/usr/bin/env node

// Hydra Auto-Guard Hook — Codex CLI PostToolUse (matcher: Write|Edit|MultiEdit)
//
// Codex's hook stdin payload uses the same field names as Claude Code (C7:
// session_id, tool_name, tool_input) — verified against the live install.
// Normalizes the payload and delegates to lib/guard-core (shared with the
// Claude and Gemini entries).
//
// Stdout contract (C8): substantial edits emit the envelope
// {hookSpecificOutput:{hookEventName:'PostToolUse', additionalContext}} —
// kept well under Codex's ~2500-token additionalContext default limit by
// construction (guard-core directives are < 500 tokens). Trivial edits and
// malformed input stay silent. Never exits non-zero.
//
// Codebase-map risk notes read .codex/hydra/codebase-map.json (fixes the C22
// .claude leak in the manual port).

const guard = require('../../lib/guard-core');

const CONFIG_DIR_NAME = '.codex';

let input = '';
process.stdin.on('data', (chunk) => (input += chunk));
process.stdin.on('end', () => {
  try {
    const data = JSON.parse(input);

    const toolName = data.tool_name || '';
    const toolKind =
      toolName === 'Write'     ? 'write' :
      toolName === 'MultiEdit' ? 'multiedit' :
                                 'edit';

    const directive = guard.processEdit({
      sessionId: data.session_id || process.env.CODEX_SESSION_ID || 'unknown',
      toolKind,
      filePath: data.tool_input?.file_path || data.tool_input?.path || null,
      oldStr: data.tool_input?.old_string || '',
      newStr: data.tool_input?.new_string || '',
      configDirName: CONFIG_DIR_NAME,
    });

    if (directive) {
      process.stdout.write(JSON.stringify({
        hookSpecificOutput: {
          hookEventName: 'PostToolUse',
          additionalContext: directive,
        },
      }));
    }
  } catch (e) {
    // Silently fail — NEVER block Codex CLI.
  }
  process.exit(0);
});
