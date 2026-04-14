# Hail Hydra — Claude Code Plugin

Multi-agent orchestration framework for Claude Code.

## Install

```bash
npx hail-hydra-cc@latest
```

## What it does

Routes your coding tasks to 10 specialized subagents (Haiku 4.5 and Sonnet 4.6)
while Opus acts as the orchestrator — inspired by speculative decoding at the task level.

- ~50% reduction in API costs
- 2-3× faster task completion
- 10 specialized heads: scout, coder, runner, scribe, guard, git, analyst,
  sentinel, sentinel-scan, preflight
- Environment preflight validation (`/hydra:preflight`)
- Automatic security scanning after code changes

## Source

https://github.com/AR6420/Hail_Hydra
