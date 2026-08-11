# Hydra Configuration

Place this file at one of these locations to customize Hydra's behavior:
- `.claude/skills/hydra/config/hydra.config.md` — project-level (takes precedence)
- `~/.claude/skills/hydra/config/hydra.config.md` — user-level (fallback)

---

## Delegation Aggressiveness
<!-- Set to: conservative, balanced (default), aggressive -->
mode: balanced

### Modes:
- **conservative**: Only delegate clearly mechanical tasks. Higher orchestrator usage, fewer rejections.
- **balanced** (default): Standard classification as described in SKILL.md.
- **aggressive**: Delegate everything possible. Lower costs, slightly higher rejection risk.

---

## Dispatch Log
<!-- Set to: on (default), off -->
dispatch_log: on

### Options:
- **on** (default): Show dispatch log footer after multi-agent tasks
- **off**: Fully invisible operation (stealth mode)

---

## Auto-Guard
<!-- Set to: on (default), off -->
auto_guard: on

### Options:
- **on** (default): Automatically scan code changes with hydra-guard (cheap tier) after hydra-coder
- **off**: The orchestrator skips the security/quality gate (the post-edit hook reminder still appears)

---

To change which model an agent runs on, edit the `model:` line in that agent's installed file for your host.
