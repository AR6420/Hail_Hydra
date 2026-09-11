# Explicit Hydra utilities for Copilot

These are arguments to the explicit-request `/hail-hydra` skill, not registered
`/hydra:*` commands or replacements for native CLI commands. Use the
loaded skill directory to resolve `scripts/` and `references/`; do not assume
the working project is the Hydra source checkout.

Interpret only the leading flags below. Utilities are mutually exclusive.
`--quiet`, `--stfu` and `--notify` may combine before a goal; their effects end
with that invocation. `--` ends flag parsing. Unknown flags, missing required
arguments or an empty modifier-only invocation get usage, without side effects.
Ordinary goals, including "update the README", remain tasks rather than
management commands. Pass file arguments safely using native tool syntax,
never concatenate untrusted task text into executable shell code.

There is no persistent Hydra model mode. For normal routing, honor the user's
explicit request not to use Hydra and do not carry modifiers into later turns.
Native `/skills` can disable future loading; it does not erase injected history.
Do not claim a bare skill selection proves that a separate task was routed
through Hydra. Prefer the skill reference and goal in the same user input;
use `/new` only if the user chooses a clean conversation boundary.

## Help and installation status

`/hail-hydra --help`

Run `node <skill-root>/scripts/hydra-control.js help` or display this guide.
Show supported utilities and native equivalents; do not start subagents.

`/hail-hydra --status`

Run `node <skill-root>/scripts/hydra-control.js status`. This checks the loaded
installation's version, activation policy, catalogue and owned files. Report
errors or missing files explicitly. It does not prove the host loaded the
latest copy or supports a particular model. Use native `/skills info hail-hydra`
to inspect discovery and `/skills reload` after an update. Report local and
personal copies separately if the user asks; never silently choose another
copy to turn a failed status into success.

Compatibility builds report `activationPolicy: explicit-request-instructions`,
`activationManualOnly: false` and `modelInvocationAllowed: true`. This avoids
hosts that exclude manual-only skills from their model-callable registry even
for explicit requests. The current user input, not automatic skill selection
or past context, must authorize Hydra work. This is not host-enforced prevention
of automatic loading and does not change the main session model.

## Statistics, comparison and context

`/hail-hydra --stats` uses native `/usage` and `/context` as the authoritative
interactive views. If those views are not callable by the agent, tell the user
which commands to run; do not claim to have executed them or invent their values.

`/hail-hydra --stats <receipt.json>` reports an explicitly supplied run receipt.
`/hail-hydra --compare <normal.json> <hydra.json>` compares compatible receipts.
Read [the measurement guide](hydra-measurements.md) before either operation.
Use the installed `hydra-usage.js` helper, not Claude's token-math parser.

`/hail-hydra --context` explains the native `/context` view and targeted context
handoffs. Context occupancy is not cumulative usage or a measure of all workers.
Do not compact or clear the session, or change its model, without authorization.
Native `/statusline` can display usage where supported; never overwrite a user's
statusline configuration. Check the current host's help rather than assuming
all native UI options exist in every version or shell.

## Preflight and guard

`/hail-hydra --preflight`

Use two sequential phases: the Copilot `hydra-preflight` role inventories only
project-relevant runtimes, tools and environment-variable presence, then
`hydra-analyst` evaluates that inventory against declared requirements and
verified compatibility evidence. Reuse valid context or work directly where
delegation does not repay overhead. Both phases count against the same budget.
Keep confirmed failures, known risks and unverified combinations distinct.
Never report compatibility solely because a probe ran, or install dependencies,
inspect secret values or contact services without task authorization.

`/hail-hydra --guard [files]`

Inspect a stable diff or the specified files with the appropriate exposed native
reviewer and Hydra role instructions. Follow any host-required specialist routing.
Check actual findings rather than merely repeating role reports. Significant
code changes also need integration checks; use `hydra-sentinel-scan`, escalating
concrete findings to `hydra-sentinel` only if useful. This explicit review does
not authorize edits. No global post-edit hook is installed: ordinary prompts
retain native behavior, while invoked Hydra tasks follow in-task verification.
Hydra coding tasks already apply [automatic quality review](hydra-quality.md)
without this utility. The flag is for a separate explicitly requested review,
not a prerequisite for reviewing implementation work.

