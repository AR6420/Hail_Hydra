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
┌─────────────────────────────┐
│  🧠 ORCHESTRATOR (Opus)     │  ◄── You. Decompose → Map dependencies
│  Decompose → Map Deps       │       → Group into waves → Dispatch waves.
│  → Group into Waves         │
└────────┬────────────────────┘
         │
    ═══════════════════════════
    Wave 1  (parallel dispatch)
    ┌────┴────┬──────────┐
    ▼         ▼          ▼
 [scout]  [runner]   [scribe]
    │         │          │
    └────┬────┘          │
         │               │
    ═══════════════════════════
    Wave 2  (parallel dispatch)
    ┌────┴────┐           │
    ▼         ▼           │
 [coder]  [analyst]       │
    │         │           │
    └────┬────┘───────────┘
         │
    ═══════════════════════════
    Wave 3  (parallel dispatch)
    ┌────┴────┐
    ▼         ▼
 [runner]  [scribe]
    │         │
    └────┬────┘
         │
         ▼
 Orchestrator verifies & merges
         │
         ▼
   User gets result
```

This mirrors speculative decoding's "draft → score → accept/reject" loop, but at task granularity.

## Decomposition First Protocol

**Before executing ANY user request, decompose it.** This is not optional — it is the
first step of every task. The whole point of Hydra is parallel execution, and you cannot
parallelize what you haven't decomposed.

### Step 1: Break the request into atomic subtasks

An atomic subtask is one that can be fully handled by a single head independently.
"Fix the auth bug" is atomic. "Fix the auth bug and add tests" is two subtasks.

### Step 2: Map dependencies

For each subtask, ask: *does this require the output of another subtask?*

- If NO → it can run in Wave 1
- If it depends on Task A → it runs in the wave after Task A completes

### Step 3: Group into waves

A wave is a set of subtasks with no dependencies between them. All tasks in a wave
launch simultaneously in a single message (multiple Task tool calls).

### Step 4: Dispatch wave by wave

Launch Wave 1 (all independent tasks) simultaneously. When Wave 1 completes, feed
relevant outputs forward and launch Wave 2. Continue until all subtasks are done.

### The Cardinal Rule

> **NEVER dispatch sequentially when parallel is possible.**
> Launching 3 Haiku agents simultaneously is always faster than launching them one at a time,
> even if you have to wait for all three before continuing. A wave of 3 Haiku agents completes
> in the time it takes 1 Haiku agent to finish, not 3× longer.

### Quick Decomposition Example

```
User: "Fix the auth bug, add tests, and update the docs"

Decomposition:
  Task A: Explore auth module → hydra-scout   [no deps]
  Task B: Run existing tests  → hydra-runner  [no deps]
  Task C: Fix the bug         → hydra-coder   [depends on A]
  Task D: Write new tests     → hydra-coder   [depends on C]
  Task E: Run all tests       → hydra-runner  [depends on C, D]
  Task F: Update docs         → hydra-scribe  [depends on C]

