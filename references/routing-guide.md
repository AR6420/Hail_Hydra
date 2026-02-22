# Routing Guide — Detailed Classification Examples

This reference provides concrete examples to help calibrate task classification.
Read this when you need to resolve ambiguous cases.

## Table of Contents
1. [Tier 1 (Haiku) Examples](#tier-1-haiku)
2. [Tier 2 (Sonnet) Examples](#tier-2-sonnet)
3. [Tier 3 (Opus) Examples](#tier-3-opus)
4. [Compound Task Decomposition](#compound-tasks)
5. [Common Misclassifications](#common-misclassifications)

---

## Tier 1 (Haiku)

### hydra-scout (Haiku) examples
| User says | Route to | Why |
|-----------|----------|-----|
| "What framework is this project using?" | hydra-scout (Haiku) | Read package.json/config files |
| "Find where the login endpoint is defined" | hydra-scout (Haiku) | Grep for routes/endpoints |
| "How many files are in the src directory?" | hydra-scout (Haiku) | Glob + count |
| "Show me the database schema" | hydra-scout (Haiku) | Find and read schema/migration files |
| "What does the User model look like?" | hydra-scout (Haiku) | Find and read model definition |
| "Is there a rate limiter in this project?" | hydra-scout (Haiku) | Grep for rate limit patterns |
| "What version of React are we using?" | hydra-scout (Haiku) | Read package.json |

### hydra-runner (Haiku) examples
| User says | Route to | Why |
|-----------|----------|-----|
| "Run the tests" | hydra-runner (Haiku) | Execute test command, report results |
| "Does the build pass?" | hydra-runner (Haiku) | Run build, report success/failure |
| "Check if there are any lint errors" | hydra-runner (Haiku) | Run linter, report findings |
| "What's the git status?" | hydra-runner (Haiku) | Run git status/diff |
| "Run the migration" | hydra-runner (Haiku) | Execute migration command |
| "Check if the server starts" | hydra-runner (Haiku) | Start server, check for errors |

### hydra-scribe (Haiku) examples
| User says | Route to | Why |
|-----------|----------|-----|
| "Add docstrings to this file" | hydra-scribe (Haiku) | Read code, write docstrings |
| "Update the README with the new API endpoints" | hydra-scribe (Haiku) | Descriptive writing from code |
| "Write a changelog entry for these changes" | hydra-scribe (Haiku) | Summarize changes |
| "Add comments explaining this function" | hydra-scribe (Haiku) | Read and annotate |

---

## Tier 2 (Sonnet)

### hydra-coder (Sonnet) examples
| User says | Route to | Why |
|-----------|----------|-----|
| "Add a password reset endpoint" | hydra-coder (Sonnet) | Feature implementation from spec |
| "Refactor this class to use composition" | hydra-coder (Sonnet) | Code transformation, clear goal |
| "Write tests for the auth module" | hydra-coder (Sonnet) | Test creation requires comprehension |
| "Fix this TypeError: cannot read property of undefined" | hydra-coder (Sonnet) | Bug fix with clear error |
| "Add pagination to the list API" | hydra-coder (Sonnet) | Standard pattern implementation |
| "Convert this JavaScript to TypeScript" | hydra-coder (Sonnet) | Mechanical but needs type reasoning |
| "Add input validation to the form" | hydra-coder (Sonnet) | Implementation with business logic |

### hydra-analyst (Sonnet) examples
| User says | Route to | Why |
|-----------|----------|-----|
| "Review this PR for issues" | hydra-analyst (Sonnet) | Code review |
| "Why is this test flaky?" | hydra-analyst (Sonnet) | Debug analysis with test output |
| "Are there any security issues in the auth code?" | hydra-analyst (Sonnet) | Focused security review |
| "What's causing this memory leak?" | hydra-analyst (Sonnet) | Performance debugging with symptoms |
| "How well tested is this module?" | hydra-analyst (Sonnet) | Coverage analysis |

---

## Tier 3 (Opus — handle directly)

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
1. **hydra-scout (Haiku)** [BLOCKING] → Find auth.py, read it, understand the context
2. **hydra-coder (Sonnet)** [BLOCKING] → Fix the bug and write tests
3. **hydra-runner (Haiku)** [BLOCKING] → Run the tests to verify

### Example 2: "Refactor the API module and update the docs"
1. **hydra-scout (Haiku)** [BLOCKING] → Map the current API module structure
2. **hydra-coder (Sonnet)** [BLOCKING] → Perform the refactoring
3. **hydra-runner (Haiku)** [BLOCKING] → Run tests to verify nothing broke
   **hydra-scribe (Haiku)** [NON-BLOCKING] → Update documentation (fire & forget)

### Example 3: "Review the codebase and suggest architecture improvements"
1. **hydra-scout (Haiku)** → Map the project structure and key files
2. **hydra-analyst (Sonnet)** → Review code quality and patterns
3. **Opus (you)** → Synthesize findings into architecture recommendations

### Example 4: "Set up CI/CD for this project"
1. **hydra-scout (Haiku)** → Understand the project structure, build system, test framework
2. **Opus (you)** → Design the CI/CD pipeline (architectural decision)
3. **hydra-coder (Sonnet)** → Implement the config files
4. **hydra-runner (Haiku)** → Validate the configuration

---

## Common Misclassifications

These are tasks that look like one tier but are actually another:

| Task | Looks like | Actually | Why |
|------|-----------|----------|-----|
| "Add a simple button" | Tier 1 (simple) | Tier 2 (Sonnet) | Needs to match existing component patterns |
| "Read the logs and find the error" | Tier 1 (read) | Tier 2 (Sonnet) | Log analysis requires reasoning |
| "Fix the typo in line 42" | Tier 2 (code change) | Tier 1 (Haiku) | Trivial mechanical change |
| "Add caching" | Tier 2 (implementation) | Tier 3 (Opus) | Cache invalidation strategy is hard |
| "Write a migration to add a column" | Tier 2 (code writing) | Tier 1 (Haiku) | Template-level SQL |
| "Upgrade React from 17 to 18" | Tier 1 (simple) | Tier 3 (Opus) | Breaking changes need careful analysis |

---

## Quick Decision Flowchart

```
Is it read-only? ─── Yes ──→ Is it just finding/reading files?
    │                              │
    │                         Yes: hydra-scout (Haiku)
    │                         No:  hydra-analyst (Sonnet)
    │
    No
    │
Is it just running a command? ─── Yes ──→ hydra-runner (Haiku)
    │
    No
    │
Is it writing docs/comments only? ─── Yes ──→ hydra-scribe (Haiku)
    │
    No
    │
Is the implementation approach clear? ─── Yes ──→ hydra-coder (Sonnet)
    │
    No
    │
Does it need architectural judgment? ─── Yes ──→ Opus (you)
    │
    No ──→ hydra-coder (Sonnet), but monitor output closely
```
