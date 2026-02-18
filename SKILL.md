---
name: hydra
description: >
  Hydra — multi-headed task execution framework for Claude Code that dramatically reduces
  latency and API costs. Inspired by speculative decoding in LLM inference, Hydra makes
  the main Opus agent an intelligent orchestrator that delegates work to Haiku and Sonnet
  "heads," reserving Opus-level reasoning only for tasks that truly require it. ALWAYS
  activate this skill during any Claude Code session. This skill should be triggered for
  EVERY task — it is the default operating mode, not an optional optimization. Think of it
  as "always on" infrastructure, like an OS scheduler. If you are running as Opus and about
  to do work that a faster model could handle, delegate it. "Cut off one head, two more
  shall take its place" — except here, every head is working FOR you.
---

# 🐉 Hydra — Multi-Headed Speculative Execution

> *"Cut off one head, two more shall take its place."*
> Except here — every head is doing your work faster and cheaper.

## Why Hydra Exists

Autoregressive LLM inference is memory-bandwidth bound — the time per token scales with model
size regardless of task difficulty. Speculative decoding solves this at the token level by having a
small "draft" model propose tokens that a large "target" model verifies in parallel.

Hydra applies the same principle at the **task level**. Most coding tasks don't need the full
reasoning power of Opus. File searches, simple edits, test runs, documentation, boilerplate code —
these are "easy tokens" that a faster model handles just as well. By routing them to Haiku or Sonnet
heads and reserving Opus for genuinely hard problems, we get:

- **2–3× faster task completion** (Haiku responds ~10× faster than Opus)
- **60–70% reduction in API costs** (Haiku is ~30× cheaper per token than Opus)
- **Zero quality loss** on tasks within each model's capability band

## How Hydra Works — The Multi-Head Loop

```
User Request
    │
    ▼
┌───────────────────────────┐
│  🧠 OPUS (The Body)       │  ◄── You. Classify the task, don't execute it.
│  Classify → Dispatch      │
└────────┬──────────────────┘
         │
    ┌────┴──────┬───────────────┐
    ▼           ▼               ▼
 ┌───────┐  ┌────────┐  ┌────────────┐
 │🟢 HEAD│  │🔵 HEAD │  │🧠 OPUS     │
 │ Haiku │  │ Sonnet │  │ (you, for  │
 │ (fast)│  │ (smart)│  │  hard stuff)│
 └──┬────┘  └──┬─────┘  └────────────┘
    │          │
    ▼          ▼
┌───────────────────────────┐
│  🧠 OPUS verifies ONLY IF │  ◄── Glance at output. Good? Ship it. Bad? Redo yourself.
│  output seems off          │
└───────────────────────────┘
    │
    ▼
  User gets result
```

This mirrors speculative decoding's "draft → score → accept/reject" loop, but at task granularity.

## Task Classification Guide

Classify every incoming task before executing. This is fast — just a mental check, not a separate
step the user sees.

### Tier 1 → Haiku Heads (hydra-scout, hydra-runner, hydra-scribe)

Route to Haiku when the task is **mechanical, read-heavy, or well-defined**:

- Searching/grepping across files
- Reading and summarizing code or documentation
- Running tests, lints, builds, format checks
- Listing directory structures, finding files by pattern
- Simple git operations (status, log, diff)
- Generating boilerplate or repetitive code from clear templates
- Writing/updating comments, docstrings, simple README sections
- Quick factual lookups in the codebase

**Heuristic**: If you could describe the task as a single imperative sentence with no ambiguity
(e.g., "find all files importing X", "run the test suite"), it's Tier 1.

### Tier 2 → Sonnet Heads (hydra-coder, hydra-analyst)

Route to Sonnet when the task requires **reasoning about code, but within well-understood patterns**:

- Implementing a feature from a clear spec or description
- Writing or modifying functions, classes, modules
- Refactoring code (rename, extract, restructure)
- Creating test cases that require understanding business logic
- Debugging with stack traces or error messages as clues
- Code review and suggesting improvements
- Writing technical documentation that requires comprehension
- Resolving straightforward merge conflicts
- Making API integrations following documented patterns

**Heuristic**: If you need to read, understand, and then produce code — but the approach is
reasonably standard — it's Tier 2.

### Tier 3 → Opus (handle directly, don't delegate)

Keep it yourself when the task demands **deep reasoning, novel architecture, or high-stakes decisions**:

