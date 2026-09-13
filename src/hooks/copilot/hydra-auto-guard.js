#!/usr/bin/env node

// Hydra Auto-Guard Hook — Copilot CLI PostToolUse (matcher: Write|Edit|MultiEdit)
//
// Copilot CLI's hook stdin payload follows the same shape as Claude Code:
// session_id, tool_name, tool_input. Normalizes the payload and delegates
// to lib/guard-core (shared with the Claude, Gemini, and Codex entries).
//
// Stdout contract: substantial edits emit the envelope
// {hookSpecificOutput:{hookEventName:'PostToolUse', additionalContext}} —
// kept under Copilot's additionalContext limit by construction (guard-core
// directives are < 500 tokens). Trivial edits and malformed input stay
// silent. Never exits non-zero.

const guard = require('../../lib/guard-core');

const CONFIG_DIR_NAME = '.copilot';

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
      sessionId: data.session_id || process.env.COPILOT_SESSION_ID || 'unknown',
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
    // Silently fail — NEVER block Copilot CLI.
  }
  process.exit(0);
});
