# Changelog

All notable changes to the Hydra framework will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [3.0.0] - 2026-08-10

### Breaking
- **Repository restructure — single-source `content/` + generated `dist/`** —
  All agents, commands, skills, and references now live once in `content/`
  and are emitted per host into `dist/<host>/` by `npm run build`. The
  hand-synced `npm-package/` mirror and `scripts/install.sh` are removed —
  `npx hail-hydra-cc` is the one supported install path.

### Added
- **Multi-host support: Gemini CLI and Codex CLI** — The installer now
  targets three hosts. Gemini CLI gets Markdown agents, TOML `/hydra:*`
  commands, hooks registered in `~/.gemini/settings.json`, and a `GEMINI.md`
  marker block. Codex CLI gets TOML agents, `$hydra-*` skills in
  `~/.agents/skills/`, hooks via `hooks.json` + `config.toml` marker blocks,
  and an `AGENTS.md` marker block (one-time `/hooks` trust review required).
  Agents pin to each host's own model tiers, and `/hydra:stats` prices them
  with host-native pricing.
- **New CLI flags** — `--agent=claude,gemini,codex` (aliases `--claude` /
  `--gemini` / `--codex`), `--all` (every detected agent), `--local` /
  `--both` scopes, `--yes` (non-interactive), `--dry-run`, and
  `--config-dir <path>`. `--global`, `--status`, and `--uninstall` behave as
  before, now host-aware.

### Fixed
- **Update banner was dead in v2.x** — the SessionStart check read VERSION
  from a path the installer never wrote, so the installed version stayed
  `unknown` and the `⚡ vX.Y.Z available` banner never appeared. VERSION is
  now read from `<base>/skills/hydra/VERSION` (project first, then global).
- **`⚠ Sentinel pending` indicator stuck on Windows** — the pending flag's
  producer and consumer used bash `${TMPDIR:-/tmp}` blocks that diverged
  from `os.tmpdir()` on Windows. All hooks now share
  `src/lib/sentinel-state.js`, keyed on `os.tmpdir()` everywhere.
- **Pricing keyed by tier + Fable tier added** — the PRICING map was keyed
  by model prefix (`claude-opus-4`, …) and went stale the moment the
  5-series shipped; it is now keyed by tier so `getTier()` is the single
  place that knows model IDs. `claude-fable-*` / `claude-mythos-*` turns
  were previously dropped into `unknownModels` and excluded from cost and
  delegation math; they now bill at the Fable tier ($10/$50 per MTok),
  excluded from delegated tiers.

## [2.4.2] - 2026-06-09

