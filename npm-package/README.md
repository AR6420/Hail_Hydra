# hail-hydra-cc

> Multi-headed speculative execution framework for Claude Code.
> Inspired by speculative decoding — same quality, 3x faster, 70% cheaper.

## Quick Install

```bash
npx hail-hydra-cc
```

Runs an interactive installer that deploys 5 Hydra agents into your Claude Code setup.

## What is Hydra?

Hydra makes Claude Code's Opus model an intelligent **orchestrator** instead of doing everything itself. It dispatches fast, cheap Haiku and Sonnet "heads" for routine tasks, reserving Opus-level reasoning only for genuinely hard problems.

| Head | Model | Role |
|------|-------|------|
| `hydra-scout` | 🟢 Haiku | Codebase exploration, file search |
| `hydra-runner` | 🟢 Haiku | Test execution, builds, linting |
| `hydra-scribe` | 🟢 Haiku | Documentation, READMEs, comments |
| `hydra-coder` | 🔵 Sonnet | Code implementation, refactoring |
| `hydra-analyst` | 🔵 Sonnet | Code review, debugging, analysis |

**Expected gains:** 2–3× faster tasks, 60–70% lower API costs, zero quality loss.

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
├── agents/
│   ├── hydra-scout.md
│   ├── hydra-runner.md
│   ├── hydra-scribe.md
│   ├── hydra-coder.md
│   └── hydra-analyst.md
└── hydra/
    ├── SKILL.md
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
