# Model Capabilities Reference

Understanding what each model does well (and where it struggles) is key to effective routing.
This reference helps calibrate delegation decisions.

## Claude Haiku 4.5

### Strengths
- Extremely fast response times (~10× faster than Opus)
- Very low cost per token (~30× cheaper than Opus)
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
security analysis, anything where getting it wrong is costly.

---

## Cost and Speed Comparison

| Model | Relative Speed | Relative Cost | Best For |
|-------|---------------|---------------|----------|
| Haiku 4.5 | 10× | 1× | Exploration, execution, docs |
| Sonnet 4.5 | 3× | 5× | Implementation, review, testing |
| Opus 4.6 | 1× (baseline) | 30× | Architecture, hard debugging, novel work |

These are approximate ratios. The key insight: for 60-70% of coding tasks, Haiku or Sonnet
produces output identical in quality to what Opus would produce, but dramatically faster and
cheaper. The skill is in identifying the 30-40% where Opus is genuinely needed.

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
