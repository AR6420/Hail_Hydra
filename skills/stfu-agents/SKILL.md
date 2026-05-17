---
name: STFU Agents
description: >
  Apply internal-thinking compression to every subagent dispatched in this
  session. Reduces wasted tokens in subagent context windows that the
  orchestrator never reads. Works on any subagent — Hydra's, third-party,
  or Claude Code's built-in agents. Opt-in; session-scoped; runtime-only.
trigger: /hydra:stfu OR /skills stfu-agents OR user says "STFU agents",
         "shut up agents", "quiet agents", or "compress all agents"
---

# STFU-Agents Mode

When this skill is active, the orchestrator (Opus) prepends an internal-thinking compression directive to EVERY Task tool dispatch — regardless of which agent.

## Behavior — Orchestrator (Opus)

When dispatching any subagent via the Task tool, prepend this directive to the `prompt` argument:

```
[INTERNAL-COMPRESSION DIRECTIVE — STFU-Agents mode active]
Your internal reasoning is billed but never read — only your final summary returns to the orchestrator. Therefore:
1. Skip preambles ("Let me…", "I'll examine…", "First I need to…")
2. Skip step announcements ("Step 1:", "Now let me…")
3. Skip transition prose between tool calls
4. Skip restatements of tool outputs (they're already in your context)
5. Act first, summarize at the end
Maintain whatever output format your role requires. Just keep the path from task → output terse internally.
```

## Activation
- `/hydra:stfu`
- `/skills stfu-agents` or `/skills STFU Agents`
- Natural language: "STFU agents", "shut up agents", "quiet agents", "compress all agents"

## Scope
- Hydra's own subagents (already have Tier 3 — harmless reinforcement)
- Third-party subagents installed by the user
- Claude Code's built-in subagents (Explore, etc.)
- User-defined custom subagents

Does NOT apply to:
- The main orchestrator (Opus) — orchestrator follows SKILL.md's own response rules
- Direct user-facing responses

## Deactivation
- `/skills` (clear active skills)
- Natural language: "verbose agents", "stop STFU"

## When NOT to use
- Debugging a subagent's behavior (you want to see its reasoning)
- Teaching the user how subagents work
- User explicitly asked for verbose mode

## Compatibility
Purely additive at runtime. No agent files modified. If a subagent ignores the directive, no harm done — falls back to baseline. Coexists with any other skill or framework.

## Risk Disclosure
STFU-Agents adds a directive to subagents Hydra does not own. While the directive is additive and harmless in principle, it has not been tested against every possible subagent definition. Activate explicitly; deactivate if anything looks off.
