# Model Capabilities Reference

Understanding what each model does well (and where it struggles) is key to effective routing.
This reference helps calibrate delegation decisions within the Speculative Execution Framework.

## Claude Haiku 4.5

### Strengths
- Extremely fast response times (~10x faster than Opus)
- Very low cost per token (~30x cheaper than Opus)
- Excellent at following clear, well-defined instructions
- Strong at text extraction, search, and pattern matching
- Good at generating code from templates and clear patterns
- Reliable for mechanical tasks with unambiguous specifications
- Effective at summarization and information retrieval

### Limitations
- Weaker at multi-step reasoning chains
- Can miss subtle bugs or edge cases in code review
- Less reliable with complex architectural decisions
- May produce simpler solutions when a nuanced approach is needed
- Can struggle with ambiguous or underspecified requirements
- Less creative in problem-solving approaches

### Ideal Task Profile
Short context, clear instructions, well-defined output, no judgment calls required.

---

## Claude Sonnet 4.5

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
security analysis, anything where errors are costly to recover from.

---

## Cost and Speed Comparison

| Model | Relative Speed | Relative Cost | Best For |
|-------|---------------|---------------|----------|
| Haiku 4.5 | 10x | 1x | Exploration, execution, documentation |
| Sonnet 4.5 | 3x | 5x | Implementation, review, testing |
| Opus 4.6 | 1x (baseline) | 30x | Architecture, hard debugging, novel work |

These are approximate ratios. The key insight: for 60–70% of coding tasks, Haiku or Sonnet
produces output identical in quality to Opus, but dramatically faster and cheaper. Effective
use of SEF is in identifying the 30–40% where Opus is genuinely required.

---

## Acceptance Rate Expectations

Drawing from speculative decoding theory, track these metrics:

| Executor Tier | Expected Acceptance Rate | Notes |
|---------------|-------------------------|-------|
| Haiku (Tier 1) -> Orchestrator verification | ~85–90% | For well-classified Tier 1 tasks |
| Sonnet (Tier 2) -> Orchestrator verification | ~90–95% | For well-classified Tier 2 tasks |

If your acceptance rate drops below 80%, tasks are likely being misclassified — shift
borderline cases to a higher tier. If it is consistently above 95%, classification may
be too conservative.

The analogy to speculative decoding is direct: acceptance rates of approximately 0.7–0.9
for draft tokens (depending on domain) correspond to similar or better rates at the task
level, since the orchestrator has substantially more context for classification than a
draft model has for next-token prediction.
