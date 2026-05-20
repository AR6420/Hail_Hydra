# hail-hydra-cc

> Multi-headed speculative execution framework for Claude Code.
> Inspired by speculative decoding — same quality, 3x faster, ~50% cheaper.

## Quick Install

```bash
npx hail-hydra-cc
```

Runs an interactive installer that deploys 10 Hydra agents into your Claude Code setup.

## What is Hydra?

Hydra makes Claude Code's Opus model an intelligent **orchestrator** instead of doing everything itself. It dispatches fast, cheap Haiku and Sonnet "heads" for routine tasks, reserving Opus-level reasoning only for genuinely hard problems.

| Head | Model | Role |
|------|-------|------|
| `hydra-scout` | 🟢 Haiku | Codebase exploration, file search |
| `hydra-runner` | 🟢 Haiku | Test execution, builds, linting |
| `hydra-scribe` | 🟢 Haiku | Documentation, READMEs, comments |
| `hydra-guard` | 🟢 Haiku | Security/quality gate after code changes |
| `hydra-git` | 🟢 Haiku | Git operations: commit, branch, diff |
| `hydra-coder` | 🔵 Sonnet | Code implementation, refactoring |
| `hydra-analyst` | 🔵 Sonnet | Code review, debugging, analysis |
| `hydra-sentinel-scan` | 🟢 Haiku | Fast integration sweep |
| `hydra-sentinel` | 🔵 Sonnet | Deep integration analysis |
| `hydra-preflight` | 🟢 Haiku | Environment detection, version probing, dep inventory |

**Expected gains:** 2–3× faster tasks, ~50% lower API costs, zero quality loss.
(Savings calculated against Opus at $5/$25 per MTok — February 2026 pricing)

## Usage

```bash
npx hail-hydra-cc                # Interactive install (recommended)
npx hail-hydra-cc --global       # Install to ~/.claude/ — all projects
npx hail-hydra-cc --local        # Install to ./.claude/ — this project
npx hail-hydra-cc --both         # Install both locations
npx hail-hydra-cc --status       # Show what's installed
npx hail-hydra-cc --uninstall    # Remove all Hydra files
npx hail-hydra-cc --help         # Show help
```

## What Gets Installed

```
~/.claude/                       (or ./.claude/ for local)
├── agents/                      # 10 agent definitions
│   ├── hydra-scout.md
│   ├── hydra-runner.md
│   ├── hydra-scribe.md
│   ├── hydra-guard.md
│   ├── hydra-git.md
│   ├── hydra-sentinel-scan.md
│   ├── hydra-preflight.md
│   ├── hydra-coder.md
│   ├── hydra-analyst.md
│   └── hydra-sentinel.md
├── commands/hydra/              # 10 slash commands
│   ├── help.md                  # /hydra:help
│   ├── status.md                # /hydra:status
│   ├── update.md                # /hydra:update
│   ├── config.md                # /hydra:config
│   ├── guard.md                 # /hydra:guard
│   ├── quiet.md                 # /hydra:quiet
│   ├── verbose.md               # /hydra:verbose
│   ├── report.md                # /hydra:report
│   ├── map.md                   # /hydra:map
│   └── preflight.md             # /hydra:preflight
├── hooks/                       # 4 lifecycle hooks
│   ├── hydra-check-update.js    # SessionStart — version check
│   ├── hydra-statusline.js      # StatusLine — status bar
│   ├── hydra-auto-guard.js      # PostToolUse — file tracker
│   ├── hydra-notify.js          # Notification — task completion sound
│   └── hydra-task-complete.wav  # Notification sound file
└── skills/hydra/                # Skill (Claude Code discoverable via /skills)
    ├── SKILL.md                 # Orchestrator instructions
    ├── VERSION                  # Installed version
    └── references/
        ├── routing-guide.md
        └── model-capabilities.md
```

All files are **bundled inside this package** — no network requests during installation.

## Requirements

- Node.js 16+
- Claude Code

## Full Documentation

[github.com/AR6420/Hail_Hydra](https://github.com/AR6420/Hail_Hydra)

## License

MIT
