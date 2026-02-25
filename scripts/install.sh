#!/usr/bin/env bash
# ============================================================================
# 🐉 Hydra — SubAgent (Head) Installer
# ============================================================================
# Installs Hydra heads so Claude Code can discover and use them.
#
# Usage:
#   ./install.sh --user      # Install to ~/.claude/agents/ (all projects)
#   ./install.sh --project   # Install to .claude/agents/ (current project)
#   ./install.sh --both      # Install to both locations
#   ./install.sh --uninstall # Remove all hydra-* agents from both locations
# ============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
AGENTS_DIR="$(dirname "$SCRIPT_DIR")/agents"

USER_DIR="$HOME/.claude/agents"
PROJECT_DIR=".claude/agents"

HYDRA_CONFIG_TEMPLATE="$(dirname "$SCRIPT_DIR")/config/hydra.config.md"
USER_CONFIG_DIR="$HOME/.claude/skills/hydra"
PROJECT_CONFIG_DIR=".claude/skills/hydra"

AGENTS=("hydra-scout" "hydra-runner" "hydra-scribe" "hydra-guard" "hydra-git" "hydra-coder" "hydra-analyst")

COMMANDS=("update" "status" "help" "config" "guard" "quiet" "verbose")
HOOKS=("hydra-check-update.js" "hydra-statusline.js" "hydra-auto-guard.js")
PACKAGE_VERSION="1.2.0"

COMMANDS_SOURCE_DIR="$(dirname "$SCRIPT_DIR")/commands/hydra"
HOOKS_SOURCE_DIR="$(dirname "$SCRIPT_DIR")/hooks"
SETTINGS_FILE="$HOME/.claude/settings.json"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

info()  { echo -e "${CYAN}[🐉 hydra]${NC} $*"; }
ok()    { echo -e "${GREEN}[🐉 hydra]${NC} $*"; }
warn()  { echo -e "${YELLOW}[🐉 hydra]${NC} $*"; }
err()   { echo -e "${RED}[🐉 hydra]${NC} $*" >&2; }

install_to() {
    local target_dir="$1"
    local label="$2"

    mkdir -p "$target_dir"

    local count=0
    for agent in "${AGENTS[@]}"; do
        local src="$AGENTS_DIR/${agent}.md"
        local dst="$target_dir/${agent}.md"

        if [[ ! -f "$src" ]]; then
            err "Head not found: $src"
            continue
        fi

        cp "$src" "$dst"
        count=$((count + 1))
    done

    ok "Deployed $count/7 heads to $label ($target_dir)"
}

uninstall_from() {
    local target_dir="$1"
    local label="$2"

    local count=0
    for agent in "${AGENTS[@]}"; do
        local dst="$target_dir/${agent}.md"
        if [[ -f "$dst" ]]; then
            rm "$dst"
            count=$((count + 1))
        fi
    done

    if [[ $count -gt 0 ]]; then
        ok "Severed $count heads from $label ($target_dir)"
    else
        info "No Hydra heads found in $label"
    fi

    # --- Remove commands ---
    local cmd_dir
    cmd_dir="$(dirname "$target_dir")/commands/hydra"
    if [[ -d "$cmd_dir" ]]; then
        rm -rf "$cmd_dir"
        ok "Removed commands from $(dirname "$target_dir")/commands/hydra"
    fi

    # --- Remove VERSION ---
    local version_file
    version_file="$(dirname "$target_dir")/skills/hydra/VERSION"
    if [[ -f "$version_file" ]]; then
        rm -f "$version_file"
        ok "Removed VERSION file"
    fi
}

install_commands() {
    local target_dir="$1"

    mkdir -p "$target_dir"

    local count=0
    for cmd in "${COMMANDS[@]}"; do
        local src="$COMMANDS_SOURCE_DIR/${cmd}.md"
        local dst="$target_dir/${cmd}.md"

        if [[ ! -f "$src" ]]; then
            warn "Command not found: $src (skipping)"
            continue
        fi

        cp "$src" "$dst"
        count=$((count + 1))
    done

    ok "Deployed $count/7 commands to $target_dir"
}

install_hooks() {
    local hooks_dir="$HOME/.claude/hooks"
    mkdir -p "$hooks_dir"

    local count=0
    for hook in "${HOOKS[@]}"; do
        local src="$HOOKS_SOURCE_DIR/${hook}"
        local dst="$hooks_dir/${hook}"

        if [[ ! -f "$src" ]]; then
            warn "Hook not found: $src (skipping)"
            continue
        fi

        cp "$src" "$dst"
        chmod +x "$dst" 2>/dev/null || true
        count=$((count + 1))
    done

    ok "Deployed $count/3 hooks to $hooks_dir"
}

