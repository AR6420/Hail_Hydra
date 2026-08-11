#!/usr/bin/env node

// Hydra Auto-Guard Hook — PostToolUse (matcher: Write|Edit|MultiEdit)
// Records changed file paths for hydra-guard, refreshes the sentinel-pending
// flag, and injects a scan directive after substantial edits.
// Does NOT run the scan itself — that would slow down every edit.
// Overhead: <1ms per edit. Files deduped by path.
//
// Claude Code entry: normalizes the PostToolUse stdin payload, then delegates
// to lib/guard-core (shared with the Gemini and Codex entries).

const guard = require('../../lib/guard-core');

const CONFIG_DIR_NAME = '.claude';

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
      sessionId: data.session_id || 'unknown',
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
        }
      }));
    }
  } catch (e) {
    // Silently fail — NEVER block Claude Code
  }
  process.exit(0);
});
