'use strict';

// Claude Code emitter — dist/claude/ mirrors the installed payload layout:
//   agents/*.md · SKILL.md · skills/stfu-agents/SKILL.md · references/*.md
//   commands/hydra/*.md · hooks/*.js + hydra-task-complete.wav
//
// Near-verbatim copy of content/ (Claude-native source format) apart from
// token resolution and hook bundling.

const fs = require('fs');
const path = require('path');

const { ROOT, CONTENT, DIST, write, emitText, listMd } = require('./shared');
const { bundleHook } = require('./bundle');

// Token values substituted into content/ text files for this host.
const TOKENS = {
  // Shell expression for the installed hooks dir, used inside bash blocks in
  // agent markdown. Honors CLAUDE_CONFIG_DIR like the JS hooks do.
  HYDRA_HOOKS_DIR_SH: '${CLAUDE_CONFIG_DIR:-$HOME/.claude}/hooks',
  // Full sentinel-done invocation. Claude's Bash tool is bash on every
  // platform, so the bash form is safe here. The hook is silent and always
  // exits 0 — no redirects or `|| true` needed.
  HYDRA_SENTINEL_DONE_CMD: 'node "${CLAUDE_CONFIG_DIR:-$HOME/.claude}/hooks/hydra-sentinel-done.js"',
};

function emit() {
  const out = path.join(DIST, 'claude');

  // Agents — verbatim apart from token resolution.
  for (const f of listMd(path.join(CONTENT, 'agents'))) {
    emitText(path.join(CONTENT, 'agents', f), path.join(out, 'agents', f), TOKENS);
  }

  // Skill + standalone skills.
  emitText(path.join(CONTENT, 'SKILL.md'), path.join(out, 'SKILL.md'), TOKENS);
  emitText(
    path.join(CONTENT, 'skills', 'stfu-agents', 'SKILL.md'),
    path.join(out, 'skills', 'stfu-agents', 'SKILL.md'),
    TOKENS
  );

  // References.
  for (const f of listMd(path.join(CONTENT, 'references'))) {
    emitText(path.join(CONTENT, 'references', f), path.join(out, 'references', f), TOKENS);
  }

  // Commands — installed under commands/hydra/ for the /hydra:* namespace.
  for (const f of listMd(path.join(CONTENT, 'commands'))) {
    emitText(path.join(CONTENT, 'commands', f), path.join(out, 'commands', 'hydra', f), TOKENS);
  }

  // Hooks — bundled self-contained from src/hooks/claude/.
  const hookSrcDir = path.join(ROOT, 'src', 'hooks', 'claude');
  for (const f of fs.readdirSync(hookSrcDir).filter((n) => n.endsWith('.js')).sort()) {
    write(path.join(out, 'hooks', f), bundleHook(path.join(hookSrcDir, f)));
  }
  fs.mkdirSync(path.join(out, 'hooks'), { recursive: true });
  fs.copyFileSync(
    path.join(ROOT, 'src', 'hooks', 'hydra-task-complete.wav'),
    path.join(out, 'hooks', 'hydra-task-complete.wav')
  );
}

module.exports = { id: 'claude', emit };
