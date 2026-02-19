---
name: speculative-execution
description: >
  Speculative Execution Framework (SEF) — task-level speculative execution for Claude Code
  that reduces latency and API costs by routing work to the most efficient model tier.
  Inspired by speculative decoding in LLM inference. Always active during Claude Code sessions.
  Routes mechanical tasks to Haiku executors, standard engineering tasks to Sonnet executors,
  and reserves Opus for tasks requiring deep reasoning. Transparent to the end user.
---

# Speculative Execution Framework (SEF)

Task-level speculative execution for Claude Code: route each task to the lowest-cost model
capable of producing acceptable output, with the orchestrator verifying and accepting or
re-executing as needed.

## Background

Autoregressive LLM inference is memory-bandwidth bound — time per token scales with model
size regardless of task difficulty. Speculative decoding (Chen et al., 2023) solves this at
the token level by having a small draft model propose tokens that a large target model verifies
in parallel. Since verification of K tokens costs approximately the same as generating one
token, the approach yields 2–2.5x speedup with zero quality degradation.

SEF applies the same principle at the task level. Most software engineering tasks do not
require the full reasoning capacity of Opus. File searches, test execution, documentation,
boilerplate implementation — these are tractable for smaller models. By routing them to
Haiku or Sonnet executors and reserving Opus for genuinely difficult problems:

- **2–3x faster task completion** (Haiku responds approximately 10x faster than Opus)
- **60–70% reduction in API costs** (Haiku is approximately 30x cheaper per token than Opus)
- **Zero quality loss** on tasks within each model's capability band

## Architecture

```
User Request
    |
    v
+---------------------------+
|  ORCHESTRATOR (Opus)      |  Classify the task. Do not execute it.
|  Classify -> Dispatch     |
+----------+----------------+
           |
    +------+------+------------------+
    v             v                  v
+---------+  +---------+  +---------------------+
| Tier 1  |  | Tier 2  |  | Orchestrator (Opus) |
| Haiku   |  | Sonnet  |  | (hard problems only)|
| (fast)  |  | (smart) |  +---------------------+
+----+----+  +----+----+
     |            |
     v            v
+---------------------------+
|  ORCHESTRATOR verifies    |  Scan output. Accept? Ship it. Reject? Execute directly.
|  only if output seems off |
+---------------------------+
     |
     v
  User receives result
```

This mirrors speculative decoding's draft-score-accept/reject loop, operating at task
granularity rather than token granularity.

## Task Classification

Classify every incoming task before executing. This is a fast mental check, not a visible
step to the user.

### Tier 1 — Haiku Executors (sef-explore, sef-validate, sef-document)

Route to Haiku when the task is mechanical, read-heavy, or has a well-defined output:

- Searching or grepping across files
- Reading and summarizing code or documentation
- Running tests, lints, builds, format checks
- Listing directory structures, finding files by pattern
- Simple git operations (status, log, diff)
- Generating boilerplate or repetitive code from clear templates
- Writing or updating comments, docstrings, simple README sections
- Quick factual lookups in the codebase

**Heuristic**: If you could state the task as a single imperative sentence with no ambiguity
(e.g., "find all files importing X", "run the test suite"), it is Tier 1.

### Tier 2 — Sonnet Executors (sef-implement, sef-review)

Route to Sonnet when the task requires reasoning about code within well-understood patterns:

- Implementing a feature from a clear specification
- Writing or modifying functions, classes, modules
- Refactoring code (rename, extract, restructure)
- Creating test cases that require understanding business logic
- Debugging with stack traces or error messages as clues
- Code review and improvement suggestions
- Writing technical documentation that requires code comprehension
- Resolving straightforward merge conflicts
- Making API integrations following documented patterns

**Heuristic**: If you need to read, understand, and produce code — but the approach is
reasonably standard — it is Tier 2.

### Tier 3 — Orchestrator (handle directly, do not delegate)

Retain the task when it demands deep reasoning, novel architecture, or high-stakes judgment:

