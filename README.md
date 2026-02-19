# Speculative Execution Framework (SEF)

Task-level speculative execution for Claude Code. Routes each software engineering task
to the lowest-cost model capable of producing acceptable output, with the Opus orchestrator
verifying and accepting or re-executing as needed.

---

## Abstract

The Speculative Execution Framework (SEF) applies the speculative decoding paradigm
(Chen et al., 2023; Leviathan et al., 2022) at the task level rather than the token level.
Most software engineering tasks do not require the full reasoning capacity of a large model
such as Claude Opus. By routing mechanical and well-defined tasks to faster, cheaper Haiku
and Sonnet executors — and reserving Opus for tasks that genuinely require deep reasoning —
SEF achieves meaningful reductions in both latency and API cost with no measurable quality
degradation on correctly classified tasks.

---

## Background

Autoregressive transformer inference is memory-bandwidth bound: the time required per token
scales with model size regardless of task complexity. Speculative decoding addresses this by
having a small draft model propose K tokens that a large target model verifies in a single
forward pass. Since verification of K tokens costs approximately the same as generating one
token, acceptance rates of 70–90% yield 2–2.5x effective throughput with zero distribution
shift.

SEF applies this structure at task granularity. The orchestrator (Opus) classifies each
incoming task, dispatches it to an appropriate executor (Haiku or Sonnet subagent), and
verifies the output. Accepted outputs are returned directly; rejected outputs are re-executed
by the orchestrator. The user observes only the final result.

---

## Architecture

```
User Request
    |
    v
+------------------------------+
|  ORCHESTRATOR  (Opus)        |
|  1. Classify task tier       |
|  2. Dispatch to executor     |
|  3. Verify output            |
+----------+-------------------+
           |
    +------+------+------------------+
    v             v                  v
+---------+  +---------+  +--------------------+
| Tier 1  |  | Tier 2  |  | Orchestrator       |
| Haiku   |  | Sonnet  |  | (Tier 3: retained) |
| executor|  | executor|  +--------------------+
+----+----+  +----+----+
     |            |
     +------+-----+
            |
            v
+------------------------------+
|  ORCHESTRATOR verifies:      |
|  accept -> return to user    |
|  reject -> execute directly  |
+------------------------------+
            |
            v
     User receives result
```

---

## Executor Agents

| Executor | Model | Tier | Role | Tools |
|----------|-------|------|------|-------|
| `sef-explore` | Haiku 4.5 | 1 | Codebase exploration, file search, reading | Read, Grep, Glob |
| `sef-validate` | Haiku 4.5 | 1 | Test execution, builds, linting, validation | Read, Bash, Glob, Grep |
| `sef-document` | Haiku 4.5 | 1 | Documentation, comments, changelogs | Read, Write, Edit, Glob, Grep |
| `sef-implement` | Sonnet 4.5 | 2 | Code writing, implementation, refactoring | Read, Write, Edit, Bash, Glob, Grep |
| `sef-review` | Sonnet 4.5 | 2 | Code review, debugging, analysis | Read, Grep, Glob, Bash |

---

## Task Classification

The orchestrator classifies each task before dispatching. Classification is a fast mental
check, not a visible step to the user.

### Tier 1 — Haiku (sef-explore, sef-validate, sef-document)

Tasks that are mechanical, read-heavy, or have a well-defined output:

- File search and pattern matching across codebases
- Reading and summarizing code or documentation
- Running tests, builds, linters, and format checks
- Simple git operations (status, log, diff)
- Boilerplate generation from clear templates
- Writing or updating comments, docstrings, and README content

**Decision criterion**: Can the task be expressed as a single unambiguous imperative
sentence? If yes, it is Tier 1.

### Tier 2 — Sonnet (sef-implement, sef-review)

Tasks requiring reasoning about code within established patterns:

- Feature implementation from a specification
- Function, class, and module creation or modification
- Refactoring (rename, extract, restructure)
- Test writing requiring business logic comprehension
- Bug fixing with identifiable stack traces or error messages
- Code review and quality assessment
- API integrations following documented patterns

**Decision criterion**: Does the task require reading, understanding, and producing code
where the approach is standard? If yes, it is Tier 2.

### Tier 3 — Orchestrator (Opus, retained)

