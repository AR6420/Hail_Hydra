#!/usr/bin/env bash
# ============================================================================
# Speculative Execution Framework (SEF) — Executor Installer
# ============================================================================
# Installs SEF executors so Claude Code can discover and use them.
#
# Usage:
#   ./install.sh --user      # Install to ~/.claude/agents/ (all projects)
#   ./install.sh --project   # Install to .claude/agents/ (current project)
#   ./install.sh --both      # Install to both locations
#   ./install.sh --uninstall # Remove all sef-* executors from both locations
# ============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
AGENTS_DIR="$(dirname "$SCRIPT_DIR")/agents"

USER_DIR="$HOME/.claude/agents"
PROJECT_DIR=".claude/agents"

AGENTS=("sef-explore" "sef-validate" "sef-implement" "sef-review" "sef-document")

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

info()  { echo -e "${CYAN}[sef]${NC} $*"; }
ok()    { echo -e "${GREEN}[sef]${NC} $*"; }
warn()  { echo -e "${YELLOW}[sef]${NC} $*"; }
err()   { echo -e "${RED}[sef]${NC} $*" >&2; }

install_to() {
    local target_dir="$1"
    local label="$2"

    mkdir -p "$target_dir"

    local count=0
    for agent in "${AGENTS[@]}"; do
        local src="$AGENTS_DIR/${agent}.md"
        local dst="$target_dir/${agent}.md"

        if [[ ! -f "$src" ]]; then
            err "Executor not found: $src"
            continue
        fi

        cp "$src" "$dst"
        count=$((count + 1))
    done

    ok "Deployed $count executors to $label ($target_dir)"
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
        ok "Removed $count executors from $label ($target_dir)"
    else
        info "No SEF executors found in $label"
    fi
}

show_usage() {
    cat << 'EOF'
Speculative Execution Framework (SEF) — Executor Installer

Usage:
  ./install.sh --user       Deploy executors to ~/.claude/agents/ (all projects)
  ./install.sh --project    Deploy executors to .claude/agents/ (current project)
  ./install.sh --both       Deploy to both locations
  ./install.sh --uninstall  Remove all SEF executors from both locations
  ./install.sh --status     Show where executors are deployed
  ./install.sh --help       Show this message

Executors:
  sef-explore    Haiku   -- Codebase exploration, file search
  sef-validate   Haiku   -- Test execution, builds, validation
  sef-document   Haiku   -- Documentation writing
  sef-implement  Sonnet  -- Code implementation, refactoring
  sef-review     Sonnet  -- Code review, debugging, analysis
EOF
}

show_status() {
    info "Checking executor deployment status..."
    echo ""

    for location_label in "User-level:$USER_DIR" "Project-level:$PROJECT_DIR"; do
        local label="${location_label%%:*}"
        local dir="${location_label##*:}"

        echo "  $label ($dir):"
        local found=0
        for agent in "${AGENTS[@]}"; do
            if [[ -f "$dir/${agent}.md" ]]; then
                local tier="Haiku"
                if [[ "$agent" == "sef-implement" || "$agent" == "sef-review" ]]; then
                    tier="Sonnet"
                fi
                echo "    ${agent}.md  ($tier)"
                found=$((found + 1))
            fi
        done
        if [[ $found -eq 0 ]]; then
            echo "    (no executors deployed)"
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
        info "Deploying executors to user-level (~/.claude/agents/)..."
        install_to "$USER_DIR" "user-level"
        echo ""
        ok "SEF deployment complete. Executors are now active in all Claude Code sessions."
        ;;
    --project)
        info "Deploying executors to project-level (.claude/agents/)..."
        install_to "$PROJECT_DIR" "project-level"
        echo ""
        ok "SEF deployment complete. Executors are now active in this project."
        warn "Consider adding .claude/agents/sef-*.md to .gitignore"
        ;;
    --both)
        info "Deploying executors to all locations..."
        install_to "$USER_DIR" "user-level"
        install_to "$PROJECT_DIR" "project-level"
        echo ""
        ok "SEF deployment complete. All executors deployed."
        warn "Project-level executors take precedence over user-level when both exist."
        ;;
    --uninstall)
        info "Removing SEF executors..."
        uninstall_from "$USER_DIR" "user-level"
        uninstall_from "$PROJECT_DIR" "project-level"
        echo ""
        ok "All executors removed."
        ;;
    --status)
        show_status
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
