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

    // === Sentinel Pending Flag ===
    // Write a flag file that the statusline hook reads.
    // This shows "⚠ Sentinel pending" in the status bar until cleared.
    const sentinelDir = path.join(os.tmpdir(), 'hydra-sentinel');
    const sentinelFlag = path.join(sentinelDir, `${sessionId}-pending.json`);

    if (!fs.existsSync(sentinelDir)) {
      fs.mkdirSync(sentinelDir, { recursive: true });
    }

    // Read existing pending data or create new
    let pending = { files: [], created_at: Date.now() };
    try {
      pending = JSON.parse(fs.readFileSync(sentinelFlag, 'utf8'));
    } catch (e) {
      // New flag
    }

    // Add file to pending list (dedup)
    if (!pending.files.includes(filePath)) {
      pending.files.push(filePath);
    }
    pending.updated_at = Date.now();

    fs.writeFileSync(sentinelFlag, JSON.stringify(pending));

    // New edit invalidates any prior "clean" marker
    try {
      const scanMarker = path.join(sentinelDir, `${sessionId}-last-scan`);
      if (fs.existsSync(scanMarker)) fs.unlinkSync(scanMarker);
    } catch (_) { /* silent — never block */ }

    // === Substantial-Edit Detection + Directive Injection (v2.4.0+) ===
    // For Write, MultiEdit, or large Edits, inject a directive recommending
    // hydra-sentinel-scan dispatch. Trivial edits stay silent.
    const toolName = data.tool_name || '';
    const isWrite = toolName === 'Write';
    const isMultiEdit = toolName === 'MultiEdit';
    const oldString = data.tool_input?.old_string || '';
    const newString = data.tool_input?.new_string || '';

    let isSubstantial = isWrite || isMultiEdit;
    if (!isSubstantial) {
      const oldLines = (oldString.match(/\n/g) || []).length;
      const newLines = (newString.match(/\n/g) || []).length;
      isSubstantial = oldLines > 5 || newLines > 5 ||
                      oldString.length > 200 || newString.length > 200;
    }

    if (isSubstantial) {
      // Best-effort codebase map risk lookup
      let riskNote = '';
      try {
        const mapPath = path.join(process.cwd(), '.claude', 'hydra', 'codebase-map.json');
        if (fs.existsSync(mapPath)) {
          const map = JSON.parse(fs.readFileSync(mapPath, 'utf8'));
          const relPath = path.relative(process.cwd(), filePath).split(path.sep).join('/');
          const fileEntry = map.files && map.files[relPath];
          if (fileEntry && fileEntry.risk) {
            riskNote = ` Risk: ${fileEntry.risk} (${fileEntry.dependents_count || 0} dependents).`;
          }
        }
      } catch (e) {
        // Map missing or malformed — no risk note appended
      }

      const directive = {
        hookSpecificOutput: {
          hookEventName: 'PostToolUse',
          additionalContext: `🐉 Hydra Auto-Guard: Substantial change to ${path.basename(filePath)}.${riskNote} Dispatch hydra-sentinel-scan to verify integration before presenting results to the user.`
        }
      };

      process.stdout.write(JSON.stringify(directive));
    }

  } catch (e) {
    // Silently fail — NEVER block Claude Code
  }
  process.exit(0);
});
