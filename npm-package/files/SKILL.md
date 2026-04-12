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

## ⛔ MANDATORY PROTOCOLS — NEVER SKIP

These protocols are NON-NEGOTIABLE. Skipping them is a framework violation.

### Protocol 1: Sentinel Scan After Code Changes

When ANY agent returns output containing `⚠️ HYDRA_SENTINEL_REQUIRED`, you
MUST — before doing ANYTHING else, before presenting results to the user,
before running any other agents — dispatch hydra-sentinel-scan with the
files and changes listed in the trigger block.

**This is blocking.** The user does NOT see the code changes until sentinel
completes. If you present code changes to the user without running sentinel
first, you have violated the framework's core safety guarantee.

Sequence:
1. Receive agent output containing ⚠️ HYDRA_SENTINEL_REQUIRED
2. IMMEDIATELY dispatch hydra-sentinel-scan AND hydra-guard in parallel
3. WAIT for both to complete
4. If sentinel-scan finds issues → dispatch hydra-sentinel (deep analysis)
5. WAIT for deep analysis
6. THEN — and ONLY then — present results to the user

If the agent output contains `✅ HYDRA_NO_CODE_CHANGES`, skip sentinel. Present
results immediately.

### Protocol 2: Sentinel Fix Decision Tree

When hydra-sentinel confirms real issues:

**TRIVIAL** (auto-fix without asking):
  Import renames, file path updates, barrel file re-exports.
  → Dispatch hydra-coder to fix. Re-run sentinel-scan to verify.
  → Tell user: "Sentinel caught [issue]. Auto-fixed."

**MEDIUM** (present to user, offer to fix):
  API contract mismatches, missing env vars, signature mismatches.
  → Show the sentinel report. Ask: "Want me to fix these?"

**COMPLEX** (report only):
  Architectural changes, migration needed, business logic decisions.
  → Show the report. Let user decide.

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
    │  SEQUENTIAL       │  PARALLEL (wait for all)         │
    ▼                   ▼                                  │
 [coder]            [scribe] ──────────────────────────────┘
    │
    ▼
 ALL agents complete (Opus waits for every dispatched agent)
    │
    ├── Raw data / clean pass? → AUTO-ACCEPT → (updates Session Index if scout)
    └── Code / analysis / user-facing docs? → Orchestrator verifies
         │
         ▼
   User gets result (single response, all agent outputs included)
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

## Codebase Map — Orchestrator Protocol

Hydra maintains a codebase map at `.claude/hydra/codebase-map.json`. This map
is built and maintained by hydra-scout. It contains file dependencies, blast
radius data, risk scores, env var references, and test coverage.

### Session Start — Map Check

At the start of EVERY session, before any work:

1. Check if `.claude/hydra/codebase-map.json` exists.
2. If yes: read the `_meta` section. Check if `git_hash` matches current HEAD.
   - If current: map is ready. Note this internally.
   - If stale: dispatch hydra-scout to do an incremental update before proceeding.
3. If no: dispatch hydra-scout to build the map on the first exploration task.
   Don't block the session — but prioritize building the map early.

### Risk-Based Sentinel Triggering

Use the map's risk scores to decide sentinel behavior:

| Modified File Risk | Sentinel Behavior |
|-------------------|-------------------|
| `critical` (7+ dependents) | ALWAYS run sentinel-scan, ALWAYS escalate to deep |
| `high` (4-6 dependents) | ALWAYS run sentinel-scan, escalate if issues found |
| `medium` (2-3 dependents) | Run sentinel-scan, escalate only if P0 issues found |
| `low` (0-1 dependents) | Run sentinel-scan, but auto-accept if clean |

This replaces the previous "always run sentinel-scan the same way" approach
with risk-proportional verification.

### When Dispatching Sentinel-Scan

Include the map's relevant data in the task description:
- The blast radius for the changed files (from the map)
- The risk score of each changed file
- The test coverage status of each changed file
- Any env vars referenced by the changed files

This gives sentinel-scan a head start — it doesn't need to compute the
blast radius itself, the map already has it.

### Map Staleness

If you notice the map's git_hash doesn't match HEAD and hydra-scout hasn't
been dispatched yet, dispatch scout to update the map BEFORE running sentinel.
A stale map is worse than no map — it could have incorrect dependency data.

## Preflight Protocol — /hydra:preflight

Run this before starting work on any new project or unfamiliar codebase.
It catches environment and compatibility issues before they become multi-hour
debugging sessions.

