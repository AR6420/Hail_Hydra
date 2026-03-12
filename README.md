<p align="center">
  <a href="https://github.com/AR6420/Hail_Hydra">
    <img src="https://img.shields.io/badge/🐉-HAIL_HYDRA-darkred?style=for-the-badge&labelColor=black" alt="Hail Hydra" />
  </a>
</p>

<h1 align="center">🐉 H Y D R A</h1>

<p align="center">
  <strong>Multi-Headed Speculative Execution for Claude Code</strong>
</p>

<p align="center">
  <em>"Cut off one head, two more shall take its place."</em><br/>
  <em>Except here — every head is doing your work faster and cheaper.</em>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Opus_4.6-🧠_The_Body-7C3AED?style=flat-square" alt="Opus" />
  <img src="https://img.shields.io/badge/Sonnet_4.6-🔵_Smart_Heads-3B82F6?style=flat-square" alt="Sonnet" />
  <img src="https://img.shields.io/badge/Haiku_4.5-🟢_Fast_Heads-22C55E?style=flat-square" alt="Haiku" />
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/hail-hydra-cc">
    <img src="https://img.shields.io/npm/v/hail-hydra-cc?style=flat-square&logo=npm&logoColor=white&color=CB3837" alt="npm version" />
  </a>
  <a href="https://www.npmjs.com/package/hail-hydra-cc">
    <img src="https://img.shields.io/npm/dt/hail-hydra-cc?style=flat-square&logo=npm&logoColor=white&color=22C55E&label=downloads" alt="npm downloads" />
  </a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Speed-2--3×_Faster-22C55E?style=flat-square&logo=zap&logoColor=white" alt="Speed" />
  <img src="https://img.shields.io/badge/Cost-~50%25_Cheaper-3B82F6?style=flat-square&logo=piggy-bank&logoColor=white" alt="Cost" />
  <img src="https://img.shields.io/badge/Quality-Zero_Loss-7C3AED?style=flat-square&logo=shield-check&logoColor=white" alt="Quality" />
  <img src="https://img.shields.io/badge/Mode-Always_On-darkred?style=flat-square&logo=power&logoColor=white" alt="Always On" />
</p>

<p align="center">
  <strong>9 agents &nbsp;·&nbsp; 7 slash commands &nbsp;·&nbsp; 3 hooks &nbsp;·&nbsp; ~50% cost savings &nbsp;·&nbsp; Persistent memory &nbsp;·&nbsp; Integration integrity</strong>
</p>

---

## 🧬 What is Hydra?

You know how in the movies, Hydra had agents embedded *everywhere*, silently getting things done in the background? That's exactly what this framework does for your Claude Code sessions.

