'use strict';

// Per-host translation tables for the generator.
// Phase 1 ships the claude emitter; gemini/codex land in later phases and
// extend these maps (tool-name maps, model-tier maps, path tokens).
//
// Tokens are namespaced {{HYDRA_*}} so they can never collide with host
// template syntax (Gemini commands use {{args}}, for example).

const HOSTS = {
  claude: {
    id: 'claude',
    // Project-level config dir name (used by guard-core's codebase-map lookup
    // and by content path references).
    configDirName: '.claude',
    // Token values substituted into content/ text files at build time.
    tokens: {
      // Shell expression for the installed hooks dir, used inside bash blocks
      // in agent markdown. Honors CLAUDE_CONFIG_DIR like the JS hooks do.
      HYDRA_HOOKS_DIR_SH: '${CLAUDE_CONFIG_DIR:-$HOME/.claude}/hooks',
    },
    // Model tiers as written in agent frontmatter (`model:` field).
    modelMap: { haiku: 'haiku', sonnet: 'sonnet' },
  },
};

// Replace {{HYDRA_*}} tokens for a host. Throws on unknown tokens so a typo
// fails the build instead of shipping a literal '{{HYDRA_...}}'.
function applyTokens(text, host) {
  return text.replace(/\{\{(HYDRA_[A-Z0-9_]+)\}\}/g, (m, name) => {
    const value = HOSTS[host].tokens[name];
    if (value === undefined) {
      throw new Error(`Unknown generator token {{${name}}} for host '${host}'`);
    }
    return value;
  });
}

module.exports = { HOSTS, applyTokens };