### When to run

- User types `hydra preflight` or `/hydra:preflight`
- User says "check my environment", "validate my setup", "is this project ready to build"
- You are about to begin a substantial build task on a project you have not seen before
  in this session AND the Session Index has no prior context for this project

### Execution — Two Phases, Always in Sequence

**Phase 1 (Detection) — dispatch hydra-preflight:**

Prompt:

```
Run a full preflight check on this project. Collect runtime versions, run all
GPU/CUDA probe scripts, inventory installed packages, compare .env.example against
.env, verify build tools exist, and check service connectivity. Return the full
structured PREFLIGHT_INVENTORY JSON. Do not make recommendations.
```

Wait for hydra-preflight to return `PREFLIGHT_INVENTORY_COMPLETE` before proceeding.

**Phase 2 (Analysis) — dispatch hydra-analyst:**

Pass the full PREFLIGHT_INVENTORY from Phase 1. Prompt:

```
You are performing a compatibility analysis on the following environment inventory.
Cross-reference all detected versions against known compatibility matrices.
Pay special attention to GPU stack combinations (PyTorch/CUDA/cuDNN),
framework pairs (React/Next, Python/TF), and Node/native addon combinations.

For each component or pair, return one of three verdicts:
  ✅ COMPATIBLE — versions are known-good together
  ⚠️  KNOWN RISK — this combination has known issues or is untested
  ❌ CONFIRMED BREAK — probe output or known matrix confirms incompatibility

For ❌ verdicts, include the specific fix (e.g. "pin pytorch==2.7.0").
For ⚠️  verdicts, include what to watch for.
For unknowns, flag as "UNVERIFIED — test before building" rather than assuming green.

INVENTORY:
[paste full PREFLIGHT_INVENTORY here]
```

### Presenting Results to User

After both phases complete, present a unified report:

```
🐉 Hydra Preflight — [project name]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

RUNTIMES
  ✅ Node 22.4.0 (matches .nvmrc)
  ✅ Python 3.11.9 (matches .python-version)

GPU STACK
  ❌ PyTorch 2.6.0 + CUDA 13.0 — incompatible
     Fix: pip install torch==2.7.0

ENVIRONMENT
  ⚠️  Missing: DATABASE_URL, REDIS_URL (declared in .env.example)

DEPENDENCIES
  ✅ node_modules present (1,847 packages)
  ✅ venv present

SERVICES
  ❌ PostgreSQL: unreachable (DATABASE_URL not set)
  ✅ Redis: reachable

BUILD TOOLS
  ✅ vite, tsc, pytest all found

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
2 confirmed breaks, 1 known risk, 1 warning
Fix the ❌ items before building.
```

Auto-apply trivial fixes (e.g. updating a pin in requirements.txt) only if the user
says "fix it" or "apply fixes". Never auto-apply without being asked.

### Three-State Verdict Reference

| State | Meaning | Source |
|-------|---------|--------|
| ✅ COMPATIBLE | Versions are known-good together | Analyst matrix knowledge |
| ⚠️ KNOWN RISK | Combination has known issues or limited testing | Analyst matrix knowledge |
| ❌ CONFIRMED BREAK | Probe output OR known matrix confirms failure | Probe output (ground truth) or analyst |
| ❓ UNVERIFIED | Combination not in training data | Analyst — flag and move on |

Ground truth from probes always beats matrix knowledge. If `torch.cuda.is_available()`
returns False, that is a ❌ regardless of what the version matrix says.

## Sequential vs Parallel Dispatch

Not all agents need to be dispatched one-by-one. When agents are independent,
dispatch them simultaneously and wait for ALL to complete before responding.

> ⚠️ **NEVER use fire-and-forget or background dispatch.** Background agent
> completion triggers an empty user turn in Claude Code, causing Claude to respond
> to nothing. Every dispatched agent MUST be awaited before presenting results.

### Sequential Dispatch (one wave at a time)
Use when downstream agents DEPEND on this agent's output:
- hydra-scout exploring files that hydra-coder needs to edit
- hydra-analyst diagnosing a bug that hydra-coder needs to fix
- hydra-coder making changes that hydra-runner needs to test

### Parallel Dispatch (all at once — wait for ALL before responding)
Use when agents are INDEPENDENT of each other:
- hydra-scribe writing docs + hydra-runner running final tests
- hydra-guard scanning + hydra-sentinel-scan sweeping (already enforced by Protocol 1)
- hydra-scout exploring supplementary context + any other independent agent

