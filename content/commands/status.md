---
description: Show Hydra framework status — installed agents, version, config, and update availability
allowed-tools: Bash, Read, Glob
---

# Hydra Status

Show a comprehensive status report for the Hydra framework.

## 1. Version Info
```bash
INSTALLED=$(cat ~/.claude/skills/hydra/VERSION 2>/dev/null || echo "unknown")
echo "Installed: $INSTALLED"
LATEST=$(npm view hail-hydra-cc version 2>/dev/null || echo "unknown")
echo "Latest: $LATEST"
```

## 2. Installed Agents
```bash
echo "=== Global Agents ==="
ls -1 ~/.claude/agents/hydra-*.md 2>/dev/null || echo "None found"
echo "=== Local Agents ==="
ls -1 .claude/agents/hydra-*.md 2>/dev/null || echo "None found"
```

## 3. Installed Commands
```bash
echo "=== Global Commands ==="
ls -1 ~/.claude/commands/hydra/*.md 2>/dev/null || echo "None found"
echo "=== Local Commands ==="
ls -1 .claude/commands/hydra/*.md 2>/dev/null || echo "None found"
```

## 4. Hooks
```bash
ls -1 ~/.claude/hooks/hydra-*.js 2>/dev/null || echo "None found"
```

## 5. Configuration
```bash
cat ~/.claude/skills/hydra/config/hydra.config.md 2>/dev/null || \
cat .claude/skills/hydra/config/hydra.config.md 2>/dev/null || \
echo "No config file found (using defaults: mode balanced, dispatch_log on, auto_guard on).
To customize, create ~/.claude/skills/hydra/config/hydra.config.md (or .claude/... for project-level)."
```

## 6. Codebase Map
```bash
if [ -f ".claude/hydra/codebase-map.json" ]; then
  echo "Map: ✅ Exists"
  node -e "const m=JSON.parse(require('fs').readFileSync('.claude/hydra/codebase-map.json','utf8'));console.log('Files:',m._meta.file_count);console.log('Built:',m._meta.built_at);console.log('Hash:',m._meta.git_hash);"
else
  echo "Map: ❌ Not built yet (run /hydra:map rebuild)"
fi
```

## Display Format

Present results as a clean status card:

```
🐉 Hydra Framework Status
──────────────────────────────
Version:     X.Y.Z (latest: X.Y.Z ✅)  OR  (update available: X.Y.Z ⚡)
Install:     Global (~/.claude/)
Agents (10):
  🟢 hydra-scout         (cheap tier) ✅
  🟢 hydra-runner        (cheap tier) ✅
  🟢 hydra-scribe        (cheap tier) ✅
  🟢 hydra-guard         (cheap tier) ✅
  🟢 hydra-git           (cheap tier) ✅
  🟢 hydra-preflight     (cheap tier) ✅
  🟢 hydra-sentinel-scan (cheap tier) ✅
  🔵 hydra-coder         (mid tier)   ✅
  🔵 hydra-analyst       (mid tier)   ✅
  🔵 hydra-sentinel      (mid tier)   ✅
Commands (10): update, status, help, guard, quiet, report, map, preflight, stats, stfu
Hooks (6):    check-update ✅, statusline ✅, token-math ✅, auto-guard ✅, notify ✅, sentinel-done ✅
Map:          ✅ Current (487 files, built 2026-03-26)
Config:       balanced mode, dispatch log on, auto-guard on
──────────────────────────────
```

If an update is available, add:
```
⚡ Update available! Run /hydra:update to get the latest version.
```

For detailed token usage and savings, run: `/hydra:stats`
