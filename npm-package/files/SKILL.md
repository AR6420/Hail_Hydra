---
name: hydra
description: >
  Multi-agent orchestration framework for Claude Code. Automatically delegates
  tasks to cheaper, faster sub-agents (Haiku 4.5, Sonnet 4.6) while maintaining
  Opus-level quality through verification. Use when working on any coding task —
  Hydra activates automatically to route file exploration, test running,
  documentation, code writing, debugging, security scanning, and git operations
  to the optimal agent. Saves ~50% on API costs.
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
- **~50% reduction in API costs** (Haiku 4.5 is 5× cheaper per token than Opus 4.6)
- **Zero quality loss** on tasks within each model's capability band

## How Hydra Works — The Multi-Head Loop

```
User Request
    │
    ├──────────────────────────────────────────────────────┐
    │                                                      │
    ▼                                                      ▼
┌─────────────────────────────┐            ┌──────────────────────────────┐
│  🧠 ORCHESTRATOR (Opus)     │            │  🟢 hydra-scout                  │
│  Classifies task            │            │  IMMEDIATE pre-dispatch:      │
│  Plans waves                │            │  "Find files relevant to      │
│  Decides blocking / not     │            │   [user's request]"           │
└────────┬────────────────────┘            └──────────────┬───────────────┘
         │         (unless Session Index already covers)  │
         └──────────────────────┬──────────────────────────┘
                                │ (scout + classification both ready)
                      [Session Index updated]
                                │
    ════════════════════════════════════════════════════════
    Wave N  (parallel dispatch, index context injected)
    ┌───────────────────┬──────────────────────────────────┐
    │  BLOCKING         │  NON-BLOCKING (fire & forget)    │
    ▼                   ▼                                  │
 [coder]            [scribe] ──────────────────────────────┘
    │
    ▼
 Results arrive
    │
    ├── Raw data / clean pass? → AUTO-ACCEPT → (updates Session Index if scout)
    └── Code / analysis / user-facing docs? → Orchestrator verifies
         │
         ▼
   User gets result  +  non-blocking outputs appended when ready
```

This mirrors speculative decoding's "draft → score → accept/reject" loop, but at task granularity.

## Speculative Pre-Dispatch

When a user prompt arrives, launch hydra-scout IMMEDIATELY before classifying the task.

### Why
Every task — Tier 1, 2, or 3 — benefits from codebase context. Scout's output is never
wasted. By the time you finish classifying the task and deciding which agents to dispatch,
scout has already returned with relevant file paths, project structure, and code context.

### Protocol
1. User prompt arrives
2. IMMEDIATELY dispatch hydra-scout with: "Find all files and code relevant to: [user's request]"
3. IN PARALLEL, classify the task into Tier 1/2/3 and plan your waves
4. When scout returns + classification is done, dispatch the execution wave with scout's
   context already available
5. If the task turns out to be pure exploration (Tier 1 scout-only), scout's output IS
   the result — zero additional dispatch needed

### Timing Advantage
Without pre-dispatch:  [classify: 2s] → [dispatch scout: 3s] → [dispatch coder: 5s] = 10s
With pre-dispatch:     [classify: 2s ↔ scout: 3s (parallel)] → [dispatch coder: 5s] = 8s
                       Saved: 2-3 seconds per task (20-30% of overhead)

### When NOT to pre-dispatch
- User explicitly says "don't search" or "just do X directly"
- The task is a continuation of the immediately previous turn where context is already loaded
- The prompt is a simple question answerable without codebase context (e.g., "what does REST stand for?")

## Session Index

After the first hydra-scout dispatch in a session, build a persistent mental index of
the project. Update it as new information is discovered. Pass relevant slices of this
index to every agent dispatch so they skip cold-start exploration.

### Index Contents
Maintain these fields mentally throughout the session:

- **Tech Stack**: Language, framework, package manager, key dependencies
- **Project Layout**: Top-level directory structure and what each directory contains
- **Key Files**: Entry points, config files, test setup, CI config, main modules
- **Test Command**: The exact command to run tests (e.g., `pytest`, `npm test`)
- **Build Command**: The exact command to build (e.g., `npm run build`, `cargo build`)
- **Conventions**: Naming patterns, file organization style, import conventions observed

