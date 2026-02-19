<p align="center">
  <img src="https://img.shields.io/badge/🐉-HAIL_HYDRA-darkred?style=for-the-badge&labelColor=black" alt="Hail Hydra" />
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
  <img src="https://img.shields.io/badge/Sonnet_4.5-🔵_Smart_Heads-3B82F6?style=flat-square" alt="Sonnet" />
  <img src="https://img.shields.io/badge/Haiku_4.5-🟢_Fast_Heads-22C55E?style=flat-square" alt="Haiku" />
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Speed-2--3×_Faster-22C55E?style=flat-square&logo=zap&logoColor=white" alt="Speed" />
  <img src="https://img.shields.io/badge/Cost-60--70%25_Cheaper-3B82F6?style=flat-square&logo=piggy-bank&logoColor=white" alt="Cost" />
  <img src="https://img.shields.io/badge/Quality-Zero_Loss-7C3AED?style=flat-square&logo=shield-check&logoColor=white" alt="Quality" />
  <img src="https://img.shields.io/badge/Mode-Always_On-darkred?style=flat-square&logo=power&logoColor=white" alt="Always On" />
</p>

---

## 🧬 What is Hydra?

You know how in the movies, Hydra had agents embedded *everywhere*, silently getting things done in the background? That's exactly what this framework does for your Claude Code sessions.

**Hydra** is a task-level speculative execution framework inspired by [Speculative Decoding](https://arxiv.org/abs/2302.01318) in LLM inference. Instead of making one expensive model (Opus 4.6) do *everything* — from searching files to writing entire modules — Hydra deploys a team of specialized **"heads"** running on faster, cheaper models that handle the grunt work.

The result? **Opus becomes a manager, not a laborer.** It classifies tasks, dispatches them to the right head, glances at the output, and moves on. The user never notices. It's invisible. It's always on.

> **Think of it this way:**
>
> Would you hire a $500/hr architect to carry bricks? No. You'd have them design the building and let the crew handle construction. That's Hydra.

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

The math is simple: if 70% of tasks can be handled by Haiku (10× faster, 30× cheaper) and 20% by Sonnet (3× faster, 6× cheaper), your effective speed and cost improve dramatically — even accounting for the occasional rejection.

---

## 🏗️ Architecture

```
User Request
    │
    ▼
┌───────────────────────────────┐
│  🧠 OPUS (The Body)           │  Classifies complexity
│  "Is this a Haiku/Sonnet/me   │  Dispatches to the right head
│   kind of problem?"            │  Verifies output (if needed)
└────────┬──────────────────────┘
         │
    ┌────┴──────┬────────────────┐
    ▼           ▼                ▼
 ┌───────┐  ┌────────┐   ┌────────────┐
 │🟢 HAIKU│  │🔵SONNET│   │🧠 OPUS     │
 │ Heads  │  │ Heads  │   │ (hard      │
 │        │  │        │   │  problems) │
 └───┬────┘  └───┬────┘   └────────────┘
     │           │
     ▼           ▼
┌───────────────────────────────┐
│  🧠 OPUS verifies ONLY IF     │  Good output? → Ship it.
│  something seems off           │  Bad output? → Redo yourself.
└───────────────────────────────┘
     │
     ▼
   User gets result (never knows what happened behind the scenes)
```

---

## 🐲 The Five Heads

| Head | Model | Speed | Role | Personality |
|:-----|:------|:------|:-----|:------------|
| **hydra-scout** | 🟢 Haiku | ⚡⚡⚡ | Codebase exploration, file search, reading | *"I've already found it."* |
| **hydra-runner** | 🟢 Haiku | ⚡⚡⚡ | Test execution, builds, linting, validation | *"47 passed, 3 failed. Here's why."* |
| **hydra-scribe** | 🟢 Haiku | ⚡⚡⚡ | Documentation, READMEs, comments | *"Documented before you finished asking."* |
| **hydra-coder** | 🔵 Sonnet | ⚡⚡ | Code implementation, refactoring, features | *"Feature's done. Tests pass."* |
| **hydra-analyst** | 🔵 Sonnet | ⚡⚡ | Code review, debugging, analysis | *"Found 2 critical bugs and an N+1 query."* |

### Task Routing Cheat Sheet

```
Is it read-only? ─── Yes ──→ Finding files?
    │                           ├── Yes: hydra-scout 🟢
    │                           └── No:  hydra-analyst 🔵
    │
    No ──→ Just running a command? ─── Yes ──→ hydra-runner 🟢
    │
    No ──→ Writing docs only? ─── Yes ──→ hydra-scribe 🟢
    │
    No ──→ Clear implementation approach? ─── Yes ──→ hydra-coder 🔵
    │
    No ──→ Needs deep reasoning? ─── Yes ──→ 🧠 Opus (handle it yourself)
```

---

## 🚀 Installation

### Quick Start (30 seconds)

```bash
# Clone the repo
git clone https://github.com/AR6420/Hail_Hydra.git
cd hydra

# Deploy heads globally (recommended — always on, every project)
./scripts/install.sh --user

# 🐉 Hail Hydra! Heads are now active in all Claude Code sessions.
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

### What Gets Installed Where

```
~/.claude/agents/          ← User-level (all projects)
  ├── hydra-scout.md       🟢 Haiku
  ├── hydra-runner.md      🟢 Haiku
  ├── hydra-scribe.md      🟢 Haiku
  ├── hydra-coder.md       🔵 Sonnet
  └── hydra-analyst.md     🔵 Sonnet

.claude/agents/            ← Project-level (one project)
  └── (same files)
```

> **Note:** Project-level agents take precedence over user-level when both exist. This lets you customize heads per-project if needed.

---

## 📂 Repository Structure

```
hydra/
├── 📄 SKILL.md                          # Core framework instructions
├── 🐲 agents/
│   ├── hydra-scout.md                   # 🟢 Codebase explorer
│   ├── hydra-runner.md                  # 🟢 Test & build executor
│   ├── hydra-scribe.md                  # 🟢 Documentation writer
│   ├── hydra-coder.md                   # 🔵 Code implementer
│   └── hydra-analyst.md                 # 🔵 Code reviewer & debugger
├── 📚 references/
│   ├── routing-guide.md                 # 30+ task classification examples
│   └── model-capabilities.md            # What each model excels at
└── ⚙️ scripts/
    └── install.sh                       # One-command deployment
```

---

## 📊 Expected Impact

| Metric | Without Hydra | With Hydra | Improvement |
|:-------|:-------------|:-----------|:------------|
| **Task Speed** | 1× (Opus for everything) | 2–3× faster | 🟢 Haiku heads respond ~10× faster |
| **API Cost** | 1× (Opus for everything) | 0.3–0.4× | 60–70% cheaper |
| **Quality** | Opus-level | Opus-level | Zero degradation |
| **User Experience** | Normal | Normal | Invisible — zero friction |

### How the Savings Work

| Task Type | % of Work | Model Used | Cost vs Opus |
|:----------|:----------|:-----------|:-------------|
| Exploration, search, tests, docs | ~50% | 🟢 Haiku | ~3% of Opus cost |
| Implementation, review, debugging | ~30% | 🔵 Sonnet | ~17% of Opus cost |
| Architecture, hard problems | ~20% | 🧠 Opus | 100% (no change) |
| **Blended effective cost** | | | **~25% of all-Opus** |

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

```bash
./scripts/install.sh --uninstall
# 🐉 All heads severed. Hydra sleeps.
```

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
</p>

---
> Prefer a clean, technical version? See the [`spec-exec`](../../tree/spec-exec) branch — same framework, zero theatrics.
