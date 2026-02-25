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
echo "No config file found (using defaults)"
```

## Display Format

Present results as a clean status card:

```
🐉 Hydra Framework Status
──────────────────────────────
Version:     1.0.0 (latest: 1.0.0 ✅)  OR  (update available: 1.1.0 ⚡)
Install:     Global (~/.claude/)
Agents (7):
  🟢 hydra-scout    (Haiku 4.5)   ✅
  🟢 hydra-runner   (Haiku 4.5)   ✅
  🟢 hydra-scribe   (Haiku 4.5)   ✅
  🟢 hydra-guard    (Haiku 4.5)   ✅
  🟢 hydra-git      (Haiku 4.5)   ✅
  🔵 hydra-coder    (Sonnet 4.6)  ✅
  🔵 hydra-analyst  (Sonnet 4.6)  ✅
Commands (7): update, status, help, config, guard, quiet, verbose
Hooks (3):    check-update ✅, statusline ✅, auto-guard ✅
Config:       balanced mode, dispatch log on, auto-guard on
──────────────────────────────
```

If an update is available, add:
```
⚡ Update available! Run /hydra:update to get the latest version.
```
