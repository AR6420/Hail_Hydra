# Routing Guide — Detailed Classification Examples

This reference provides concrete examples to help calibrate task classification.
Read this when you need to resolve ambiguous cases.

## Table of Contents
1. [Tier 1 (Haiku 4.5) Examples](#tier-1-haiku)
2. [Tier 2 (Sonnet 4.6) Examples](#tier-2-sonnet)
3. [Tier 3 (Opus 4.6) Examples](#tier-3-opus)
4. [Compound Task Decomposition](#compound-tasks)
5. [Common Misclassifications](#common-misclassifications)

---

## Tier 1 (Haiku 4.5)

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

## Tier 2 (Sonnet 4.6)

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

## Tier 3 (Opus 4.6 — handle directly)

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
3. **hydra-guard (Haiku 4.5)** [NON-BLOCKING] → Security scan on changed files
   **hydra-runner (Haiku 4.5)** [BLOCKING] → Run the tests to verify

### Example 2: "Refactor the API module and update the docs"
1. **hydra-scout (Haiku 4.5)** [BLOCKING] → Map the current API module structure
2. **hydra-coder (Sonnet 4.6)** [BLOCKING] → Perform the refactoring
3. **hydra-runner (Haiku 4.5)** [BLOCKING] → Run tests to verify nothing broke
   **hydra-scribe (Haiku 4.5)** [NON-BLOCKING] → Update documentation (fire & forget)

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
| "Add a simple button" | Tier 1 (simple) | Tier 2 (Sonnet 4.6) | Needs to match existing component patterns |
| "Read the logs and find the error" | Tier 1 (read) | Tier 2 (Sonnet 4.6) | Log analysis requires reasoning |
| "Fix the typo in line 42" | Tier 2 (code change) | Tier 1 (Haiku 4.5) | Trivial mechanical change |
| "Add caching" | Tier 2 (implementation) | Tier 3 (Opus 4.6) | Cache invalidation strategy is hard |
| "Write a migration to add a column" | Tier 2 (code writing) | Tier 1 (Haiku 4.5) | Template-level SQL |
| "Upgrade React from 17 to 18" | Tier 1 (simple) | Tier 3 (Opus 4.6) | Breaking changes need careful analysis |

---

## Quick Decision Flowchart

```
Is it read-only? ─── Yes ──→ Is it just finding/reading files?
    │                              │
    │                         Yes: hydra-scout (Haiku 4.5)
    │                         No:  hydra-analyst (Sonnet 4.6)
    │
    No
    │
Is it a git operation? ─── Yes ──→ hydra-git (Haiku 4.5)
    │
    No
    │
Is it a security/quality scan? ─── Yes ──→ hydra-guard (Haiku 4.5)
    │
    No
    │
Is it just running a command? ─── Yes ──→ hydra-runner (Haiku 4.5)
    │
    No
    │
Is it writing docs/comments only? ─── Yes ──→ hydra-scribe (Haiku 4.5)
    │
    No
    │
Is the implementation approach clear? ─── Yes ──→ hydra-coder (Sonnet 4.6)
    │
    No
    │
Does it need architectural judgment? ─── Yes ──→ Opus 4.6 (you)
    │
    No ──→ hydra-coder (Sonnet 4.6), but monitor output closely
```
