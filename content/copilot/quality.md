# Automatic in-task quality review

Applies to every Hydra coding task automatically — no review request needed.
This is an in-task gate, not a background monitor or host hook.

Substantial change: run native `code-review` on the stable diff;
`security-review` for auth, data or input handling; optional `rubber-duck`
for design decisions. Trivial change: check the diff directly.

If independent review is unavailable, the main agent reviews and says so —
self-review is never called independent.

Do not declare the task complete or deploy while a required check fails,
required behavior is unverified, or a confirmed serious finding remains.
Every mode keeps required checks; Economy never waives one, only reduces
optional scrutiny. A later edit invalidates affected evidence — recheck
that scope before accepting it.

The main agent reviews the actual diff, not a worker's "passed" summary.

End every answer with one line that quiet/stfu must not suppress:

`Quality: <review used>; <checks run>; <remaining findings>; <passed|blocked|incomplete>.`
