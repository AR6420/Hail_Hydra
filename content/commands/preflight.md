---
description: Run two-phase environment and compatibility check before starting a new project build
allowed-tools: Task
---

# Hydra Preflight

Run the two-phase environment and compatibility check before starting work on a
new or unfamiliar project. Catches broken GPU stacks, missing env vars, and
incompatible dependency pairs before they cost hours of debugging.

## Execute the Preflight Protocol

Follow the **Preflight Protocol** defined in SKILL.md — two phases, always
dispatched in sequence. Never skip Phase 2.

### Phase 1 — Detection (dispatch hydra-preflight, Haiku 4.5)

Dispatch the `hydra-preflight` agent with this prompt:

```
Run a full preflight check on this project. Collect runtime versions, run all
GPU/CUDA probe scripts, inventory installed packages, compare .env.example
against .env, verify build tools exist, and check service connectivity. Return
the full structured PREFLIGHT_INVENTORY JSON. Do not make recommendations.
```

Wait for the agent to return `PREFLIGHT_INVENTORY_COMPLETE` before proceeding.

### Phase 2 — Analysis (dispatch hydra-analyst, Sonnet 4.6)

Pass the full PREFLIGHT_INVENTORY from Phase 1 as context and dispatch
`hydra-analyst` with this prompt:

```
You are performing a compatibility analysis on the following environment inventory.
Cross-reference all detected versions against known compatibility matrices.
Pay special attention to GPU stack combinations (PyTorch/CUDA/cuDNN),
framework pairs (React/Next, Python/TF), and Node/native addon combinations.

For each component or pair, return one of three verdicts:
  ✅ COMPATIBLE — versions are known-good together
  ⚠️  KNOWN RISK — this combination has known issues or is untested
  ❌ CONFIRMED BREAK — probe output or known matrix confirms incompatibility

For ❌ verdicts, include the specific fix (e.g. "pin pytorch==2.7.0").
For ⚠️  verdicts, include what to watch for.
For unknowns, flag as "UNVERIFIED — test before building" rather than assuming green.

Probe output from Phase 1 is ground truth — it always beats matrix knowledge.
If torch.cuda.is_available() returned False, that is a ❌ regardless of what
the version matrix says.

INVENTORY:
[paste full PREFLIGHT_INVENTORY here]
```

## Present the Unified Report

After both phases return, present a unified report in this format:

```
🐉 Hydra Preflight — [project name]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

RUNTIMES
  ✅ Node 22.4.0 (matches .nvmrc)
  ✅ Python 3.11.9 (matches .python-version)

GPU STACK
  ❌ PyTorch 2.6.0 + CUDA 13.0 — incompatible
     Fix: pip install torch==2.7.0

ENVIRONMENT
  ⚠️  Missing: DATABASE_URL, REDIS_URL (declared in .env.example)

DEPENDENCIES
  ✅ node_modules present (1,847 packages)
  ✅ venv present

SERVICES
  ❌ PostgreSQL: unreachable (DATABASE_URL not set)
  ✅ Redis: reachable

BUILD TOOLS
  ✅ vite, tsc, pytest all found

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
X confirmed breaks, Y known risks, Z warnings
Fix the ❌ items before building.
```

Auto-suggest pinned-version fixes for ❌ verdicts. **Never** auto-apply fixes
unless the user says "fix it" or "apply fixes".
