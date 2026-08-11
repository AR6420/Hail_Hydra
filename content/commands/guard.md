---
description: Manually run the Hydra security and quality scan on specified files or directories
allowed-tools: Read, Grep, Glob, Bash
model: haiku
---

# Hydra Guard — Manual Security Scan

Run a focused security and quality scan on the specified files.

**Target**: $ARGUMENTS

If no arguments provided, scan all files changed since the last commit:
```bash
git diff --name-only HEAD 2>/dev/null || echo "Not a git repository or no changes"
```

## Scan Checklist

For each target file, check for:

### CRITICAL (security)
- Hardcoded secrets, API keys, tokens, passwords (patterns: `sk-`, `ghp_`, `AKIA`, `password =`, `secret =`, `token =`, `api_key =`)
- SQL injection vulnerabilities (string concatenation in queries)
- XSS vulnerabilities (unescaped user input in HTML output)
- Unsafe deserialization (`eval()`, `pickle.loads()`, `unserialize()`)
- Path traversal (`../` in file operations without validation)
- Command injection (user input passed to shell commands)

### WARNING (quality)
- `console.log` / `print()` debug leftovers
- TODO/FIXME/HACK comments
- Unused imports (obvious cases only)
- Missing error handling on async operations (no try/catch, no .catch())
- Empty catch blocks
- Hardcoded URLs or magic numbers without constants

### INFO (style)
- Functions longer than 100 lines
- Deeply nested conditionals (3+ levels)
- Inconsistent naming conventions within the same file

## Output Format

```
🐉 Hydra Guard — Security & Quality Report
═══════════════════════════════════════════
Files scanned: 3

🔴 CRITICAL (2 findings)
  src/auth.py:45     Hardcoded API key: OPENAI_KEY = "sk-..."
  src/db.py:78       SQL injection: f-string in query construction

⚠️  WARNING (3 findings)
  src/auth.py:12     console.log left in production code
  src/utils.py:89    Empty catch block — errors silently swallowed
  src/api.py:34      TODO: "fix this later" (line 34)

ℹ️  INFO (1 finding)
  src/handler.py:1   Function process_request is 142 lines long

Summary: 2 critical · 3 warnings · 1 info
```

If no issues found:
```
🐉 Hydra Guard — All Clear ✅
Files scanned: 3 | No issues found.
```

**Important**: This is a FAST scan, not a deep audit. For thorough security review, use hydra-analyst instead.
