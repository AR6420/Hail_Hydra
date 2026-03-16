# Routing Guide — Mandatory Delegation Examples

This reference provides concrete examples to see mandatory delegation in action.
Read this when you need to see how delegation rules apply to real tasks.

## Table of Contents
1. [ALWAYS Delegate — Haiku 4.5 Agents](#always-delegate-haiku)
2. [ALWAYS Delegate — Sonnet 4.6 Agents](#always-delegate-sonnet)
3. [ALWAYS Handle Yourself — Opus 4.6](#always-handle-yourself-opus)
4. [Compound Task Decomposition](#compound-tasks)
5. [Common Misclassifications](#common-misclassifications)

---

## ALWAYS Delegate — Haiku 4.5 Agents

### hydra-scout (Haiku 4.5) examples
| User says | Route to | Why |
|-----------|----------|-----|
| "What framework is this project using?" | hydra-scout (Haiku 4.5) | Read package.json/config files |
| "Find where the login endpoint is defined" | hydra-scout (Haiku 4.5) | Grep for routes/endpoints |
| "How many files are in the src directory?" | hydra-scout (Haiku 4.5) | Glob + count |
| "Show me the database schema" | hydra-scout (Haiku 4.5) | Find and read schema/migration files |
| "What does the User model look like?" | hydra-scout (Haiku 4.5) | Find and read model definition |
| "Is there a rate limiter in this project?" | hydra-scout (Haiku 4.5) | Grep for rate limit patterns |
| "What version of React are we using?" | hydra-scout (Haiku 4.5) | Read package.json |

### hydra-runner (Haiku 4.5) examples
| User says | Route to | Why |
|-----------|----------|-----|
| "Run the tests" | hydra-runner (Haiku 4.5) | Execute test command, report results |
| "Does the build pass?" | hydra-runner (Haiku 4.5) | Run build, report success/failure |
| "Check if there are any lint errors" | hydra-runner (Haiku 4.5) | Run linter, report findings |
| "What's the git status?" | hydra-runner (Haiku 4.5) | Run git status/diff |
| "Run the migration" | hydra-runner (Haiku 4.5) | Execute migration command |
| "Check if the server starts" | hydra-runner (Haiku 4.5) | Start server, check for errors |

### hydra-scribe (Haiku 4.5) examples
| User says | Route to | Why |
|-----------|----------|-----|
| "Add docstrings to this file" | hydra-scribe (Haiku 4.5) | Read code, write docstrings |
| "Update the README with the new API endpoints" | hydra-scribe (Haiku 4.5) | Descriptive writing from code |
| "Write a changelog entry for these changes" | hydra-scribe (Haiku 4.5) | Summarize changes |
| "Add comments explaining this function" | hydra-scribe (Haiku 4.5) | Read and annotate |

### hydra-guard (Haiku 4.5) examples
| User says | Route to | Why |
|-----------|----------|-----|
| "Scan my changes for security issues" | hydra-guard (Haiku 4.5) | Security gate scan |
| "Are there any secrets in this file?" | hydra-guard (Haiku 4.5) | Pattern scan for credentials |
| "Check this PR for obvious quality issues" | hydra-guard (Haiku 4.5) | Quality gate on code diff |
| (auto-invoked after hydra-coder) | hydra-guard (Haiku 4.5) | Auto-guard protocol |

### hydra-git (Haiku 4.5) examples
| User says | Route to | Why |
|-----------|----------|-----|
| "Commit these changes" | hydra-git (Haiku 4.5) | Stage + commit with message |
| "What's the git status?" | hydra-git (Haiku 4.5) | Run git status, summarize |
| "Create a branch for this feature" | hydra-git (Haiku 4.5) | Branch creation |
| "Show me the diff for the last commit" | hydra-git (Haiku 4.5) | Diff inspection |
| "Stash my changes" | hydra-git (Haiku 4.5) | Git stash |
| "Are there any merge conflicts?" | hydra-git (Haiku 4.5) | Conflict detection (not resolution) |
| "Cherry-pick commit abc123" | hydra-git (Haiku 4.5) | Cherry-pick execution |

---

## ALWAYS Delegate — Sonnet 4.6 Agents

### hydra-coder (Sonnet 4.6) examples
| User says | Route to | Why |
|-----------|----------|-----|
| "Add a password reset endpoint" | hydra-coder (Sonnet 4.6) | Feature implementation from spec |
| "Refactor this class to use composition" | hydra-coder (Sonnet 4.6) | Code transformation, clear goal |
| "Write tests for the auth module" | hydra-coder (Sonnet 4.6) | Test creation requires comprehension |
| "Fix this TypeError: cannot read property of undefined" | hydra-coder (Sonnet 4.6) | Bug fix with clear error |
| "Add pagination to the list API" | hydra-coder (Sonnet 4.6) | Standard pattern implementation |
| "Convert this JavaScript to TypeScript" | hydra-coder (Sonnet 4.6) | Mechanical but needs type reasoning |
| "Add input validation to the form" | hydra-coder (Sonnet 4.6) | Implementation with business logic |

### hydra-analyst (Sonnet 4.6) examples
| User says | Route to | Why |
|-----------|----------|-----|
| "Review this PR for issues" | hydra-analyst (Sonnet 4.6) | Code review |
| "Why is this test flaky?" | hydra-analyst (Sonnet 4.6) | Debug analysis with test output |
| "Are there any security issues in the auth code?" | hydra-analyst (Sonnet 4.6) | Focused security review |
| "What's causing this memory leak?" | hydra-analyst (Sonnet 4.6) | Performance debugging with symptoms |
| "How well tested is this module?" | hydra-analyst (Sonnet 4.6) | Coverage analysis |

---

## ALWAYS Handle Yourself — Opus 4.6

| User says | Why Opus? |
|-----------|-----------|
| "Design the database schema for a multi-tenant SaaS" | Novel architecture decisions |
| "This works in staging but not production and I can't figure out why" | Subtle debugging, no clear clues |
| "How should we structure the microservices?" | System design requiring tradeoff analysis |
| "Optimize this algorithm — it's too slow for large inputs" | Algorithmic insight needed |
| "We need to support both REST and GraphQL — how?" | Architectural decision with implications |
| "Review the overall architecture and suggest improvements" | Requires deep holistic understanding |
| "There's a race condition somewhere in the checkout flow" | Subtle concurrency debugging |

---

## Compound Tasks

> **Note**: By default, hydra-scout is pre-dispatched in parallel with task classification for
> any prompt involving codebase context (see Speculative Pre-Dispatch in SKILL.md). The compound
> task decompositions below show the explicit Wave 1 scout dispatch for clarity, but in practice,
> scout may already be returning results by the time Wave 1 launches.

Many real user requests contain multiple subtasks at different tiers. Decompose them:

### Example 1: "Fix the bug in auth.py and add tests"
1. **hydra-scout (Haiku 4.5)** [BLOCKING] → Find auth.py, read it, understand the context
2. **hydra-coder (Sonnet 4.6)** [BLOCKING] → Fix the bug and write tests
3. **hydra-sentinel-scan (Haiku 4.5)** [BLOCKING] → Integration sweep on changed files
   **hydra-guard (Haiku 4.5)** [BLOCKING] → Security scan on changed files
   **hydra-runner (Haiku 4.5)** [BLOCKING] → Run the tests to verify
4. *(If sentinel-scan flags issues)* **hydra-sentinel (Sonnet 4.6)** [BLOCKING] → Deep analysis

### Example 2: "Refactor the API module and update the docs"
1. **hydra-scout (Haiku 4.5)** [BLOCKING] → Map the current API module structure
2. **hydra-coder (Sonnet 4.6)** [BLOCKING] → Perform the refactoring
3. **hydra-sentinel-scan (Haiku 4.5)** [BLOCKING] → Integration sweep on refactored code
   **hydra-guard (Haiku 4.5)** [BLOCKING] → Security scan on changed files
   **hydra-runner (Haiku 4.5)** [BLOCKING] → Run tests to verify nothing broke
   **hydra-scribe (Haiku 4.5)** [NON-BLOCKING] → Update documentation (fire & forget)
4. *(If sentinel-scan flags issues)* **hydra-sentinel (Sonnet 4.6)** [BLOCKING] → Deep analysis

### Example 3: "Review the codebase and suggest architecture improvements"
1. **hydra-scout (Haiku 4.5)** → Map the project structure and key files
2. **hydra-analyst (Sonnet 4.6)** → Review code quality and patterns
3. **Opus 4.6 (you)** → Synthesize findings into architecture recommendations

### Example 4: "Set up CI/CD for this project"
1. **hydra-scout (Haiku 4.5)** → Understand the project structure, build system, test framework
2. **Opus 4.6 (you)** → Design the CI/CD pipeline (architectural decision)
3. **hydra-coder (Sonnet 4.6)** → Implement the config files
4. **hydra-runner (Haiku 4.5)** → Validate the configuration

---

## Common Misclassifications

These are tasks that look like one tier but are actually another:

| Task | Looks like | Actually | Why |
|------|-----------|----------|-----|
| "Add a simple button" | Haiku (simple) | hydra-coder (Sonnet) | Needs to match existing component patterns |
| "Read the logs and find the error" | Haiku (read) | hydra-analyst (Sonnet) | Log analysis requires reasoning |
| "Fix the typo in line 42" | hydra-coder (Sonnet) | hydra-scribe (Haiku) | Trivial mechanical change |
| "Add caching" | hydra-coder (Sonnet) | Opus (handle yourself) | Cache invalidation strategy is hard |
| "Write a migration to add a column" | hydra-coder (Sonnet) | hydra-scribe (Haiku) | Template-level SQL |
| "Upgrade React from 17 to 18" | Haiku (simple) | Opus (handle yourself) | Breaking changes need careful analysis |

---

## Quick Decision Flowchart

```
Task arrives
│
├── In ALWAYS Delegate table? ── YES ──→ Route to specified agent
│
├── In ALWAYS Handle Yourself table? ── YES ──→ Opus handles directly
│
└── Neither? → JUDGMENT CALLS:
    ├── Requires conversation context? ── YES ──→ Opus
    ├── Haiku/Sonnet can do equally well? ── NO ──→ Opus
    └── Delegation takes LONGER? ── YES (and truly trivial) ──→ Opus
        └── Otherwise ──→ Delegate to best-fit agent
```

## Routing Examples — Mandatory Delegation

These examples show the RIGHT and WRONG way to handle common requests under the mandatory delegation rules.

### 1. "Fix the bug in auth.ts"

**WRONG** (Opus does it all):
```
Read auth.ts yourself → find the bug → fix it → run tests
```

**RIGHT** (mandatory delegation):
```
1. hydra-scout → explore auth module, find the bug location
2. hydra-analyst → analyze the bug, identify root cause
3. hydra-coder → implement the fix
4. hydra-sentinel-scan + hydra-guard → verify changes [parallel]
5. hydra-runner → run tests to confirm fix
```

### 2. "What's the project structure?"

**WRONG** (Opus runs find/ls itself):
```
Run `find . -type f` or `ls -R` yourself
```

**RIGHT** (mandatory delegation):
```
1. hydra-scout → map project structure, report back
```

### 3. "Run the tests"

**WRONG** (Opus runs npm test itself):
```
Run `npm test` yourself
```

**RIGHT** (mandatory delegation):
```
1. hydra-runner → execute test suite, report results
```

### 4. "Commit these changes"

**WRONG** (Opus runs git add/commit itself):
```
Run `git add . && git commit -m "..."` yourself
```

**RIGHT** (mandatory delegation):
```
1. hydra-git → stage and commit with well-crafted message
```

### 5. "This function is slow, figure out why"

**RIGHT** (Opus orchestrates, delegates execution):
```
1. hydra-analyst → profile and diagnose the performance issue
2. YOU → decide the optimization approach (architectural judgment)
3. hydra-coder → implement the optimization
4. hydra-runner → benchmark before and after
```

### 6. "Redesign the auth module to use OAuth2"

**RIGHT** (Opus architects, delegates implementation):
```
1. hydra-scout → map current auth module structure [parallel with Step 2]
2. hydra-scout → research OAuth2 patterns in codebase [parallel with Step 1]
3. YOU → design the new architecture (this is YOUR job)
4. hydra-coder #1 → implement OAuth2 provider [parallel with Steps 5-6]
5. hydra-coder #2 → implement token management [parallel with Steps 4, 6]
6. hydra-coder #3 → update route handlers [parallel with Steps 4-5]
7. hydra-sentinel-scan → integration sweep on all changes
8. hydra-runner → run full test suite
```

### 7. "Quick — add a console.log to line 5"

**ACCEPTABLE** (trivial <5s edit — uses overhead budget):
```
YOU → add the console.log directly (counts as 1 of max 2-3 exceptions per session)
```

## Sentinel Routing

Sentinel is NOT manually routed. It triggers AUTOMATICALLY after code changes:

| Event | Triggers |
|-------|----------|
| hydra-coder writes/edits code | → sentinel-scan (always) |
| hydra-analyst suggests code changes | → sentinel-scan (always) |
| Orchestrator makes direct code changes | → sentinel-scan (always) |
| sentinel-scan finds issues | → sentinel deep analysis |
| sentinel-scan is clean | → nothing (done) |
| hydra-scribe writes docs | → nothing (skip) |
| hydra-git commits | → nothing (skip) |
| hydra-runner runs tests | → nothing (skip) |
