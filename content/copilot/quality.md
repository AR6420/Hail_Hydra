# Automatic in-task quality review

Apply this policy to Hydra coding tasks without waiting for the user to ask
for review, name a reviewer or request quality evidence. The selected main
agent owns the outcome; inexpensive implementation is not proof of correctness.
This is an instruction-driven gate inside an invoked task, not a background
monitor, host hook or guarantee that every defect will be found.

## Plan the checks with the work

Derive acceptance criteria, affected interfaces and required checks from the
goal, project rules and actual change. Identify risk early: authorization,
data integrity, public API contracts, concurrency, migrations, release paths
and broad cross-file behavior require more scrutiny than an isolated edit.
Reserve review capacity inside the existing dispatch budget before assigning
all slots to writers. Do not add another budget or lower the bar when it runs out.

For a trivial isolated change, inspect the diff and run the relevant existing
check directly. Documentation-only work needs its applicable documentation
checks, not unnecessary test runs or a team of reviewers.

For substantial code changes, automatically obtain an independent review of
the stable diff using a suitable native reviewer with focused Hydra analysis
instructions. Do not ask the user to pick the role. Select a capable available
model for complex logic; a cheap pattern scan alone is not a deep review.
If native review/dispatch is unavailable or the budget is exhausted, perform
a separate main-agent review pass, disclose that fallback, and retain all
required checks. Never describe self-review as independent review.

## Review and execution

Use `hydra-guard` for common quality/security patterns and
`hydra-sentinel-scan` for imports, signatures, routes and consumers.
Escalate concrete integration or logic concerns to `hydra-sentinel` or
`hydra-analyst`; obey host-required specialist routing for explicit audits.
Select only useful checks, not every role. Existing authoritative review
evidence can be reused when the reviewed scope has not changed.

Run the smallest relevant existing tests, build and type checks, directly or
through `hydra-runner`. Add regression coverage for changed behavior when the
project has an applicable test mechanism. Tests and independent reviews can
run in parallel on the same stable changeset after affected writers finish.
Any later edit invalidates the affected evidence: re-review and recheck it.
Verify application behavior where feasible, not just file presence, an agent's
summary or a successful command unrelated to the requirement.

For performance changes, use representative before/after measurements and
check correctness under failure and load conditions relevant to the change.
Do not invent a speedup or run load tests against live services without
authorization. Deployment still requires the separate release permissions,
gates and post-deployment artifact/health evidence.

## Completion gate

Do not declare the task complete or deploy while required checks fail,
required behavior is unverified, or confirmed serious findings remain
unresolved. Confirm and address critical/high-severity correctness, security,
data-loss and integration issues. A quick guard's advisory report is input
to this gate, never permission to ignore a delivery blocker.

Distinguish introduced failures from demonstrated pre-existing or unrelated
failures; explain their scope instead of hiding them or changing unrelated
code. Missing tools, credentials, test infrastructure or review coverage
must be explicit. Do not silently treat a skipped required check as passed.
An incomplete scan is unverified coverage, not a clean result.
Within the existing two improvement rounds, fix findings and recheck affected
behavior. If required work remains, report blocked/incomplete rather than
lowering criteria, disabling checks or running indefinitely.

## Automatic evidence in the final answer

Include a concise quality summary without a separate user request:

`Quality: <reviewer role/model or direct review>; <actual checks/results>;
<remaining findings or unverified scope>; <passed/blocked/incomplete>.`

Reference actual tool results and the reviewed scope. State that no serious
findings were identified within that scope only when supported; do not promise
zero defects. Quiet/concise-output modifiers may shorten this summary but
must not suppress failures, missing checks or the quality outcome.
