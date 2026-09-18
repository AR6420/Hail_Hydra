# Task-local execution modes

Choose from the current invocation only. Without `--mode`, use `balanced`;
never inherit a previous task's mode. Modes change how Hydra spends effort,
not the main model, permissions, acceptance criteria or native session
settings. All modes follow the same [quality floor](hydra-quality.md) and
[context continuity policy](hydra-continuity.md).

| Mode | Priority | Default concurrent workers / total dispatches |
|---|---|---|
| `turbo` | Speed first; costs more | 8 / 32 |
| `balanced` | Quality, speed and cost together | 2 / 6 |
| `economy` | Efficient changes to established designs | 1 / 3 |

Ceilings are instruction-level guidance, not measured host limits: they are
bounded by the Copilot plan's `subagents.maxConcurrency` on usage-based
billing (cap 32) — the lower of the two wins. The 2/6 and 1/3 defaults are
Copilot heuristics, not measured optima.

For multiple substantial, independent subsystems, Balanced can expand to
4 concurrent subagents and 12 total dispatches when parallel progress repays
overhead. Do not expand Economy automatically or silently switch it to
Turbo. All modes allow at most two improvement rounds, inside the same
dispatch budget. Ceilings are not targets; a simple task can use zero
workers in any mode.

## Resolve the policy before dispatch

Use the installed helper without passing task text to a shell:

`node <skill-root>/scripts/hydra-control.js mode <turbo|balanced|economy>`

`mode` alone returns Balanced. For justified expanded Balanced work, append
`--expanded` to the helper call. The helper prints an inspectable policy and
writes no state; it neither starts workers nor changes the active CLI mode.

The user may explicitly override ceilings with leading task modifiers
`--max-agents N` and `--max-dispatches N` — requested instruction-level
ceilings, not verified host capacity. Pass only validated numeric values to
the same helper: positive safe integers, with concurrency never exceeding
total dispatches. Invalid or duplicate options are errors, never permission
to guess a budget. Respect smaller host/user limits: the effective ceiling
is no higher than both the resolved policy and applicable host limits.

Record the mode, requested ceilings and main/worker responsibilities in the
task ledger before substantive dispatch. Count every advisor, scan, retry
and escalation; do not reset counters when replanning.

## Turbo

Keep substantive reasoning and final acceptance with the selected main
model. Use strong, current, capable workers for independent implementation
and complex review; smaller workers still handle mechanical operations.
Run implementation, tests and independent reviews in parallel on disjoint
or stable scopes. Cost is secondary, not unlimited: existing user/host
limits and release gates still apply.

## Balanced

Retain Hydra's cost/speed/context tradeoff. Delegate when parallel
progress, a suitable cheaper model or context isolation repays dispatch
overhead. Research only decisions that could materially change the
solution; reuse settled facts. Preserve the selected main agent's difficult
reasoning and acceptance responsibilities.

## Economy

Prefer existing designs, contracts and available project evidence. Minimize
optional research, extra review passes and cosmetic polish. Economy never
waives required checks or accepts known serious defects — security,
authorization, data integrity and deployment gates remain. High-risk logic
stays with the main agent; if a needed review cannot fit the budget, review
directly with a disclosed fallback or report blocked work.

## Large workloads are queues, not unlimited swarms

Schedule only ready independent units with exclusive write ownership, in
bounded waves. Even explicit ceilings such as 100 workers / 1000 dispatches
are requests, not verified host capacity — this integration adds no
massive-swarm scheduler or recursive/factory dispatch.

Report actual mode, models, worker counts, checks and limits; never promise
a speedup solely from a larger team.
