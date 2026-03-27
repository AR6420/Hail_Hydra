---
description: View, rebuild, or query the codebase dependency map
allowed-tools: Bash, Read
---

# Hydra Map

Manage the codebase dependency map.

## If no arguments provided: Show Summary

Read `.claude/hydra/codebase-map.json` and display a summary:

```
🐉 Hydra Codebase Map
══════════════════════════════════
Status:     ✅ Current (matches HEAD)
Files:      487 mapped
Built:      2026-03-26 10:00:00
Git hash:   a1b2c3d

Risk Distribution:
  🔴 Critical (7+ deps):   8 files
  🟠 High (4-6 deps):     23 files
  🟡 Medium (2-3 deps):   89 files
  🟢 Low (0-1 deps):     367 files

Test Coverage:
  ✅ Covered:    234 files (48%)
  🟡 Partial:    78 files (16%)
  ❌ Untested:  175 files (36%)

Environment Variables: 12 tracked across 28 files

Top 5 Highest-Risk Files:
  src/services/auth.ts      (12 dependents) 🔴
  src/utils/helpers.ts      (9 dependents)  🔴
  src/config/index.ts       (8 dependents)  🔴
  src/models/user.ts        (7 dependents)  🔴
  src/middleware/cors.ts     (6 dependents)  🟠
```

If the map file doesn't exist, display:
```
🐉 Hydra Codebase Map
══════════════════════════════════
Status:     ❌ Not built

No codebase map found. Run /hydra:map rebuild to build one,
or it will be built automatically on the next hydra-scout dispatch.
```

If the map exists but `_meta.git_hash` doesn't match current `git rev-parse HEAD`:
```
Status:     ⚠️ Stale (map: a1b2c3d, HEAD: e4f5g6h)
```

## If argument is "rebuild": Force Rebuild

Dispatch hydra-scout to do a complete rebuild of the map, regardless of
staleness. Show progress and report when done.

## If argument is a file path: Show Blast Radius

Read the map entry for that file and display:

```
🐉 Blast Radius: src/services/auth.ts
══════════════════════════════════════
Risk: 🔴 CRITICAL (12 dependents)
Test Coverage: ✅ Covered (tests/auth.test.ts, tests/integration/login.test.ts)

Imports (this file depends on):
  → src/models/user.ts
  → src/config/env.ts

Imported By (depends on this file):
  1st degree (direct):
    ← src/api/users.ts
    ← src/api/admin.ts
    ← src/middleware/auth.ts
  2nd degree (indirect):
    ← src/routes/index.ts (via api/users.ts)
    ← src/app.ts (via middleware/auth.ts)

Total Blast Radius: 5 files

Environment Variables Referenced:
  JWT_SECRET (also used in: src/middleware/auth.ts)
  AUTH_TIMEOUT (also used in: src/config/index.ts)

⚠ Changing this file could impact 5 other files.
  Run sentinel after any modifications.
```

If the file is not found in the map, display:
```
File not found in codebase map: <file_path>
The map may be stale. Run /hydra:map rebuild to refresh.
```
