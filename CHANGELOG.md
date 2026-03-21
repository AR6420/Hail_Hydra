# Changelog

All notable changes to the Hydra framework will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

[Unreleased]: https://github.com/AR6420/Hail_Hydra/compare/v2.0.3...HEAD
[2.0.3]: https://github.com/AR6420/Hail_Hydra/compare/v2.0.0...v2.0.3
[2.0.2]: https://github.com/AR6420/Hail_Hydra/compare/v2.0.1...v2.0.2
[2.0.1]: https://github.com/AR6420/Hail_Hydra/compare/v2.0.0...v2.0.1
[2.0.0]: https://github.com/AR6420/Hail_Hydra/compare/v1.2.3...v2.0.0
[1.2.3]: https://github.com/AR6420/Hail_Hydra/compare/v1.2.2...v1.2.3
[1.2.2]: https://github.com/AR6420/Hail_Hydra/compare/v1.2.1...v1.2.2
[1.2.1]: https://github.com/AR6420/Hail_Hydra/compare/v1.1.0...v1.2.1
[1.1.0]: https://github.com/AR6420/Hail_Hydra/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/AR6420/Hail_Hydra/releases/tag/v1.0.0