### Usage Rules
1. Build the index after the FIRST scout dispatch in a session
2. On subsequent prompts, check if the index already covers what scout would find
3. If yes — skip scout, inject index context directly into the execution agent's prompt
4. If no (user asks about a NEW area of the codebase) — dispatch scout for that
   specific area only, then update the index
5. Always pass the relevant slice of the index to dispatched agents:
   - hydra-coder gets: tech stack, conventions, relevant file paths
   - hydra-runner gets: test command, build command
   - hydra-scribe gets: project layout, conventions, existing docs
   - hydra-analyst gets: tech stack, key files, project layout

### Speed Impact
- Turn 1: Normal speed (scout runs, index is built)
- Turn 2+: Scout is SKIPPED for known areas → saves 2-4 seconds per turn
- Over a 10-turn session: ~20-40 seconds saved total

### Index Invalidation
The index is stale if:
- The user explicitly changes the project structure
- A major refactoring was just completed
- The user switches to a different project/directory
When stale, rebuild the index on the next scout dispatch.

## Blocking vs Non-Blocking Dispatch

Not all agents need to finish before the next wave starts. Classify each dispatch as
blocking or non-blocking to maximize throughput.

### Blocking Dispatch (wait for result before continuing)
Use when downstream agents DEPEND on this agent's output:
- hydra-scout exploring files that hydra-coder needs to edit
- hydra-analyst diagnosing a bug that hydra-coder needs to fix
- hydra-coder making changes that hydra-runner needs to test

### Non-Blocking Dispatch (fire and forget, merge results later)
Use when the output is a FINAL deliverable with no downstream dependents:
- hydra-scribe writing docs (ALWAYS non-blocking unless user only asked for docs)
- hydra-runner running final validation tests (the fix is already done)
- hydra-scout exploring supplementary context (nice-to-have, not critical-path)

### Execution Flow with Non-Blocking

```
Wave 1 (blocking): scout explores → returns file paths
Wave 2 (blocking): coder implements fix → returns changed files
Wave 3 (mixed):
  runner tests the fix   (BLOCKING — need to confirm it works)
  scribe updates docs    (NON-BLOCKING — fire and forget)

Wave 3 completes when: runner returns (don't wait for scribe)
Present results to user. Scribe's docs are appended when ready.
```

### Rules
1. A wave completes when all BLOCKING agents in it return
2. Non-blocking agents run in background — their output is merged into the final
   response or presented as a follow-up
3. NEVER mark hydra-coder as non-blocking — code changes always need verification
4. NEVER mark hydra-analyst as non-blocking — diagnoses feed into fixes
5. hydra-scribe is non-blocking by DEFAULT unless it's the primary task
6. hydra-runner is non-blocking ONLY when it's the final validation step
7. If in doubt, make it blocking — correctness over speed

## Integrated Execution Model

All four optimizations compose into a unified execution loop. This section shows how
they interact as a single coherent system.

### Full Execution Flow

```
User Prompt arrives
    │
    ├── Session Index covers this area? ─── YES ──► Skip scout; inject index context
    │           │                                    into execution wave directly ──►──┐
    │           NO                                                                     │
    │           ▼                                                                      │
    ├── IMMEDIATELY dispatch hydra-scout             ◄── Opt 1: Speculative Pre-Dispatch
    │   "Find files relevant to: [prompt]"                                             │
    │                                                                                  │
    ├── IN PARALLEL: Classify task, plan waves,                                        │
    │   decide blocking/non-blocking per agent                                         │
    │                                                                                  │
    ▼                                                                                  │
Scout returns                                                                          │
    │                                                                                  │
    ├── AUTO-ACCEPT scout output ─────────────────── ◄── Opt 4: Confidence Auto-Accept │
    │   Update Session Index with new findings ──────◄── Opt 2: Session Index         │
    │                                                                                  │
    └─────────────────────────────────────────────────────────────────────────────►───┘
                                          │
                                          ▼
                              Wave N dispatched
                        (index context injected into each agent prompt)
                                          │
                     ┌────────────────────┴───────────────────────┐
                     │ BLOCKING agents       ◄── Opt 3: Non-Block  │ NON-BLOCKING agents
                     │ (wait for result)                           │ (fire & forget)
                     ▼                                             ▼
              Results arrive                              Background — merge when ready
                     │                                             │
              ┌──────┴──────┐                                      │
              │             │                                      │
              ▼             ▼                                      │
        AUTO-ACCEPT?   MANUAL VERIFY?  ◄── Opt 4: Auto-Accept     │
              │             │                                      │
              ▼             ▼                                      │
        Pass through   Orchestrator                                │
        directly       reviews                                     │
              │             │                                      │
              └──────┬──────┘                                      │
                     │                                             │
                     ▼                                             │
          Was this a CODE CHANGE?                                  │
              │             │                                      │
              YES           NO ── Present result immediately ──►───┘
              │                                                    │
              ▼                                                    │
          Dispatch sentinel-scan + guard  ◄── Sentinel Protocol    │
          IN PARALLEL (both blocking)                              │
              │                                                    │
              ▼                                                    │
          Both return                                              │
              │                                                    │
              ├── All clean → Present result to user               │
              └── Issues found → hydra-sentinel (deep analysis)    │
                    → Wait → Decision tree → Present to user       │
                                                                   │
          Next wave OR present result ◄──────────────────────────►┘
          (non-blocking outputs appended when ready)
```