### Execution Flow

```
Wave 1 (sequential): scout explores → returns file paths
Wave 2 (sequential): coder implements fix → returns changed files
Wave 3 (parallel):   dispatch runner AND scribe simultaneously
                     WAIT for BOTH to complete
                     Present single response to user (all outputs included)
```

### Rules
1. A wave completes when ALL agents in it return — no exceptions
2. NEVER present results while any dispatched agent is still running
3. NEVER dispatch hydra-coder without awaiting the result — code changes always need verification
4. NEVER dispatch hydra-analyst without awaiting the result — diagnoses feed into fixes
5. hydra-scribe runs IN PARALLEL with hydra-runner by default (not after)
6. If in doubt, wait for everything — correctness over speed

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
    │   decide sequential/parallel per agent                                           │
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
                     │ SEQUENTIAL agents     ◄── Opt 3: Parallel   │ PARALLEL agents
                     │ (one wave at a time)                        │ (dispatched together)
                     ▼                                             ▼
              Results arrive                              All complete together
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
          (all parallel agents completed before this point)
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

#### Rule 2: Parallel + Auto-Accept = Zero-Overhead Path
When an agent runs in parallel with others AND its output qualifies for auto-accept:
- Dispatch it alongside other parallel agents
- When it returns: auto-accept without orchestrator review
- Append result to response (all parallel agents finish before the response is sent)
- **Total orchestrator overhead: 0 seconds**

This is the highest-throughput path. Common cases:
- Parallel hydra-runner (final validation) reporting all-pass → zero overhead
- Parallel hydra-scribe (internal docstrings) → zero overhead
- Parallel hydra-scout (supplementary context) → zero overhead, index updated

#### Rule 3: Auto-Accepted Scout Output ALWAYS Updates Session Index
Every scout output that passes auto-accept is immediately folded into the Session Index.
No separate step. The act of auto-accepting IS the index update.

#### Rule 4: Parallel Dispatch Does Not Override Verification Requirements
Parallel dispatch governs TIMING (run together), not VERIFICATION (do review).
If scribe writes user-facing docs (README, API docs), verification is still required —
it happens when all parallel agents complete, before the response is sent.
Opus always waits for every dispatched agent before presenting results.

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
  t=9s   Dispatch runner (parallel) + scribe (parallel)          [3s — both run at once]
         Scribe and runner run simultaneously, Opus waits for both
  t=12s  Runner: all-pass → auto-accept                          [0s overhead]
         Scribe: internal docs → auto-accept                     [0s overhead]
  t=12s  Present result to user (single response, all outputs included)
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

## Mandatory Delegation Rules

These rules are BINDING. They are not heuristics, suggestions, or guidelines to consider. They are hard rules that determine whether YOU handle a task or DELEGATE it to a Hydra head. Violating these rules defeats the purpose of Hydra.

### ALWAYS Delegate — No Exceptions

These task types MUST be delegated. You are NOT allowed to handle them yourself, regardless of how simple they seem.

| Task Type | Delegate To | Why You Don't Do It |
|-----------|-------------|---------------------|
| File search / grep / find patterns | hydra-scout | Haiku is equally good at Glob/Grep and costs 95% less |
| Read and summarize code or docs | hydra-scout | Reading files is mechanical — no Opus reasoning needed |
| Run tests, builds, lints, type checks | hydra-runner | Executing commands and reporting output is mechanical |
| Git operations (commit, branch, diff, log, stash) | hydra-git | Git commands are well-defined and deterministic |
| Security/quality gate scans | hydra-guard | Pattern matching for secrets/issues is Haiku's strength |
| Write/update docstrings, comments, changelogs | hydra-scribe | Descriptive writing from existing code is mechanical |
| Implement features from clear specs | hydra-coder | Sonnet handles standard implementation patterns equally well |
| Fix bugs with clear error messages/stack traces | hydra-coder | Error-driven debugging with clear clues is Sonnet-level |
| Code review and PR analysis | hydra-analyst | Structured code analysis is Sonnet's sweet spot |

**Self-check**: Before you start ANY task, ask: "Is this in the ALWAYS Delegate table?" If yes — delegate. No exceptions. No "but it's faster if I just..." No "it's only a small..." DELEGATE.

### ALWAYS Handle Yourself — Never Delegate

These task types stay with Opus. Delegating them wastes time or risks quality.

