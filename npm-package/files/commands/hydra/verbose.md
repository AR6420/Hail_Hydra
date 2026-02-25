---
description: Enable verbose Hydra dispatch logs with timing and token estimates
---

# Hydra Verbose Mode

Acknowledge this command and remember for the rest of this session:

**Display DETAILED Hydra Dispatch Logs after every task that involves delegation.**

The verbose log includes extra columns for timing:

```
🐉 Hydra Dispatch Log (verbose)
| Step | Agent               | Task                  | Time  | Verdict     |
|------|---------------------|-----------------------|-------|-------------|
| 1    | hydra-scout (Haiku 4.5)  | Explored auth module | 3.2s  | ✅ Accepted |
| 2    | hydra-coder (Sonnet 4.6) | Fixed null check     | 8.1s  | ✅ Accepted |
| 3    | hydra-guard (Haiku 4.5)  | Security scan        | 1.4s  | ✅ Passed   |
| 4    | hydra-runner (Haiku 4.5) | Ran test suite       | 4.7s  | ✅ Accepted |

Delegation: 4/4 (100%) | Accepted: 4 | Adjusted: 0 | Rejected: 0
Total delegation time: 17.4s | Waves: 2
```

Respond with:
"🐉 Verbose mode enabled. Dispatch logs will include timing details. Use /hydra:quiet to suppress."
