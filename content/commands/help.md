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
  /hydra:guard     Run security scan on files (usage: /hydra:guard src/auth.py)
  /hydra:quiet     Suppress dispatch logs for this session
  /hydra:map       View, rebuild, or query the codebase map
  /hydra:report    Report a bug, request a feature, or share feedback
  /hydra:preflight Two-phase environment & compatibility check before new projects
  /hydra:stats     Show real token usage and estimated savings (no AI estimation)
  /hydra:stfu      Silence intermediate prose from every dispatched subagent

AGENTS
  🟢 hydra-scout         (cheap tier) — Explore codebase, find files, map structure
  🟢 hydra-runner        (cheap tier) — Run tests, linters, build commands
  🟢 hydra-scribe        (cheap tier) — Write docs, comments, READMEs
  🟢 hydra-guard         (cheap tier) — Security scan, quality gate
  🟢 hydra-git           (cheap tier) — Git operations, commits, branches
  🟢 hydra-preflight     (cheap tier) — Environment detection, version probing, dep inventory
  🟢 hydra-sentinel-scan (cheap tier) — Fast integration sweep after code changes
  🔵 hydra-coder         (mid tier)   — Write and edit code
  🔵 hydra-analyst       (mid tier)   — Debug, diagnose, review
  🔵 hydra-sentinel      (mid tier)   — Deep integration analysis (when scan flags issues)

  The concrete model behind each tier depends on the host CLI you installed on.

HOW IT WORKS
  The orchestrator automatically delegates tasks to cheaper, faster
  agents in the cheap and mid tiers — saving ~50% on API costs while
  the orchestrator verifies quality.

  You don't need to do anything. Just work normally.
  Hydra operates invisibly unless you check the dispatch log.

LINKS
  GitHub:  https://github.com/AR6420/Hail_Hydra
  npm:     https://www.npmjs.com/package/hail-hydra-cc
```
