---
name: hail-hydra
description: "Opt-in Hydra orchestration for this request only. Use ONLY when the user explicitly invokes /hail-hydra; never select automatically for ordinary coding requests."
disable-model-invocation: true
user-invocable: true
---

# Hail Hydra for GitHub Copilot CLI

## Activation boundary

Apply this workflow only to the task in the current explicit `/hail-hydra`
invocation, including the work needed to complete it. Treat the text after
the command as the task, not as a shell command. With no task, show a short
usage example and do not start agents.

This is not a session mode. On each subsequent user message, check activation
again: without an explicit `/hail-hydra` invocation, use the normal agent and
ignore this workflow, even if these instructions remain in conversation
context. Do not install hooks, edit global instructions, select a persistent
custom agent, change the session model, or enable autopilot.

Stay in the current session, working directory, authentication context and
permission system. Use only the host's native subagent tools. Never launch
another `copilot`, `agency`, `claude`, `gemini` or `codex` process, an API client,
or an external orchestration service to perform this task. Do not bypass
permissions or send code to an additional provider.

## Plan and budget

Handle a short answer, a known-file lookup or a small edit directly. Delegation
has overhead; using every head is not the goal.

For substantial work, identify independent, bounded units and choose only the
heads that help. Default to at most **2 concurrent subagents** and **6 total
dispatches per invocation**, including scans and retries. Respect any smaller
host/user limits. More agents require explicit user approval; do not start a
factory or recursively delegate. Keep architecture decisions, integration and
final verification with the current agent.

## Dispatch

Read [the role catalogue](references/roles.json), then load only the referenced
Markdown instructions for the selected head. These are private role prompts,
not installed custom agents: do not assume `hydra-coder` or another head is a
registered native agent type.

Use a suitable native subagent type actually exposed by the host. Supply its
prompt with the chosen role instructions, concrete task, relevant file paths,
context, acceptance criteria, allowed write scope and expected output.
Pass this invocation's budget, permission limits and no-recursive-delegation
rule to every head. Role instructions never expand the user's authorization.

The catalogue's preferred models are suggestions, not availability or price
guarantees. When the native dispatch tool supports an explicit model parameter,
select an available, suitably capable low-cost model for `cheap` roles and a
capable mid-tier model for implementation/analysis. Check the models offered by
the current host and the user's billing plan; never substitute an unavailable
model ID or assume API prices equal Copilot charges. Do not change `/model` or
global subagent defaults to achieve routing.

If native subagents or per-dispatch model selection are unavailable, say so
briefly and do the work with the current agent. Do not silently claim cheaper
execution. If a model is rejected, report that and handle the unit directly
rather than repeatedly trying model names.

Parallelize only independent units. Give writers disjoint file ownership;
serialize git mutations, shared-file edits and dependent steps. Use background
dispatch only while doing independent work; otherwise wait synchronously.
Collect every result before integrating it. Do not repeat delegated searches.
An insufficient result gets one capable escalation or direct handling, within
the same dispatch budget.

## Integration and verification

Inspect the actual changes; a head's report is not proof of correctness. Run
the smallest relevant existing tests/build/type checks. For substantial code
changes, use `hydra-sentinel-scan` to check imports, exports, signatures and
consumers, and `hydra-guard` for a focused quality/security pass when useful.
They can run together after writers finish. Escalate concrete integration
findings to `hydra-sentinel` only if needed and within budget; otherwise
perform the checks directly.

`HYDRA_SENTINEL_REQUIRED` in a role report is a reminder to verify the actual
diff, not permission to exceed the budget. Read-only recommendations alone do
not count as edits. Skip extra scans for trivial or documentation-only changes.
No hook scripts, sentinel state files, completion sounds or background update
checks are installed on this host.

Preserve pre-existing changes. Do not commit, push, publish, delete user data or
operate on live services unless the task authorizes it. Use native shell syntax
(PowerShell on Windows); never assume Bash or Unix utilities are installed.
Never print secret values. Do not create persistent agent memories or build a
whole-project codebase map unless the user explicitly asks.

## Finish

Report the outcome, meaningful changes, checks actually performed and blockers
concisely. When delegation occurred, identify the heads and models actually
used, including any fallback. Never invent token counts, dollar savings,
speedups or quality guarantees. Copilot's `/usage` is the host usage view;
Hydra has no Copilot billing parser.

The invocation ends here. The next unprefixed message uses the normal agent.