write_version_file() {
    local base_dir="$1"
    local version_dir="$base_dir/skills/hydra"

    mkdir -p "$version_dir"
    echo "$PACKAGE_VERSION" > "$version_dir/VERSION"
    ok "Wrote VERSION ($PACKAGE_VERSION) to $version_dir/VERSION"
}

register_hooks_in_settings() {
    info "Registering hooks in settings.json..."

    node -e "
      const fs = require('fs');
      const settingsFile = process.env.HYDRA_SETTINGS_FILE;

      let settings = {};
      try {
        settings = JSON.parse(fs.readFileSync(settingsFile, 'utf8'));
      } catch(e) {}

      if (!settings.hooks) settings.hooks = {};
      if (!settings.hooks.SessionStart) settings.hooks.SessionStart = [];
      if (!settings.hooks.PostToolUse) settings.hooks.PostToolUse = [];

      const isHydraHook = (entry) =>
        entry.hooks && entry.hooks.some(h => h.command && h.command.includes('hydra-'));

      // Clean reinstall — remove existing Hydra entries first
      settings.hooks.SessionStart = settings.hooks.SessionStart.filter(x => !isHydraHook(x));
      settings.hooks.PostToolUse  = settings.hooks.PostToolUse.filter(x => !isHydraHook(x));

      // SessionStart: update checker
      settings.hooks.SessionStart.push({
        hooks: [{ type: 'command', command: 'node ~/.claude/hooks/hydra-check-update.js' }]
      });

      // PostToolUse: auto-guard file tracker
      settings.hooks.PostToolUse.push({
        matcher: 'Write|Edit|MultiEdit',
        hooks: [{ type: 'command', command: 'node ~/.claude/hooks/hydra-auto-guard.js' }]
      });

      // StatusLine: only set if unset or already Hydra's
      if (!settings.statusLine || (settings.statusLine.command && settings.statusLine.command.includes('hydra-'))) {
        settings.statusLine = {
          type: 'command',
          command: 'node ~/.claude/hooks/hydra-statusline.js',
          padding: 0
        };
        console.log('  statusLine configured (Hydra)');
      } else {
        console.log('  Existing statusLine detected — keeping yours.');
        console.log('  To use Hydra statusline, set in ~/.claude/settings.json:');
        console.log('    { \"statusLine\": { \"type\": \"command\", \"command\": \"node ~/.claude/hooks/hydra-statusline.js\", \"padding\": 0 } }');
      }

      fs.writeFileSync(settingsFile, JSON.stringify(settings, null, 2));
      console.log('  Hooks registered in settings.json');
    " HYDRA_SETTINGS_FILE="$SETTINGS_FILE" || warn "Could not register hooks (Node.js required). Register manually."
}

uninstall_global_extras() {
    # Remove hooks
    for hook in "${HOOKS[@]}"; do
        local dst="$HOME/.claude/hooks/${hook}"
        [[ -f "$dst" ]] && rm -f "$dst" && ok "Removed $dst"
    done

    # Remove update cache
    rm -f "$HOME/.claude/cache/hydra-update-check.json"

    # Clean temp tracking files
    rm -rf /tmp/hydra-guard 2>/dev/null || true

    # Deregister from settings.json
    node -e "
      const fs = require('fs');
      const settingsFile = process.env.HYDRA_SETTINGS_FILE;

      try {
        let settings = JSON.parse(fs.readFileSync(settingsFile, 'utf8'));

        const isHydraHook = (entry) =>
          entry.hooks && entry.hooks.some(h => h.command && h.command.includes('hydra-'));

        if (settings.hooks && settings.hooks.SessionStart) {
          settings.hooks.SessionStart = settings.hooks.SessionStart.filter(x => !isHydraHook(x));
          if (!settings.hooks.SessionStart.length) delete settings.hooks.SessionStart;
        }
        if (settings.hooks && settings.hooks.PostToolUse) {
          settings.hooks.PostToolUse = settings.hooks.PostToolUse.filter(x => !isHydraHook(x));
          if (!settings.hooks.PostToolUse.length) delete settings.hooks.PostToolUse;
        }
        if (settings.hooks && !Object.keys(settings.hooks).length) delete settings.hooks;

        if (settings.statusLine && settings.statusLine.command && settings.statusLine.command.includes('hydra-')) delete settings.statusLine;

        fs.writeFileSync(settingsFile, JSON.stringify(settings, null, 2));
        console.log('  Hooks deregistered from settings.json');
      } catch(e) {
        console.log('  Could not update settings.json:', e.message);
      }
    " HYDRA_SETTINGS_FILE="$SETTINGS_FILE" || warn "Could not deregister hooks. Clean up ~/.claude/settings.json manually."
}

