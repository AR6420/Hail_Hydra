#!/usr/bin/env node

// Hydra Auto-Guard Hook — PostToolUse (matcher: Write|Edit|MultiEdit)
// Records changed file paths to a temp file for hydra-guard to scan later.
// Does NOT run the scan itself — that would slow down every edit.
// Overhead: <1ms per edit. Files deduped by path.

const fs = require('fs');
const path = require('path');
const os = require('os');

let input = '';
process.stdin.on('data', (chunk) => (input += chunk));
process.stdin.on('end', () => {
  try {
    const data = JSON.parse(input);

    // Extract the file path from the tool input
    const filePath = data.tool_input?.file_path ||
                     data.tool_input?.path ||
                     null;

    if (!filePath) {
      process.exit(0);
    }

    // Append to session-scoped changed files list
    const sessionId = data.session_id || 'unknown';
    const trackingDir = path.join(os.tmpdir(), 'hydra-guard');
    const trackingFile = path.join(trackingDir, `${sessionId}.txt`);

    // Ensure directory exists
    if (!fs.existsSync(trackingDir)) {
      fs.mkdirSync(trackingDir, { recursive: true });
    }

    // Read existing tracked files
    let existing = '';
    try {
      existing = fs.readFileSync(trackingFile, 'utf8');
    } catch (e) {
      // File doesn't exist yet — that's fine
    }

    // Only append if not already tracked (dedup)
    if (!existing.split('\n').includes(filePath)) {
      fs.appendFileSync(trackingFile, filePath + '\n');
    }

  } catch (e) {
    // Silently fail — NEVER block Claude Code
  }
  process.exit(0);
});
