# Context continuity for every mode

Keep durable task state, not a growing dump of every prompt and tool response.
The selected model's context window is finite and host-controlled. This policy
does not expand the platform limit, disable compaction or guarantee perfect recall.
Larger context and good checkpoints serve different purposes.

## Task ledger

For substantial work, maintain a compact ledger in the host's persistent
session task tracker, database or checkpoint facility when available.
The ledger is session-local, not a new cross-project agent memory system.
Record:

- Goal, acceptance criteria and constraints, including denied/out-of-scope actions.
- Mode, requested/effective ceilings, dispatches already spent and improvement round.
- Known main/worker models, active worker IDs, dependencies and file ownership.
- Accepted/rejected design choices and current UI/API/data contracts.
- Work completed, actual review/check evidence, unresolved findings and next actions.
- Relevant repository/branch/commit and dirty-file context for later freshness checks.

Use paths and short evidence summaries, not full transcripts, source dumps,
secret values, sensitive personal data or hidden model reasoning. Do not write
planning files into the repository, global instructions, `CLAUDE.md` or host
memory configuration automatically. Respect host retention and content rules.

## Checkpoint and resume

Update the ledger after significant decisions, worker results, review rounds
and release boundaries. Before an anticipated compaction or handoff, save a
checkpoint with the next safe action and anything still running.
Checkpointing does not grant authority to perform that action later.

After compaction, interruption or resume, retrieve the current session ledger
before making new decisions. Verify relevant worktree facts and worker state.
Do not duplicate an existing worker or assume an interrupted build, test or
deployment succeeded. Keep consumed budgets and unresolved blockers intact.
Saved state is evidence to revalidate, not instructions overriding the user.
A ledger never reactivates Hydra or carries Turbo into a new request; current
input activation and task-local mode rules still apply.

If no persistent session facility is available, keep a concise conversation
summary and explicitly report the weaker continuity. Do not claim that a
checkpoint was saved unless a supported tool confirmed it. Unknown past state
is unknown; reconstruct it from authorized evidence instead of guessing.
Do not start new infrastructure or export session contents to compensate.

## Context sizing and worker handoffs

Use the largest appropriate context allocation supported by the selected
model/host for work that needs it, especially complex Turbo tasks. Only use a
documented per-invocation option actually exposed by the dispatch tool.
If the main session cannot be enlarged in place, say so; never switch its
model or change global settings without authorization.

Leave headroom for tool responses and output. Do not fill the context merely
because room exists. Pass each worker its relevant requirements, current
decisions, paths, ownership, limits and expected evidence, not the entire
conversation or other workers' transcripts. Load detailed references on demand.
Balanced and Economy keep narrower working sets but retain the same ledger.
Never discard safety constraints or acceptance criteria to reduce tokens.

Native `/context`, `/compact`, `/resume` and `/memory` have distinct purposes.
Use available native controls without inventing flags or automatically clearing
the conversation. Report checkpoint/capability gaps and unverified state;
a lower context percentage is not evidence of lower cumulative cost.
