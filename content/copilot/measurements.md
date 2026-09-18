# Measuring Hydra on Copilot

## Native measurements first

Use the installed host's `/usage` for reported input/output/cached tokens
and AI credits (or legacy premium requests), and `/context` for current
context occupancy. If native measurements are unavailable, report them as
unavailable — never replace missing values with zero.

## Explicit local receipts

The installed `scripts/hydra-usage.js` reads small JSON run receipts
supplied explicitly by the user; it writes nothing and makes no network
calls. Run `node <skill-root>/scripts/hydra-usage.js template` for the
versioned schema; null means not measured.

For a session with cumulative counters, subtract the starting counters from
the final counters, including the main agent and all workers. Set
`includesSubagents` true only when the native source actually covers them.

`node <skill-root>/scripts/hydra-usage.js report <receipt.json>` validates
and summarizes one receipt. `compare <normal.json> <hydra.json>` compares
two receipts against each other, not against a proof of correctness.

## A/B procedure

1. Same commit, clean tree, same main model; start a fresh session (`/new`).
2. Record `/usage` and wall clock, run the task normally, record `/usage`
   and wall clock again.
3. Reset to the same starting commit and session state.
4. Run the same task through `/hail-hydra`, recording `/usage` and wall
   clock the same way.
5. Confirm both runs passed the same acceptance checks; set
   `includesSubagents` true only if the source covers all workers.
6. Build a receipt for each run and compare with
   `hydra-usage.js compare normal.json hydra.json`.
7. Repeat for at least 3 pairs and report the median, not a single run.

## Fair comparison

Use separate clean runs from the same starting commit, task, environment and
main model with the same tools, permissions and acceptance criteria. Do not
reuse the first run's modifications or findings in the second. A quicker
incomplete result is not a saving.

The comparison calculates `(normal - hydra) / normal * 100` for each
available metric. Negative results mean more consumption. A zero or
unavailable baseline does not produce a meaningful percentage. Context
snapshots are reported separately, not as cumulative token savings.

## What is not claimed

Claude's Hydra token-math script uses provider-specific logs and price
tables; its all-frontier-model cost baseline is a counterfactual estimate,
not an observed second run, and not a Copilot billing calculation.

Some Copilot versions support opt-in local OpenTelemetry exports; consult
`copilot help monitoring`. This package does not enable exporters.