install_config() {
    local target_dir="$1"
    local label="$2"

    mkdir -p "$target_dir"

    if [[ -f "$target_dir/hydra.config.md" ]]; then
        warn "Config already exists at $target_dir/hydra.config.md — not overwriting"
        warn "Delete it manually if you want a fresh config"
        return
    fi

    if [[ ! -f "$HYDRA_CONFIG_TEMPLATE" ]]; then
        err "Config template not found: $HYDRA_CONFIG_TEMPLATE"
        return
    fi

    cp "$HYDRA_CONFIG_TEMPLATE" "$target_dir/hydra.config.md"
    ok "Created config at $target_dir/hydra.config.md"
}

show_usage() {
    cat << 'EOF'
🐉 Hydra — Multi-Headed Speculative Execution

  "Cut off one head, two more shall take its place."

Usage:
  ./install.sh --user       Deploy to ~/.claude/ (all projects)
  ./install.sh --project    Deploy to .claude/ (current project)
  ./install.sh --both       Deploy to both locations
  ./install.sh --uninstall  Remove all Hydra files from both locations
  ./install.sh --status     Show deployment status
  ./install.sh --config     Create default config file
  ./install.sh --help       Show this message

Installs:
  7 agents     (hydra-scout, hydra-runner, hydra-scribe, hydra-coder,
                hydra-analyst, hydra-guard, hydra-git)
  7 commands   (/hydra:help, /hydra:status, /hydra:update, /hydra:config,
                /hydra:guard, /hydra:quiet, /hydra:verbose)
  3 hooks      (update checker, statusline, auto-guard tracker)
  1 skill      (SKILL.md orchestrator instructions)
  1 version    (VERSION file for update tracking)
EOF
}

show_status() {
    info "Checking Hydra deployment status..."
    echo ""

    local version
    version=$(cat "$HOME/.claude/skills/hydra/VERSION" 2>/dev/null || echo "unknown")

    echo "  Version:  $version"
    echo "  Agents:   $(ls -1 "$HOME/.claude/agents/hydra-"*.md 2>/dev/null | wc -l | tr -d ' ')/7  [$(ls -1 ".claude/agents/hydra-"*.md 2>/dev/null | wc -l | tr -d ' ')/7 project]"
    echo "  Commands: $(ls -1 "$HOME/.claude/commands/hydra/"*.md 2>/dev/null | wc -l | tr -d ' ')/7  [$(ls -1 ".claude/commands/hydra/"*.md 2>/dev/null | wc -l | tr -d ' ')/7 project]"
    echo "  Hooks:    $(ls -1 "$HOME/.claude/hooks/hydra-"*.js 2>/dev/null | wc -l | tr -d ' ')/3"
    echo ""
}

# ---- Main ----

if [[ $# -eq 0 ]]; then
    show_usage
    exit 0
fi

case "${1:-}" in
    --user)
        info "Deploying to user-level (~/.claude/)..."
        install_to "$USER_DIR" "user-level"
        install_commands "$HOME/.claude/commands/hydra"
        install_hooks
        write_version_file "$HOME/.claude"
        register_hooks_in_settings
        echo ""
        ok "Hail Hydra! Framework active in all Claude Code sessions."
        ;;
    --project)
        info "Deploying to project-level (.claude/)..."
        install_to "$PROJECT_DIR" "project-level"
        install_commands ".claude/commands/hydra"
        install_hooks
        write_version_file ".claude"
        register_hooks_in_settings
        echo ""
        ok "Hail Hydra! Framework active in this project."
        warn "Consider adding .claude/agents/hydra-*.md and .claude/commands/ to .gitignore"
        ;;
    --both)
        info "Deploying to both locations..."
        install_to "$USER_DIR" "user-level"
        install_commands "$HOME/.claude/commands/hydra"
        write_version_file "$HOME/.claude"
        install_to "$PROJECT_DIR" "project-level"
        install_commands ".claude/commands/hydra"
        write_version_file ".claude"
        install_hooks
        register_hooks_in_settings
        echo ""
        ok "Hail Hydra! Framework active everywhere."
        warn "Project-level files take precedence over user-level when both exist."
        warn "Consider adding .claude/agents/hydra-*.md and .claude/commands/ to .gitignore"
        ;;
    --uninstall)
        info "Severing Hydra..."
        uninstall_from "$USER_DIR" "user-level"
        uninstall_from "$PROJECT_DIR" "project-level"
        uninstall_global_extras
        echo ""
        ok "All heads severed. Hydra sleeps."
        ;;
    --status)
        show_status
        ;;
    --config)
        info "Creating Hydra config..."
        install_config "$USER_CONFIG_DIR" "user-level"
        echo ""
        ok "Edit $USER_CONFIG_DIR/hydra.config.md to customize Hydra behavior."
        ;;
    --help|-h)
        show_usage
        ;;
    *)
        err "Unknown option: $1"
        echo ""
        show_usage
        exit 1
        ;;
esac