Wave 1 → launch A + B simultaneously
Wave 2 → launch C (using A's findings)
Wave 3 → launch D + F simultaneously (both only need C)
Wave 4 → launch E (needs D complete)
```

## Task Classification Guide

Classify every incoming task before executing. This is fast — just a mental check, not a separate
step the user sees.

### Tier 1 → Haiku Heads (hydra-scout (Haiku), hydra-runner (Haiku), hydra-scribe (Haiku))

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

### Tier 2 → Sonnet Heads (hydra-coder (Sonnet), hydra-analyst (Sonnet))

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
  becomes: hydra-scout (Haiku) reads, then you design (Opus).
- **Iterative tasks escalate naturally.** If a Sonnet draft isn't right, don't retry with Sonnet —
  do it yourself.

## Wave Execution Model

Waves are the unit of parallel work in Hydra. Every multi-step task should be mapped
to waves before any agent is dispatched.

### Rules for Wave Construction

1. **All tasks in a wave launch in a single message** — use multiple Task tool calls
   in one response. Never send Wave 2 before Wave 1's results arrive.
2. **Dependencies determine wave membership** — if Task B needs Task A's output, they
   are in different waves. If they're independent, they're in the same wave.
3. **Within a wave, order doesn't matter** — all tasks start simultaneously.
4. **Between waves, results flow forward** — pass relevant context from each wave into
   the prompts of the next wave's agents (see Handoff Protocol).

### Wave Execution Examples

#### Example 1: "Review this PR, fix the issues, and run the tests"

```
Task A: Review PR changes     → hydra-analyst  [no deps]
Task B: Check test coverage   → hydra-runner   [no deps]
Task C: Fix identified issues → hydra-coder    [depends on A]
Task D: Run full test suite   → hydra-runner   [depends on C]

Wave 1 → A + B (parallel)
Wave 2 → C (with A's findings as context)
Wave 3 → D
```

#### Example 2: "Set up a new feature: search endpoint with tests and docs"

```
Task A: Map existing endpoints  → hydra-scout   [no deps]
Task B: Map existing test style → hydra-scout   [no deps]
Task C: Map existing doc style  → hydra-scout   [no deps]
Task D: Implement endpoint      → hydra-coder   [depends on A]
Task E: Write tests             → hydra-coder   [depends on A, B]
Task F: Write API docs          → hydra-scribe  [depends on A, C]
Task G: Run tests               → hydra-runner  [depends on E]

Wave 1 → A + B + C (parallel — all pure exploration)
Wave 2 → D + E + F (parallel — all depend only on Wave 1)
Wave 3 → G
```

#### Example 3: "Debug why the payment service is slow, fix it, and verify"

```
Task A: Profile payment service code  → hydra-analyst  [no deps]
Task B: Check DB query patterns       → hydra-scout    [no deps]
Task C: Run benchmark before fix      → hydra-runner   [no deps]
Task D: Implement fix                 → hydra-coder    [depends on A, B]
Task E: Run benchmark after fix       → hydra-runner   [depends on D]
Task F: Update perf notes in README   → hydra-scribe   [depends on D]

Wave 1 → A + B + C (parallel)
Wave 2 → D (with A and B findings as context)
Wave 3 → E + F (parallel)
```

### Why Waves Beat Sequential Dispatch

- **3 Haiku agents in parallel** finish in ~1× the time of 1 agent
- **3 Haiku agents sequentially** take ~3× the time
- For a 4-wave workflow, parallelism within waves can cut total wall-clock time by 40-60%
- The orchestrator (Opus) is not executing during waves — it's free to think about the
  next wave while heads work

## The Verification Protocol

After a head returns, apply this quick check:

1. **Scan the output** — Does it look complete and sensible? (1–2 seconds of your time)
2. **If yes** → Pass directly to the user. Done.
3. **If uncertain** → Read more carefully. Fix minor issues inline. Still cheaper than redoing.
4. **If clearly wrong** → Do the task yourself. Don't retry with the same tier.

The key insight from the speculative decoding paper: at least one token is always generated per loop.
Similarly, every task always produces a result — if the draft fails, Opus catches it. The user
never sees a failed draft.

## Verification Report

After completing any task that involved two or more agent dispatches, append a brief
verification summary at the end of your response. This is not a separate tool call —
it's a structured footer in plain markdown.

### Format

---
**🐉 Hydra Dispatch Log**
| Wave | Agent | Task | Status |
|------|-------|------|--------|
| 1 | hydra-scout (Haiku) | Explored auth module | ✅ Verified |
| 1 | hydra-runner (Haiku) | Ran existing tests | ✅ Verified |
| 2 | hydra-coder (Sonnet) | Fixed null check bug in auth.py:142 | 🔧 Adjusted |
| 3 | hydra-runner (Haiku) | Ran tests post-fix | ✅ Verified |

> **Format note:** Agent column uses "agent-name (Model)" shorthand matching the existing
> SKILL.md convention — e.g., "hydra-scout (Haiku)", "hydra-coder (Sonnet)", not full model IDs.

**Waves**: 3 | **Agents used**: 4 dispatches | **Rejections**: 0
**Estimated savings**: ~65% cost reduction vs all-Opus execution
---

### Status Key

| Symbol | Meaning |
|--------|---------|
| ✅ Verified | Output accepted as-is |
| 🔧 Adjusted | Minor fix applied inline by Opus before presenting |
| 🔄 Re-executed | Opus redid this task directly (agent output discarded) |
| ❌ Rejected | Output discarded; reason noted in log |

### Rules for the Dispatch Log

- **Always show it** when 2+ agent dispatches occurred in a session
- **Wave column**: Same wave number = ran in parallel
- **Keep it brief** — this is a footer, not a report. No explanations, just the table
- **Inline markers**: If a head's output needed adjustment, say "Adjusting [agent]'s output:
  [what changed]" before presenting the adjusted result. If a head was rejected, say
  "Re-executing [task] directly — [agent]'s output was insufficient because [reason]"
- **If accepted as-is**, no inline comment needed — the dispatch log covers it

### Controlling the Dispatch Log

- **Default**: ON — always shown when 2+ agents were used
- **To suppress**: User says "quiet mode", "no dispatch log", or "stealth mode"
- **To force on**: User says "show dispatch log", "verbose mode", or "audit mode"
- In stealth mode, Hydra operates fully invisibly (original behavior — no footer)

## Handoff Protocol

When dispatching Wave N+1, pass relevant outputs from Wave N into the next agents'
prompts. Agents never talk to each other directly — all information flows through
Opus, which decides what context each agent needs.

### What to Hand Off

- **hydra-scout findings** → file paths, relevant code snippets, architecture observations
  — pass these to any subsequent agent that needs to write or modify code
- **hydra-analyst diagnosis** → root cause, affected code locations, suggested fix direction
  — pass to hydra-coder as the starting point for implementation
- **hydra-coder changes** → list of modified files and what changed — pass to hydra-runner
  (to know what to test) and hydra-scribe (to know what to document)
- **hydra-runner results** → specific test failures with file:line — pass back to hydra-coder
  for targeted fixes

### Context Passing Rules

1. **Pass only what the next agent needs** — not the full output of the previous agent.
   Summarize findings into actionable context before including in the next wave's prompts.

2. **Translate findings into directives**:
   - Instead of: "The analyst found several issues in auth.py including..."
   - Pass: "The bug is in `auth/session.py` line 142 — `user.profile` can be None but
     there's no null check before accessing `.email`. Fix the null check."

3. **Always include file paths** discovered by scout in every subsequent agent's prompt.
   Agents shouldn't re-search for files that scout already found.

4. **Flag contradictions** — if Wave 2 output contradicts Wave 1 output, do not silently
   pick one. Note the contradiction and resolve it before dispatching Wave 3.

5. **Prune aggressively** — if scout returned 20 files but only 3 are relevant to the fix,
   pass only the 3 relevant file paths to the coder. Don't copy-paste entire agent outputs.

## Operating Principles

### Invisibility
The user should never notice Hydra operating. Don't announce "I'm delegating to Haiku."
Don't explain the routing. Don't ask permission. Just do it. The user asked for a result, not
a process narration. If a head does the work, present the output as if you did it.

### Speed Over Ceremony
Don't overthink classification. The whole point is speed. A quick mental "Haiku/Sonnet/Opus?"
and go. If you spend 10 seconds classifying a 5-second task, you've defeated the purpose.

### Parallel Heads
Parallel dispatch is the default, not a bonus feature. Every multi-step request MUST be
decomposed into waves before any agent is dispatched (see Decomposition First Protocol).
Independent subtasks always launch simultaneously in a single message. Never dispatch
sequentially when parallel is possible. The Wave Execution Model section has 3 concrete
examples showing how to do this correctly.

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
| `hydra-scout (Haiku)` | 🟢 Haiku | Codebase exploration, file search, reading | Read, Grep, Glob |
| `hydra-runner (Haiku)` | 🟢 Haiku | Test execution, builds, linting, validation | Read, Bash, Glob, Grep |
| `hydra-scribe (Haiku)` | 🟢 Haiku | Documentation, READMEs, comments, changelogs | Read, Write, Edit, Glob, Grep |
| `hydra-coder (Sonnet)` | 🔵 Sonnet | Code writing, implementation, refactoring | Read, Write, Edit, Bash, Glob, Grep |
| `hydra-analyst (Sonnet)` | 🔵 Sonnet | Code review, debugging, architecture analysis | Read, Grep, Glob, Bash |

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