Tasks requiring deep reasoning, novel architecture, or high-stakes judgment:

- System architecture design and major structural decisions
- Debugging subtle issues with no clear stack trace
- Performance optimization requiring algorithmic analysis
- Security vulnerability assessment
- Multi-file coordinated changes with complex interdependencies
- Novel algorithm implementation
- Ambiguous requirements requiring clarification

**Decision criterion**: Would careful reasoning be required even with full Opus capacity?
If yes, retain the task.

---

## Installation

```bash
# Clone the repository
git clone https://github.com/AR6420/Hail_Hydra.git
cd Hail_Hydra

# Deploy executors to all Claude Code projects (recommended)
./scripts/install.sh --user

# Deploy to current project only
./scripts/install.sh --project

# Deploy to both locations
./scripts/install.sh --both

# Check deployment status
./scripts/install.sh --status

# Remove all executors
./scripts/install.sh --uninstall
```

Executors are installed to:
- `~/.claude/agents/` — user-level, active in all Claude Code sessions
- `.claude/agents/` — project-level, active in the current project only

Project-level executors take precedence over user-level when both are present.

---

## Repository Structure

```
.
+-- SKILL.md                          # Framework instructions (loaded by Claude Code)
+-- agents/
|   +-- sef-explore.md                # Haiku: codebase exploration
|   +-- sef-validate.md               # Haiku: test and build execution
|   +-- sef-document.md               # Haiku: documentation writing
|   +-- sef-implement.md              # Sonnet: code implementation
|   +-- sef-review.md                 # Sonnet: code review and debugging
+-- references/
|   +-- routing-guide.md              # Classification examples and decision flowchart
|   +-- model-capabilities.md         # Model capability profiles and cost/speed ratios
+-- scripts/
    +-- install.sh                    # Executor deployment script
```

---

## Performance Expectations

Estimates based on approximate model speed and cost ratios. Actual results depend on task
mix and classification accuracy.

| Metric | Baseline (Opus only) | With SEF | Notes |
|--------|---------------------|----------|-------|
| Task completion speed | 1x | 2–3x | Haiku ~10x faster than Opus |
| API cost | 1x | 0.3–0.4x | 60–70% reduction |
| Output quality | Opus-level | Opus-level | Zero degradation on correctly classified tasks |

### Cost Model

| Task category | Estimated share | Executor used | Cost vs. Opus |
|---------------|----------------|---------------|---------------|
| Exploration, execution, documentation | ~50% | Haiku | ~3% of Opus cost |
| Implementation, review, testing | ~30% | Sonnet | ~17% of Opus cost |
| Architecture, complex debugging | ~20% | Opus (retained) | 100% |
| **Blended effective cost** | | | **~25% of all-Opus** |

---

## Design Principles

- **Transparency**: The user does not observe routing decisions. Executor output is presented
  as the final result. No delegation announcements, no routing narration.

- **Conservative escalation**: When classification is uncertain, route to a higher tier.
  Quality takes precedence over cost reduction. Never downgrade on retry — if an executor's
  output is insufficient, the orchestrator re-executes directly.

- **Parallel dispatch**: Independent subtasks are dispatched concurrently to multiple
  executors, maximizing throughput on compound requests.

- **Calibration**: Track delegation rate (target: 60–80%) and rejection rate (target: <15%).
  Adjust classification thresholds if either metric drifts significantly.

---

## References

- Chen, C., Borgeaud, S., Irving, G., Lespiau, J. B., Sifre, L., & Jumper, J. (2023).
  *Accelerating Large Language Model Decoding with Speculative Sampling.*
  arXiv:2302.01318. https://arxiv.org/abs/2302.01318

- Leviathan, Y., Kalman, M., & Matias, Y. (2023).
  *Fast Inference from Transformers via Speculative Decoding.*
  arXiv:2211.17192. https://arxiv.org/abs/2211.17192

---

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/new-executor`)
3. Commit your changes (`git commit -m 'Add sef-optimize executor for performance work'`)
4. Push to the branch (`git push origin feature/new-executor`)
5. Open a pull request

---

## License

MIT. Use freely, modify as needed.

---

> Looking for something with more personality? Check out the [Hail Hydra](../../tree/main) branch — same framework, more fun.
