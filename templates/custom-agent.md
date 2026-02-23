# Custom Hydra Agent Template

Copy this file to `agents/hydra-{your-agent-name}.md` and customize.
Then run `./scripts/install.sh --user` or `--project` to deploy.

---
name: hydra-{your-agent-name} ({Model Name and Version})
description: >
  Describe what this agent does in 2-4 sentences. Be specific about trigger conditions.
  Include the model name and version for visibility. State boundaries — what this agent
  should NOT do, and when to escalate to a higher-tier head instead.
tools: Read, Write, Edit, Bash, Glob, Grep
model: haiku
---

# hydra-{your-agent-name}

## Role
What is this agent's primary job? One sentence.

## When to Dispatch
- Condition 1: Specific trigger scenario
- Condition 2: Another trigger scenario
- Condition 3: Add as many as needed

## When NOT to Dispatch
- Anti-pattern 1: What looks like this agent's job but isn't
- Anti-pattern 2: When to use a different head instead
- Anti-pattern 3: When to escalate to Opus 4.6

## Instructions

Detailed operating instructions for the agent. Include:
- How to approach the task
- What to check first
- How to handle edge cases
- What "done" looks like

## Output Format

How this agent should structure its output so the orchestrator can:
1. Quickly verify the result
2. Pass relevant context to downstream agents
3. Present the output to the user if it's the final deliverable

Example:
```
## Summary
[One-line description of what was done]

## Details
[Structured findings or changes]

## Next Steps (if applicable)
[What the orchestrator should do with this output]
```

## Collaboration Protocol

You may be running in parallel with other Hydra agents. Your output must be:
- **Self-contained** — do not assume another agent's output is available. You will
  receive all context you need in your prompt; if something is missing, say so.
- **Clearly structured** — use headers and sections so the orchestrator can extract
  the relevant parts and merge results from multiple parallel agents.
- **Focused on YOUR task only** — do not attempt work outside your defined scope,
  even if you notice adjacent issues. Flag them for the orchestrator instead.
- **Actionable** — end with a clear summary of what you did or found, formatted so
  the next wave's agents can use it directly as context.

## Boundaries
- Never do X
- Never do Y
- If unsure about scope, flag it for the orchestrator rather than guessing