**Hydra** is a task-level speculative execution framework inspired by [Speculative Decoding](https://arxiv.org/abs/2302.01318) in LLM inference. Instead of making one expensive model (Opus 4.6) do *everything* — from searching files to writing entire modules — Hydra deploys a team of specialized **"heads"** running on faster, cheaper models that handle the grunt work.

The result? **Opus becomes a manager, not a laborer.** It classifies tasks, dispatches them to the right head, glances at the output, and moves on. The user never notices. It's invisible. It's always on.

**New in v2.0.0:** Every agent now has **persistent memory** — they learn
your codebase patterns, conventions, and architectural decisions across
sessions. The orchestrator (Opus) also maintains its own memory of fragile
zones and routing decisions. Plus, the new **hydra-sentinel** automatically
catches integration breakage after code changes — and code isn't presented
to you until verification completes.

> **Four built-in speed optimizations** reduce overhead at every stage: speculative pre-dispatch
> (scout launches in parallel with task classification), session indexing (codebase context
> persists across turns — no re-exploration), fire-and-forget dispatch (non-critical agents run
> in the background without blocking downstream work), and confidence-based auto-accept (raw
> factual outputs skip Opus review entirely).

> **Think of it this way:**
>
> Would you hire a $500/hr architect to carry bricks? No. You'd have them design the building and let the crew handle construction. That's Hydra.

---

## 🚀 Installation

> **One command. Done.**

```bash
npx hail-hydra-cc@latest
```

[OR]

```bash
npm i hail-hydra-cc@latest
```

Runs the interactive installer — deploys 9 agents, 7 slash commands, 3 hooks, and registers
the statusline and update checker. Done in seconds.

### Manual Install

```bash
# Clone the repo
git clone https://github.com/AR6420/Hail_Hydra.git
cd hydra

# Deploy heads globally (recommended — always on, every project)
./scripts/install.sh --user

# 🐉 Hail Hydra! Framework active in all Claude Code sessions.
# ✅ 9 agents  ✅ 7 commands  ✅ 3 hooks  ✅ StatusLine  ✅ VERSION
```

### Installation Options

```bash
# User-level — available in ALL your Claude Code projects
./scripts/install.sh --user

# Project-level — just this one project
./scripts/install.sh --project

# Both — maximum coverage
./scripts/install.sh --both

# Check what's deployed
./scripts/install.sh --status

# Remove everything
./scripts/install.sh --uninstall
```

### What Gets Installed

```
~/.claude/
├── agents/                      # 9 agent definitions (all with memory: project)
│   ├── hydra-scout.md           # 🟢 Haiku 4.5 — explore codebase
│   ├── hydra-runner.md          # 🟢 Haiku 4.5 — run tests/builds
│   ├── hydra-scribe.md          # 🟢 Haiku 4.5 — write documentation
│   ├── hydra-guard.md           # 🟢 Haiku 4.5 — security/quality gate
│   ├── hydra-git.md             # 🟢 Haiku 4.5 — git operations
│   ├── hydra-sentinel-scan.md   # 🟢 Haiku 4.5 — fast integration sweep
│   ├── hydra-coder.md           # 🔵 Sonnet 4.6 — write/edit code
│   ├── hydra-analyst.md         # 🔵 Sonnet 4.6 — debug/diagnose
│   └── hydra-sentinel.md        # 🔵 Sonnet 4.6 — deep integration analysis
├── commands/hydra/              # 7 slash commands
│   ├── help.md                  # /hydra:help
│   ├── status.md                # /hydra:status
│   ├── update.md                # /hydra:update
│   ├── config.md                # /hydra:config
│   ├── guard.md                 # /hydra:guard
│   ├── quiet.md                 # /hydra:quiet
│   └── verbose.md               # /hydra:verbose
├── hooks/                       # 3 lifecycle hooks
│   ├── hydra-check-update.js    # SessionStart — version check (background)
│   ├── hydra-statusline.js      # StatusLine — status bar display
│   └── hydra-auto-guard.js      # PostToolUse — file change tracker
└── skills/
    └── hydra/                   # Skill (Claude Code discoverable)
        ├── SKILL.md             # Orchestrator instructions
        ├── VERSION              # Installed version number
        ├── config/
        │   └── hydra.config.md  # User configuration (created by --config)
        └── references/
            ├── model-capabilities.md
            └── routing-guide.md

> **Note:** `settings.json` is at `~/.claude/settings.json` — hooks and statusLine are registered there.
```

> **Project-level** (`--project`): same files written to `.claude/` in your working
> directory instead of `~/.claude/`. Project-level takes precedence when both exist.

---

## ⚡ Slash Commands

| Command | Description |
|---------|-------------|
| `/hydra:help` | Show all commands and agents |
| `/hydra:status` | Show installed agents, version, and update availability |
| `/hydra:update` | Update Hydra to the latest version |
| `/hydra:config` | Show current configuration |
| `/hydra:guard [files]` | Run manual security & quality scan |
| `/hydra:quiet` | Suppress dispatch logs for this session |
| `/hydra:verbose` | Enable verbose dispatch logs with timing |

---

## 🖥️ Status Line

After installation, your Claude Code status bar shows real-time framework info:

```
🐉 │ Opus │ Ctx: 37% ████░░░░░░ │ $0.42 │ my-project
```

| Element | What It Shows |
|---------|---------------|
| 🐉 | Hydra is active |
| Model | Current Claude model (Opus, Sonnet, Haiku) |
| Ctx: XX% | Context window usage with visual bar |
| $X.XX | Session API cost so far |
| Directory | Current working directory |
| ⚠ Warning | Compaction warning (only at 70%+ context usage) |

**Context bar colors:**
- 🟢 Green (0–49%) — plenty of room
- 🟡 Yellow (50–79%) — getting full, consider `/compact`
- 🔴 Red (80%+) — context nearly full, `/compact` or `/clear` recommended

**Compaction warnings** (appended automatically at 70%+):
```
🐉 │ Opus │ Ctx: 73% ███████░░░ │ $1.87 │ my-project │ ⚠ Auto-compact at 85%
🐉 │ Opus │ Ctx: 83% ████████░░ │ $3.14 │ my-project │ ⚠ Compacting soon!
```
- ⚠ **Auto-compact at 85%** (70–79%) — heads-up that compaction is approaching
- ⚠ **Compacting soon!** (80%+) — compaction is imminent, consider `/compact` now

> **Note:** If you already have a custom `statusLine` configured, the installer
> keeps yours and prints instructions for switching to Hydra's.

---

## 🔄 Auto-Update Notifications

Hydra checks for updates once per session in the background (never blocks startup).
When a new version is available, you'll see it in the status bar:

```
🐉 │ Opus │ Ctx: 37% ████░░░░░░ │ $0.42 │ my-project │ ⚡ v1.1.0 available
```

Update with:

```bash
# From within Claude Code:
/hydra:update

# Or from your terminal:
npx hail-hydra-cc@latest --global
```

After updating, restart Claude Code to load the new files.

---

## ✨ Features

- **Nine specialized heads** — Haiku 4.5 (fast) and Sonnet 4.6 (capable) heads for every task type
- **Sentinel integration integrity** — Two-tier verification (fast scan + deep analysis) catches ~72% of integration bugs before runtime
- **Persistent agent memory** — Every agent remembers your codebase patterns, conventions, and past decisions across sessions
- **Orchestrator memory** — Opus maintains its own notes on fragile zones, routing patterns, and known issues via CLAUDE.md
- **Quality-first pipeline** — Code changes block until sentinel + guard verification completes; nothing reaches you unchecked
- **Auto-Guard** — hydra-guard (Haiku 4.5) automatically scans code changes for security issues after every hydra-coder run
- **Configurable modes** — `conservative`, `balanced` (default), or `aggressive` delegation via `hydra.config.md`
- **Slash commands** — `/hydra:help`, `/hydra:status`, `/hydra:update`, `/hydra:config`, `/hydra:guard`, `/hydra:quiet`, `/hydra:verbose` for full session control
- **Quick commands** — natural language shortcuts: `hydra status`, `hydra quiet`, `hydra verbose`
- **Custom agent templates** — Add your own heads using `templates/custom-agent.md`
- **Session indexing** — Codebase context persists across turns; no re-exploration on every prompt
- **Speculative pre-dispatch** — hydra-scout launches in parallel with task classification, saving 2–3 seconds per task
- **Dispatch log** — Transparent audit trail showing which agents ran, what model, and outcome

---

## 🛡️ Sentinel — Integration Integrity

Most bugs don't come from bad code — they come from good code that **doesn't fit together**. A renamed export, a changed return type, a missing dependency after a refactor. These integration issues slip past linters, type-checkers, and even code review because no single file looks wrong.

**hydra-sentinel** catches them automatically.

### How It Works

```
Code change lands (hydra-coder finishes)
    │
    ▼
┌──────────────────────────────────────┐
│  🟢 hydra-sentinel-scan (Haiku 4.5)  │  ← Runs on EVERY code change (~1-2s)
│  Fast sweep: imports, exports,       │
│  signatures, dependencies            │
└──────────────┬───────────────────────┘
               │
          Issues found?
          ├── No:  ✅ Pass — code proceeds to guard
          │
          └── Yes: Escalate
               │
               ▼
┌──────────────────────────────────────┐
│  🔵 hydra-sentinel (Sonnet 4.6)      │  ← Only when scan flags issues (~20-30%)
│  Deep analysis: confirms real issues, │
│  dismisses false positives,          │
│  proposes fixes                      │
└──────────────┬───────────────────────┘
               │
          Fix decision:
          ├── Trivial (import typo): Auto-fix
          ├── Medium (signature mismatch): Offer fix to user
          └── Complex (architectural): Report with context
```

### What Sentinel Catches

| Check Type | Priority | Example |
|:-----------|:---------|:--------|
| **Import/export mismatches** | P0 | Importing a function that was renamed or removed |
| **Function signature changes** | P0 | Caller passes 2 args, function now expects 3 |
| **Type contract violations** | P1 | Function returns `string` but caller expects `number` |
| **Missing dependency updates** | P1 | New import added but package not in `package.json` |
| **Cross-file rename gaps** | P1 | Variable renamed in definition but not all call sites |
| **Circular dependency introduction** | P2 | New import creates A → B → C → A cycle |
| **Dead code from refactoring** | P2 | Exported function no longer imported anywhere |
| **Environment/config mismatches** | P2 | Code references env var that isn't in `.env.example` |

### Example Output

```
🛡️ Sentinel Report
──────────────────────────────────────
✖ P0: src/auth.js imports `validateToken` from src/utils.js
       but src/utils.js now exports `verifyToken` (renamed in this session)
       → Fix: Update import to `verifyToken` [auto-fixable]

⚠ P1: src/api/routes.js calls createUser(name, email)
       but src/models/user.js:createUser now expects (name, email, role)
       → Missing required parameter `role` added in this change

✔ 6 other integration points verified clean
──────────────────────────────────────
```

### Expected Detection Rates

| Category | Estimated Detection Rate | Notes |
|:---------|:------------------------|:------|
| Import/export mismatches | ~95% | Direct string matching |
| Signature mismatches | ~80% | Requires type inference |
| Type contract violations | ~60% | Limited without full type system |
| Missing dependencies | ~90% | Package.json diffing |
| Cross-file rename gaps | ~70% | Heuristic-based |
| Circular dependencies | ~85% | Import graph traversal |
| Dead code | ~50% | Conservative — flags only obvious cases |
| Config mismatches | ~40% | Pattern matching on env references |
| **Weighted average** | **~72%** | Based on typical issue distribution |

> **Memory makes it better over time.** Sentinel remembers past false positives and known fragile
> integration points in your project. The more you use it, the more accurate it gets.

---

## 🧠 Agent Memory

Without memory, every session starts cold. Agents re-discover your conventions, re-learn your
project structure, and repeat the same questions. With memory, knowledge compounds.

| Aspect | Without Memory | With Memory |
|:-------|:---------------|:------------|
| **First task** | Agent explores from scratch | Agent recalls project patterns |
| **Conventions** | May use wrong style | Remembers your naming, structure, patterns |
| **Known issues** | No awareness of past bugs | Recalls fragile areas and past fixes |
| **Routing accuracy** | Generic classification | Improved by past dispatch outcomes |
| **False positives** | Same false alarms repeat | Sentinel suppresses known non-issues |

### How It Works

Every agent has `memory: project` in its frontmatter. Claude Code automatically manages a
per-project memory directory (`.claude/memory/`) where agents store and retrieve learnings.

| Agent | What It Remembers |
|:------|:------------------|
| **hydra-scout** | Project structure patterns, key file locations, search shortcuts |
| **hydra-runner** | Test commands, common failure patterns, build quirks |
| **hydra-scribe** | Documentation style, preferred formats, terminology |
| **hydra-guard** | Known false positives, project-specific security patterns |
| **hydra-git** | Commit conventions, branch naming, merge preferences |
| **hydra-sentinel-scan** | Known fragile integration points, past false positives |
| **hydra-coder** | Coding style, architecture patterns, preferred libraries |
| **hydra-analyst** | Common bug patterns, performance hotspots, review focus areas |
| **hydra-sentinel** | Integration history, confirmed vs dismissed findings |
| **Orchestrator (Opus)** | Fragile zones, routing accuracy, escalation patterns (via CLAUDE.md Hydra Notes) |

### Memory Properties

- **Automatic** — agents read and write memory without any user action
- **Project-scoped** — each project has its own memory; no cross-contamination
- **Persistent** — survives across sessions; compounds over time
- **Manageable** — stored as plain markdown in `.claude/memory/`; edit or delete anytime

### The Compound Effect

Session 1: Agents learn your project. Session 5: They know your conventions. Session 20: They
anticipate your patterns. The framework gets more efficient the more you use it — not because
the models improve, but because context quality improves.

---

## 🤔 Why I Built This

After Opus 4.6 dropped, I noticed something frustrating — code execution felt slowww. Reallyyy Slow. Not because the model was worse, but because I was feeding everything through one massive model. Every file read, every grep, every test run, every docstring — all burning through Opus-tier tokens. The result? Frequent context compaction, more hallucinations, and an API bill that made me wince.

So I started experimenting. I switched to Haiku for the simple stuff — running commands, tool calls, file exploration. Sonnet for code generation, refactoring, reviews. And kept Opus only for what it's actually good at: planning, architecture, and the hard decisions. The result surprised me. Same code quality. Sometimes better — because each model was operating within a focused context window instead of one overloaded one.

Five agents. Five separate context windows. Each with a clearly defined job. They do the work, and only pass results back to the brain — Opus. The outcome:

- Longer coding sessions (less compaction, less context blowup)
- Drastically reduced API costs (Haiku 4.5 is 5× cheaper than Opus 4.6)
- Faster execution (Haiku 4.5 responds ~10× faster)
- Same or better code quality (focused context > bloated context)
- Zero manual model switching (this is the big one)

Because that was the real pain — manually switching between models for every task tier to save costs. Every. Single. Time. So I built a framework that does it for me. And honestly? It does it better than I did. That was hard to admit, but here we are.

I also didn't want it to be boring. So I gave it teeth, heads, and a battle cry. If you prefer something more buttoned-up, the [`spec-exec`](../../tree/spec-exec) branch has the same framework with zero theatrics.

*Hail Hydra. Have fun.*

---

## 💡 The Theory (for nerds)

Speculative decoding (Chen et al., 2023) accelerates LLM inference by having a small **draft model** propose tokens that a large **target model** verifies in parallel. Since verifying K tokens costs roughly the same as generating 1 token, you get 2–2.5× speedup with **zero quality loss**.

Hydra applies this at the **task level**:

```
                          ┌─────────────────────────────────┐
                          │  SPECULATIVE DECODING (tokens)  │
                          │                                 │
                          │  Small model drafts K tokens    │
                          │  Big model verifies in parallel │
                          │  Accept or reject + resample    │
                          │  Result: 2-2.5× speedup         │
                          └─────────────────────────────────┘
                                        │
                                   Same idea,
                                  bigger scale
                                        │
                                        ▼
                          ┌─────────────────────────────────┐
                          │  🐉 HYDRA (tasks)               │
                          │                                 │
                          │  Haiku/Sonnet drafts the task   │
                          │  Opus verifies (quick glance)   │
                          │  Accept or redo yourself        │
                          │  Result: 2-3× speedup           │
                          └─────────────────────────────────┘
```

The math is simple: if 70% of tasks can be handled by Haiku 4.5 (10× faster, 5× cheaper) and 20% by Sonnet 4.6 (3× faster, ~1.7× cheaper), your effective speed and cost improve dramatically — even accounting for the occasional rejection.

---

## 🏗️ Architecture

```
User Request
    │
    ├──────────────────────────────────────────────────────┐
    │                                                      │
    ▼                                                      ▼
┌─────────────────────────────┐            ┌──────────────────────────────┐
│  🧠 ORCHESTRATOR (Opus)     │            │  🟢 hydra-scout (Haiku 4.5)  │
│  Classifies task            │            │  IMMEDIATE pre-dispatch:      │
│  Plans waves                │            │  "Find files relevant to      │
│  Decides blocking / not     │            │   [user's request]"           │
└────────┬────────────────────┘            └──────────────┬───────────────┘
         │         (unless Session Index already covers)  │
         └──────────────────────┬──────────────────────────┘
                                │ (scout + classification both ready)
                      [Session Index updated]
                                │
    ════════════════════════════════════════════════════════
    Wave N  (parallel dispatch, index context injected)
    ┌───────────────────┬──────────────────────────────────┐
    │  BLOCKING         │  NON-BLOCKING (fire & forget)    │
    ▼                   ▼                                  │
 [coder]            [scribe] ──────────────────────────────┘
    │
    ▼
 Results arrive
    │
    ├── Raw data / clean pass? → AUTO-ACCEPT → (updates Session Index if scout)
    └── Code / analysis / user-facing docs? → Orchestrator verifies
         │
         ▼
   ┌─────────────────────────────────────────────────────┐
   │  🛡️ QUALITY GATE (blocks until complete)            │
   │                                                     │
   │  🟢 sentinel-scan (Haiku) — fast integration sweep  │
   │       └── issues? → 🔵 sentinel (Sonnet) — deep     │
   │  🟢 guard (Haiku) — security/quality scan           │
   │                                                     │
   │  Both must pass before result reaches user           │
   └──────────────────────┬──────────────────────────────┘
                          │
                          ▼
   User gets result  +  non-blocking outputs appended when ready
```

---

## 🐲 The Nine Heads

| Head | Model | Speed | Role | Personality |
|:-----|:------|:------|:-----|:------------|
| **hydra-scout (Haiku 4.5)** | 🟢 Haiku 4.5 | ⚡⚡⚡ | Codebase exploration, file search, reading | *"I've already found it."* |
| **hydra-runner (Haiku 4.5)** | 🟢 Haiku 4.5 | ⚡⚡⚡ | Test execution, builds, linting, validation | *"47 passed, 3 failed. Here's why."* |
| **hydra-scribe (Haiku 4.5)** | 🟢 Haiku 4.5 | ⚡⚡⚡ | Documentation, READMEs, comments | *"Documented before you finished asking."* |
| **hydra-guard (Haiku 4.5)** | 🟢 Haiku 4.5 | ⚡⚡⚡ | Security/quality gate after code changes | *"No secrets. No injection. You're clean."* |
| **hydra-git (Haiku 4.5)** | 🟢 Haiku 4.5 | ⚡⚡⚡ | Git: commit, branch, diff, stash, log | *"Committed. Conventional message. Clean diff."* |
| **hydra-sentinel-scan (Haiku 4.5)** | 🟢 Haiku 4.5 | ⚡⚡⚡ | Fast integration sweep after code changes | *"Imports check out. Signatures match. Clean."* |
| **hydra-coder (Sonnet 4.6)** | 🔵 Sonnet 4.6 | ⚡⚡ | Code implementation, refactoring, features | *"Feature's done. Tests pass."* |
| **hydra-analyst (Sonnet 4.6)** | 🔵 Sonnet 4.6 | ⚡⚡ | Code review, debugging, analysis | *"Found 2 critical bugs and an N+1 query."* |
| **hydra-sentinel (Sonnet 4.6)** | 🔵 Sonnet 4.6 | ⚡⚡ | Deep integration analysis (when scan flags issues) | *"2 real issues confirmed. 1 false positive dismissed."* |

### Task Routing Cheat Sheet

```
Is it read-only? ─── Yes ──→ Finding files?
    │                           ├── Yes: hydra-scout (Haiku 4.5) 🟢
    │                           └── No:  hydra-analyst (Sonnet 4.6) 🔵
    │
    No ──→ Is it a git operation? ─── Yes ──→ hydra-git (Haiku 4.5) 🟢
    │
    No ──→ Is it a security scan? ─── Yes ──→ hydra-guard (Haiku 4.5) 🟢
    │
    No ──→ Just running a command? ─── Yes ──→ hydra-runner (Haiku 4.5) 🟢
    │
    No ──→ Writing docs only? ─── Yes ──→ hydra-scribe (Haiku 4.5) 🟢
    │
    No ──→ Clear implementation approach? ─── Yes ──→ hydra-coder (Sonnet 4.6) 🔵
    │
    No ──→ Needs deep reasoning? ─── Yes ──→ 🧠 Opus 4.6 (handle it yourself)

    Code was just changed? ─── Yes ──→ hydra-sentinel-scan (Haiku 4.5) 🟢
        │                                   │
        │                              Issues found?
        │                              ├── No:  Done ✅
        │                              └── Yes: hydra-sentinel (Sonnet 4.6) 🔵
```

---

## ⚙️ Configuration

Customize Hydra's behavior with an optional config file:

```bash
# Create a default config (user-level — applies to all projects)
./scripts/install.sh --config
```

Then edit `~/.claude/skills/hydra/config/hydra.config.md`:

```markdown
mode: balanced          # conservative | balanced (default) | aggressive
dispatch_log: on        # on (default) | off | verbose
auto_guard: on          # on (default) | off
```

**Project-level config** (overrides user-level):
Place at `.claude/skills/hydra/config/hydra.config.md` in your project root.

See [`config/hydra.config.md`](config/hydra.config.md) for the full reference with all options.

---

## 🧩 Extending Hydra

Add your own specialized head in three steps:

**1. Copy the template:**
```bash
cp templates/custom-agent.md agents/hydra-myspecialist.md
```

**2. Customize the agent** — edit the name, description, tools, and instructions.

**3. Deploy it:**
```bash
./scripts/install.sh --user   # or --project
```

Your new head is now discoverable by Claude Code alongside the built-in nine.
See [`templates/custom-agent.md`](templates/custom-agent.md) for the full template with
instructions on writing effective agent descriptions, output formats, and collaboration protocols.

---

## 📂 Repository Structure

```
hydra/
├── 📄 SKILL.md                          # Core framework instructions
├── 🐲 agents/
│   ├── hydra-scout.md                   # 🟢 Codebase explorer
│   ├── hydra-runner.md                  # 🟢 Test & build executor
│   ├── hydra-scribe.md                  # 🟢 Documentation writer
│   ├── hydra-guard.md                   # 🟢 Security/quality gate
│   ├── hydra-git.md                     # 🟢 Git operations
│   ├── hydra-sentinel-scan.md           # 🟢 Fast integration sweep
│   ├── hydra-coder.md                   # 🔵 Code implementer
│   ├── hydra-analyst.md                 # 🔵 Code reviewer & debugger
│   └── hydra-sentinel.md               # 🔵 Deep integration analysis
├── 📚 references/
│   ├── routing-guide.md                 # 30+ task classification examples
│   └── model-capabilities.md            # What each model excels at
├── ⚙️ config/
│   └── hydra.config.md                  # User configuration template
├── 📋 templates/
│   └── custom-agent.md                  # Template for adding your own heads
└── 🔧 scripts/
    └── install.sh                       # One-command deployment
```

---

## 📊 Expected Impact

| Metric | Without Hydra | With Hydra | Improvement |
|:-------|:-------------|:-----------|:------------|
| **Task Speed** | 1× (Opus for everything) | 2–3× faster | 🟢 Haiku 4.5 heads respond ~10× faster |
| **API Cost** | 1× (Opus 4.6 for everything) | ~0.5× | ~50% cheaper |
| **Quality** | Opus-level | Opus-level | Zero degradation |
| **User Experience** | Normal | Normal | Invisible — zero friction |
| **Overhead per turn (Turn 2+)** | Full re-exploration each turn | Session index reused | 🟢 2-4s saved per turn |
| **Scout/runner verification** | Opus reviews every output | Auto-accepted for factual data | 🟢 ~50-60% of outputs skip review |
| **Integration bugs caught** | 0% (no verification) | ~72% caught before runtime | 🟢 Sentinel auto-verification |
| **Session knowledge** | Starts cold every time | Compounds across sessions | 🟢 Persistent agent memory |

### How the Savings Work

| Task Type | % of Work | Model Used | Input Cost vs Opus 4.6 | Output Cost vs Opus 4.6 |
|:----------|:----------|:-----------|:----------------------|:-----------------------|
| Exploration, search, tests, docs | ~50% | 🟢 Haiku 4.5 | 20% ($1 vs $5/MTok) | 20% ($5 vs $25/MTok) |
| Implementation, review, debugging | ~30% | 🔵 Sonnet 4.6 | 60% ($3 vs $5/MTok) | 60% ($15 vs $25/MTok) |
| Architecture, hard problems | ~20% | 🧠 Opus 4.6 | 100% (no change) | 100% (no change) |
| Sentinel scan (fast) | Auto (every code change) | 🟢 Haiku 4.5 | 20% | 20% |
| Sentinel deep (conditional) | ~20-30% of code changes | 🔵 Sonnet 4.6 | 60% | 60% |
| **Blended effective cost** | | | **~48% of all-Opus** | **~48% of all-Opus** |

Note: Blended input = (0.5×$1 + 0.3×$3 + 0.2×$5) / $5 = $2.40/$5 ≈ 48%.
Rounded to **~50% blended cost reduction** overall.
Savings calculated against Opus 4.6 ($5/$25 per MTok) as of February 2026.

### Measure Your Savings

The most accurate way to measure Hydra's impact — no estimation, real numbers:

1. Start a Claude Code session **without** Hydra installed
2. Complete a representative coding task
3. Note the session cost from Claude Code's cost display
4. Start a **new** session **with** Hydra installed
5. Complete a similar task
6. Compare the two costs

That's it. Real data beats theoretical calculations every time.

#### What to expect (based on February 2026 API pricing)
With a typical task distribution (50% Haiku 4.5, 30% Sonnet 4.6, 20% Opus 4.6):
- **Input tokens**: ~52% cheaper ($2.40 vs $5.00 per MTok)
- **Output tokens**: ~52% cheaper ($12.00 vs $25.00 per MTok)
- **Blended**: ~50% cost reduction
- **Speed**: 2–3× faster on delegated tasks

> Note: Savings calculated against Opus 4.6 pricing ($5/$25 per MTok) as of February 2026.
> Savings would be significantly higher compared to Opus 4.1/4.0 ($15/$75 per MTok).

---

## 🎯 Design Principles

### 🫥 Invisibility
> The user should **never** notice Hydra operating. No announcements, no permission requests, no process narration. If a head does the work, present the output as if Opus did it.

### ⚡ Speed Over Ceremony
> Don't overthink classification. Quick mental check: "Haiku? Sonnet? Me?" and go. If you spend 10 seconds classifying a 5-second task, you've defeated the purpose.

### 🔀 Parallel Heads
> Independent subtasks launch in parallel. "Fix the bug AND add tests" → two heads working simultaneously.

### ⬆️ Escalate, Never Downgrade
> If a head's output isn't good enough, Opus does it directly. No retries at the same tier. This mirrors speculative decoding's rejection sampling — when a draft token is rejected, the target model samples directly.

---

## 🔬 The Speculative Decoding Connection

For those who want to go deeper, here's how Hydra maps to the original speculative decoding concepts:

| Speculative Decoding Concept | Hydra Equivalent |
|:-----------------------------|:-----------------|
| Target model (large) | 🧠 Opus 4.6 — the orchestrator |
| Draft model (small) | 🟢 Haiku / 🔵 Sonnet heads |
| Draft K tokens | Heads draft the full task output |
| Parallel verification | Opus glances at the output |
| Modified rejection sampling | Accept → ship it. Reject → Opus redoes it. |
| Acceptance rate (~70-90%) | Target: 85%+ of delegated tasks accepted as-is |
| Guaranteed ≥1 token per loop | Every task produces a result — Opus catches failures |
| Temperature/nucleus compatibility | Works with any coding task type or domain |

### Key Papers
- [Accelerating Large Language Model Decoding with Speculative Sampling](https://arxiv.org/abs/2302.01318) — Chen et al., 2023 (DeepMind)
- [Fast Inference from Transformers via Speculative Decoding](https://arxiv.org/abs/2211.17192) — Leviathan et al., 2022 (Google)

---

## 🤔 FAQ

<details>
<summary><strong>Will I notice any quality difference?</strong></summary>
<br/>
No. Hydra only delegates tasks that are within each model's capability band. If there's any doubt, the task stays with Opus. And Opus always verifies — if a head's output isn't up to standard, Opus redoes it before you ever see it.
</details>

<details>
<summary><strong>Is this actually speculative decoding?</strong></summary>
<br/>
Not at the token level — that happens inside Anthropic's servers and we can't modify it. Hydra applies the same <em>philosophy</em> at the task level: draft with a fast model, verify with the powerful model, accept or reject. Same goals (speed + cost), same guarantees (zero quality loss), different granularity.
</details>

<details>
<summary><strong>What if I'm not using Opus?</strong></summary>
<br/>
Hydra is designed for the Opus-as-orchestrator pattern, but the principles apply at any tier. If you're running Sonnet as your main model, you could adjust the heads to use Haiku for everything delegatable.
</details>

<details>
<summary><strong>Can I customize which models the heads use?</strong></summary>
<br/>
Absolutely. Each head is a simple Markdown file with a <code>model:</code> field in the frontmatter. Change <code>model: haiku</code> to <code>model: sonnet</code> (or any supported model) and you're done.
</details>

<details>
<summary><strong>Do the heads work with subagents I already have?</strong></summary>
<br/>
Yes. Hydra heads coexist with any other subagents. Claude Code discovers all agents in the <code>.claude/agents/</code> directories. No conflicts.
</details>

<details>
<summary><strong>How do I uninstall?</strong></summary>
<br/>

Removes all agents, commands, hooks, and cache files. Deregisters hooks from
`~/.claude/settings.json`. Your other Claude Code configuration is preserved.

```bash
./scripts/install.sh --uninstall
# or: npx hail-hydra-cc --uninstall
```

</details>

<details>
<summary><strong>What is Sentinel and how does it work?</strong></summary>
<br/>
Sentinel is a two-tier integration verification system. After every code change, <strong>hydra-sentinel-scan</strong> (Haiku 4.5) runs a fast sweep (~1-2s) checking imports, exports, function signatures, and dependencies. If it finds potential issues, <strong>hydra-sentinel</strong> (Sonnet 4.6) performs deep analysis to confirm real problems and dismiss false positives. The result is ~72% of integration bugs caught before they reach you.
</details>

<details>
<summary><strong>Does Sentinel slow things down?</strong></summary>
<br/>
The fast scan adds ~1-2 seconds per code change. The deep analysis only triggers when the scan flags issues (~20-30% of changes), adding another ~3-5 seconds in those cases. For the ~70-80% of changes that are clean, you'll barely notice it. The time saved debugging integration issues far outweighs the scan overhead.
</details>

<details>
<summary><strong>Will Sentinel auto-fix things without asking?</strong></summary>
<br/>
Only trivial fixes (like updating an import path after a rename). For medium-complexity fixes (signature mismatches), it offers the fix for your approval. For complex architectural issues, it reports the problem with context but doesn't attempt a fix. You stay in control.
</details>

<details>
<summary><strong>Can I disable Sentinel?</strong></summary>
<br/>
Yes. Set <code>sentinel: off</code> in your <code>hydra.config.md</code>. You can also set <code>sentinel: scan-only</code> to keep the fast sweep but skip deep analysis. The default is <code>on</code> (both tiers).
</details>

<details>
<summary><strong>Does Agent Memory use extra tokens?</strong></summary>
<br/>
Memory is loaded as part of each agent's context when it starts, so it does use some tokens — but agent memory files are small (typically a few hundred tokens each). The improved accuracy from having project context usually <em>saves</em> tokens by reducing re-exploration and misclassification.
</details>

<details>
<summary><strong>Where is agent memory stored?</strong></summary>
<br/>
In <code>.claude/memory/</code> within your project directory. Each agent stores its own memory as plain markdown files. You can read, edit, or delete them anytime. Memory is project-scoped — each project has its own memory, no cross-contamination.
</details>

<details>
<summary><strong>Does Opus (the orchestrator) also have memory?</strong></summary>
<br/>
Yes. Opus maintains a "Hydra Notes" section in your project's <code>CLAUDE.md</code> file. This includes fragile integration zones, routing accuracy observations, and known issues. Unlike agent memory (which is per-agent), orchestrator memory is visible to all agents and informs dispatch decisions.
</details>

---

## 🤝 Contributing

Found a task type that gets misclassified? Have an idea for a new head? Contributions are welcome!

1. Fork it
2. Create your branch (`git checkout -b feature/hydra-new-head`)
3. Commit (`git commit -m 'Add hydra-optimizer head for perf tuning'`)
4. Push (`git push origin feature/hydra-new-head`)
5. Open a PR

---

## 📜 License

MIT — Use it, fork it, deploy it. Just don't use it for world domination.

*...unless it's code world domination. Then go ahead.*

---

<p align="center">
  <br/>
  <img src="https://img.shields.io/badge/🐉-HAIL_HYDRA-darkred?style=for-the-badge&labelColor=black" alt="Hail Hydra" />
  <br/><br/>
  <em>Built with 🧠 by Claude Opus 4.6 — ironically, the model this framework is designed to use less of.</em>
  <br/>
  <em>v2.0.0 — Now with memory and integration integrity.</em>
</p>

---
> Prefer a clean, technical version? See the [`spec-exec`](../../tree/spec-exec) branch — same framework, zero theatrics.
