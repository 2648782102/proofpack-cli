# User experience

## First run

The user runs `npx proofpack-cli check` in a Git repository. Proofpack inspects Git metadata and diffs, runs no checks, writes a Markdown report to `.proofpack/latest.md`, and prints a short summary plus the report path. If the directory is not a Git repository, it explains how to enter one. If there are no changes, it says so and does not create a misleading empty review.

## One-screen report

The terminal summary uses three sections only:

```text
Proofpack · 4 files changed

Changed   2 modified · 1 added · 1 deleted
Checks    1 passed · 1 failed · 2 not run
Review    2 prompts (workflow file, dependency change)

Report    .proofpack/latest.md
```

The full Markdown report contains:

1. **Change** — base/ref used, file counts, insertions/deletions, changed paths.
2. **Checks** — exact command, start/end time, exit status, output excerpt, truncation/redaction notes.
3. **Not checked** — relevant default checks not explicitly run, without implying that all possible tests are known.
4. **Review prompts** — path, matched rule, reason, and a direct diff link/anchor when feasible.
5. **Limits** — a concise statement that this report does not establish correctness or security.

## Interaction rules

- No interactive setup wizard in MVP.
- No unexplained scores, badges, or pass/fail color as the only signal.
- A failed check and an unrun check are visually distinct.
- Errors say what happened and one next action.
- Every heuristic links to the filename and matching rule.
- Long output is folded/collapsed in HTML in a later version; Markdown remains the canonical report.
- The CLI respects `NO_COLOR` and terminal width and does not require a TTY.
