---
description: Report a bug, request a feature, or share feedback about Hydra
allowed-tools: Bash
---

# Hydra Report

Walk the user through submitting a bug report, feature request, or general feedback for the Hydra framework. Follow these steps interactively:

## Step 1 — Ask report type

Ask the user:

```
🐉 What would you like to report?

  1. 🐛 Bug Report — something is broken or not working as expected
  2. ✨ Feature Request — an idea for a new feature or improvement
  3. 💬 General Feedback — anything else you'd like to share

Enter 1, 2, or 3:
```

Wait for their response. Map:
- 1 → label: `bug`, template: Bug Report
- 2 → label: `enhancement`, template: Feature Request
- 3 → label: `feedback`, template: General Feedback

## Step 2 — Collect description

Ask the user to describe the issue or idea:

```
Describe the [bug/feature/feedback] in a few sentences:
```

For bugs, also ask:
```
Steps to reproduce (if applicable):
```

## Step 3 — Collect system info (optional)

Ask: "Include system info in the report? (recommended for bugs) [Y/n]"

If yes, gather:
```bash
# Hydra version
cat ~/.claude/skills/hydra/VERSION 2>/dev/null || echo "not found"
```
```bash
# OS info
node -e "console.log(process.platform + ' ' + process.arch + ' ' + require('os').release())"
```
```bash
# Agent count
ls ~/.claude/agents/hydra-*.md 2>/dev/null | wc -l
```

Format as a "System Info" section in the report.

## Step 4 — Submit via GitHub CLI or fallback

Check if `gh` CLI is available:
```bash
gh --version 2>/dev/null
```

### If `gh` is installed, check auth:
```bash
gh auth status 2>/dev/null
```

### If authenticated → create issue directly:
```bash
gh issue create \
  --repo AR6420/Hail_Hydra \
  --title "<concise title based on description>" \
  --label "<bug|enhancement|feedback>" \
  --body "<formatted report body>"
```

Show the resulting issue URL to the user.

### If `gh` is installed but NOT authenticated:

Tell the user:
```
GitHub CLI is installed but not authenticated.
Run this in your terminal to authenticate:

  gh auth login

Then try /hydra:report again.
```

### If `gh` is NOT installed → browser fallback:

Construct a pre-filled GitHub issue URL and show it to the user:

```
GitHub CLI not found. You can submit your report via browser:

  https://github.com/AR6420/Hail_Hydra/issues/new?template=<template>&title=<encoded-title>&labels=<label>&body=<encoded-body>

Or install GitHub CLI: https://cli.github.com
```

Map template filenames:
- bug → `bug_report.md`
- enhancement → `feature_request.md`
- feedback → `feedback.md`
