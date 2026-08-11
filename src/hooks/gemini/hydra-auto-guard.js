#!/usr/bin/env node

// Hydra Auto-Guard Hook — Gemini CLI AfterTool (matcher: write_file|replace)
//
// Normalizes the Gemini AfterTool stdin payload (G9: session_id, tool_name,
// tool_input) and delegates to lib/guard-core (shared with the Claude entry).
//
// Stdout contract (G10): on exit 0 stdout must be PURE JSON or empty — any
// other text breaks Gemini's hook-output parse. Substantial edits emit the
// G11 envelope {hookSpecificOutput:{additionalContext}}; trivial edits and
// malformed input stay silent.
//
// tool_input file-path key: write_file/replace use `file_path`; `path` and
// `absolute_path` (read-side vocabulary) are accepted defensively.

const guard = require('../../lib/guard-core');

const CONFIG_DIR_NAME = '.gemini';

let input = '';
process.stdin.on('data', (chunk) => (input += chunk));
process.stdin.on('end', () => {
  try {
    const data = JSON.parse(input);

    const toolName = data.tool_name || '';
    const toolKind = toolName === 'write_file' ? 'write' : 'edit';
    const ti = data.tool_input || {};

    const directive = guard.processEdit({
      sessionId: data.session_id || process.env.GEMINI_SESSION_ID || 'unknown',
      toolKind,
      filePath: ti.file_path || ti.path || ti.absolute_path || null,
      oldStr: ti.old_string || '',
      newStr: ti.new_string || '',
      configDirName: CONFIG_DIR_NAME,
    });

    if (directive) {
      process.stdout.write(JSON.stringify({
        hookSpecificOutput: { additionalContext: directive },
      }));
    }
  } catch (e) {
    // Silent — never break the parse contract or block Gemini CLI.
  }
  process.exit(0);
});
