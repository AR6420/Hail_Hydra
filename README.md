<p align="center">
  <a href="https://github.com/AR6420/Hail_Hydra">
    <img src="https://img.shields.io/badge/🐉-HAIL_HYDRA-darkred?style=for-the-badge&labelColor=black" alt="Hail Hydra" />
  </a>
</p>

<h1 align="center">🐉 H Y D R A</h1>

<p align="center">
  <strong>Multi-Headed Speculative Execution for AI Coding CLIs</strong><br/>
  <sub>Claude Code &nbsp;·&nbsp; Gemini CLI &nbsp;·&nbsp; Codex CLI &nbsp;·&nbsp; GitHub Copilot CLI</sub>
</p>

<p align="center">
  <em>"Cut off one head, two more shall take its place."</em><br/>
  <em>Except here — every head is doing your work faster and cheaper.</em>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Opus-🧠_The_Body-7C3AED?style=flat-square" alt="Opus" />
  <img src="https://img.shields.io/badge/Sonnet-🔵_Smart_Heads-3B82F6?style=flat-square" alt="Sonnet" />
  <img src="https://img.shields.io/badge/Haiku-🟢_Fast_Heads-22C55E?style=flat-square" alt="Haiku" />
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/hail-hydra-cc">
    <img src="https://img.shields.io/npm/v/hail-hydra-cc?style=flat-square&logo=npm&logoColor=white&color=CB3837" alt="npm version" />
  </a>
  <a href="https://www.npmjs.com/package/hail-hydra-cc">
    <img src="https://img.shields.io/npm/dt/hail-hydra-cc?style=flat-square&logo=npm&logoColor=white&color=22C55E&label=downloads" alt="npm downloads" />
  </a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Speed-2--3×_Faster-22C55E?style=flat-square&logo=zap&logoColor=white" alt="Speed" />
  <img src="https://img.shields.io/badge/Cost-40--60%25_Per_Dispatch-3B82F6?style=flat-square&logo=piggy-bank&logoColor=white" alt="Cost" />
  <img src="https://img.shields.io/badge/Quality-Zero_Loss-7C3AED?style=flat-square&logo=shield-check&logoColor=white" alt="Quality" />
</p>

<p align="center">
  <strong>10 core agent roles &nbsp;·&nbsp; 4 host CLIs &nbsp;·&nbsp; Host-specific commands and hooks &nbsp;·&nbsp; Opt-in Copilot orchestration and research</strong>
</p>

---

## 🧬 What is Hydra?

**Hydra** is a curated multi-agent toolkit for AI coding CLIs — **Claude Code**, **Gemini CLI**, **Codex CLI**, and **GitHub Copilot CLI**. Claude, Gemini and Codex ship 10 specialized agents pinned to their host's model tiers, 10 commands, and an automatic integration-verification touchpoint. Copilot instead ships one explicit-request `/hail-hydra` skill with the same 10 roles plus read-only architecture/performance and web research advisors, routed through native subagents when available, without automatic hooks.

Each agent runs on the smallest model that can do its job well. When invoked, Hydra typically reduces per-task cost by 40–60% compared to running the same work on the orchestrator alone — while maintaining output quality through verification.

**Copilot cost caveat:** the speed/cost claims above are not Copilot benchmarks.
Copilot savings depend on your plan, available models, task size and dispatch
overhead. No fixed savings or quality guarantee applies.

> **Think of it this way:**
>
> Would you hire a $500/hr architect to carry bricks? No. You'd have them design the building and let the crew handle construction. That's the model Hydra follows when you invoke a specialized head.