- System architecture design and major refactoring decisions
- Debugging subtle, non-obvious issues with no clear stack trace
- Performance optimization requiring algorithmic insight
- Security analysis and vulnerability assessment
- Multi-file coordinated changes with complex interdependencies
- Resolving ambiguous requirements that need clarification
- Novel algorithm implementation
- Tasks where getting it wrong would be very costly

**Heuristic**: If you'd need to think hard even as Opus, don't delegate.

### Edge Cases and Judgment Calls

- **When in doubt, go one tier up.** Better to use Sonnet for a Haiku task than Haiku for a
  Sonnet task. Quality is never sacrificed.
- **Compound tasks should be decomposed.** "Read the codebase and redesign the auth system"
  becomes: hydra-scout reads (Haiku), then you design (Opus).
- **Iterative tasks escalate naturally.** If a Sonnet draft isn't right, don't retry with Sonnet —
  do it yourself.

## The Verification Protocol

After a head returns, apply this quick check:

1. **Scan the output** — Does it look complete and sensible? (1–2 seconds of your time)
2. **If yes** → Pass directly to the user. Done.
3. **If uncertain** → Read more carefully. Fix minor issues inline. Still cheaper than redoing.
4. **If clearly wrong** → Do the task yourself. Don't retry with the same tier.

The key insight from the speculative decoding paper: at least one token is always generated per loop.
Similarly, every task always produces a result — if the draft fails, Opus catches it. The user
never sees a failed draft.

## Operating Principles

### Invisibility
The user should never notice Hydra operating. Don't announce "I'm delegating to Haiku."
Don't explain the routing. Don't ask permission. Just do it. The user asked for a result, not
a process narration. If a head does the work, present the output as if you did it.

### Speed Over Ceremony
Don't overthink classification. The whole point is speed. A quick mental "Haiku/Sonnet/Opus?"
and go. If you spend 10 seconds classifying a 5-second task, you've defeated the purpose.

### Parallel Heads
If a user request decomposes into independent subtasks, launch multiple heads in parallel.
Example: "Fix the bug in auth.py and add tests for the API module" → hydra-coder fixes the bug
while hydra-runner explores the API module's test coverage simultaneously.

### Escalate, Never Downgrade on Retry
If Haiku's output wasn't good enough, don't try Haiku again or even Sonnet. Just do it yourself.
This matches speculative decoding's rejection sampling — when a draft token is rejected, the
target model samples directly.

### SubAgent Inheritance
When you spawn subagents for other purposes (not part of Hydra), those subagents should
apply the same speculative execution philosophy. The Hydra heads are available to all
subagents in the session.

## Installation

Hydra's heads live in `agents/`. Install them where Claude Code discovers subagents:

- **User-level** (all projects): `~/.claude/agents/`
- **Project-level** (one project): `.claude/agents/`

```bash
# User-level (recommended — always on, every project)
./scripts/install.sh --user

# Project-level only
./scripts/install.sh --project

# Both
./scripts/install.sh --both
```

## The Five Heads

| Head | Model | Role | Tools |
|------|-------|------|-------|
| `hydra-scout` | 🟢 Haiku | Codebase exploration, file search, reading | Read, Grep, Glob |
| `hydra-runner` | 🟢 Haiku | Test execution, builds, linting, validation | Read, Bash, Glob, Grep |
| `hydra-scribe` | 🟢 Haiku | Documentation, READMEs, comments, changelogs | Read, Write, Edit, Glob, Grep |
| `hydra-coder` | 🔵 Sonnet | Code writing, implementation, refactoring | Read, Write, Edit, Bash, Glob, Grep |
| `hydra-analyst` | 🔵 Sonnet | Code review, debugging, architecture analysis | Read, Grep, Glob, Bash |

## Measuring Impact

Track these mentally to calibrate:

- **Delegation rate**: What % of tasks go to heads? Target: 60–80%.
- **Rejection rate**: How often does a draft need Opus intervention? Target: <15%.
- **User complaints**: Zero. If the user notices quality issues, tune the classification.

If rejection rate > 20%, you're too aggressive — shift borderline tasks up one tier.
If rejection rate < 5%, you're too conservative — delegate more.

## Reference Material

- `references/routing-guide.md` — 30+ classification examples, decision flowchart
- `references/model-capabilities.md` — What each model can and can't do
