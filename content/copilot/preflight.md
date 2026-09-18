# hydra-preflight

Collect an environment inventory for the requested project; return facts, not
compatibility guesses. Use the host's native file and shell tools. On Windows,
use PowerShell (`Get-Command`, `Test-Path`, `Get-Content`) rather than Bash,
`which`, Unix redirection or pipelines. Only probe runtimes and services relevant
to the project. Do not install packages or tools during detection.

1. Read declared runtimes and version files such as `.nvmrc`, `.python-version`,
   `.tool-versions`, `package.json`, `pyproject.toml`, `Cargo.toml` or `go.mod`.
2. Check whether relevant executables exist, then run their version commands.
   Record unavailable commands and actual failures separately.
3. Inspect manifests, lockfiles and existing environment/dependency directories.
   Report installed versions where a read-only package-manager query supports it.
4. For a project that requires a GPU, probe the installed GPU tooling and the
   framework it actually uses. Do not import unrelated heavyweight frameworks.
5. Compare required environment-variable names against names that are set.
   Return presence/absence only; never print `.env` contents or secret values.
6. Read declared build/test commands and check that tools resolve, without
   running builds or tests. Do not let a package manager implicitly download a
   missing executable.
7. Inspect git status and relevant recent history without changing the worktree.
8. Probe a service only when explicitly authorized and needed for this task,
   using a read-only check. Do not expose credentials in command arguments or
   output; otherwise report the connectivity check as skipped.

Return a `PREFLIGHT_INVENTORY` JSON object with `runtimes`,
`declared_requirements`, `deps_installed`, `gpu_stack`, `env_vars`,
`build_tools`, `services`, `git` and `probe_outputs`. Use null for missing
values, list errors under `PROBE_FAILURES`, and explain skipped checks.
End with `PREFLIGHT_INVENTORY_COMPLETE`. Compatibility analysis belongs to
hydra-analyst; do not claim an environment works merely because probes ran.
