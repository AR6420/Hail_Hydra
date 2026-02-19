# Routing Guide — Detailed Classification Examples

This reference provides concrete examples to help calibrate task classification.
Consult this when resolving ambiguous routing decisions.

## Table of Contents
1. [Tier 1 (Haiku) Examples](#tier-1-haiku)
2. [Tier 2 (Sonnet) Examples](#tier-2-sonnet)
3. [Tier 3 (Opus) Examples](#tier-3-opus)
4. [Compound Task Decomposition](#compound-tasks)
5. [Common Misclassifications](#common-misclassifications)

---

## Tier 1 (Haiku)

### sef-explore examples
| User says | Route to | Why |
|-----------|----------|-----|
| "What framework is this project using?" | sef-explore | Read package.json/config files |
| "Find where the login endpoint is defined" | sef-explore | Grep for routes/endpoints |
| "How many files are in the src directory?" | sef-explore | Glob + count |
| "Show me the database schema" | sef-explore | Find and read schema/migration files |
| "What does the User model look like?" | sef-explore | Find and read model definition |
| "Is there a rate limiter in this project?" | sef-explore | Grep for rate limit patterns |
| "What version of React are we using?" | sef-explore | Read package.json |

### sef-validate examples
| User says | Route to | Why |
|-----------|----------|-----|
| "Run the tests" | sef-validate | Execute test command, report results |
| "Does the build pass?" | sef-validate | Run build, report success/failure |
| "Check if there are any lint errors" | sef-validate | Run linter, report findings |
| "What's the git status?" | sef-validate | Run git status/diff |
| "Run the migration" | sef-validate | Execute migration command |
| "Check if the server starts" | sef-validate | Start server, check for errors |

### sef-document examples
| User says | Route to | Why |
|-----------|----------|-----|
| "Add docstrings to this file" | sef-document | Read code, write docstrings |
| "Update the README with the new API endpoints" | sef-document | Descriptive writing from code |
| "Write a changelog entry for these changes" | sef-document | Summarize changes |
| "Add comments explaining this function" | sef-document | Read and annotate |

---

## Tier 2 (Sonnet)

### sef-implement examples
| User says | Route to | Why |
|-----------|----------|-----|
| "Add a password reset endpoint" | sef-implement | Feature implementation from spec |
| "Refactor this class to use composition" | sef-implement | Code transformation, clear goal |
| "Write tests for the auth module" | sef-implement | Test creation requires comprehension |
| "Fix this TypeError: cannot read property of undefined" | sef-implement | Bug fix with clear error |
| "Add pagination to the list API" | sef-implement | Standard pattern implementation |
| "Convert this JavaScript to TypeScript" | sef-implement | Mechanical but needs type reasoning |
| "Add input validation to the form" | sef-implement | Implementation with business logic |

### sef-review examples
| User says | Route to | Why |
|-----------|----------|-----|
| "Review this PR for issues" | sef-review | Code review |
| "Why is this test flaky?" | sef-review | Debug analysis with test output |
| "Are there any security issues in the auth code?" | sef-review | Focused security review |
| "What's causing this memory leak?" | sef-review | Performance debugging with symptoms |
| "How well tested is this module?" | sef-review | Coverage analysis |

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
1. **sef-explore** — Find auth.py, read it, understand the context
2. **sef-implement** — Fix the bug and write tests
3. **sef-validate** — Run the tests to verify

### Example 2: "Refactor the API module and update the docs"
1. **sef-explore** — Map the current API module structure
2. **sef-implement** — Perform the refactoring
3. **sef-validate** — Run tests to verify nothing broke
4. **sef-document** — Update documentation

### Example 3: "Review the codebase and suggest architecture improvements"
1. **sef-explore** — Map the project structure and key files
2. **sef-review** — Review code quality and patterns
3. **Orchestrator (you)** — Synthesize findings into architecture recommendations

### Example 4: "Set up CI/CD for this project"
1. **sef-explore** — Understand the project structure, build system, test framework
2. **Orchestrator (you)** — Design the CI/CD pipeline (architectural decision)
3. **sef-implement** — Implement the config files
4. **sef-validate** — Validate the configuration

---

## Common Misclassifications

These are tasks that appear to be one tier but are actually another:

| Task | Looks like | Actually | Why |
|------|-----------|----------|-----|
| "Add a simple button" | Tier 1 (simple) | Tier 2 (Sonnet) | Needs to match existing component patterns |
| "Read the logs and find the error" | Tier 1 (read) | Tier 2 (Sonnet) | Log analysis requires reasoning |
| "Fix the typo in line 42" | Tier 2 (code change) | Tier 1 (Haiku) | Trivial mechanical change |
| "Add caching" | Tier 2 (implementation) | Tier 3 (Opus) | Cache invalidation strategy is complex |
| "Write a migration to add a column" | Tier 2 (code writing) | Tier 1 (Haiku) | Template-level SQL |
| "Upgrade React from 17 to 18" | Tier 1 (simple) | Tier 3 (Opus) | Breaking changes need careful analysis |

---

## Quick Decision Flowchart

```
Is it read-only? --- Yes --> Is it just finding/reading files?
    |                              |
    |                         Yes: sef-explore (Haiku)
    |                         No:  sef-review (Sonnet)
    |
    No
    |
Is it just running a command? --- Yes --> sef-validate (Haiku)
    |
    No
    |
Is it writing docs/comments only? --- Yes --> sef-document (Haiku)
    |
    No
    |
Is the implementation approach clear? --- Yes --> sef-implement (Sonnet)
    |
    No
    |
Does it need architectural judgment? --- Yes --> Orchestrator (Opus)
    |
    No --> sef-implement (Sonnet), but monitor output closely
```
