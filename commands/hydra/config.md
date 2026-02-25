---
description: Show current Hydra configuration and how to customize it
allowed-tools: Read, Bash
---

# Hydra Config

Show the current Hydra configuration:

1. Check for project-level config first:
```bash
   cat .claude/skills/hydra/config/hydra.config.md 2>/dev/null
```

2. If not found, check global config:
```bash
   cat ~/.claude/skills/hydra/config/hydra.config.md 2>/dev/null
```

3. If neither found, show defaults:

```
🐉 Hydra Configuration (defaults — no config file found)
─────────────────────────────
Mode:          balanced
Dispatch Log:  on
Auto-Guard:    on
Model Overrides: none
─────────────────────────────
To customize, create a config file:
  Global:  ~/.claude/skills/hydra/config/hydra.config.md
  Project: .claude/skills/hydra/config/hydra.config.md

Run /hydra:status to see current agent assignments.
```

4. If a config file IS found, display its contents and note where it was loaded from.
