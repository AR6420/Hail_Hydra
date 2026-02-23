# Hydra Configuration

Place this file at one of these locations to customize Hydra's behavior:
- `.claude/hydra/hydra.config.md` — project-level (takes precedence)
- `~/.claude/hydra/hydra.config.md` — user-level (fallback)

---

## Delegation Aggressiveness
<!-- Set to: conservative, balanced (default), aggressive -->
mode: balanced

### Modes:
- **conservative**: Only delegate clearly mechanical tasks. Higher Opus 4.6 usage, fewer rejections.
- **balanced** (default): Standard classification as described in SKILL.md.
- **aggressive**: Delegate everything possible. Lower costs, slightly higher rejection risk.

---

## Dispatch Log
<!-- Set to: on (default), off, verbose -->
dispatch_log: on

### Options:
- **on** (default): Show dispatch log footer after multi-agent tasks
- **off**: Fully invisible operation (stealth mode)
- **verbose**: Show dispatch log + per-agent timing

---

## Auto-Guard
<!-- Set to: on (default), off -->
auto_guard: on

### Options:
- **on** (default): Automatically scan code changes with hydra-guard (Haiku 4.5) after hydra-coder
- **off**: Skip the security/quality gate

---

## Custom Agent Overrides
<!-- Override default model assignments if needed -->
<!-- Uncomment and modify: -->
<!-- hydra-scout: sonnet -->
<!-- hydra-runner: sonnet -->
<!-- hydra-scribe: sonnet -->
<!-- hydra-guard: sonnet -->
<!-- hydra-git: sonnet -->
<!-- hydra-coder: opus -->
<!-- hydra-analyst: opus -->
