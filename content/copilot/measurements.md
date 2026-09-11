# Measuring Hydra on Copilot

## Native measurements first

Use the installed host's `/usage` for reported input/output/cached tokens and
AI credits (or legacy premium requests), and `/context` for current context
occupancy. Native `/statusline` can expose usage options supported by that host.
These controls are not Hydra replacements or new billing providers.

This package does not scrape private session logs, assume another host's JSONL
schema, enable telemetry or capture prompt contents. If native measurements are
unavailable, report them as unavailable. Never replace missing values with zero.

## Explicit local receipts

For repeatable calculations, the installed `scripts/hydra-usage.js` reads small
JSON run receipts supplied explicitly by the user. They contain measurement
values and comparison metadata, not prompts, source code or secrets.
The helper writes nothing and makes no network calls.

Run `node <skill-root>/scripts/hydra-usage.js template` to see the exact versioned
schema. Fill it with actual native measurements and a measured elapsed duration.
Null means not measured. The template is intentionally incomplete; it is not
evidence of a successful run. Save it only to a user-authorized local location.
Do not commit receipts automatically.

For a task in a session with cumulative counters, subtract the starting counters
from the final counters before recording the run. Include the main agent and
all workers. Set `includesSubagents` true only when the native source actually
covers them. If coverage is unknown, a comparison must not claim total savings.
Keep input, output and cached counts separate: do not add cached tokens to input
without a verified accounting definition. Credit units must match the native
source; do not turn plan credits or model-list prices into actual billed dollars.

`node <skill-root>/scripts/hydra-usage.js report <receipt.json>` validates and
summarizes one receipt. `compare <normal.json> <hydra.json>` compares two receipts.
These are imported measurements, not automatic task instrumentation. The helper
checks shape and declared comparability; it cannot independently prove that a
user's measurements, verification claim or environment label are correct.

## Fair comparison

Use separate clean runs from the same starting commit, task, environment and
main model with the same tools, permissions and acceptance criteria. Change
only the Hydra invocation/routing. Do not reuse the first run's modifications
or findings in the second. Record cold/warm cache and dependency differences
in your experiment design; keep the environment identifier equal only when
conditions are genuinely comparable.

Measure wall time from task submission through required final verification,
not the sum of overlapping worker times. Only compare runs that passed the
same acceptance criteria and include all workers. A quicker incomplete result
is not a saving. Repeat representative pairs and report medians, not a universal
claim from one run.

The comparison calculates `(normal - hydra) / normal * 100` for each available
metric. Negative results mean more consumption. A zero or unavailable baseline
does not produce a meaningful percentage. Different billing units cannot be
compared. Context snapshots are reported separately, not as cumulative token
savings; compaction can reduce occupancy after tokens have already been billed.

## What is not claimed

Claude's Hydra token-math script uses provider-specific logs and price tables.
Its all-frontier-model cost baseline is a counterfactual estimate, not an
observed second run. It is not a Copilot billing calculation and is not reused.

Some Copilot versions support opt-in local OpenTelemetry exports; consult
`copilot help monitoring`. This package does not enable exporters or claim
direct compatibility with an unverified export schema. Metadata-only collection
and explicit local destinations are preferable to capturing prompts. Any
enterprise telemetry integration remains governed by that host's permissions,
data coverage and retention rules, not by Hydra.
