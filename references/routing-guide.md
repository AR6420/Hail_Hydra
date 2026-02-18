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

### hydra-scout examples
| User says | Route to | Why |
|-----------|----------|-----|
| "What framework is this project using?" | hydra-scout | Read package.json/config files |
| "Find where the login endpoint is defined" | hydra-scout | Grep for routes/endpoints |
| "How many files are in the src directory?" | hydra-scout | Glob + count |
| "Show me the database schema" | hydra-scout | Find and read schema/migration files |
| "What does the User model look like?" | hydra-scout | Find and read model definition |
| "Is there a rate limiter in this project?" | hydra-scout | Grep for rate limit patterns |
| "What version of React are we using?" | hydra-scout | Read package.json |

### hydra-runner examples
| User says | Route to | Why |
|-----------|----------|-----|
| "Run the tests" | hydra-runner | Execute test command, report results |
| "Does the build pass?" | hydra-runner | Run build, report success/failure |
| "Check if there are any lint errors" | hydra-runner | Run linter, report findings |
| "What's the git status?" | hydra-runner | Run git status/diff |
| "Run the migration" | hydra-runner | Execute migration command |
| "Check if the server starts" | hydra-runner | Start server, check for errors |

### hydra-scribe examples
| User says | Route to | Why |
|-----------|----------|-----|
| "Add docstrings to this file" | hydra-scribe | Read code, write docstrings |
| "Update the README with the new API endpoints" | hydra-scribe | Descriptive writing from code |
| "Write a changelog entry for these changes" | hydra-scribe | Summarize changes |
| "Add comments explaining this function" | hydra-scribe | Read and annotate |

---

## Tier 2 (Sonnet)

### hydra-coder examples
| User says | Route to | Why |
|-----------|----------|-----|
| "Add a password reset endpoint" | hydra-coder | Feature implementation from spec |
| "Refactor this class to use composition" | hydra-coder | Code transformation, clear goal |
| "Write tests for the auth module" | hydra-coder | Test creation requires comprehension |
| "Fix this TypeError: cannot read property of undefined" | hydra-coder | Bug fix with clear error |
| "Add pagination to the list API" | hydra-coder | Standard pattern implementation |
| "Convert this JavaScript to TypeScript" | hydra-coder | Mechanical but needs type reasoning |
| "Add input validation to the form" | hydra-coder | Implementation with business logic |

### hydra-analyst examples
| User says | Route to | Why |
|-----------|----------|-----|
| "Review this PR for issues" | hydra-analyst | Code review |
| "Why is this test flaky?" | hydra-analyst | Debug analysis with test output |
| "Are there any security issues in the auth code?" | hydra-analyst | Focused security review |
| "What's causing this memory leak?" | hydra-analyst | Performance debugging with symptoms |
| "How well tested is this module?" | hydra-analyst | Coverage analysis |

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

Many real user requests contain multiple subtasks at different tiers. Decompose them:

### Example 1: "Fix the bug in auth.py and add tests"
1. **hydra-scout** → Find auth.py, read it, understand the context
2. **hydra-coder** → Fix the bug and write tests
3. **hydra-runner** → Run the tests to verify

### Example 2: "Refactor the API module and update the docs"
1. **hydra-scout** → Map the current API module structure
2. **hydra-coder** → Perform the refactoring
3. **hydra-runner** → Run tests to verify nothing broke
4. **hydra-scribe** → Update documentation

### Example 3: "Review the codebase and suggest architecture improvements"
1. **hydra-scout** → Map the project structure and key files
2. **hydra-analyst** → Review code quality and patterns
3. **Opus (you)** → Synthesize findings into architecture recommendations

### Example 4: "Set up CI/CD for this project"
1. **hydra-scout** → Understand the project structure, build system, test framework
2. **Opus (you)** → Design the CI/CD pipeline (architectural decision)
3. **hydra-coder** → Implement the config files
4. **hydra-runner** → Validate the configuration

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