| Task Type | Why You Keep It |
|-----------|----------------|
| Task classification and routing decisions | Only you see the full conversation context |
| Verifying and synthesizing agent outputs | Judgment on whether a draft is acceptable requires orchestrator perspective |
| System architecture and major design decisions | Novel architectural tradeoffs need Opus-level reasoning |
| Ambiguous debugging with no clear clues | "It works in staging but not prod" needs deep investigation |
| Context-dependent tasks requiring conversation history | Agents don't see prior turns — you do |
| Trivial edits under 5 seconds (max 2-3 per session) | Delegation overhead exceeds task cost |
| Planning and decomposition | Breaking tasks into waves IS the orchestrator's job |
| Conversation management (clarification, alignment) | Only you talk to the user |

### JUDGMENT CALLS — Use This Decision Framework

For tasks NOT in either table above, apply this 3-step check:

1. **Does it require conversation context?** (prior turns, user preferences, accumulated state)
   - YES → Handle yourself. Agents don't have this context.
2. **Can Haiku or Sonnet do this equally well?** (not "almost as well" — EQUALLY well)
   - YES → Delegate. You're wasting money and time doing it yourself.
   - NO → Handle yourself.
3. **Would delegation take LONGER than doing it yourself?** (including prompt construction + wait time)
   - YES, and the task is truly trivial → Handle yourself (counts toward overhead budget).
   - NO or UNSURE → **Delegate.** This is the default. When in doubt, DELEGATE.

### Parallel Dispatch — MANDATORY for Independent Subtasks

If a task decomposes into subtasks with no dependencies between them, you MUST dispatch them simultaneously in a single message. Sequential dispatch of independent tasks is a rule violation.

**WRONG** (sequential — wastes time):
```
Message 1: Launch hydra-scout to explore auth module
[wait for result]
Message 2: Launch hydra-runner to run existing tests
[wait for result]
Message 3: Launch hydra-scout to check test patterns
```

**RIGHT** (parallel — all independent):
```
Message 1: Launch hydra-scout (auth module) + hydra-runner (tests) + hydra-scout (test patterns)
[all three return]
Message 2: Launch dependent tasks using results from Message 1
```

**Trigger phrases that REQUIRE parallel dispatch:**
- "...and..." (e.g., "fix the bug AND add tests" → scout + runner in parallel)
- "...then..." where the "then" tasks are independent of each other
- Any request with 2+ independent components
- Any request where exploration and execution can overlap

### Delegation Overhead Budget

You are allowed a MAXIMUM of 2-3 "do it myself" exceptions per session for tasks that technically fall in the ALWAYS Delegate table but are genuinely trivial (e.g., adding a single `console.log` to a known file). Track this internally.

**Rules:**
- If you've done 5+ tasks directly in a row without delegating, STOP. Re-read the ALWAYS Delegate table. You are almost certainly violating these rules.
- "It's faster if I just do it" is not a valid exception after the 2-3 budget is spent.
- The budget resets each session.

### Plan Mode Behavior

During planning phase (before execution begins):
- Using Claude Code's built-in Explore agent is acceptable for quick codebase understanding.
- No delegation rules apply yet — you're gathering context, not executing.

Once execution begins (after plan is approved):
- ALL mandatory delegation rules apply immediately.
- **NEVER use the built-in Explore agent during execution when hydra-scout is available.** hydra-scout is faster and cheaper.
- Plans MUST reference specific Hydra agents. Example format:

```
Step 1: hydra-scout → read auth module structure [parallel with Step 2]
Step 2: hydra-runner → run existing test suite [parallel with Step 1]
Step 3: hydra-coder → implement fix using findings from Steps 1-2
Step 4: hydra-sentinel-scan + hydra-guard → verify changes [parallel]
Step 5: hydra-runner → run tests to confirm fix
Step 6: hydra-git → commit with descriptive message
```

### Dispatch Logging

After every task completion (unless `/hydra:quiet` is active), show a dispatch summary:

```
| Step | Agent | Task | Time |
|------|-------|------|------|
| 1 | hydra-scout | Explore auth module | 3.2s |
| 2 | hydra-runner | Run test suite | 5.1s |
| 3 | hydra-coder | Fix auth bug | 8.4s |
| 4 | hydra-guard | Security scan | 2.1s |
| 5 | hydra-runner | Verify fix | 4.8s |

Delegation: 5/5 (100%) — Opus direct: 0
```

If "Opus direct" exceeds "Delegation" count, the mandatory rules are not being followed. Re-read the ALWAYS Delegate table before continuing.

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

