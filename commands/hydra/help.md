---
description: Show all available Hydra commands, agents, and a quick reference guide
---

# Hydra Help

Display the following help reference directly — do NOT search files or run commands:

```
🐉 Hydra Framework — Quick Reference
═══════════════════════════════════════
COMMANDS
  /hydra:help      Show this help screen
  /hydra:status    Show installed agents, version, config
  /hydra:update    Update Hydra to the latest version
  /hydra:config    Show current configuration
  /hydra:guard     Run security scan on files (usage: /hydra:guard src/auth.py)
  /hydra:quiet     Suppress dispatch logs for this session
  /hydra:map       View, rebuild, or query the codebase map
  /hydra:verbose   Enable verbose dispatch logs with timing
  /hydra:report    Report a bug, request a feature, or share feedback
  /hydra:preflight Two-phase environment & compatibility check before new projects

AGENTS
  🟢 hydra-scout    (Haiku 4.5)   — Explore codebase, find files, map structure
  🟢 hydra-runner   (Haiku 4.5)   — Run tests, linters, build commands
  🟢 hydra-scribe   (Haiku 4.5)   — Write docs, comments, READMEs
  🟢 hydra-guard    (Haiku 4.5)   — Security scan, quality gate
  🟢 hydra-git      (Haiku 4.5)   — Git operations, commits, branches
  🟢 hydra-preflight (Haiku 4.5)  — Environment detection, version probing, dep inventory
  🔵 hydra-coder    (Sonnet 4.6)  — Write and edit code
  🔵 hydra-analyst  (Sonnet 4.6)  — Debug, diagnose, review

HOW IT WORKS
  The Opus 4.6 orchestrator automatically delegates tasks to cheaper,
  faster agents (Haiku 4.5 and Sonnet 4.6) — saving ~50% on API costs
  while maintaining Opus-level quality through verification.

  You don't need to do anything. Just work normally.
  Hydra operates invisibly unless you check the dispatch log.

LINKS
  GitHub:  https://github.com/AR6420/Hail_Hydra
  npm:     https://www.npmjs.com/package/hail-hydra-cc
```