### Optimization Interaction Rules

#### Rule 1: Session Index OVERRIDES Speculative Pre-Dispatch
When the Session Index already covers the relevant area, skip pre-dispatch entirely.
The index IS the scout output — use it directly and save the full scout dispatch time.

```
New prompt arrives → Check Session Index coverage
    ├── Covered:     Use index → Skip scout → Wave 1 starts immediately
    └── Not covered: Pre-dispatch scout → Update index → Wave 1 starts
```

#### Rule 2: Non-Blocking + Auto-Accept = Zero-Overhead Path
When an agent is both non-blocking AND its output qualifies for auto-accept:
- Dispatch it
- When it returns: auto-accept without orchestrator review
- Append result to response
- **Total orchestrator overhead: 0 seconds**

This is the highest-throughput path. Common cases:
- Non-blocking hydra-runner (final validation) reporting all-pass → zero overhead
- Non-blocking hydra-scribe (internal docstrings) → zero overhead
- Non-blocking hydra-scout (supplementary context) → zero overhead, index updated

#### Rule 3: Auto-Accepted Scout Output ALWAYS Updates Session Index
Every scout output that passes auto-accept is immediately folded into the Session Index.
No separate step. The act of auto-accepting IS the index update.

#### Rule 4: Non-Blocking Does Not Override Verification Requirements
Non-blocking governs TIMING (don't wait), not VERIFICATION (do review).
If scribe writes user-facing docs (README, API docs), verification is still required —
it happens when scribe's output arrives asynchronously, not before the next wave.
The next wave starts without waiting; verification happens as a follow-up step.

### Timing Profile: Optimized vs Baseline

```
BASELINE (4-agent task, no optimizations):
  t=0s   Classify task                                         [1s]
  t=1s   Dispatch scout, wait                                  [3s]
  t=4s   Verify scout (manual)                                 [1s]
  t=5s   Dispatch coder, wait                                  [5s]
  t=10s  Verify coder (manual)                                 [2s]
  t=12s  Dispatch runner + scribe, wait for BOTH               [4s]
  t=16s  Verify scribe output (user-facing docs)               [2s]
  t=18s  Present result
  Total wall-clock: ~18 seconds

OPTIMIZED (all 4 optimizations active):
  t=0s   Pre-dispatch scout + classify (parallel)              [3s max]
  t=3s   Scout auto-accepted, index built                      [0s overhead]
  t=3s   Dispatch coder (index context injected), wait         [5s]
  t=8s   Quick-scan coder (code → verify)                      [1s]
  t=9s   Dispatch runner (blocking) + scribe (non-blocking)    [3s runner]
         Scribe runs in background simultaneously
  t=12s  Runner: all-pass → auto-accept                        [0s overhead]
  t=12s  Present result to user
         Scribe arrives ~t=13s → auto-accept internal docs → appended
  Total wall-clock: ~12 seconds (33% faster, zero quality loss)
```

### Override Cases

Deviate from this model only when:

| Situation | Override |
|-----------|---------|
| User says "don't search" | Skip pre-dispatch; skip session index injection |
| Pure factual question (no codebase) | Skip all scout steps |
| Docs-only task | Make scribe BLOCKING (it's the primary deliverable) |
| Catastrophic test failure | Make final runner BLOCKING (something is fundamentally broken) |
| Stale Session Index detected | Rebuild index; treat as Turn 1 |

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

### Tier 1 → Haiku 4.5 Heads (hydra-scout, hydra-runner, hydra-scribe, hydra-guard, hydra-git)

Route to Haiku when the task is **mechanical, read-heavy, or well-defined**:

- Searching/grepping across files
- Reading and summarizing code or documentation
- Running tests, lints, builds, format checks
- Listing directory structures, finding files by pattern
- Simple git operations (status, log, diff)
- Generating boilerplate or repetitive code from clear templates
- Writing/updating comments, docstrings, simple README sections
- Quick factual lookups in the codebase
- Security/quality gate scans on changed code (hydra-guard)
- Git operations: staging, committing, branching, log inspection (hydra-git)

**Heuristic**: If you could describe the task as a single imperative sentence with no ambiguity
(e.g., "find all files importing X", "run the test suite"), it's Tier 1.

### Tier 2 → Sonnet 4.6 Heads (hydra-coder, hydra-analyst)

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
  becomes: hydra-scout reads, then you design (Opus).
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

## Verification Protocol

After an agent returns, determine whether to auto-accept or manually verify.

### Auto-Accept (skip verification entirely)
These output types require no orchestrator judgment — accept and pass through:

| Agent | Auto-Accept When |
|-------|-----------------|
| hydra-scout | Returns file paths, directory listings, search results, grep output — factual data with no interpretation |
| hydra-runner | Reports all tests passing, clean build, clean lint — unambiguous pass/fail |
| hydra-scribe | Produces docs/comments for NON-CRITICAL content (internal docstrings, changelogs) |
| hydra-sentinel-scan | Returns `"status": "clean"` — no issues found |

### Manual Verify (orchestrator reviews before accepting)
These outputs require judgment — scan before passing to user or downstream agents:

| Agent | Always Verify When |
|-------|-------------------|
| hydra-coder | ALWAYS — code changes are never auto-accepted |
| hydra-analyst | ALWAYS — diagnoses and recommendations need validation |
| hydra-runner | Reports test FAILURES — verify the failures are real and not environment issues |
| hydra-scribe | Writing user-facing docs (README, API docs) — verify accuracy |
| hydra-scout | Returns analysis or interpretation (not raw data) — verify conclusions |
| hydra-sentinel-scan | Returns `"status": "issues_found"` — escalate to hydra-sentinel |
| hydra-sentinel | ALWAYS — integration analysis requires orchestrator judgment |

### Verification Decision Flowchart

```
Agent returns output
│
├── Is it raw factual data? (file paths, test pass, grep results)
│       → AUTO-ACCEPT. Zero overhead.
│
├── Is it code changes?
│       → ALWAYS VERIFY. Scan for correctness, edge cases.
│
├── Is it analysis/diagnosis/recommendation?
│       → ALWAYS VERIFY. Check reasoning, validate conclusions.
│
├── Is it documentation?
│       ├── Internal (docstrings, comments) → AUTO-ACCEPT
│       └── User-facing (README, API docs) → VERIFY for accuracy
│
└── Is it a test failure report?
    → VERIFY. Confirm failures are real, not environment noise.
```

### Verification Depth
When manual verification is required, match depth to risk:

- **Quick scan (2 seconds)**: Code looks complete, handles obvious cases, follows
  project patterns → Accept
- **Careful review (5-10 seconds)**: Edge cases, error handling, security implications
  → Accept with minor adjustments OR reject
- **Full re-execution**: Output is fundamentally wrong → Discard, do it yourself

### Speed Impact
- ~50-60% of agent outputs qualify for auto-accept (most scout and runner outputs)
- Saves 2-3 seconds per auto-accepted output (the time Opus would spend reading/judging)
- Over a typical 4-agent task: saves ~6-8 seconds of verification overhead

## Sentinel Protocol — Integration Integrity

After EVERY code change made by hydra-coder or hydra-analyst (or yourself),
you MUST run the sentinel pipeline BEFORE presenting results to the user.

### CRITICAL: Updated Dispatch Flow for Code Changes

The old flow was:
  hydra-coder finishes → present result to user

The NEW flow is:
  hydra-coder finishes → dispatch sentinel-scan + hydra-guard in parallel
  → wait for both → THEN present to user

You MUST wait for sentinel-scan (and hydra-guard) to complete before showing
the user the code change results. The user should see one cohesive response
that includes: the code change, the security scan result, and the integration
scan result — not three separate messages.

### Step 1: Fast Scan (ALWAYS after code changes)
Dispatch hydra-sentinel-scan (Haiku 4.5) with:
- The list of files modified
- The functions/exports that changed
- The git diff if available

Dispatch hydra-guard (Haiku 4.5) IN PARALLEL — they check different things
and don't depend on each other.

### Step 2: Evaluate Scan Results
- If sentinel-scan returns `"status": "clean"` AND guard is clean:
  → Present the code change to the user. Mention "Sentinel: ✅ clean"
     and "Guard: ✅ clean" briefly in the dispatch log. Done.
- If sentinel-scan returns `"status": "issues_found"`:
  → Proceed to Step 3 BEFORE presenting to the user.

### Step 3: Deep Analysis (conditional)
Dispatch hydra-sentinel (Sonnet 4.6) with:
- The original code diff
- The sentinel-scan report (the JSON with flagged issues)
- Context about what task was being performed

Wait for the deep analysis to complete.

### Step 4: Act on Results — Decision Tree

When sentinel confirms real issues, follow this decision tree:

#### TRIVIAL fixes (auto-fix without asking):
- Import path renames (old name → new name)
- File path updates after a rename/move
- Adding a missing re-export to a barrel file (index.ts)

For these: dispatch hydra-coder to apply the fix immediately. Tell the user:
"Sentinel caught [issue]. Auto-fixed: [what was done]."

#### MEDIUM fixes (present to user, offer to fix):
- API contract mismatches across frontend/backend
- Missing environment variables
- Changed function signatures with multiple callers
- State shape mismatches

For these: present the sentinel report to the user with the specific fix
suggestions. Ask: "Sentinel found [N] integration issues. Want me to fix them?"
If yes → dispatch hydra-coder with the fix suggestions. Then re-run
sentinel-scan to verify the fixes didn't introduce new issues.

#### COMPLEX fixes (report only, user decides):
- Architectural changes needed (e.g., interface redesign)
- Database migration required
- Multiple interconnected fixes across many files
- Changes that require understanding business logic

For these: present the full sentinel report. Do NOT offer to auto-fix.
Say: "Sentinel found [N] issues that may need architectural decisions.
Here's the full analysis:" and show the report.

#### FALSE POSITIVES (sentinel dismisses scan findings):
If sentinel (Sonnet) dismisses all of sentinel-scan's findings as false
positives, present the code change as clean. Mention briefly: "Sentinel
scanned and verified — no integration issues."

### When to SKIP Sentinel
- Documentation-only changes (hydra-scribe output)
- Git operations (hydra-git output)
- Test-only changes
- Comment or whitespace changes
- README/config file edits with no code impact

For these, present results to the user immediately (old flow). No sentinel needed.

### Cost of the Pipeline
- Fast scan (sentinel-scan): ~$0.001 per scan (Haiku 4.5)
- Guard scan: ~$0.001 per scan (Haiku 4.5)
- Deep analysis (sentinel): ~$0.01 per analysis (Sonnet 4.6, only when needed)
- ~80%+ of code changes pass the fast scan clean — total cost: ~$0.002
- Only the ~20% with flagged issues incur the deep analysis cost

Note: Savings calculated against Opus 4.6 pricing ($5/$25 per MTok) as of February 2026.

## Orchestrator Memory — CLAUDE.md Integration

You (Opus) are NOT a subagent — you don't have `memory: project` frontmatter.
Your persistent memory is Claude Code's project memory file: `CLAUDE.md`
(at the project root) or the auto-memory system.

### What to Remember

After significant orchestration events, update CLAUDE.md with notes that will
help you in future sessions. Specifically:

#### After Sentinel finds confirmed issues:
Add a note like:
```
# Hydra Notes

FRAGILE: When auth.ts changes, check middleware.ts and users.ts (sentinel caught breakage 2025-03-11)
FRAGILE: API response shapes in /api/v2/ — frontend components tightly coupled
```

#### After routing decisions that matter:
```
# Hydra Notes

hydra-coder handles database migrations well in this project (Prisma + PostgreSQL)
hydra-analyst found the N+1 query pattern — watch for it in user-related endpoints
```

#### After learning project patterns:
```
# Hydra Notes

This project uses tRPC — API contracts are type-safe, sentinel can focus on other checks
State management: Zustand with slices pattern — watch for slice boundary changes
Test command: npm run test:unit (not npm test which runs e2e too)
```

### Rules for CLAUDE.md Updates
- ONLY add notes under a `# Hydra Notes` section — never modify other content
- Keep notes concise — one line per insight
- Prefix fragile zone notes with "FRAGILE:" for easy scanning
- Include dates so stale notes can be pruned
- Do NOT add notes after routine clean operations — only when something
  notable happened (sentinel caught something, a routing decision was unusual,
  a new pattern was discovered)
- Read the Hydra Notes section at the start of each session to refresh
  your memory of past orchestration insights

### How This Connects to Agent Memory
- Agent memory (per-agent `memory: project`) = detailed, domain-specific knowledge
- Orchestrator memory (CLAUDE.md Hydra Notes) = high-level patterns, fragile
  zones, routing decisions, project architecture notes
- They complement each other: you know WHERE issues tend to happen (your notes),
  agents know the DETAILS of those areas (their memory)

## Dispatch Log

After completing any task that involved two or more agent dispatches, append a brief
verification summary at the end of your response. This is not a separate tool call —
it's a structured footer in plain markdown.

### Format

---
**🐉 Hydra Dispatch Log**
| Step | Agent | Model | Task | Verdict |
|------|-------|-------|------|---------|
| 1 | hydra-scout | Haiku 4.5 | Explored auth module | ✅ Accepted |
| 1 | hydra-runner | Haiku 4.5 | Ran existing tests | ✅ Accepted |
| 2 | hydra-coder | Sonnet 4.6 | Fixed null check bug in auth.py:142 | 🔧 Adjusted |
| 2 | hydra-guard | Haiku 4.5 | Security scan on changes | ✅ Accepted |
| 3 | hydra-runner | Haiku 4.5 | Ran tests post-fix | ✅ Accepted |

> **Format note:** Agent column uses the agent name only; Model column shows the versioned model.
> e.g., "hydra-scout" / "Haiku 4.5", "hydra-coder" / "Sonnet 4.6"

**Waves**: 3 | **Agents used**: 5 dispatches | **Rejections**: 0
**Estimated savings**: ~50% cost reduction vs all-Opus execution

Note: Savings calculated against Opus 4.6 pricing ($5/$25 per MTok) as of February 2026.
---

### Status Key

| Symbol | Meaning |
|--------|---------|
| ✅ Accepted | Output accepted as-is |
| 🔧 Adjusted | Minor fix applied inline by Opus before presenting |
| 🔄 Re-executed | Opus redid this task directly (agent output discarded) |
| ❌ Rejected | Output discarded; reason noted in log |

### Rules for the Dispatch Log

- **Always show it** when 2+ agent dispatches occurred in a session
- **Step column**: Same step number = ran in parallel
- **Keep it brief** — this is a footer, not a report. No explanations, just the table
- **Inline markers**: If a head's output needed adjustment, say "Adjusting [agent]'s output:
  [what changed]" before presenting the adjusted result. If a head was rejected, say
  "Re-executing [task] directly — [agent]'s output was insufficient because [reason]"
- **If accepted as-is**, no inline comment needed — the dispatch log covers it

### Controlling the Dispatch Log

- **Default**: ON — always shown when 2+ agents were used
- **To suppress**: User says "hydra quiet", "quiet mode", "no dispatch log", or "stealth mode"
- **To force on**: User says "hydra verbose", "show dispatch log", "verbose mode", or "audit mode"
- In stealth mode, Hydra operates fully invisibly (original behavior — no footer)

## Slash Commands Available

The user may invoke these Hydra-specific commands. When they do, follow
the command's instructions:

| Command | Action |
|---------|--------|
| `/hydra:help` | Display the help reference |
| `/hydra:status` | Run status checks and display framework health |
| `/hydra:update` | Trigger an update via npx |
| `/hydra:config` | Show current configuration |
| `/hydra:guard [files]` | Manually invoke the security scan on specified files |
| `/hydra:quiet` | Suppress dispatch logs for this session |
| `/hydra:verbose` | Enable detailed dispatch logs with timing |

These slash commands are defined in `~/.claude/commands/hydra/` and are
separate from natural-language quick commands. Typing "hydra status"
(without the slash) also works — handled by the Quick Commands section above.

## Auto-Guard File Tracking

A PostToolUse hook (`hydra-auto-guard.js`) automatically tracks every file
modified during the session. Changed file paths are recorded to:

  /tmp/hydra-guard/{session_id}.txt

When hydra-guard runs (either automatically via the Sentinel Protocol or
manually via `/hydra:guard`), it can reference this file to know exactly
which files need scanning. The tracking hook adds <1ms overhead per edit.

## Update Notifications

A SessionStart hook (`hydra-check-update.js`) runs once per session in the
background. It compares the installed version (`~/.claude/skills/hydra/VERSION`)
against the latest version on npm (`hail-hydra-cc`).

If an update is available, it appears in the statusline:

  🐉 │ Opus │ Ctx: 37% ████░░░░░░ │ $0.42 │ my-project │ ⚡ v1.2.0 available

The user can run `/hydra:update` to update, or update manually:
  npx hail-hydra-cc@latest --global

The check is throttled to once per hour and runs in a detached background
process — it NEVER blocks Claude Code startup.

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
  (to know what to test), hydra-scribe (to know what to document), hydra-sentinel-scan
  (to know what to check for integration breakage), and hydra-guard (to know what to scan
  for security)
- **hydra-sentinel-scan findings** → pass to hydra-sentinel (for deep analysis of flagged issues)
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

## Configuration

At session start, check for a Hydra configuration file at:
1. `.claude/skills/hydra/config/hydra.config.md` (project-level, takes precedence)
2. `~/.claude/skills/hydra/config/hydra.config.md` (user-level, fallback)

If found, apply the settings. If not found, use defaults:
- **mode**: balanced
- **dispatch_log**: on
- **auto_guard**: on

Do NOT announce that you loaded the config. Apply it silently.

See `config/hydra.config.md` in the repository for the full configuration reference
with all available options and explanations.

## Quick Commands

If the user types any of these exact phrases, respond with the corresponding action:

| Command | Action |
|---------|--------|
| `hydra status` | List all 9 heads by name, model, and whether they appear to be installed (check `agents/` dir) |
| `hydra config` | Show current configuration settings (mode, dispatch_log, auto_guard) and their source (default/project/user) |
| `hydra help` | Show available commands and a brief one-line description of each head |
| `hydra quiet` | Suppress dispatch logs for the rest of the session (equivalent to stealth mode) |
| `hydra verbose` | Enable verbose dispatch logs with per-agent detail for the rest of the session |
| `hydra reset` | Clear session index, treat next turn as Turn 1 (rebuild from fresh scout) |

## The Nine Heads

| Head | Model | Role | Tools |
|------|-------|------|-------|
| `hydra-scout` | 🟢 Haiku 4.5 | Codebase exploration, file search, reading | Read, Grep, Glob |
| `hydra-runner` | 🟢 Haiku 4.5 | Test execution, builds, linting, validation | Read, Bash, Glob, Grep |
| `hydra-scribe` | 🟢 Haiku 4.5 | Documentation, READMEs, comments, changelogs | Read, Write, Edit, Glob, Grep |
| `hydra-guard` | 🟢 Haiku 4.5 | Security/quality gate after code changes | Read, Grep, Glob, Bash |
| `hydra-git` | 🟢 Haiku 4.5 | Git operations: commit, branch, diff, log | Read, Bash, Glob, Grep |
| `hydra-sentinel-scan` | 🟢 Haiku 4.5 | Fast integration sweep after code changes | Read, Grep, Glob |
| `hydra-coder` | 🔵 Sonnet 4.6 | Code writing, implementation, refactoring | Read, Write, Edit, Bash, Glob, Grep |
| `hydra-analyst` | 🔵 Sonnet 4.6 | Code review, debugging, architecture analysis | Read, Grep, Glob, Bash |
| `hydra-sentinel` | 🔵 Sonnet 4.6 | Deep integration analysis (when scan flags issues) | Read, Grep, Glob, Write |

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
