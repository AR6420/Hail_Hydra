---
description: Update the Hydra framework to the latest version from npm
allowed-tools: Bash, Read
---

# Hydra Update

Run the following steps to update Hydra to the latest version:

## Step 1 — Check versions

```bash
cat ~/.claude/skills/hydra/VERSION 2>/dev/null || echo "VERSION file not found"
```
```bash
npm view hail-hydra-cc version 2>/dev/null || echo "Package not found on npm"
```

If the installed version matches the latest npm version, tell the user:
"🐉 Hydra is already at the latest version ([version])."
and stop here.

## Step 2 — Show changelog preview

Fetch the CHANGELOG from GitHub:
```bash
curl -sL "https://raw.githubusercontent.com/AR6420/Hail_Hydra/main/CHANGELOG.md"
```

Parse the changelog to extract entries between the installed version and the latest version. Display a formatted "What's New" section:

```
🐉 Hydra Update Available: [installed] → [latest]
═══════════════════════════════════════════════════

📋 What's New:
[changelog entries for versions between installed and latest]
```

If the changelog fetch fails, skip the preview and continue with the update.

## Step 3 — Show safety note

Display:
```
⚠️  What gets replaced:
   • Agent definitions (agents/*.md)
   • SKILL.md, references, commands, hooks
   • VERSION file

✅ What's preserved:
   • Your hydra.config.md settings
   • Agent memory directories (memory/)
   • CLAUDE.md orchestrator notes
   • settings.json hook registrations (re-registered automatically)
```

## Step 4 — Ask for confirmation

Ask the user: "Proceed with update? [Y/n]"

If they decline, respond: "🐉 Update cancelled." and stop.

## Step 5 — Run the update

```bash
npx hail-hydra-cc@latest --global
```

## Step 6 — Verify

```bash
cat ~/.claude/skills/hydra/VERSION
```

Report to the user:
- If updated: "🐉 Hydra updated from [old] → [new]. All heads refreshed. Restart Claude Code to load the new files."
- If error: Show the error and suggest running `npx hail-hydra-cc@latest --global` manually in their terminal.
