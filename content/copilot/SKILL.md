---
name: hail-hydra
description: "Use only for an explicit /hail-hydra request. Never select for ordinary tasks. Efficient parallelism with focused context."
argument-hint: "[--mode turbo|balanced|economy] [--help] <task>"
disable-model-invocation: false
user-invocable: true
---

# Hail Hydra for GitHub Copilot CLI

## Activation boundary

Loading this file or calling a skill tool is not activation. Require an explicit `/hail-hydra` request in the current user input, not prior history.
Without it, do not load roles, run helpers or delegate under Hydra — these are instruction gates, not a host lock.
On each subsequent user message, check again: without an explicit `/hail-hydra` invocation, use the normal agent.
With no task, show a short usage example without starting agents.

Stay in this session, directory, authentication and permissions. Use native subagents only.
Never launch another AI CLI (`copilot`, `agency`, `claude`, `gemini`, `codex`), API client or orchestration provider for the task.
Do not bypass permissions, send code to another provider, install hooks or global instructions, pin a persistent agent/model, or enable autopilot.

## Explicit utilities

For leading flags, read [the command guide](references/hydra-commands.md); unknown flags get usage, not execution.

## Cost, speed and context first

Preserve correctness while balancing mode priorities: cost, elapsed time and context.
Every dispatch must plausibly repay overhead through parallel progress, a cheaper capable model or context isolation; otherwise work directly.
Group tiny related steps; avoid per-edit dispatch.

Reuse verified findings and decisions; give each worker only its relevant
context slice, not the full conversation.

## Plan from the goal

Derive acceptance criteria and select specialists from the goal and project; do not require agent names, a swarm flag or repeated "continue" prompts.
Keep a compact task ledger with dependencies, file ownership, decisions and evidence in the conversation/task tracker, not new repository planning files.
For substantial work, follow [context continuity](references/hydra-continuity.md): save session-local checkpoints and restore verified decisions after compaction.
Subagents have separate contexts; pass relevant main-conversation facts.

Architecture and research are optional, not mandatory stages.
For a backend decision that could avoid substantial rework, use `hydra-architect` even without an explicit performance request.
Use `hydra-researcher` when public evidence could materially change a choice.
Reuse settled decisions; do not launch both advisors for every feature.
For new code, assess proposed flows and label assumptions. Run architecture
assessment and relevant UI research in parallel when independent and useful.

Before dependent implementation, record choices, contracts and measurements.
Send it to every affected writer before dependent edits. When evidence changes direction, pause affected writers, update the brief and dependencies, then redirect and recheck affected work; unaffected work can continue.
Confirm affected writers have stopped or finished before reassigning files.
Do not integrate stale-direction results or discard user changes. Such changes consume the same dispatch and improvement budgets; they do not reset them.

## Plan and budget

Use [task-local modes](references/hydra-modes.md); default `balanced`.
Resolve mode and explicit limits with `hydra-control.js mode` before dispatch.
Modes are ceilings, not targets; every dispatch counts and quality gates remain.
Respect smaller host/user limits; exceeding the ceiling needs approval.
At the limit, work directly or report a blocker.
The selected main model owns reasoning, design, complex debugging and final acceptance; never reduce it to a dispatcher or rubber-stamp worker reports.

## Dispatch

Roles are private prompts, not registered agents; pass task, paths, criteria, write scope, context, output contract, budget and permissions.

Dispatch each role with its `models` list, in order. If policy-disabled or rejected, try the next entry, then the cheapest suitable host model, and report the substitution; an explicit user model choice overrides the list.
Role tiers are hints, not capability caps.
Keep unresolved high-risk logic in the main agent, and delegate hard units only to an explicitly chosen capable model, not a cheap default.
Never change `/model` or session settings. If model selection is unavailable, say so and work directly.

Re-review affected changes after later edits; a moving worktree is not final evidence.

Use native web tools through the main agent if a worker lacks them, otherwise disclose the gap.
Never send secrets, private code or confidential requirements to public searches.

## Integration and verification

For coding tasks, automatically apply [the quality policy](references/hydra-quality.md). Do not wait for a review request.
Required failures, unverified behavior and serious findings block completion and deployment.

Allow at most **2 improvement rounds** for concrete findings within mode limits.
Stop when criteria are met or progress stalls; at budget exhaustion, an unresolved required outcome is a blocker.

For an explicit build/deploy goal, read the command guide's deployment section.
Preserve user changes; never commit, push, publish, delete data or operate on live services without task authorization. Never expose secrets.

## Finish

Report outcome, checks, blockers and any deployment result concisely.
Identify the main model and actual worker models separately when exposed; otherwise mark unknown.
Include the quality outcome and evidence automatically, even with quiet output.