> **REMINDER:** If you see `⚠️ HYDRA_SENTINEL_REQUIRED` in any agent's output
> and you skip sentinel, you are violating the framework's core protocol.
> See "⛔ MANDATORY PROTOCOLS" at the top of this document.

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

### Sentinel Status in Dispatch Log

The dispatch log MUST show sentinel status for every task involving code changes:

| Step | Agent | Task | Verdict |
|------|-------|------|---------|
| 1 | hydra-coder (Sonnet 4.6) | Fixed auth bug | ✅ Accepted |
| 2 | hydra-sentinel-scan (Haiku) | Integration sweep | ✅ Clean |
| 3 | hydra-guard (Haiku 4.5) | Security scan | ✅ Clean |

If sentinel-scan is missing from the dispatch log after a code change,
something went wrong. This is your self-check.

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
| `/hydra:map [file]` | View, rebuild, or query the codebase dependency map |
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

### Speed and Parallelism
See "Mandatory Delegation Rules" for binding delegation and parallel dispatch rules.

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
| `hydra status` | List all 10 heads by name, model, and whether they appear to be installed (check `agents/` dir) |
| `hydra config` | Show current configuration settings (mode, dispatch_log, auto_guard) and their source (default/project/user) |
| `hydra help` | Show available commands and a brief one-line description of each head |
| `hydra quiet` | Suppress dispatch logs for the rest of the session (equivalent to stealth mode) |
| `hydra verbose` | Enable verbose dispatch logs with per-agent detail for the rest of the session |
| `hydra reset` | Clear session index, treat next turn as Turn 1 (rebuild from fresh scout) |
| `hydra map` | Show codebase map summary, or query a specific file's blast radius |
| `hydra preflight` | Run two-phase environment and compatibility check before starting a new project build |

## The Ten Heads

| Head | Model | Role | Tools |
|------|-------|------|-------|
| `hydra-scout` | 🟢 Haiku 4.5 | Codebase exploration, file search, reading, map building | Read, Grep, Glob, Bash, Write |
| `hydra-runner` | 🟢 Haiku 4.5 | Test execution, builds, linting, validation | Read, Bash, Glob, Grep |
| `hydra-scribe` | 🟢 Haiku 4.5 | Documentation, READMEs, comments, changelogs | Read, Write, Edit, Glob, Grep |
| `hydra-guard` | 🟢 Haiku 4.5 | Security/quality gate after code changes | Read, Grep, Glob, Bash |
| `hydra-git` | 🟢 Haiku 4.5 | Git operations: commit, branch, diff, log | Read, Bash, Glob, Grep |
| `hydra-sentinel-scan` | 🟢 Haiku 4.5 | Fast integration sweep after code changes | Read, Grep, Glob |
| `hydra-preflight` | 🟢 Haiku 4.5 | Environment detection, version probing, dep inventory | Read, Bash, Glob |
| `hydra-coder` | 🔵 Sonnet 4.6 | Code writing, implementation, refactoring | Read, Write, Edit, Bash, Glob, Grep |
| `hydra-analyst` | 🔵 Sonnet 4.6 | Code review, debugging, architecture analysis | Read, Grep, Glob, Bash |
| `hydra-sentinel` | 🔵 Sonnet 4.6 | Deep integration analysis (when scan flags issues) | Read, Grep, Glob, Write |

## Measuring Impact

Track these mentally to calibrate:

- **Delegation rate**: What % of tasks go to heads? Target: 60–70%.
- **Preflight rate**: Are you running `/hydra:preflight` on new projects? Target: 100% of new project sessions.
- **Rejection rate**: How often does a draft need Opus intervention? Target: <15%.
- **User complaints**: Zero. If the user notices quality issues, tune the classification.

If rejection rate > 20%, you're too aggressive — shift borderline tasks up one tier.
If rejection rate < 5%, you're too conservative — delegate more.

## Task Completion Notification

After completing a user's task (the final response you present to the user),
run this command as the LAST action:
```bash
node ~/.claude/hooks/hydra-notify.js < /dev/null
```

This plays a short notification sound so the user knows you're done —
especially useful when they've tabbed away while waiting.

Do this for SUBSTANTIAL tasks only (tasks that took more than ~10 seconds).
Do NOT play it for quick conversational responses, acknowledgments, or
follow-up questions.

## Reference Material

- `references/routing-guide.md` — Mandatory delegation examples, decision flowchart
- `references/model-capabilities.md` — What each model can and can't do
