---
description: Update the Hydra framework to the latest version from npm
allowed-tools: Bash
---

# Hydra Update

Run the following steps to update Hydra to the latest version:

1. First, check the current installed version:
```bash
   cat ~/.claude/skills/hydra/VERSION 2>/dev/null || echo "VERSION file not found"
```

2. Check the latest available version on npm:
```bash
   npm view hail-hydra-cc version 2>/dev/null || echo "Package not found on npm"
```

3. If an update is available (versions differ), run the installer:
```bash
   npx hail-hydra-cc@latest --global
```

4. After installation completes, verify the new version:
```bash
   cat ~/.claude/skills/hydra/VERSION
```

5. Report to the user:
   - If updated: "🐉 Hydra updated from [old] → [new]. All heads refreshed."
   - If already current: "🐉 Hydra is already at the latest version ([version])."
   - If error: Show the error and suggest running `npx hail-hydra-cc@latest --global` manually in their terminal.

**Important**: After updating, the user should restart Claude Code to reload the updated agent files, commands, and hooks.
