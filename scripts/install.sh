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
USER_CONFIG_DIR="$HOME/.claude/hydra"
PROJECT_CONFIG_DIR=".claude/hydra"

AGENTS=("hydra-scout" "hydra-runner" "hydra-scribe" "hydra-guard" "hydra-git" "hydra-coder" "hydra-analyst")

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
  ./install.sh --user       Deploy heads to ~/.claude/agents/ (all projects)
  ./install.sh --project    Deploy heads to .claude/agents/ (current project)
  ./install.sh --both       Deploy to both locations
  ./install.sh --uninstall  Sever all Hydra heads from both locations
  ./install.sh --status     Show where heads are deployed
  ./install.sh --config     Create default config file in ~/.claude/hydra/
  ./install.sh --help       Show this message

The Seven Heads:
  hydra-scout (Haiku 4.5)    🟢 Haiku 4.5   — Codebase exploration, file search
  hydra-runner (Haiku 4.5)   🟢 Haiku 4.5   — Test execution, builds, validation
  hydra-scribe (Haiku 4.5)   🟢 Haiku 4.5   — Documentation writing
  hydra-guard (Haiku 4.5)    🟢 Haiku 4.5   — Security/quality gate after code changes
  hydra-git (Haiku 4.5)      🟢 Haiku 4.5   — Git operations: commit, branch, diff
  hydra-coder (Sonnet 4.6)   🔵 Sonnet 4.6  — Code implementation, refactoring
  hydra-analyst (Sonnet 4.6) 🔵 Sonnet 4.6  — Code review, debugging, analysis
EOF
}

show_status() {
    info "Checking head deployment status..."
    echo ""

    for location_label in "User-level:$USER_DIR" "Project-level:$PROJECT_DIR"; do
        local label="${location_label%%:*}"
        local dir="${location_label##*:}"

        echo "  $label ($dir):"
        local found=0
        for agent in "${AGENTS[@]}"; do
            if [[ -f "$dir/${agent}.md" ]]; then
                # Determine the emoji and display name based on model
                local emoji="🟢"
                local display_name="$agent"
                case "$agent" in
                    hydra-scout)   display_name="hydra-scout (Haiku 4.5)" ;;
                    hydra-runner)  display_name="hydra-runner (Haiku 4.5)" ;;
                    hydra-scribe)  display_name="hydra-scribe (Haiku 4.5)" ;;
                    hydra-guard)   display_name="hydra-guard (Haiku 4.5)" ;;
                    hydra-git)     display_name="hydra-git (Haiku 4.5)" ;;
                    hydra-coder)   display_name="hydra-coder (Sonnet 4.6)"; emoji="🔵" ;;
                    hydra-analyst) display_name="hydra-analyst (Sonnet 4.6)"; emoji="🔵" ;;
                esac
                echo "    $emoji ${display_name}.md"
                found=$((found + 1))
            fi
        done
        if [[ $found -eq 0 ]]; then
            echo "    (no heads deployed)"
        fi
        echo ""
    done
}

# ---- Main ----

if [[ $# -eq 0 ]]; then
    show_usage
    exit 0
fi

case "${1:-}" in
    --user)
        info "Deploying heads to user-level (~/.claude/agents/)..."
        install_to "$USER_DIR" "user-level"
        echo ""
        ok "Hail Hydra! Heads are now active in all Claude Code sessions."
        ;;
    --project)
        info "Deploying heads to project-level (.claude/agents/)..."
        install_to "$PROJECT_DIR" "project-level"
        echo ""
        ok "Hail Hydra! Heads are now active in this project."
        warn "Consider adding .claude/agents/hydra-*.md to .gitignore"
        ;;
    --both)
        info "Deploying heads to all locations..."
        install_to "$USER_DIR" "user-level"
        install_to "$PROJECT_DIR" "project-level"
        echo ""
        ok "Hail Hydra! All heads deployed everywhere."
        warn "Project-level heads take precedence over user-level when both exist."
        ;;
    --uninstall)
        info "Severing Hydra heads..."
        uninstall_from "$USER_DIR" "user-level"
        uninstall_from "$PROJECT_DIR" "project-level"
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