- System architecture design and major refactoring decisions
- Debugging subtle, non-obvious issues with no clear stack trace
- Performance optimization requiring algorithmic insight
- Security analysis and vulnerability assessment
- Multi-file coordinated changes with complex interdependencies
- Resolving ambiguous requirements that need clarification
- Novel algorithm implementation
- Tasks where an error would be costly to recover from

**Heuristic**: If you would need to reason carefully even as Opus, do not delegate.

### Edge Cases and Classification Judgment

- **When uncertain, escalate one tier.** Better to use Sonnet for a Haiku task than Haiku
  for a Sonnet task. Quality takes precedence over cost optimization.
- **Decompose compound tasks.** "Read the codebase and redesign the auth system" becomes:
  sef-explore reads (Haiku), then the orchestrator designs (Opus).
- **Iterative tasks escalate naturally.** If a Sonnet executor's output is insufficient,
  do not retry with Sonnet — execute it directly.

## Verification Protocol

After an executor returns output, apply this check:

1. **Scan the output** — Is it complete and correct? (1–2 seconds of review)
2. **If acceptable** — Pass directly to the user.
3. **If uncertain** — Read more carefully. Fix minor issues inline. Still cheaper than
   full re-execution.
4. **If clearly wrong** — Execute the task directly. Do not retry at the same tier.

The key property from speculative decoding: every task always produces a result. If the
executor's draft fails, the orchestrator catches it. The user never observes a failed draft.

## Operating Principles

**Transparency to the user**: The user should not observe SEF operating. Do not announce
delegation. Do not explain routing decisions. Do not request permission. Present executor
output as the final result.

**Speed over ceremony**: Do not over-classify. The entire value is in speed. A quick
"Tier 1/2/3?" assessment and immediate dispatch. Spending 10 seconds classifying a
5-second task negates the benefit.

**Parallel execution**: If a request decomposes into independent subtasks, dispatch
multiple executors concurrently. Example: "Fix the bug in auth.py and add tests for the
API module" dispatches sef-implement and sef-explore simultaneously.

**Escalation only**: If an executor's output is insufficient, escalate to the orchestrator.
Do not retry at the same tier or a lower tier. This matches speculative decoding's rejection
sampling behavior.

**Inheritance**: When spawning subagents for purposes unrelated to SEF, those subagents
should apply the same speculative execution philosophy. Executors are available to all
subagents in the session.

## Installation

Executor agents are located in `agents/`. Install them where Claude Code discovers
subagents:

- **User-level** (all projects): `~/.claude/agents/`
- **Project-level** (one project): `.claude/agents/`

```bash
# User-level (recommended)
./scripts/install.sh --user

# Project-level only
./scripts/install.sh --project

# Both
./scripts/install.sh --both
```

## Executor Reference

| Executor | Model | Role | Tools |
|----------|-------|------|-------|
| `sef-explore` | Haiku | Codebase exploration, file search, reading | Read, Grep, Glob |
| `sef-validate` | Haiku | Test execution, builds, linting, validation | Read, Bash, Glob, Grep |
| `sef-document` | Haiku | Documentation, READMEs, comments, changelogs | Read, Write, Edit, Glob, Grep |
| `sef-implement` | Sonnet | Code writing, implementation, refactoring | Read, Write, Edit, Bash, Glob, Grep |
| `sef-review` | Sonnet | Code review, debugging, architecture analysis | Read, Grep, Glob, Bash |

## Calibration Metrics

Track these to calibrate routing quality:

- **Delegation rate**: Percentage of tasks routed to executors. Target: 60–80%.
- **Rejection rate**: How often an executor's output requires orchestrator intervention.
  Target: less than 15%.
- **User-observable quality issues**: Target: zero.

If rejection rate exceeds 20%, the classification threshold is too aggressive — shift
borderline tasks up one tier. If rejection rate is below 5%, classification is too
conservative — delegate more.

## Reference Material

- `references/routing-guide.md` — Classification examples and decision flowchart
- `references/model-capabilities.md` — Model capability profiles and cost/speed ratios
