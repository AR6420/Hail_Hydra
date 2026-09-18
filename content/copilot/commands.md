# Explicit Hydra utilities for Copilot

Arguments to the explicit-request `/hail-hydra` skill, not registered `/hydra:*` commands.

Interpret only the leading flags below; utilities are mutually exclusive.
Task modifiers `--mode`, `--max-agents`, `--max-dispatches`, `--quiet`, `--stfu` and `--notify` may combine before a goal; their effects end
with that invocation. `--` ends flag parsing. Unknown flags, missing required arguments or an empty modifier-only invocation get usage, without side effects.
Ordinary goals remain tasks, not management commands. Pass file arguments safely; never concatenate untrusted task text into shell code.

There is no persistent Hydra model. Honor a user's explicit request not to use Hydra, and do not carry modifiers into later turns.

## Execution mode and explicit limits

`/hail-hydra --mode turbo <goal>` / `--mode balanced` / `--mode economy`

Mode names are exactly `turbo`, `balanced` and `economy`; no mode means Balanced.
Read [the mode policy](hydra-modes.md) and resolve it with the control helper before dispatch.
A mode flag requires a goal; it does not set a persistent mode.
For an inspection without a coding task, use the helper's `mode [name]` command.

`/hail-hydra --mode turbo --max-agents 16 --max-dispatches 64 <goal>`

Limits are explicit requested ceilings, not host capacity. Pass them to `hydra-control.js mode turbo --max-agents 16 --max-dispatches 64`; require positive safe integers, concurrency never exceeding total dispatches.
Duplicate mode/limit flags, missing values or unsupported modes are errors before any task work starts; parse only before the first goal word or `--`.

The helper resolves policy only — it never starts agents, persists the mode or changes models.
Follow [context continuity](hydra-continuity.md) in every mode.

## Help and installation status

`/hail-hydra --help`

Run `node <skill-root>/scripts/hydra-control.js help` or display this guide; do not start subagents.

`/hail-hydra --status`

Run `node <skill-root>/scripts/hydra-control.js status`. It reports whether the installation is present, its version and owned-file count — checks version and owned files, not a live capability probe.
Use native `/skills info hail-hydra` to inspect discovery and `/skills reload` after an update; never silently choose another copy to turn a failed status into success.

## Statistics, comparison and context

`/hail-hydra --stats` uses native `/usage` and `/context`; if unavailable, tell the user which commands to run rather than inventing values.

`/hail-hydra --stats <receipt.json>` reports an explicitly supplied run receipt.
`/hail-hydra --compare <normal.json> <hydra.json>` compares compatible receipts.
Read [the measurement guide](hydra-measurements.md) before either operation.

`/hail-hydra --context` explains the native `/context` view; occupancy is not cumulative usage.
Do not compact, clear the session or change its model without authorization.

## Preflight and guard

`/hail-hydra --preflight`

Two sequential phases: `hydra-preflight` inventories project-relevant runtimes and environment-variable presence; `hydra-analyst` then evaluates that inventory against declared requirements, within the same budget.
Keep confirmed failures, known risks and unverified combinations distinct.
Never report compatibility solely because a probe ran, or install dependencies, inspect secret values or contact services without task authorization.

`/hail-hydra --guard [files]`

Inspect a stable diff or the specified files with the appropriate native reviewer and Hydra role instructions. Check actual findings, not just role reports.
Significant changes also need `hydra-sentinel-scan`, escalating concrete findings to `hydra-sentinel`.
Copilot hooks are deferred until upstream hook reliability bugs are fixed; quality gates and `--notify` run in-task/manually for now.
Hydra coding tasks already apply [automatic quality review](hydra-quality.md) without this utility.

## Codebase map

`/hail-hydra --map` shows a summary. `/hail-hydra --map <file>` shows its dependent paths. `/hail-hydra --map rebuild` explicitly authorizes a rebuild.

Default map: `.github/hydra/codebase-map.json`; use `node <skill-root>/scripts/hydra-control.js map <map.json> [file]`.
Missing or invalid maps are errors, not empty healthy projects.
Compare its recorded commit with current HEAD and uncommitted changes before relying on it. Matching HEAD alone is not proof of freshness.

For a rebuild, give `hydra-scout` only the map's write scope. Exclude generated, dependency, credential and secret files; record environment-variable names from source declarations, never `.env` contents or values.

## Quiet output and concise workers

`/hail-hydra --quiet <goal>` suppresses Hydra's final dispatch roster, not errors, required approvals or host-native tool activity.

`/hail-hydra --stfu <goal>` asks dispatched workers for concise final findings, exact symbols/paths and necessary evidence, without redundant narration or reduced reasoning quality.

## Memory

`/hail-hydra --memory` explains native memory controls; `/memory` and `/resume` are not shared live worker memory.

An explicit request to remember a project fact uses available host memory tools under their consent, scope and privacy rules — never secrets or personal data.
If no suitable mechanism exists, disclose it rather than silently writing `CLAUDE.md` or global instructions.

## Updates and issue reports

`/hail-hydra --update` checks the public npm registry using `node <skill-root>/scripts/hydra-control.js check-update`. Report installed/latest versions and failures.
Never downgrade an unreleased preview to an older stable release.
Install only a verified newer version, using the existing installer and scope.

`/hail-hydra --report [bug|feature|feedback]` shows official issue-template links via the control helper's `report` command.
Do not submit an issue or upload logs, code or private task context unless explicitly authorized.

## Completion notification

`/hail-hydra --notify <goal>` runs `node <skill-root>/scripts/hydra-control.js notify success|failure` once, manually, since Copilot hooks are deferred (see Preflight and guard).
No player process or always-on notification is installed.

## Requested build and deployment

Use the project's existing build/release commands; finish local work and required gates before an explicitly requested deployment.
A generic "deploy" is not permission to guess production or run destructive migrations.
Ask if the target or authority is unclear; establish the authorized account, target, artifact and recovery procedure.

Confirm the artifact reached its target and run the documented health check.
Do not claim success from an exit code alone or loop deployments.
