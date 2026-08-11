---
description: Activate STFU-Agents mode — silence intermediate prose from every dispatched subagent
allowed-tools: Read
---

# Hydra STFU Mode

Activate the STFU-Agents skill for this session.

Acknowledge with:
"🐉 STFU-Agents mode activated. All dispatched subagents will run with compressed internal thinking. Final outputs unchanged. Run `/skills` to deactivate or say 'verbose agents'."

From this point in the session, when dispatching ANY subagent via the Task tool, prepend the internal-compression directive defined in `skills/stfu-agents/SKILL.md` to the task description.

Applies until:
- Session ends
- User says "verbose agents" / "stop STFU"
- A conflicting skill is invoked

## Why
Subagents generate intermediate prose that's billed by Anthropic but never read. Final summary is the only thing returned to Opus. STFU tells every dispatched subagent to skip narration — same final output, fewer billed tokens. Universal scope: any subagent in the session, regardless of source.