### Fixed
- **`/hydra:stats` now resolves sessions for project paths with underscores
  and special characters** (#4) — The session directory slug computation was
  stripping the leading dash that Claude Code includes in project directory
  names, causing "No session data" for affected paths. Slug now matches
  Claude Code's directory naming exactly. Thanks to @irodimus for the
  detailed report and verified fix.
- Hardened the fallback session-matching logic to normalize basenames
  consistently (underscores and special characters).

## [2.4.1] - 2026-05-26

### Fixed
- **Sentinel pending indicator now clears after scan completes** — The
  statusline previously showed a persistent `⚠ Sentinel pending (N files)`
  counter even after `hydra-sentinel-scan` had successfully verified the
  changes. Pending flag is cleared at scan completion and the counter no
  longer accumulates across the session.

### Added
- **`✅ Sentinel clean` confirmation in statusline** — After a successful
  sentinel scan, the statusline displays `✅ Sentinel clean` (green) for
  ~60 seconds before fading to quiet state. Provides positive feedback
  that verification ran and the session is clear.
- Auto-guard hook now invalidates the clean marker when new edits occur,
  so subsequent edits immediately revert the indicator to pending.

## [2.4.0] - 2026-05-22

### Added
- **Auto-verification on substantial code changes** — The hydra-auto-guard
  hook now injects a sentinel verification directive when changes are
  substantial (new files, MultiEdit batches, or edits affecting more than
  ~5 lines / 200 characters). Trivial edits don't trigger the hook.
- **`/hydra:stats` no-delegation guidance** — When a session has no
  subagent dispatches, `/hydra:stats` now shows actionable guidance on
  how to invoke Hydra explicitly instead of displaying empty savings.

### Changed
- **SKILL.md refocused** — Documentation of Hydra's capabilities updated
  to reflect the toolkit-with-touchpoints model. Slash commands and
  subagent dispatch guidance consolidated into clearer reference sections.
- **README repositioned** — Updated framing to highlight Hydra's role as
  a specialized toolkit with explicit invocation paths and one
  auto-verification touchpoint.
- **Installer deploys `commands/hydra/stfu.md` and `skills/stfu-agents/SKILL.md`**
  — `npm-package/src/files.js` and `installer.js` updated so fresh installs
  include the STFU slash command and skill file alongside the rest of the
  toolkit.

### Internal
- Mirror sync verified between canonical and npm-package paths
- No breaking changes
- Existing slash commands, agents, hooks, and skills all preserved

## [2.3.2] - 2026-05-17

### Added
- **Internal compression for subagents** — All Hydra subagents now run with
  compressed internal reasoning, in addition to the compressed final output
  introduced in v2.3.0. Intermediate prose ("Let me check...", "I'll
  examine...") is reduced significantly, lowering per-dispatch token costs
  with no change to the final summary returned to the orchestrator.
- **`/hydra:stfu` slash command and STFU-Agents skill** — Activates
  internal-thinking compression for every subagent dispatched in the
  session, regardless of source. Session-scoped, opt-in, no agent files
  modified at runtime.
- **System prompt refinement across all agents** — Trimmed redundancies,
  consolidated overlapping rules, and standardized output formats.

### Fixed
- **Statusline savings indicator path resolution** — Session JSONL slug
  computation now uses a more permissive character class, improving
  resolution accuracy across Windows path encodings and IDE-embedded
  terminals.

### Internal
- Slash command count: 11 → 12 (`/hydra:stfu` added)
- `scripts/install.sh` COMMANDS array and PACKAGE_VERSION refreshed
- Agent file mirror sync between canonical and npm-package paths re-verified

## [2.3.1] - 2026-05-09

### Added
- **Statusline savings indicator** — green `↓$X.XX` after the cost field,
  showing real USD saved vs an all-Opus baseline. Hidden when savings
  `<$0.01` or session has no delegations yet.
- **`/hydra:stats` retail-price effect** — strikethrough on hypothetical
  all-Opus cost, bold green on actual cost. Visually reinforces savings.
- **Shared `hooks/hydra-token-math.js` helper** — single source of truth
  for token parsing and savings math. Statusline and `/hydra:stats` both
  call it so numbers never disagree.
- **Terminal capability detection** — strikethrough auto-enabled on
  iTerm2, kitty, Alacritty, WezTerm, Windows Terminal, VS Code,
  Apple_Terminal. Auto-disabled on Git Bash (`MSYSTEM`) and Cygwin where
  rendering is inconsistent. User override: `HYDRA_STRIKETHROUGH=0|1`.
- 15-second in-memory cache on token math so statusline refreshes don't
  re-parse the full session JSONL on every tick.

### Fixed
- Statusline hides the savings field at session start when no delegations
  have happened yet (avoids `$0.00 ↓$0.00`).

### Notes
- Strikethrough is purely additive — terminals without support get a
  clean `Baseline / Actual cost` labeled fallback.
- Statusline savings match `/hydra:stats` exactly (shared codepath).

## [2.3.0] - 2026-05-06

### Added
- **`/hydra:stats`** — Real token tracking command. Reads Claude Code session
  JSONL directly to show actual token usage by model, delegation rate,
  actual cost, hypothetical all-Opus cost, and real savings in USD.
  No AI estimation. Cross-platform Node.js implementation works on Windows,
  macOS, and Linux. Respects `CLAUDE_CONFIG_DIR` env override.
- **Internal Compression Protocol** — two-tier compression strategy:
  - **Tier 1 (Orchestrator)**: Light compression of Opus responses. Drops
    filler, pleasantries, and hedging while keeping natural prose. Average
    user won't notice the difference.
  - **Tier 2 (Sub-Agents)**: Aggressive compression of subagent output.
    Structured terse output (tables, key:value, JSON). Sub-agent output
    goes to Opus, not the user, so this can be aggressive without UX impact.
- **Auto-Clarity rule** — orchestrator drops compression for security
  warnings, destructive operations, multi-step instructions, and
  onboarding/learning contexts. Safety-critical output stays full prose.

### Changed
- Slash commands increased from 10 to 11.
- Every subagent now has an "Output Format — Compressed (MANDATORY)" section
  in its system prompt with role-specific format hints.
- SKILL.md includes a new Response Compression Protocol — Orchestrator
  section near the top of the framework spec.

### Improved
- Subagent output ~60-70% smaller, allowing Opus's context to last longer
  in extended sessions.
- Orchestrator responses ~30-40% shorter without losing readability.
- Real token tracking lets users verify Hydra's savings claims with their
  own session data — no marketing fluff, just the numbers from Anthropic's
  API responses.

## [2.2.0] - 2026-04-11

### Added
- **`/hydra:preflight`** — Two-phase environment and compatibility validation
  command for new projects. Solves the "15-hour debugging session caused by a
  2-minute pre-flight check that never happened" problem.
  - **Phase 1 — `hydra-preflight` (Haiku 4.5):** Detects runtime versions, runs
    GPU/CUDA probe scripts (`torch.cuda.is_available()`, etc.), inventories
    installed packages, diffs `.env.example` against `.env`, verifies build
    tools, and checks service connectivity. Returns a structured
    `PREFLIGHT_INVENTORY` JSON.
  - **Phase 2 — `hydra-analyst` (Sonnet 4.6):** Cross-references the inventory
    against known compatibility matrices (PyTorch/CUDA, React/Next, Python/TF,
    Node/native addons). Produces three-state verdicts: ✅ COMPATIBLE,
    ⚠️ KNOWN RISK, ❌ CONFIRMED BREAK. Probe output is treated as ground truth
    over matrix knowledge.
  - Auto-suggests pinned-version fixes for ❌ verdicts. Flags unknown
    combinations as UNVERIFIED rather than silently passing.
- **`hydra-preflight`** agent (10th head) — Haiku 4.5; tools: Read, Bash, Glob.
- **Preflight rate** metric added to the Measuring Impact section in SKILL.md
  (target: 100% of new project sessions).

### Changed
- Agent count increased from 9 to 10. "The Nine Heads" → "The Ten Heads"
  throughout SKILL.md and README.md.
- Slash command count increased from 9 to 10.
- `npm-package/files/SKILL.md` resynced with top-level `SKILL.md` — this closes
  a pre-existing v2.1.1 drift where the "Blocking vs Non-Blocking Dispatch"
  → "Sequential vs Parallel Dispatch" rename had not been propagated to the
  npm-published copy.

## [2.1.1] — Bug Fix

### Fixed
- **Ghost message bug** (#2): Background agent dispatch (fire-and-forget) caused an
  empty user turn to appear in Claude Code after agent completion, triggering Claude
  to respond to nothing. All agents are now dispatched in parallel foreground mode —
  Opus waits for every dispatched agent before presenting results. Same speed benefit
  (agents still run simultaneously), no ghost messages.

### Changed
- `SKILL.md`: "Blocking vs Non-Blocking Dispatch" section renamed to
  "Sequential vs Parallel Dispatch". All fire-and-forget language removed.
  Parallel dispatch is now the model for independent agents running simultaneously.

## [2.1.0] - 2026-03-26

### Added
- **Codebase Map** — persistent JSON dependency map built by hydra-scout
  - File-level import/export tracking with automatic reverse indexing
  - Risk scores per file (low/medium/high/critical based on dependent count)
  - Environment variable index (tracks every env var reference across the codebase)
  - Test coverage mapping (covered/partial/untested per file)
  - Git hash staleness detection — incremental updates, only re-maps changed files
  - Stored at `.claude/hydra/codebase-map.json`, no external dependencies
- `/hydra:map` slash command — view summary, query blast radius, force rebuild
- Map-aware sentinel scanning — instant blast-radius lookups instead of grep
- Risk-based sentinel triggering — critical files always get deep analysis,
  low-risk files get fast-track acceptance
- Map-aware orchestration — Opus uses risk scores for smarter routing decisions

### Changed
- hydra-scout now builds and maintains the codebase map alongside exploration
- hydra-sentinel-scan uses map for dependency checks (falls back to grep if no map)
- hydra-sentinel reads map for blast radius context during deep analysis
- SKILL.md updated with Map-Aware Orchestration protocol
- Routing guide updated with map-aware examples
- Slash commands increased from 8 to 9

### Improved
- Sentinel scanning ~3-5x faster with map (JSON lookup vs grep)
- Sentinel scanning ~3-5x fewer tokens with map (reads only blast radius files)
- Scout exploration dramatically faster on repeat sessions (reads map, skips full scan)
- Risk-proportional verification reduces unnecessary sentinel runs on low-risk changes

## [2.0.3] - 2026-03-16

### Changed
- Replaced soft delegation guidelines with mandatory hard rules in SKILL.md
- Routing guide rewritten with agent-based examples and 7 mandatory delegation patterns
- Added Plan Mode behavior: built-in Explore ok for planning, Hydra agents for execution
- Added parallel dispatch enforcement for multi-file tasks
- Added delegation overhead budget (max 2-3 self-handled tasks per session)
- Added dispatch log accountability showing delegation vs direct ratio

## [2.0.2] - 2026-03-15

### Fixed
- Enforce sentinel execution with 3-layer trigger system
- Sentinel pipeline now fires reliably on all code changes

## [2.0.1] - 2026-03-11

### Fixed
- Skip overwrite prompt in non-interactive mode (`--global`/`--local`/`--both`)

## [2.0.0] - 2026-03-11

### Added
- hydra-sentinel-scan (Haiku 4.5) — fast integration sweep after code changes
- hydra-sentinel (Sonnet 4.6) — deep integration analysis when issues found
- Persistent agent memory (`memory: project`) across all 9 agents
- Orchestrator memory via CLAUDE.md Hydra Notes
- Sentinel Protocol in SKILL.md — two-tier verification pipeline
- Post-Code-Change Pipeline — code changes held until sentinel + guard complete
- Fix decision tree: auto-fix trivial, offer medium, report complex
- Compaction warning in statusline at 70%+ context usage

### Changed
- Agent count increased from 7 to 9
- All agent frontmatter updated with `memory: project`
- SKILL.md substantially rewritten with Sentinel Protocol and Orchestrator Memory
- README overhauled with Sentinel section, Memory section, updated features, new FAQ

### Breaking
- Code changes now block until sentinel + guard verification completes

## [1.2.3] - 2026-03-08

### Changed
- CI: Publish to both npm and GitHub Packages on release
- CI: Gracefully skip publish if version already exists

### Added
- npm lifetime downloads badge in README

## [1.2.2] - 2026-03-05

### Fixed
- Remove model annotations from agent name fields (was causing display issues)
- Target npmjs.com registry instead of GitHub Packages

## [1.2.1] - 2026-02-24

### Fixed
- Move skill to `skills/hydra/`, update frontmatter description
- Add hydra-guard & hydra-git agents, dynamic version, fix head count display

### Added
- GitHub Packages publish workflow

### Changed
- npm package README corrected to show `skills/hydra/` install tree

## [1.1.0] - 2026-02-23

### Added
- npx installer package (`npx hail-hydra-cc`)
- 7 specialized agents (scout, runner, scribe, guard, git, coder, analyst)
- Auto-guard system
- Configuration system (`hydra.config.md`)
- "Why I Built This" section in README

### Changed
- Corrected pricing information

## [1.0.0] - 2026-02-18

### Added
- Initial release
- SKILL.md orchestrator instructions
- Reference documents (routing guide, model capabilities)
- Wave execution, verification reports, handoff protocol
- 4 orchestrator-level speed optimizations

[2.2.0]: https://github.com/AR6420/Hail_Hydra/compare/v2.1.1...v2.2.0
[2.1.1]: https://github.com/AR6420/Hail_Hydra/compare/v2.1.0...v2.1.1
[2.1.0]: https://github.com/AR6420/Hail_Hydra/compare/v2.0.3...v2.1.0
[2.0.3]: https://github.com/AR6420/Hail_Hydra/compare/v2.0.0...v2.0.3
[2.0.2]: https://github.com/AR6420/Hail_Hydra/compare/v2.0.1...v2.0.2
[2.0.1]: https://github.com/AR6420/Hail_Hydra/compare/v2.0.0...v2.0.1
[2.0.0]: https://github.com/AR6420/Hail_Hydra/compare/v1.2.3...v2.0.0
[1.2.3]: https://github.com/AR6420/Hail_Hydra/compare/v1.2.2...v1.2.3
[1.2.2]: https://github.com/AR6420/Hail_Hydra/compare/v1.2.1...v1.2.2
[1.2.1]: https://github.com/AR6420/Hail_Hydra/compare/v1.1.0...v1.2.1
[1.1.0]: https://github.com/AR6420/Hail_Hydra/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/AR6420/Hail_Hydra/releases/tag/v1.0.0