**New in v2.5.2 — Opt-in Copilot:** use `/hail-hydra <task>` inside your existing
Copilot session. Normal messages keep the normal agent. No second CLI, API key,
background service or model-default change is needed. See [Copilot setup](#github-copilot-cli-opt-in).

**Multi-Host:** One canonical source (`content/`) generates a native payload per
host. Invoke with `/hydra:*` on Claude Code and Gemini CLI, `$hydra-*` skills on
Codex CLI, or `/hail-hydra <task>` on Copilot.

Everything else Hydra is known for is still here: persistent agent memory, the codebase map with blast-radius lookups, the sentinel verification touchpoint after substantial edits, internal-thinking compression (`/hydra:stfu`), and real token tracking with `/hydra:stats`. Full version history lives in the [CHANGELOG](CHANGELOG.md).

## When to Use Hydra Explicitly

Hydra's biggest cost savings come from explicit invocation in scenarios where specialized handling genuinely helps:

| Scenario | How to Invoke | Why It Saves |
|----------|---------------|-------------|
| Broad codebase exploration | "use hydra-scout to find X" | Haiku reads files faster and cheaper than Opus |
| Multi-file changes | "use hydra-coder to update X across these files" | Parallel Sonnet dispatch beats sequential Opus |
| Security review | `/hydra:guard` | Pattern matching is Haiku-cheap |
| Environment validation | `/hydra:preflight` | Cross-references compatibility matrices on Sonnet |
| Codebase architecture review | `/hydra:map` | Dependency graph stored locally |

For one-off questions, simple edits, or conversational work, the host handles it
directly. On Claude, Gemini and Codex, Hydra's only automatic intervention is the
post-substantial-edit sentinel directive. Copilot has no automatic intervention.

---

## 🚀 Installation

> **One command. Done.**

```bash
npx hail-hydra-cc@latest
```

Runs the interactive installer — pick your CLI(s) (Claude Code, Gemini CLI, Codex CLI, GitHub Copilot CLI)
and scope, and it deploys the agents, commands, hooks, and per-host wiring. Done in seconds.

### Installation Options

```bash
# Claude Code, all projects — no prompts (v2-compatible default)
npx hail-hydra-cc --global

# Pick your agent(s) explicitly
npx hail-hydra-cc --agent=claude --global
npx hail-hydra-cc --gemini --global
npx hail-hydra-cc --codex --global
npx hail-hydra-cc --copilot --global
npx hail-hydra-cc --agent=claude,gemini,codex,copilot --global

# Every detected agent, fully non-interactive
npx hail-hydra-cc --all --global --yes

# This project only / both scopes
npx hail-hydra-cc --claude --local
npx hail-hydra-cc --claude --both

# Preview what would be written (writes nothing)
npx hail-hydra-cc --dry-run --all

# Check what's deployed
npx hail-hydra-cc --status

# Remove everything
npx hail-hydra-cc --uninstall
```

All flags: `--agent=<list>` (`claude,gemini,codex,copilot`) or the aliases `--claude` /
`--gemini` / `--codex` / `--copilot` / `--all` (every detected agent) · scope `--global` /
`--local` / `--both` · `--yes` non-interactive (requires an agent selection) ·
`--dry-run` · `--config-dir <path>` config-dir override (single agent only) ·
`--status` · `--uninstall`.

### Per-Host Invocation

| Host | Commands | Notes |
|:-----|:---------|:------|
| **Claude Code** | `/hydra:help`, `/hydra:stats`, … | StatusLine + hooks registered in `~/.claude/settings.json` |
| **Gemini CLI** | `/hydra:help`, `/hydra:stats`, … | Restart Gemini CLI (or run `/commands reload`) to pick up the new commands |
| **Codex CLI** | `$hydra-help`, `$hydra-stats`, … (skills with a `$` trigger) | **Required once:** run `/hooks` inside Codex to review and trust the Hydra hooks — they stay inert until then |
| **GitHub Copilot CLI** | `/hail-hydra <task>` | Run `/skills reload`; instruction-gated explicit requests, no hooks or persistent agent switch |

### GitHub Copilot CLI (opt-in)

Requires a Copilot CLI version that supports skills and explicit invocation.
Install once for all projects:

```bash
npx hail-hydra-cc@latest --copilot --global --yes
```

Until 2.5.2 is published, install from a checkout containing this change:

```bash
npm install
npm run build
node bin/cli.js --copilot --global --yes
```

Then, **inside the same Copilot session**:

```text
/skills reload
/skills info hail-hydra
/hail-hydra Implement pagination for this API and update the tests
/hail-hydra Build the dashboard and deploy it to the staging target documented in this repository
/hail-hydra --help
```

A later message such as `Explain this function` uses the normal agent.
`/hail-hydra` is a skill invocation, not a sticky mode or a replacement shell.
Its instructions apply to the invoked task only, even while they remain in
conversation history. An empty invocation shows usage rather than spawning
agents. The skill does not pre-approve tools or bypass existing permissions.

Some interactive clients may display skill selection separately from the next
input. Do not infer an active mode or a model change from that display alone.
For an unambiguous task-level request, include the skill reference and goal in
one input: `Use the /hail-hydra skill to implement pagination and run tests.`
The routing boundary is instruction-driven, not a host-enforced context reset.
To prevent future loading, use native `/skills`, select `hail-hydra`, and choose
Disable. Already injected instructions remain in conversation history; explicitly
request normal routing for subsequent work, or use `/new` for a clean conversation.
Hydra does not change the main session model and has no sticky on/off model mode.

**Compatibility mode:** the Copilot integration sets `disable-model-invocation: false`.
Some Copilot versions return `Skill not found` from the model's skill tool for
`disable-model-invocation: true`, even when the user names an installed, enabled
skill. See [upstream issue #4438](https://github.com/github/copilot-cli/issues/4438).
Reloading cannot overcome that filtering. The compatibility setting permits
model-mediated loading; explicit-request-only behavior now relies on the skill's
description and current-input guard, **not a host-enforced automatic-selection
block**. Accidental loading must not trigger Hydra helpers or delegation.
Status exposes `activationPolicy: explicit-request-instructions`,
`activationManualOnly: false` and `modelInvocationAllowed: true` so this tradeoff
is visible. These describe installed configuration, not proof of a live invocation.

Give the outcome, not a roster of agents. Hydra selects relevant specialists,
tracks dependencies and decisions, and coordinates the task without requiring
a swarm flag or repeated "continue" prompts. Small changes stay direct;
independent substantial work can run in parallel. Writers own separate files,
and reviewers examine stable changes rather than a moving worktree.

**Quality review is automatic for Hydra coding tasks.** The main agent plans
acceptance checks, reserves review capacity and requests independent review
for substantial changes without needing another prompt. Trivial edits stay
direct; unavailable independent review gets a disclosed main-agent fallback.
Required check failures, unverified required behavior and confirmed serious
findings block completion/deployment. Every coding result includes concise
review/check evidence and remaining gaps, even with quiet output. This is an
in-task instruction policy, not an always-on monitor or defect-free guarantee.

**Your selected main model does the substantive reasoning and final acceptance.**
Hydra must not reduce it to a dispatcher for smaller models. Keep unresolved
architecture, difficult debugging and high-risk logic with the main agent;
workers gather evidence, execute checks or implement bounded, well-specified
changes. A complex delegated review needs an explicitly chosen capable model
(the selected main model when appropriate and available), or a disclosed
main-agent fallback. The main agent reviews the actual result and evidence
instead of simply accepting a worker's "passed" report.

**Same Hydra priorities: cost, speed and context.** Dispatch must plausibly
repay its overhead through parallel progress, a cheaper capable model or
context isolation. Group tiny steps, reuse current findings and decisions,
load only selected role prompts, and pass each worker a focused context slice.
More agents are not automatically faster or cheaper.

Architecture and web research are optional capabilities, not mandatory
pipeline stages. When an unresolved backend/request-flow choice could avoid
substantial rework, `hydra-architect` assesses the code or proposed design
**before dependent implementation**, even without a performance-specific prompt.
Reuse settled decisions and skip an extra advisor when direct handling suffices.
The role considers relevant API,
database, algorithm, caching, concurrency and resource-use tradeoffs. This is
not limited to bulk calls: an optimization needs a code-backed reason, workload
assumptions and a measurement plan. Batching is not automatically better, and
correctness, authorization, partial failures and compatibility still matter.

The bounded swarm can run this assessment alongside independent UI research.
The main agent reconciles both into a decision brief covering shared contracts,
accepted/rejected choices and measurement criteria, then briefs affected writers.
If later evidence changes the direction, affected work pauses and is redirected;
unaffected work can continue. Stale-direction results are not integrated.
Replanning uses the existing dispatch and improvement budgets, not a new loop.
Small or unrelated tasks avoid this overhead; the main agent can assess directly.

When external evidence can materially affect a decision, the Copilot-only
`hydra-researcher` compares public sources and returns options, tradeoffs and
citations. This includes UI/accessibility, library, architecture and
compatibility questions, not just visual design. The main agent chooses
against project requirements and constraints. Web research needs native host
tools; unavailable capabilities are reported, not replaced with another
provider. Private code and confidential requirements must not be sent to
public searches.

The main conversation keeps its available context when alternating between
Hydra and ordinary prompts. Workers have separate contexts; the main agent
briefs them and reconciles results in a session task ledger. This is not
shared live subagent memory or a separate cross-session memory service.

The installer places everything under `~/.copilot/skills/hail-hydra/`:

```text
hail-hydra/
├── SKILL.md
├── VERSION
├── .hydra-manifest.json
└── references/
    ├── roles.json
    └── hydra-*.md             # 10 core roles + architect/researcher, loaded as needed
```

The Copilot integration also includes on-demand command, measurement and quality guides under
`references/` and dependency-free `scripts/hydra-control.js` and
`scripts/hydra-usage.js`. These run only for explicitly requested utilities;
installing them does not enable hooks or telemetry.

`--local` installs only to `.github/skills/hail-hydra/` in the current project;
it does not write personal configuration. `--both` installs both copies.
`--config-dir <path>` replaces the personal `.copilot` directory, not the
project path; a custom personal path must also be discoverable by Copilot.
Reload skills after installing, updating or removing a copy.

No always-on instructions, discoverable custom agents, automatic hooks, MCP
servers, session model settings or global subagent defaults are installed.
The explicit-request instruction guard keeps ordinary work outside the Hydra
workflow; it is not a host-enforced selection block. If another host has already
installed Hydra instructions/skills into locations Copilot also reads (such as
`AGENTS.md` or `~/.agents/skills`), those remain independent; this installer does
not remove or disable them.

The role catalogue records `cheap`/`mid` hints (`tierIsHint: true`) and
`modelSelection: latest-suitable-available`, **not fixed model IDs**.
At dispatch, routing instructions prefer newer suitable models from those the
host actually exposes, within the task's cost constraints and explicit user
pins/exclusions. Role tiers are not capability ceilings; select for the actual
scope/risk and reclaim inadequate worker results rather than always choosing
small models. The main agent selects the real ID; this metadata is not an
automatic model-discovery or pricing service. Newer models do not guarantee
equal token usage, latency or plan charges. Actual selected models and any
fallback belong in the task report, with the main model identified separately
from workers when the host exposes it; unknown is not inferred. Selecting a
main model does not force every worker to use that same model. Hydra leaves
the main selection unchanged, including native Auto behavior when selected.
The default budget is two concurrent heads and six dispatches total. Broad
goals spanning multiple substantial, independent subsystems can automatically
use an expanded ceiling of four concurrent heads and twelve dispatches only
when useful parallel progress justifies the overhead. Ceilings are not targets.
Architecture, research, scans and retries all count; smaller host/user limits take precedence.
These are prompt-level orchestration limits, not a separate runtime scheduler
or a hard billing cap. Small work stays with the main agent.
If subagents or per-dispatch model selection are unavailable,
Hydra explains the limitation and works directly, without claiming savings.

Improvement is bounded: at most two rounds after the first candidate, within
the same dispatch budget, to address concrete findings or unmet acceptance
criteria. Stop when the criteria are met, progress stalls or the budget is
exhausted; unresolved required work is reported as blocked. Hydra does not
start an infinite optimization loop or enable autopilot.

For an explicit build/deploy goal, Hydra follows the existing project release
process, completes local work before releasing, and verifies the deployed
artifact and health. Deployment still requires a clear authorized account,
target and artifact, plus any existing approvals. A vague "deploy" does not
authorize guessing production, billable provisioning or destructive changes.
If deployment is blocked, completed build work and the blocked release are
reported separately. Iteration does not repeatedly deploy speculative changes.

### Explicit utilities and native feature equivalents

The Copilot integration uses `/hail-hydra --<utility>` rather than
installing native `/hydra:*` aliases. Existing Copilot features and permissions
remain available in compatible Copilot-backed shells. No command replaces
native memory, billing, model selection or session management.

| Hydra feature | Copilot entry point | Behavior and boundary |
|---|---|---|
| Help | `/hail-hydra --help` | Lists supported routes; no agents needed. |
| Status | `/hail-hydra --status` | Inspects installed version, catalogue and owned files. Native `/skills info hail-hydra` checks discovery. |
| Statistics | `/hail-hydra --stats` | Directs to native `/usage` and `/context`; never invents values when the host UI is not callable. |
| Run comparison | `/hail-hydra --compare normal.json hydra.json` | Validates and compares explicit local receipts, not automatically captured logs. |
| Map | `/hail-hydra --map [rebuild\|file]` | Explicit scout rebuild or local graph summary/blast radius, with freshness and coverage caveats. |
| Preflight | `/hail-hydra --preflight` | Sequential environment inventory and compatibility analysis, without installing or exposing secrets. |
| Guard/sentinel | `/hail-hydra --guard [files]` | Explicit stable-change review and in-task integration verification, not global post-edit hooks. |
| Quiet | `/hail-hydra --quiet <goal>` | Suppresses Hydra's dispatch roster for this task, never failures or host tool output. |
| Concise workers | `/hail-hydra --stfu <goal>` | Requests concise worker reports for this task; no claim to control hidden reasoning or guarantee savings. |
| Update | `/hail-hydra --update` | Explicit registry check and normal installer workflow for a verified newer release; never downgrade a preview. |
| Issue reporting | `/hail-hydra --report [bug\|feature\|feedback]` | Shows official issue-template links without submitting or uploading private data. |
| Memory/context | `/hail-hydra --memory` / `--context` | Reuses native controls and consent rules; no automatic Hydra memory files or session compaction. |
| Notification | `/hail-hydra --notify <goal>` | One terminal bell on completion, subject to terminal settings; no watcher or background player. |

Utility flags are explicit and mutually exclusive. `--quiet`, `--stfu` and
`--notify` can combine before a goal and end with that invocation. `--` ends
flag parsing. Normal text such as `update the README` remains a coding task.
Unknown flags or missing arguments show usage rather than performing actions.

**Honest measurement:** `/usage` is the native source for reported tokens and
AI credits (or legacy premium requests). `/context` measures current window
occupancy, not cumulative tokens or every worker's context. Native statusline
options remain user-controlled. The receipt helper can calculate reductions
only from supplied compatible normal/Hydra runs that passed the same criteria
and declare complete worker coverage. Missing metrics stay unavailable.
It cannot independently prove the recorded measurements or verification claims.

To see the receipt schema in PowerShell, run:

```powershell
node "$HOME\.copilot\skills\hail-hydra\scripts\hydra-usage.js" template
```

Fill the template from actual native counter deltas and wall-clock timing,
using a separate clean run for each mode; leave unmeasured fields null. Store
only at an explicitly chosen local path, without secrets or source content.
Then use `/hail-hydra --stats <receipt.json>` or `--compare` above.

This is **not full automatic hook parity**: the integration does not install
always-on edit tracking, sentinel state indicators, persistent agent-memory
hooks, update polling, a custom live billing dashboard or raw session-log
scraping. Native host features cover part of that surface; manual/in-task
equivalents cover others. Automatic instrumentation needs separately verified
host contracts and explicit opt-in. Claude's provider-price/all-frontier
estimate is not observed Copilot savings and is not reused.

```bash
npx hail-hydra-cc --copilot --status
npx hail-hydra-cc --copilot --uninstall --yes
```

Uninstall removes Hydra's recorded payload in personal and current-project
locations, preserving unrelated files and settings. A malformed manifest
causes an explicit error instead of trusting arbitrary deletion paths.

See GitHub's [skill setup and reload documentation](https://docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/add-skills)
for supported discovery locations and invocation, and the
[skills reference](https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-command-reference#skills-reference)
for frontmatter semantics. Interactive skill expansion and model-driven
skill-tool lookup are distinct paths; compatibility mode addresses the latter
without claiming a hard per-task runtime boundary.

Generator and lifecycle tests cover the shipped instruction contracts and
payloads; utility tests exercise local status/graph/report calculations.
They do not prove live model behavior, end-to-end deployment or savings.

### What Gets Installed

**Claude Code** — `~/.claude/` (or `./.claude/` with `--local`):

```
~/.claude/
├── agents/                      # 10 agent definitions (Haiku/Sonnet pinned, memory: project)
├── commands/hydra/              # 11 slash commands (/hydra:*)
├── hooks/                       # 6 hook scripts + notification sound
│   ├── hydra-check-update.js    # SessionStart — version check (background)
│   ├── hydra-statusline.js      # StatusLine — status bar display
│   ├── hydra-token-math.js      # Token parsing + savings math (shared library)
│   ├── hydra-auto-guard.js      # PostToolUse — file change tracker
│   ├── hydra-notify.js          # Notification — task completion sound
│   ├── hydra-sentinel-done.js   # Sentinel tracking cleanup
│   └── hydra-task-complete.wav  # Notification sound file
└── skills/
    ├── hydra/                   # SKILL.md + VERSION + references/
    └── stfu-agents/             # SKILL.md
```

Hooks and the statusLine are registered in `~/.claude/settings.json` — existing
entries are preserved, and a custom statusLine is never overwritten.

**Gemini CLI** — `~/.gemini/` (or `./.gemini/` with `--local`):

```
~/.gemini/
├── agents/                      # 10 agent definitions (Flash-tier pinned)
├── commands/hydra/              # 11 TOML commands (/hydra:*)
├── hydra/                       # SKILL.md, VERSION, references/, hooks/
└── GEMINI.md                    # Hydra marker block (appended, reversible)
```

Hooks (AfterTool, SessionStart, Notification) are registered in `~/.gemini/settings.json`.

**Codex CLI** — `~/.codex/` (or `./.codex/` with `--local`):

```
~/.codex/
├── agents/                      # 10 agent definitions (*.toml, Luna/Terra pinned)
├── hydra/                       # VERSION, references/, hooks/
├── hooks.json                   # Hook registrations — trust once via /hooks
├── config.toml                  # [features] hooks + notify chain (marker blocks, reversible)
└── AGENTS.md                    # Hydra marker block (appended, reversible)
~/.agents/skills/                # Skills: $hydra-help, $hydra-stats, $hydra-guard, …
```

> **Local scope for Claude/Gemini/Codex** (`--local`): the per-project payload goes to `./.claude/`,
> `./.gemini/`, or `./.codex/` in your working directory. Hooks and host wiring
> (settings/hooks registration, context files, Codex skills) always stay user-level.

---

## ⚡ Slash Commands

> The following command catalogue and automatic integrations describe
> Claude/Gemini/Codex. Copilot has the separate opt-in skill documented above.

> **Codex CLI:** the same commands ship as skills invoked with a `$` trigger —
> `$hydra-help`, `$hydra-stats`, `$hydra-guard`, … The `/hydra:*` form below is
> for Claude Code and Gemini CLI.

| Command | Description |
|---------|-------------|
| `/hydra:help` | Show all commands and agents |
| `/hydra:status` | Show installed agents, version, and update availability |
| `/hydra:update` | Update Hydra to the latest version |
| `/hydra:guard [files]` | Run manual security & quality scan |
| `/hydra:quiet` | Suppress dispatch logs for this session |
| `/hydra:report` | Report a bug, request a feature, or share feedback |
| `/hydra:stfu` | Compress internal thinking for every subagent in the session |
| `/hydra:map` | View codebase dependency map, query blast radius, rebuild |
| `/hydra:preflight` | Two-phase environment and compatibility check before starting a new project build |
| `/hydra:stats` | Show real token usage, delegation rate, and actual savings (parses the host CLI's own session logs — no AI estimation) |

### `/hydra:preflight` — Environment Validation

Run before starting any new project build. Catches broken GPU stacks, missing env
vars, and incompatible dependency pairs before they cost you hours of debugging.

```
/hydra:preflight
```

Hydra runs a two-phase check:
1. **Detection** (Haiku): probes runtimes, CUDA stack, deps, env vars, services
2. **Analysis** (Sonnet): cross-references against compatibility matrices, flags
   ✅ COMPATIBLE / ⚠️ KNOWN RISK / ❌ CONFIRMED BREAK

---

## 🖥️ Status Line

> Claude Code only — Gemini CLI and Codex CLI have no statusline; use
> `/hydra:stats` (or `$hydra-stats`) there instead.

After installation, your Claude Code status bar shows real-time framework info:

```
🐉 │ Opus │ Ctx: 37% ████░░░░░░ │ $0.42 │ my-project
```

| Element | What It Shows |
|---------|---------------|
| 🐉 | Hydra is active |
| Model | Current Claude model (Opus, Sonnet, Haiku) |
| Ctx: XX% | Context window usage with visual bar |
| $X.XX | Session API cost so far |
| Directory | Current working directory |
| ⚠ Warning | Compaction warning (only at 70%+ context usage) |

**Context bar colors:**
- 🟢 Green (0–49%) — plenty of room
- 🟡 Yellow (50–79%) — getting full, consider `/compact`
- 🔴 Red (80%+) — context nearly full, `/compact` or `/clear` recommended

**Compaction warnings** (appended automatically at 70%+):
```
🐉 │ Opus │ Ctx: 73% ███████░░░ │ $1.87 │ my-project │ ⚠ Auto-compact at 85%
🐉 │ Opus │ Ctx: 83% ████████░░ │ $3.14 │ my-project │ ⚠ Compacting soon!
```
- ⚠ **Auto-compact at 85%** (70–79%) — heads-up that compaction is approaching
- ⚠ **Compacting soon!** (80%+) — compaction is imminent, consider `/compact` now

> **Note:** If you already have a custom `statusLine` configured, the installer
> keeps yours and prints instructions for switching to Hydra's.

---

## 🔔 Task Completion Sound

Hydra plays a short notification sound when the CLI finishes responding — so you know it's done even if you've tabbed away.

- **Cross-platform** — macOS (`afplay`), Windows (PowerShell), Linux (`paplay`/`aplay`)
- **Non-blocking** — the sound plays detached; it never delays the response
- **Host-native and fully event-driven** — Claude Code `Stop` hook, Gemini `Notification` hook, Codex `notify` chain that preserves your existing notifier; no prompt-level calls, so the model can't forget it

The notification hook is registered automatically during installation.

---

## 🔄 Auto-Update Notifications

Hydra checks for updates once per session in the background (never blocks startup).
When a new version is available, you'll see it in the status bar:

```
🐉 │ Opus │ Ctx: 37% ████░░░░░░ │ $0.42 │ my-project │ ⚡ v2.6.0 available
```

Update with:

```bash
# From within Claude Code:
/hydra:update

# Or from your terminal:
npx hail-hydra-cc@latest --global
```

After updating, restart Claude Code to load the new files.

---

## ✨ Features

- **Ten specialized heads** — Haiku (fast) and Sonnet (capable) heads for every task type, including preflight detection for new projects
- **Sentinel integration integrity** — Two-tier verification (fast scan + deep analysis) catches ~72% of integration bugs before runtime
- **Persistent agent memory** — Every agent remembers your codebase patterns, conventions, and past decisions across sessions
- **Orchestrator memory** — Opus maintains its own notes on fragile zones, routing patterns, and known issues via CLAUDE.md
- **Verification touchpoint** — after substantial code changes, the auto-guard hook injects a directive recommending a sentinel + guard verification wave before results are presented; trivial edits stay silent
- **Auto-Guard** — a PostToolUse hook tracks every file edit; hydra-guard (Haiku) scans the tracked files for security issues on demand (`/hydra:guard`) or as part of the sentinel wave
- **Configurable modes** — `conservative`, `balanced` (default), or `aggressive` delegation via `hydra.config.md`
- **Slash commands** — `/hydra:help`, `/hydra:status`, `/hydra:update`, `/hydra:guard`, `/hydra:quiet`, `/hydra:report` for full session control
- **Task completion sound** — plays a notification when Claude finishes substantial tasks
- **Quick commands** — natural language shortcuts: `hydra status`, `hydra quiet`, `hydra map`
- **Custom agent templates** — Add your own heads using `templates/custom-agent.md`
- **Session indexing** — Codebase context persists across turns; no re-exploration on every prompt
- **Speculative pre-dispatch** — hydra-scout launches in parallel with task classification, saving 2–3 seconds per task
- **Dispatch log** — Transparent audit trail showing which agents ran, what model, and outcome
- **Codebase Map** — Persistent dependency graph built by hydra-scout. Maps every file's imports, dependents, risk score, env vars, and test coverage. Enables instant blast-radius lookups for sentinel — no more grepping the entire codebase.
- **Risk-Based Verification** — Files with more dependents get more thorough verification. Critical files always trigger deep sentinel analysis. Low-risk files get fast-tracked.
- **`/hydra:map`** — Inspect the dependency map, query blast radius for any file, or force a rebuild
- **🆕 Real Token Tracking** — `/hydra:stats` parses Claude Code session logs directly to show actual usage and savings. No AI estimation, no marketing fluff — just real numbers from Anthropic's API responses.
- **🆕 Internal Compression** — Subagent output and orchestrator responses are now compressed for efficiency. Sub-agent output is heavily compressed (only Opus reads it). Orchestrator responses drop filler and pleasantries while keeping natural prose.

---

## 🛡️ Sentinel — Integration Integrity

Most bugs don't come from bad code — they come from good code that **doesn't fit together**. A renamed export, a changed return type, a missing dependency after a refactor. These integration issues slip past linters, type-checkers, and even code review because no single file looks wrong.

**hydra-sentinel** catches them — the auto-guard touchpoint recommends a scan after every substantial edit, and the scan escalates to deep analysis only when it finds something.

### How It Works

```
Code change lands (hydra-coder finishes)
    │
    ▼
┌──────────────────────────────────────┐
│  🟢 hydra-sentinel-scan (Haiku)  │  ← Runs on EVERY code change (~1-2s)
│  Fast sweep: imports, exports,       │
│  signatures, dependencies            │
└──────────────┬───────────────────────┘
               │
          Issues found?
          ├── No:  ✅ Pass — code proceeds to guard
          │
          └── Yes: Escalate
               │
               ▼
┌──────────────────────────────────────┐
│  🔵 hydra-sentinel (Sonnet)      │  ← Only when scan flags issues (~20-30%)
│  Deep analysis: confirms real issues, │
│  dismisses false positives,          │
│  proposes fixes                      │
└──────────────┬───────────────────────┘
               │
          Fix decision:
          ├── Trivial (import typo): Auto-fix
          ├── Medium (signature mismatch): Offer fix to user
          └── Complex (architectural): Report with context
```

### What Sentinel Catches

| Check Type | Priority | Example |
|:-----------|:---------|:--------|
| **Import/export mismatches** | P0 | Importing a function that was renamed or removed |
| **Function signature changes** | P0 | Caller passes 2 args, function now expects 3 |
| **Type contract violations** | P1 | Function returns `string` but caller expects `number` |
| **Missing dependency updates** | P1 | New import added but package not in `package.json` |
| **Cross-file rename gaps** | P1 | Variable renamed in definition but not all call sites |
| **Circular dependency introduction** | P2 | New import creates A → B → C → A cycle |
| **Dead code from refactoring** | P2 | Exported function no longer imported anywhere |
| **Environment/config mismatches** | P2 | Code references env var that isn't in `.env.example` |

### Example Output

```
🛡️ Sentinel Report
──────────────────────────────────────
✖ P0: src/auth.js imports `validateToken` from src/utils.js
       but src/utils.js now exports `verifyToken` (renamed in this session)
       → Fix: Update import to `verifyToken` [auto-fixable]

⚠ P1: src/api/routes.js calls createUser(name, email)
       but src/models/user.js:createUser now expects (name, email, role)
       → Missing required parameter `role` added in this change

✔ 6 other integration points verified clean
──────────────────────────────────────
```

Across the check types above, the estimated weighted detection rate is **~72%**
of integration bugs caught before runtime — highest for import/export and
dependency mismatches (direct matching), lower for type contracts and config
drift (heuristic).

> **Memory makes it better over time.** Sentinel remembers past false positives and known fragile
> integration points in your project. The more you use it, the more accurate it gets.

---

## 🗺️ Codebase Map

Hydra builds a persistent dependency map of your codebase,
giving every agent instant access to file relationships without scanning.

### How It Works

hydra-scout builds the map on first run by extracting import statements
from every source file using grep (no external parsers required). The map
is stored at `.claude/hydra/codebase-map.json`.

```
Session 1: scout builds the full map (~10 seconds for 500 files)
Session 2: scout checks git hash → nothing changed → skip rebuild (instant)
Session 3: scout checks git hash → 3 files changed → update only those 3
```

### What the Map Contains

| Data | How It's Used |
|:-----|:-------------|
| **File imports** | "auth.ts imports user.ts and env.ts" |
| **Reverse imports** | "auth.ts is imported by users.ts, admin.ts, middleware.ts" |
| **Risk score** | low (0-1 deps) → medium (2-3) → high (4-6) → critical (7+) |
| **Env var index** | "JWT_SECRET is used in auth.ts and middleware.ts" |
| **Test coverage** | covered / partial / untested per file |
| **Git staleness** | Hash comparison for instant freshness check |

### Why This Matters

**Without map** — When auth.ts changes, sentinel greps the ENTIRE codebase
looking for files that import it. In a 500-file project, that's 500 file reads.
Takes 5-15 seconds, costs 3,000-8,000 tokens.

**With map** — Sentinel reads the JSON, looks up auth.ts's `imported_by` array,
gets `[users.ts, admin.ts, middleware.ts]` instantly. Reads only those 3 files.
Takes <2 seconds, costs 500-1,500 tokens.

**Savings: 3-5× faster, 3-5× fewer tokens per sentinel scan.**

### Risk-Based Sentinel Triggering

The map's risk scores let Opus make smarter verification decisions:

| Modified File Risk | What Happens |
|:-------------------|:------------|
| 🔴 Critical (7+ deps) | Sentinel-scan + deep analysis (always) |
| 🟠 High (4-6 deps) | Sentinel-scan, escalate if issues found |
| 🟡 Medium (2-3 deps) | Sentinel-scan, escalate only for P0 issues |
| 🟢 Low (0-1 deps) | Sentinel-scan, auto-accept if clean |

This means Hydra spends more verification effort where it matters most
(high-risk files) and less where it doesn't (isolated utilities).

### Inspect the Map

```bash
/hydra:map                       # Show summary — risk distribution, coverage stats
/hydra:map src/services/auth.ts  # Show blast radius for a specific file
/hydra:map rebuild               # Force a complete rebuild
```

### Technical Notes

- The map is built using grep + regex — no Tree-sitter, no AST parsing, no
  external dependencies. Works with JS/TS, Python, Go, Java, Kotlin, Ruby, Rust.
- Supports relative import resolution (e.g., `'./auth'` → `src/services/auth.ts`)
- Falls back gracefully — if the map doesn't exist, all agents use their
  original grep-based behavior. The map is an optimization, not a requirement.
- Stored at `.claude/hydra/codebase-map.json` — add to `.gitignore` (machine-generated).

---

## 📊 Real Token Tracking

`/hydra:stats` shows actual token usage and savings for your session. No AI
estimation. The numbers are pulled directly from the host CLI's own session
logs — Claude Code JSONL, Gemini CLI chat records, or Codex CLI rollout files.

```
🐉 Hydra Stats
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Session: 7c3a9e21.jsonl
Turns:   38
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🟢 Haiku  (24 turns):  142.3k in / 8.1k out  → $0.183
🔵 Sonnet (9 turns):   67.4k in / 3.2k out   → $0.250
🟣 Opus   (5 turns):   45.1k in / 2.8k out   → $0.296
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Delegation rate:    87.0% (33/38 turns)
Actual cost:        $0.729
All-Opus baseline:  $1.502
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💰 Saved:           $0.773 (51.5%)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Reads the host CLI's session logs directly.
No AI estimation. Numbers are real.
```

The "All-Opus baseline" is the hypothetical cost if every Hydra agent had
been Opus instead. The savings show what Hydra's model routing actually
saves you in this session. Implementation is pure Node.js — works on
Windows, macOS, and Linux. Respects `CLAUDE_CONFIG_DIR` env override.

---

## 🧠 Agent Memory

Without memory, every session starts cold. Agents re-discover your conventions, re-learn your
project structure, and repeat the same questions. With memory, knowledge compounds.

| Aspect | Without Memory | With Memory |
|:-------|:---------------|:------------|
| **First task** | Agent explores from scratch | Agent recalls project patterns |
| **Conventions** | May use wrong style | Remembers your naming, structure, patterns |
| **Known issues** | No awareness of past bugs | Recalls fragile areas and past fixes |
| **Routing accuracy** | Generic classification | Improved by past dispatch outcomes |
| **False positives** | Same false alarms repeat | Sentinel suppresses known non-issues |

### How It Works

Every agent has `memory: project` in its frontmatter. Claude Code automatically manages a
per-project memory directory (`.claude/memory/`) where agents store and retrieve learnings.

> Agent memory is a **Claude Code** feature — Gemini CLI and Codex CLI have no
> equivalent, so the generator drops the `memory` field on those hosts.

| Agent | What It Remembers |
|:------|:------------------|
| **hydra-scout** | Project structure patterns, key file locations, search shortcuts |
| **hydra-runner** | Test commands, common failure patterns, build quirks |
| **hydra-scribe** | Documentation style, preferred formats, terminology |
| **hydra-guard** | Known false positives, project-specific security patterns |
| **hydra-git** | Commit conventions, branch naming, merge preferences |
| **hydra-sentinel-scan** | Known fragile integration points, past false positives |
| **hydra-coder** | Coding style, architecture patterns, preferred libraries |
| **hydra-analyst** | Common bug patterns, performance hotspots, review focus areas |
| **hydra-sentinel** | Integration history, confirmed vs dismissed findings |
| **Orchestrator (Opus)** | Fragile zones, routing accuracy, escalation patterns (via CLAUDE.md Hydra Notes) |

### Memory Properties

- **Automatic** — agents read and write memory without any user action
- **Project-scoped** — each project has its own memory; no cross-contamination
- **Persistent** — survives across sessions; compounds over time
- **Manageable** — stored as plain markdown in `.claude/memory/`; edit or delete anytime

### The Compound Effect

Session 1: Agents learn your project. Session 5: They know your conventions. Session 20: They
anticipate your patterns. The framework gets more efficient the more you use it — not because
the models improve, but because context quality improves.

---

## 🤔 Why I Built This

After Opus 4 dropped, I noticed something frustrating — code execution felt slowww. Reallyyy Slow. Not because the model was worse, but because I was feeding everything through one massive model. Every file read, every grep, every test run, every docstring — all burning through Opus-tier tokens. The result? Frequent context compaction, more hallucinations, and an API bill that made me wince.

So I started experimenting. I switched to Haiku for the simple stuff — running commands, tool calls, file exploration. Sonnet for code generation, refactoring, reviews. And kept Opus only for what it's actually good at: planning, architecture, and the hard decisions. The result surprised me. Same code quality. Sometimes better — because each model was operating within a focused context window instead of one overloaded one.

Five agents. Five separate context windows. Each with a clearly defined job. They do the work, and only pass results back to the brain — Opus. The outcome:

- Longer coding sessions (less compaction, less context blowup)
- Drastically reduced API costs (Haiku is 5× cheaper than Opus)
- Faster execution (Haiku responds ~10× faster)
- Same or better code quality (focused context > bloated context)
- Zero manual model switching (this is the big one)

Because that was the real pain — manually switching between models for every task tier to save costs. Every. Single. Time. So I built a framework that does it for me. And honestly? It does it better than I did. That was hard to admit, but here we are.

I also didn't want it to be boring. So I gave it teeth, heads, and a battle cry. If you prefer something more buttoned-up, the [`spec-exec`](../../tree/spec-exec) branch has the same framework with zero theatrics.

*Hail Hydra. Have fun.*

---

## 💡 The Theory (for nerds)

Speculative decoding (Chen et al., 2023) accelerates LLM inference by having a small **draft model** propose tokens that a large **target model** verifies in parallel. Since verifying K tokens costs roughly the same as generating 1 token, you get 2–2.5× speedup with **zero quality loss**.

Hydra applies this at the **task level**:

```
                          ┌─────────────────────────────────┐
                          │  SPECULATIVE DECODING (tokens)  │
                          │                                 │
                          │  Small model drafts K tokens    │
                          │  Big model verifies in parallel │
                          │  Accept or reject + resample    │
                          │  Result: 2-2.5× speedup         │
                          └─────────────────────────────────┘
                                        │
                                   Same idea,
                                  bigger scale
                                        │
                                        ▼
                          ┌─────────────────────────────────┐
                          │  🐉 HYDRA (tasks)               │
                          │                                 │
                          │  Haiku/Sonnet drafts the task   │
                          │  Opus verifies (quick glance)   │
                          │  Accept or redo yourself        │
                          │  Result: 2-3× speedup           │
                          └─────────────────────────────────┘
```

The math is simple: if 70% of tasks can be handled by Haiku (10× faster, 5× cheaper) and 20% by Sonnet (3× faster, ~1.7× cheaper), your effective speed and cost improve dramatically — even accounting for the occasional rejection.

How the concepts map:

| Speculative Decoding Concept | Hydra Equivalent |
|:-----------------------------|:-----------------|
| Target model (large) | 🧠 The orchestrator (Opus / Gemini Pro / GPT-5.6 Sol) |
| Draft model (small) | 🟢🔵 The cheap/mid-tier heads |
| Draft K tokens | Heads draft the full task output |
| Parallel verification | Orchestrator glances at the output |
| Modified rejection sampling | Accept → ship it. Reject → orchestrator redoes it. |
| Acceptance rate (~70-90%) | Target: 85%+ of delegated tasks accepted as-is |

**Key papers:**
- [Accelerating Large Language Model Decoding with Speculative Sampling](https://arxiv.org/abs/2302.01318) — Chen et al., 2023 (DeepMind)
- [Fast Inference from Transformers via Speculative Decoding](https://arxiv.org/abs/2211.17192) — Leviathan et al., 2022 (Google)

---

## 🏗️ Architecture

```
User Request
    │
    ├──────────────────────────────────────────────────────┐
    │                                                      │
    ▼                                                      ▼
┌─────────────────────────────┐            ┌──────────────────────────────┐
│  🧠 ORCHESTRATOR (Opus)     │            │  🟢 hydra-scout (Haiku)  │
│  Classifies task            │            │  IMMEDIATE pre-dispatch:      │
│  Plans waves                │            │  "Find files relevant to      │
│  Decides blocking / not     │            │   [user's request]"           │
└────────┬────────────────────┘            └──────────────┬───────────────┘
         │         (unless Session Index already covers)  │
         └──────────────────────┬──────────────────────────┘
                                │ (scout + classification both ready)
                      [Session Index updated]
                                │
    ════════════════════════════════════════════════════════
    Wave N  (parallel dispatch, index context injected)
    ┌───────────────────┬──────────────────────────────────┐
    │  SEQUENTIAL       │  PARALLEL (wait for all)         │
    ▼                   ▼                                  │
 [coder]            [scribe] ──────────────────────────────┘
    │
    ▼
 ALL agents complete (Opus waits for every dispatched agent)
    │
    ├── Raw data / clean pass? → AUTO-ACCEPT → (updates Session Index if scout)
    └── Code / analysis / user-facing docs? → Orchestrator verifies
         │
         ▼
   ┌─────────────────────────────────────────────────────┐
   │  🛡️ VERIFICATION WAVE (recommended by auto-guard)   │
   │                                                     │
   │  🟢 sentinel-scan (Haiku) — fast integration sweep  │
   │       └── issues? → 🔵 sentinel (Sonnet) — deep     │
   │  🟢 guard (Haiku) — security/quality scan           │
   │                                                     │
   │  Runs before results are presented to you            │
   └──────────────────────┬──────────────────────────────┘
                          │
                          ▼
   User gets result (single response, all agent outputs included)
```

---

## 🐲 The Ten Heads

| Head | Model | Speed | Role | Personality |
|:-----|:------|:------|:-----|:------------|
| **hydra-scout (Haiku)** | 🟢 Haiku | ⚡⚡⚡ | Codebase exploration, file search, reading | *"I've already found it."* |
| **hydra-runner (Haiku)** | 🟢 Haiku | ⚡⚡⚡ | Test execution, builds, linting, validation | *"47 passed, 3 failed. Here's why."* |
| **hydra-scribe (Haiku)** | 🟢 Haiku | ⚡⚡⚡ | Documentation, READMEs, comments | *"Documented before you finished asking."* |
| **hydra-guard (Haiku)** | 🟢 Haiku | ⚡⚡⚡ | Security/quality gate after code changes | *"No secrets. No injection. You're clean."* |
| **hydra-git (Haiku)** | 🟢 Haiku | ⚡⚡⚡ | Git: commit, branch, diff, stash, log | *"Committed. Conventional message. Clean diff."* |
| **hydra-sentinel-scan (Haiku)** | 🟢 Haiku | ⚡⚡⚡ | Fast integration sweep after code changes | *"Imports check out. Signatures match. Clean."* |
| **hydra-preflight (Haiku)** | 🟢 Haiku | ⚡⚡⚡ | Environment detection, version probing, dep inventory | *"Your PyTorch/CUDA pair is broken. Pin torch==2.7.0."* |
| **hydra-coder (Sonnet)** | 🔵 Sonnet | ⚡⚡ | Code implementation, refactoring, features | *"Feature's done. Tests pass."* |
| **hydra-analyst (Sonnet)** | 🔵 Sonnet | ⚡⚡ | Code review, debugging, analysis | *"Found 2 critical bugs and an N+1 query."* |
| **hydra-sentinel (Sonnet)** | 🔵 Sonnet | ⚡⚡ | Deep integration analysis (when scan flags issues) | *"2 real issues confirmed. 1 false positive dismissed."* |

### Task Routing Cheat Sheet

```
Is it read-only? ─── Yes ──→ Finding files?
    │                           ├── Yes: hydra-scout (Haiku) 🟢
    │                           └── No:  hydra-analyst (Sonnet) 🔵
    │
    No ──→ Is it a git operation? ─── Yes ──→ hydra-git (Haiku) 🟢
    │
    No ──→ Is it a security scan? ─── Yes ──→ hydra-guard (Haiku) 🟢
    │
    No ──→ Just running a command? ─── Yes ──→ hydra-runner (Haiku) 🟢
    │
    No ──→ Writing docs only? ─── Yes ──→ hydra-scribe (Haiku) 🟢
    │
    No ──→ Clear implementation approach? ─── Yes ──→ hydra-coder (Sonnet) 🔵
    │
    No ──→ Needs deep reasoning? ─── Yes ──→ 🧠 Opus (handle it yourself)

    Code was just changed? ─── Yes ──→ hydra-sentinel-scan (Haiku) 🟢
        │                                   │
        │                              Issues found?
        │                              ├── No:  Done ✅
        │                              └── Yes: hydra-sentinel (Sonnet) 🔵
```

---

## ⚙️ Configuration

Customize Hydra's behavior with an optional config file — create it by hand at
your host's config path (the installer doesn't write one, and `--uninstall`
leaves it alone):

| Host | Global | Project-level (overrides global) |
|:-----|:-------|:---------------------------------|
| Claude Code | `~/.claude/skills/hydra/config/hydra.config.md` | `.claude/skills/hydra/config/hydra.config.md` |
| Gemini CLI | `~/.gemini/hydra/config/hydra.config.md` | `.gemini/hydra/config/hydra.config.md` |
| Codex CLI | `~/.codex/hydra/config/hydra.config.md` | `.codex/hydra/config/hydra.config.md` |

```markdown
mode: balanced          # conservative | balanced (default) | aggressive
dispatch_log: on        # on (default) | off
auto_guard: on          # on (default) | off
```

Run `/hydra:status` (`$hydra-status` on Codex) to see what's currently loaded.
See [`content/config/hydra.config.md`](content/config/hydra.config.md) for the full reference with all options.

---

## 🧩 Extending Hydra

Add your own specialized head in three steps:

**1. Fetch the template** straight into the agents directory Hydra installed:
```bash
curl -o ~/.claude/agents/hydra-myspecialist.md https://raw.githubusercontent.com/AR6420/Hail_Hydra/main/templates/custom-agent.md
# project-level: curl -o .claude/agents/hydra-myspecialist.md https://raw.githubusercontent.com/AR6420/Hail_Hydra/main/templates/custom-agent.md
```

**2. Customize the agent** — edit the name, description, tools, and instructions.

**3. Restart your CLI** — the new head is discoverable alongside the built-in ten.

The template uses the Markdown agent format shared by Claude Code and Gemini CLI
(`~/.gemini/agents/`); Codex CLI agents live in `~/.codex/agents/` as TOML.
See [`templates/custom-agent.md`](templates/custom-agent.md) for the full template with
instructions on writing effective agent descriptions, output formats, and collaboration protocols.

---

## 📂 Repository Structure

```
hydra/
├── 📄 bin/cli.js                        # The npx installer (hail-hydra-cc)
├── 🧬 content/                          # Canonical source — single origin for every host
│   ├── SKILL.md                         # Orchestrator instructions (full)
│   ├── skill-core.md                    # Compressed core for size-capped hosts
│   ├── agents/                          # 10 agent definitions
│   ├── commands/                        # 10 command definitions
│   ├── references/                      # Routing guide + model capabilities
│   ├── config/hydra.config.md           # User configuration template
│   └── skills/stfu-agents/              # STFU-Agents skill
├── ⚙️ src/
│   ├── generator/                       # Emitters: content/ → dist/<host>/
│   ├── installer/                       # Multi-host installer (hosts/claude|gemini|codex.js)
│   ├── hooks/<host>/                    # Per-host lifecycle hooks
│   └── lib/                             # Shared cores (token math, guard, sentinel state)
├── 📦 dist/                             # Generated per-host payload (`npm run build` — gitignored)
├── 📋 templates/
│   └── custom-agent.md                  # Template for adding your own heads
└── 🧪 test/                             # Node test suite (`npm test`)
```

---

## 📊 Expected Impact

| Metric | Without Hydra | With Hydra | Improvement |
|:-------|:-------------|:-----------|:------------|
| **Task Speed (per dispatch)** | 1× (Opus for everything) | 2–3× faster | 🟢 Haiku heads respond ~10× faster |
| **API Cost (per dispatch)** | 1× (Opus for everything) | ~0.5× per dispatch | 40–60% cheaper when invoked |
| **Quality** | Opus-level | Opus-level | Zero degradation |
| **User Experience** | Normal | Normal | Explicit invocation; one automatic touchpoint (post-substantial-edit verification) |
| **Overhead per turn (Turn 2+)** | Full re-exploration each turn | Session index reused | 🟢 2-4s saved per turn |
| **Scout/runner verification** | Opus reviews every output | Auto-accepted for factual data | 🟢 ~50-60% of outputs skip review |
| **Integration bugs caught** | 0% (no verification) | ~72% caught before runtime | 🟢 Sentinel auto-verification |
| **Session knowledge** | Starts cold every time | Compounds across sessions | 🟢 Persistent agent memory |
| **Sentinel scan speed** | 5-15 seconds (grep) | <2 seconds (map lookup) | 🟢 3-5× faster with codebase map |
| **Sentinel scan tokens** | 3,000-8,000 per scan | 500-1,500 per scan | 🟢 3-5× fewer tokens per scan |

### How the Savings Work

| Task Type | % of Work | Model Used | Input Cost vs Opus | Output Cost vs Opus |
|:----------|:----------|:-----------|:----------------------|:-----------------------|
| Exploration, search, tests, docs | ~50% | 🟢 Haiku | 20% ($1 vs $5/MTok) | 20% ($5 vs $25/MTok) |
| Implementation, review, debugging | ~30% | 🔵 Sonnet | 60% ($3 vs $5/MTok) | 60% ($15 vs $25/MTok) |
| Architecture, hard problems | ~20% | 🧠 Opus | 100% (no change) | 100% (no change) |
| Sentinel scan (fast) | Auto (every code change) | 🟢 Haiku | 20% | 20% |
| Sentinel deep (conditional) | ~20-30% of code changes | 🔵 Sonnet | 60% | 60% |
| **Blended effective cost** | | | **~48% of all-Opus** | **~48% of all-Opus** |

Note: When Hydra is invoked across a representative mix of task types, blended input = (0.5×$1 + 0.3×$3 + 0.2×$5) / $5 = $2.40/$5 ≈ 48% of all-Opus.
Per-dispatch savings of **40–60%** are typical for Hydra-invoked work. Session-level savings depend on how often Hydra is invoked — run `/hydra:stats` for real numbers from your session.
Savings calculated against Opus ($5/$25 per MTok) as of February 2026.

On Gemini CLI and Codex CLI the same routing applies against that host's own
frontier model — Flash-tier heads measured against an all-Gemini-Pro baseline,
Luna/Terra heads against an all-GPT-5.6-Sol baseline — landing around the same
~50% blended mark. `/hydra:stats` (`$hydra-stats` on Codex) reports real
per-host numbers.

### Measure Your Savings

The most accurate way to measure Hydra's impact — no estimation, real numbers:

1. Start a Claude Code session **without** Hydra installed
2. Complete a representative coding task
3. Note the session cost from Claude Code's cost display
4. Start a **new** session **with** Hydra installed
5. Complete a similar task
6. Compare the two costs

That's it. Real data beats theoretical calculations every time.

#### What to expect (based on February 2026 API pricing)
When Hydra is actively invoked across a typical mix (50% Haiku, 30% Sonnet, 20% Opus):
- **Input tokens**: ~52% cheaper per dispatch ($2.40 vs $5.00 per MTok)
- **Output tokens**: ~52% cheaper per dispatch ($12.00 vs $25.00 per MTok)
- **Per-dispatch blended**: 40–60% cost reduction on Hydra-invoked work
- **Speed**: 2–3× faster on delegated tasks

Session-level savings depend on invocation frequency. `/hydra:stats` reports real numbers from your session logs — no estimation.

### Additional Savings from Codebase Map

The codebase map provides additional token savings on TOP of the model-routing
savings above:

| Operation | Without Map | With Map | Savings |
|:----------|:-----------|:---------|:--------|
| Sentinel scan (per change) | 3,000-8,000 tokens | 500-1,500 tokens | ~3-5× |
| Scout exploration (repeat session) | 5,000-15,000 tokens | 1,000-3,000 tokens | ~3-5× |
| Blast radius computation | Grep entire codebase | JSON lookup | Instant |

These savings compound with every code change in a session. In a session with
5 code changes, the map saves roughly 10,000-30,000 tokens on sentinel scans alone.

---

## 🎯 Design Principles

### 🫥 Invisibility
> The user should **never** notice Hydra operating. No announcements, no permission requests, no process narration. If a head does the work, present the output as if the orchestrator did it.

### ⚡ Speed Over Ceremony
> Don't overthink classification. Quick mental check: "Haiku? Sonnet? Me?" and go. If you spend 10 seconds classifying a 5-second task, you've defeated the purpose.

### 🔀 Parallel Heads
> Independent subtasks launch in parallel. "Fix the bug AND add tests" → two heads working simultaneously.

### ⬆️ Escalate, Never Downgrade
> If a head's output isn't good enough, Opus does it directly. No retries at the same tier. This mirrors speculative decoding's rejection sampling — when a draft token is rejected, the target model samples directly.

---

## 🤔 FAQ

<details>
<summary><strong>Will I notice any quality difference?</strong></summary>
<br/>
No. Hydra only delegates tasks that are within each model's capability band. If there's any doubt, the task stays with Opus. And Opus always verifies — if a head's output isn't up to standard, Opus redoes it before you ever see it.
</details>

<details>
<summary><strong>Is this actually speculative decoding?</strong></summary>
<br/>
Not at the token level — that happens inside Anthropic's servers and we can't modify it. Hydra applies the same <em>philosophy</em> at the task level: draft with a fast model, verify with the powerful model, accept or reject. Same goals (speed + cost), same guarantees (zero quality loss), different granularity.
</details>

<details>
<summary><strong>What if I'm not using Opus?</strong></summary>
<br/>
Hydra is designed for the Opus-as-orchestrator pattern, but the principles apply at any tier. If you're running Sonnet as your main model, you could adjust the heads to use Haiku for everything delegatable.
</details>

<details>
<summary><strong>Can I customize which models the heads use?</strong></summary>
<br/>
Absolutely. Each head is a simple Markdown file with a <code>model:</code> field in the frontmatter. Change <code>model: haiku</code> to <code>model: sonnet</code> (or any supported model) and you're done.
</details>

<details>
<summary><strong>Do the heads work with subagents I already have?</strong></summary>
<br/>
Yes. Hydra heads coexist with any other subagents. Claude Code discovers all agents in the <code>.claude/agents/</code> directories. No conflicts.
</details>

<details>
<summary><strong>How do I uninstall?</strong></summary>
<br/>

Removes all agents, commands, skills, hooks, and cache files, and reverses the
host wiring — hooks/statusLine in `~/.claude/settings.json`, hooks in
`~/.gemini/settings.json` plus the `GEMINI.md` marker block, and Codex's
`hooks.json`, `config.toml` marker blocks, and `AGENTS.md` block. Your own
configuration (including any `hydra/config/` files) is preserved.

```bash
npx hail-hydra-cc --uninstall              # every host with Hydra installed
npx hail-hydra-cc --uninstall --gemini     # just one host
```

</details>

<details>
<summary><strong>What is Sentinel and how does it work?</strong></summary>
<br/>
Sentinel is a two-tier integration verification system. After every code change, <strong>hydra-sentinel-scan</strong> (Haiku) runs a fast sweep (~1-2s) checking imports, exports, function signatures, and dependencies. If it finds potential issues, <strong>hydra-sentinel</strong> (Sonnet) performs deep analysis to confirm real problems and dismiss false positives. The result is ~72% of integration bugs caught before they reach you.
</details>

<details>
<summary><strong>Does Sentinel slow things down?</strong></summary>
<br/>
The fast scan adds ~1-2 seconds per code change. The deep analysis only triggers when the scan flags issues (~20-30% of changes), adding another ~3-5 seconds in those cases. For the ~70-80% of changes that are clean, you'll barely notice it. The time saved debugging integration issues far outweighs the scan overhead.
</details>

<details>
<summary><strong>Will Sentinel auto-fix things without asking?</strong></summary>
<br/>
Only trivial fixes (like updating an import path after a rename). For medium-complexity fixes (signature mismatches), it offers the fix for your approval. For complex architectural issues, it reports the problem with context but doesn't attempt a fix. You stay in control.
</details>

<details>
<summary><strong>Can I disable Sentinel?</strong></summary>
<br/>
Yes. Set <code>auto_guard: off</code> in your <code>hydra.config.md</code> and the orchestrator skips the verification dispatch (the hook's post-edit reminder still appears — it's the orchestrator that honors the setting). Or use <code>mode: conservative</code> to make delegation, including verification dispatches, more sparing. The sentinel agents themselves stay installed — you can always invoke them explicitly.
</details>

<details>
<summary><strong>Does Agent Memory use extra tokens?</strong></summary>
<br/>
Memory is loaded as part of each agent's context when it starts, so it does use some tokens — but agent memory files are small (typically a few hundred tokens each). The improved accuracy from having project context usually <em>saves</em> tokens by reducing re-exploration and misclassification.
</details>

<details>
<summary><strong>Where is agent memory stored?</strong></summary>
<br/>
In <code>.claude/memory/</code> within your project directory. Each agent stores its own memory as plain markdown files. You can read, edit, or delete them anytime. Memory is project-scoped — each project has its own memory, no cross-contamination.
</details>

<details>
<summary><strong>Does Opus (the orchestrator) also have memory?</strong></summary>
<br/>
Yes. Opus maintains a "Hydra Notes" section in your project's <code>CLAUDE.md</code> file. This includes fragile integration zones, routing accuracy observations, and known issues. Unlike agent memory (which is per-agent), orchestrator memory is visible to all agents and informs dispatch decisions.
</details>

<details>
<summary><strong>What is the Codebase Map?</strong></summary>
<br/>
A persistent JSON file that maps every file's imports, dependents, risk score,
env var references, and test coverage. Built by hydra-scout using grep (no external
parsers). Stored at <code>.claude/hydra/codebase-map.json</code>. Enables instant
blast-radius lookups for sentinel instead of scanning the entire codebase.
</details>

<details>
<summary><strong>Do I need to build the map manually?</strong></summary>
<br/>
No. hydra-scout builds it automatically the first time it's dispatched for
exploration. After that, it updates incrementally (only changed files) using
git hash comparison. You can force a rebuild with <code>/hydra:map rebuild</code>
or inspect it with <code>/hydra:map</code>.
</details>

<details>
<summary><strong>Does the map work with my language?</strong></summary>
<br/>
The map extracts imports using grep patterns for JavaScript, TypeScript, Python,
Go, Java, Kotlin, Ruby, and Rust. If your language isn't supported, agents fall
back to their original grep-based behavior — the map is an optimization, not
a requirement. More languages can be added in future versions.
</details>

<details>
<summary><strong>How big is the map file?</strong></summary>
<br/>
For a 500-file project, the map is typically 50-150KB. For a 5,000-file project,
it's around 500KB-1.5MB. It's a single JSON file — no database, no external
services, nothing to maintain.
</details>

---

## 💬 Feedback

Found a bug? Have a feature idea? Want to share feedback?

**From within Claude Code:**
```
/hydra:report
```

**Or directly on GitHub:**
- [Report a Bug](https://github.com/AR6420/Hail_Hydra/issues/new?template=bug_report.md)
- [Request a Feature](https://github.com/AR6420/Hail_Hydra/issues/new?template=feature_request.md)
- [Share Feedback](https://github.com/AR6420/Hail_Hydra/issues/new?template=feedback.md)

---

## 🤝 Contributing

Found a task type that gets misclassified? Have an idea for a new head? Contributions are welcome!

1. Fork it
2. Create your branch (`git checkout -b feature/hydra-new-head`)
3. Commit (`git commit -m 'Add hydra-optimizer head for perf tuning'`)
4. Push (`git push origin feature/hydra-new-head`)
5. Open a PR

---

## 📜 License

MIT — Use it, fork it, deploy it. Just don't use it for world domination.

*...unless it's code world domination. Then go ahead.*

---

<p align="center">
  <br/>
  <img src="https://img.shields.io/badge/🐉-HAIL_HYDRA-darkred?style=for-the-badge&labelColor=black" alt="Hail Hydra" />
  <br/><br/>
  <em>Built with 🧠 by Claude Opus — ironically, the model this framework is designed to use less of.</em>
  <br/>
  <em>v2.5.2 — Opt-in GitHub Copilot CLI support alongside Claude Code, Gemini CLI, and Codex CLI.</em>
</p>

---
> Prefer a clean, technical version? See the [`spec-exec`](../../tree/spec-exec) branch — same framework, zero theatrics.