## Codebase map

`/hail-hydra --map` shows a map summary.
`/hail-hydra --map <project-relative-file>` shows its dependent paths.
`/hail-hydra --map rebuild` explicitly authorizes rebuilding the project's map.

The default map is `.github/hydra/codebase-map.json`. For summary/blast radius,
use `node <skill-root>/scripts/hydra-control.js map <map.json> [file]`.
Missing or invalid maps are errors, not empty healthy projects.

Before relying on the map, compare its recorded commit with current HEAD and
inspect relevant uncommitted/untracked changes. Matching HEAD alone is not proof
of freshness. The helper does not run git; label freshness unverified until the
main agent checks. Follow current source when map and source disagree.

For an explicit rebuild, give `hydra-scout` only the map's write scope. Reuse its
canonical graph schema and import/reverse-import relationships. Exclude generated,
dependency, credential and secret files; record environment-variable names from
source declarations, never `.env` contents or values. Respect content exclusions.
Do not modify source, `.gitignore` or user settings without separate authorization.
If map generation is too large for the remaining budget, mark coverage partial
with skipped paths and explain the limit rather than claiming a complete index.
Keep `_meta.coverage` as `complete` or `partial`; record unknown import resolution.
Graph-based risk and test-file relationships are heuristics, not measured test
coverage or exhaustive dynamic call graphs. Cycles must not count a file as its
own dependent. Verify the written artifact before reporting a successful rebuild.

## Quiet output and concise workers

`/hail-hydra --quiet <goal>` suppresses Hydra's final dispatch roster, not errors,
required approvals or host-native tool activity. It does not silence ordinary
prompts or hide incomplete work.

`/hail-hydra --stfu <goal>` asks dispatched workers for concise final findings,
exact symbols/paths and necessary evidence without redundant narration.
Preserve required reasoning quality and output fields. Do not claim to control
hidden reasoning tokens or guarantee billing savings. This is not a global
interceptor for every host subagent.

## Memory

`/hail-hydra --memory` explains the native memory controls and current capability
availability. Native `/memory` manages host memory; `/resume` and the current
conversation serve a different purpose. Do not treat any of them as shared live
worker memory or unlimited recall.

An explicit request to remember a project fact uses available host memory tools
and their consent, scope and privacy rules. Store only supported durable facts,
never secrets or sensitive personal data. If the host has no suitable memory
mechanism, disclose it; do not silently write `CLAUDE.md`, global instructions
or agent-memory files. Maps and session task ledgers are not persistent memory.

## Updates and issue reports

`/hail-hydra --update` explicitly permits checking the public npm registry using
`node <skill-root>/scripts/hydra-control.js check-update`. Report installed/latest
versions and failures. Never downgrade an unreleased preview to an older stable
release. An equal version is not proof that a source preview matches a release.
Only install a verified newer published version using the existing installer
and the same scope/configuration; preserve user changes and permissions.
Do not guess an account, source branch or preview update channel. After updating,
inspect the payload and have the user reload skills. No background update poller
is enabled by default.

`/hail-hydra --report [bug|feature|feedback]` uses the control helper's `report`
command to show official issue-template links. Do not submit an issue or upload
logs, code, receipts or private task context unless explicitly authorized.

## Completion notification

`/hail-hydra --notify <goal>` permits one terminal bell after this task finishes,
using `node <skill-root>/scripts/hydra-control.js notify success` or `failure`
according to the actual outcome. A failed or blocked task must not signal success.
Terminal settings may mute the bell; never claim it was heard. No player process,
host hook, watcher or always-on notification setting is installed.

## Requested build and deployment

Use the existing project's build/release commands; finish local work and required
gates before an explicitly requested deployment, not every speculative candidate.
A generic "deploy" is not permission to guess production, provision billable
infrastructure or run destructive migrations. Ask if the target or authority is unclear.
Establish the authorized account, target, artifact and recovery procedure.
Existing permissions/approvals still apply; never change authentication.
Serialize releases under the main agent. Confirm the artifact reached its target
and run the documented health/smoke check. Use only authorized recovery.
Report failures and completed builds separately from blocked releases.
Do not claim success from an exit code alone or loop deployments.
