# Task-local execution modes

Choose from the current invocation only. Without `--mode`, use `balanced`;
never inherit a previous task's mode. Modes change how Hydra spends effort,
not the main model, permissions, acceptance criteria or native session settings.
Do not read other hosts' `hydra.config.md` or map `aggressive` to Turbo.
All modes follow the same [quality floor](hydra-quality.md) and
[context continuity policy](hydra-continuity.md).

| Mode | Priority | Default concurrent workers / total dispatches |
|---|---|---|
| `turbo` | Quality and elapsed time; cost is secondary | 8 / 32 |
| `balanced` | Quality, speed and cost together | 2 / 6 |
| `economy` | Efficient changes to established designs | 1 / 3 |

For multiple substantial, independent subsystems, Balanced can expand to
4 concurrent subagents and 12 total dispatches when parallel progress repays
overhead. Do not expand Economy automatically or silently switch it to Turbo.
All modes allow at most two improvement rounds, inside the same dispatch budget.
Ceilings are not targets; a simple task can use zero workers in any mode.

## Resolve the policy before dispatch

Use the installed helper without passing task text to a shell:

`node <skill-root>/scripts/hydra-control.js mode <turbo|balanced|economy>`

`mode` alone returns Balanced. For justified expanded Balanced work, append
`--expanded` to the helper call; this is not a separate user-facing skill flag.
The helper prints an inspectable policy and writes no state. It neither starts
workers nor changes the active CLI mode. Reuse its result in the current
invocation rather than calling it before every worker.

The user may explicitly override ceilings with leading task modifiers
`--max-agents N` and `--max-dispatches N`. Pass only validated numeric values
to the same helper. Positive safe integers are required, and concurrency
must not exceed total dispatches. Invalid/duplicate options are errors, never
permission to guess a budget. Respect smaller host/user limits: the effective
ceiling is no higher than both the resolved policy and applicable host limits.
If capacity is unknown, disclose that and grow conservatively as supported.

Record the mode, requested ceilings, any stricter limits and main/worker
responsibilities in the task ledger before substantive dispatch. Count every
advisor, scan, retry and escalation. Explicit limit overrides can raise the
requested budget, but never bypass native permissions, billing restrictions
or resource capacity. Do not reset counters when replanning or checkpointing.

## Turbo

Keep substantive reasoning and final acceptance with the selected main model.
Use strong, current, capable workers for independent implementation and complex
review; do not downgrade those units merely because their catalogue tier says
cheap/mid. Smaller workers can still handle mechanical operations.

Compare relevant backend/frontend approaches and evidence where choices affect
the outcome. Let independent research proceed together; dependent coding waits
for the main agent's shared contract. Run implementation, tests and independent
reviews in parallel only on disjoint or stable scopes. Use broader relevant
validation, not unrelated exploratory work or endless alternatives.

Prefer a larger supported context allocation when it materially helps the
selected model/worker reason across the task. Do not silently switch the main
model or change global settings to obtain it. Cost-secondary does not mean
unlimited billing permission; existing user/host limits and release gates remain.

## Balanced

Retain Hydra's cost/speed/context tradeoff. Delegate when parallel progress,
a suitable cheaper model or context isolation repays dispatch overhead.
Research only decisions that could materially change the solution; reuse
settled facts. Match review depth to scope/risk. Preserve the selected main
agent's difficult reasoning and acceptance responsibilities.

Use focused handoffs and enough context for each unit, with headroom for tool
results. Expand the team only for genuinely independent substantial work.

## Economy

Prefer existing designs, contracts and available project evidence. Minimize
optional web research, competing designs, extra review passes and cosmetic
polish. Use inexpensive suitable workers for bounded routine changes, or work
directly when dispatch costs more than it saves. An established project is
not proof that a new change is low-risk.

Economy never waives required checks or accepts known serious defects.
Security, authorization, data integrity, compatibility and deployment gates
remain. High-risk logic stays with the main agent; if a needed review cannot
fit the selected budget, review directly with a disclosed fallback or report
blocked work. Do not silently buy a larger team or substitute an incapable
model. Reduced optional scrutiny must be stated, not sold as equal coverage.

## Large workloads are queues, not unlimited swarms

Schedule only ready independent units with exclusive write ownership. Keep
large task sets queued and process them in bounded waves. Hundreds of planned
units are different from hundreds of simultaneous models or processes.
Avoid shared-file contention and CPU, memory, API or deployment overload.
Pause/reassign workers only after their prior owners have stopped or finished.

Even explicit ceilings such as 100 workers / 1000 dispatches are requests,
not verified host capacity or an instruction to consume every slot.
This integration does not add a massive-swarm scheduler, worktree isolation
service, external orchestrator or recursive/factory dispatch. Do not launch a
factory or another AI CLI to manufacture missing capacity.

Report actual mode, models, worker counts, checks and limits; never promise
a speedup solely from a larger team. Changing the next task's mode does not
change already-running workers or ordinary unprefixed prompts.
