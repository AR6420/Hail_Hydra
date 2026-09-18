# Context continuity for every mode

Keep durable task state, not a growing dump of every prompt and tool response.
The selected model's context window is finite and host-controlled.

## Task ledger

For substantial work, maintain a compact ledger in the host's persistent session facility when available — session-local, not a new cross-project memory system. Record:

- Goal, acceptance criteria and constraints, including out-of-scope actions.
- Mode, ceilings, dispatches spent and improvement round.
- Known main/worker models, active worker IDs, dependencies and file ownership.
- Accepted/rejected design choices and current UI/API/data contracts.
- Work completed, review evidence, unresolved findings and next actions.
- Relevant repository/branch/commit and dirty-file context.

Use paths and short evidence summaries, not full transcripts, source dumps, secret values or hidden model reasoning.
Do not write planning files into the repository, global instructions or host memory automatically.

## Checkpoint and resume

Update the ledger after significant decisions, worker results, review rounds and release boundaries.
Before an anticipated compaction or handoff, save a checkpoint with the next safe action and anything still running.

Treat a `/model` switch like a compaction boundary: write the ledger before an anticipated switch; read it back before the next dispatch or decision.

After compaction, interruption or resume, retrieve the current session ledger before making new decisions.
Verify relevant worktree facts and worker state; do not duplicate an existing worker or assume an interrupted build, test or deployment succeeded.
Keep consumed budgets and unresolved blockers intact.
A ledger never reactivates Hydra or carries Turbo into a new request — current input activation and task-local mode rules still apply.

If no persistent session facility is available, keep a concise conversation summary and explicitly report the weaker continuity.
Do not claim that a checkpoint was saved unless a supported tool confirmed it.

## Context sizing and worker handoffs

Use the largest appropriate context allocation supported by the selected model/host for work that needs it. Leave headroom for tool responses and output.
Pass each worker its relevant requirements, current decisions, paths, ownership, limits and expected evidence — not the entire conversation or other workers' transcripts.

Native `/context`, `/compact`, `/resume` and `/memory` have distinct purposes.
Report checkpoint/capability gaps and unverified state; a lower context percentage is not evidence of lower cumulative cost.
