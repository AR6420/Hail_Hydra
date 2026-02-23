# Model Capabilities Reference

Understanding what each model does well (and where it struggles) is key to effective routing.
This reference helps calibrate delegation decisions.

## Claude Haiku 4.5

### Strengths
- Extremely fast response times (~10× faster than Opus)
- Very low cost per token (~5× cheaper than Opus 4.6 — $1/$5 vs $5/$25 per MTok)
- Excellent at following clear, well-defined instructions
- Strong at text extraction, search, and pattern matching
- Good at generating code from templates and clear patterns
- Reliable for mechanical tasks with unambiguous specifications
- Great at summarization and information retrieval

### Limitations
- Weaker at multi-step reasoning chains
- Can miss subtle bugs or edge cases in code review
- Less reliable with complex architectural decisions
- May produce simpler solutions when a nuanced approach is needed
- Can struggle with ambiguous or underspecified requirements
- Less creative in problem-solving approaches

### Ideal Task Profile
Short context, clear instructions, well-defined output, no judgment calls needed.

### Auto-Accept Thresholds
Haiku outputs qualify for auto-accept when they are raw, factual, and unambiguous:
- **hydra-scout**: File paths, grep results, directory listings, code snippets with location markers
- **hydra-runner**: All-pass results, clean build/lint output, git status output
- **hydra-scribe**: Internal docstrings, inline comments, changelog entries
- **Requires verify**: Any analysis, interpretation, or user-facing documentation

---

## Claude Sonnet 4.6

### Strengths
- Strong code generation across most languages and frameworks
- Good reasoning about code structure and patterns
- Reliable bug fixing when errors are identifiable
- Effective code review for common issues
- Good at test writing with understanding of business logic
- Handles refactoring with awareness of dependencies
- Balances speed and capability well

### Limitations
- May not catch the most subtle architectural issues
- Less reliable than Opus for novel algorithm design
- Can sometimes miss non-obvious security implications
- May not fully optimize complex performance bottlenecks
- Less effective at synthesizing large amounts of disparate information

### Ideal Task Profile
Standard software engineering tasks: implementation, testing, debugging, review. Tasks where
the approach is established even if the specific implementation requires thought.

### Auto-Accept Thresholds
Sonnet outputs always require orchestrator review — code changes and analysis are never auto-accepted:
- **hydra-coder**: ALWAYS verify — scan for correctness, edge cases, project pattern alignment
- **hydra-analyst**: ALWAYS verify — validate reasoning, check suggested fix against actual code

---

## Claude Opus 4.6

### Strengths
- Deepest reasoning and analysis capability
- Best at novel problem-solving and architecture design
- Most reliable for subtle bug detection
- Strongest at synthesizing complex, multi-source information
- Best judgment on ambiguous tradeoffs
- Most creative in approach selection
- Highest accuracy on edge cases

### Limitations
- Slowest response time
- Highest cost per token
- Overkill for routine tasks (same quality as Sonnet on standard work)

### Ideal Task Profile
Hard problems: architecture design, subtle debugging, complex tradeoffs, novel implementations,
security analysis, anything where getting it wrong is costly.

### Auto-Accept Thresholds
N/A — Opus is the orchestrator, not a delegated head. Opus output goes directly to the user.

---

## Cost and Speed Comparison (February 2026 Pricing)

| Model | Input Cost | Output Cost | Relative Speed | Input Cost vs Opus 4.6 | Output Cost vs Opus 4.6 |
|-------|-----------|-------------|----------------|----------------------|------------------------|
| Haiku 4.5 | $1 / MTok | $5 / MTok | ~10× faster | 5× cheaper | 5× cheaper |
| Sonnet 4.6 | $3 / MTok | $15 / MTok | ~3× faster | ~1.7× cheaper | ~1.7× cheaper |
| Opus 4.6 | $5 / MTok | $25 / MTok | 1× (baseline) | 1× (baseline) | 1× (baseline) |

Source: https://platform.claude.com/docs/en/about-claude/pricing

### Blended Cost with Hydra (typical 50/30/20 task split)

| Metric | All Opus 4.6 | With Hydra | Savings |
|--------|-------------|------------|---------|
| Input cost / MTok | $5.00 | $2.40 | 52% |
| Output cost / MTok | $25.00 | $12.00 | 52% |
| Blended effective cost | $30.00 / MTok | $14.40 / MTok | ~50% |

Note: Savings calculated against Opus 4.6 pricing ($5/$25 per MTok) as of February 2026.
Savings would be significantly higher when compared to Opus 4.1/4.0 pricing ($15/$75 per MTok).

These are approximate ratios. The key insight: for 60-70% of coding tasks, Haiku 4.5 or
Sonnet 4.6 produces output identical in quality to what Opus 4.6 would produce, but
dramatically faster and cheaper. The skill is in identifying the 30-40% where Opus 4.6
is genuinely needed.

---

## Acceptance Rate Expectations

Drawing from speculative decoding theory, track these metrics mentally:

| Draft Model | Expected Acceptance Rate | Notes |
|-------------|------------------------|-------|
| Haiku → Opus verification | ~85-90% | For well-classified Tier 1 tasks |
| Sonnet → Opus verification | ~90-95% | For well-classified Tier 2 tasks |

If your acceptance rate drops below 80%, you're likely misclassifying tasks — shift borderline
tasks to a higher tier. If it's consistently above 95%, you might be too conservative.

The analogy to speculative decoding is direct: just as the paper found acceptance rates of
~0.7-0.9 for draft tokens depending on domain, our task-level acceptance rates should be
similar or better, since we have more context for classification than a draft model has for
next-token prediction.
