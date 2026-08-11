#!/usr/bin/env node

// Hydra StatusLine — persistent status bar at bottom of Claude Code
// Receives session JSON via stdin, outputs one formatted line to stdout.
//
// Display format:
//   🐉 │ Opus │ Ctx: 37% ████░░░░░░ │ $0.42 │ my-project │ ⚡ Update available
//
// Context bar is color-coded:
//   Green (0-49%) → Yellow (50-79%) → Red (80%+)

const fs = require('fs');
const path = require('path');
const os = require('os');

const sentinel = require('../../lib/sentinel-state');

const configDir = process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');
const cacheFile = path.join(configDir, 'cache', 'hydra-update-check.json');

let input = '';
process.stdin.on('data', (chunk) => (input += chunk));
process.stdin.on('end', () => {
  try {
    const data = JSON.parse(input);

    // === Model ===
    const model = data.model?.display_name || 'Unknown';

    // === Context Usage ===
    // Use precomputed used_percentage from Claude Code (most reliable)
    const ctxPct = Math.round(data.context_window?.used_percentage || 0);

    // Build visual context bar (10 chars wide)
    const filled = Math.round(ctxPct / 10);
    const empty = 10 - filled;
    const bar = '█'.repeat(filled) + '░'.repeat(empty);

    // Color-code: Green <50%, Yellow 50-79%, Red 80%+
    let ctxColor;
    if (ctxPct < 50) {
      ctxColor = '\x1b[32m'; // Green
    } else if (ctxPct < 80) {
      ctxColor = '\x1b[33m'; // Yellow
    } else {
      ctxColor = '\x1b[31m'; // Red
    }
    const reset = '\x1b[0m';
    const dim = '\x1b[2m';

    const ctxDisplay = `${ctxColor}Ctx: ${ctxPct}% ${bar}${reset}`;

    // === Session Cost ===
    const cost = (data.cost?.total_cost_usd || 0).toFixed(2);

    // === Savings vs all-Opus baseline (cached, silent on failure) ===
    let savingsStr = '';
    try {
      const tokenMath = require('./hydra-token-math');
      const summary = tokenMath.computeSummaryCached();
      if (summary.available && summary.savedUSD >= 0.01) {
        savingsStr = ` \x1b[32m↓$${summary.savedUSD.toFixed(2)}\x1b[0m`;
      }
    } catch (e) { /* silent fallback */ }

    // === Working Directory ===
    const dirName = path.basename(data.workspace?.current_dir || data.cwd || '');

    // === Update Check (read from cache) ===
    let updateNotice = '';
    try {
      const cache = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
      if (cache.update_available) {
        updateNotice = ` \x1b[33m⚡ v${cache.latest} available${reset}`;
      }
    } catch (e) {
      // No cache — skip update notice
    }

    // === Compose Status Line ===
    const parts = [
      '\x1b[32m🐲\x1b[0m',         // Green dragon emoji (🐉)
      `${dim}${model}${reset}`,                 // Dim model name
      ctxDisplay,                               // Color-coded context bar
      `${dim}$${cost}${reset}${savingsStr}`,   // Dim cost + green ↓savings
      `${dim}${dirName}${reset}`,              // Dim directory
    ];

    // Append update notice if available
    if (updateNotice) {
      parts.push(updateNotice);
    }

    // Compaction warning — only show at 70%+ context usage
    if (ctxPct >= 80) {
      parts.push(`\x1b[31m⚠ Compacting soon!\x1b[0m`);
    } else if (ctxPct >= 70) {
      parts.push(`\x1b[31m⚠ Auto-compact at 85%\x1b[0m`);
    }

    // === Sentinel Indicator: 3 states (pending / clean / quiet) ===
    const indicator = sentinel.readIndicator(data.session_id || 'unknown');
    if (indicator.state === 'pending') {
      parts.push(`\x1b[33m⚠ Sentinel pending (${indicator.count} file${indicator.count === 1 ? '' : 's'})\x1b[0m`);
    } else if (indicator.state === 'clean') {
      parts.push(`\x1b[32m✅ Sentinel clean\x1b[0m`);
    }

    process.stdout.write(parts.join(' │ '));

  } catch (e) {
    // Fallback if JSON parse fails
    process.stdout.write('🐲 Hydra');
  }
});
