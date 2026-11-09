# User experience

## First run

The user runs `npx -y --package=proofpack-cli@0.3.2 proofpack check` in a Git repository, or `npx proofpack check` after installing the package locally. Because the published package exposes two binaries, one-command `npx` usage must name the `proofpack` binary explicitly. Proofpack inspects Git metadata and diff statistics, runs no checks, and prints a Markdown report to stdout. Only `--output <path>` writes a file; it prints a short summary and destination paths to stderr. If the directory is not a Git repository, the CLI explains the error and suggests a next action. If there are no changes, the report states that fact and still records that no checks ran.

## Explicit checks

Each `--run` command is previewed on stderr before execution. With a single report format and no output path, the report goes to stdout; command previews never contaminate it. With `--output`, stderr carries a concise result and the written paths.

```text
Proofpack: running check 1/2: npm test
Proofpack: running check 2/2: npm run lint
Proofpack · 4 Git-visible files · 2 passed · 0 failed · 0 not run · 2 review prompts · report written to .proofpack/review.md
Proofpack: wrote .proofpack/review.md
```

`--format json` writes JSON to stdout or the output path. `--format markdown,json` requires `--output` and writes sibling `.md` and `.json` files. The CLI never opens a browser or asks setup questions.

## Full report

The Markdown report contains:

1. **Change** — branch/HEAD, file counts, insertions/deletions, changed paths, index/worktree flags.
2. **Checks** — explicit commands, status, timestamps, duration, exit code/signal, bounded stdout/stderr, truncation, and redaction metadata; or a clear statement that none were supplied.
3. **Not checked** — explicit statements that commands not supplied through `--run` were not executed and no project checks were inferred.
4. **Review prompts** — stable rule ID, path, matched rule, reason, and evidence; unmatched rules are not evidence of safety.
5. **Limits** — correctness, coverage, redaction, heuristic, and sandbox limitations.

The JSON report uses the same `0.3` evidence model. Passing, failing, unrun, timeout, interrupted, and start-error outcomes are distinct values, never represented as one pass/fail color.

## Base and sharing

`--base <ref>` switches the report to committed, staged, and working-tree changes against a resolved commit. The report explicitly says untracked files are excluded and shows the base ref/commit. `--share-safe` replaces identifying fields with `[OMITTED]` and omits command output from both Markdown and JSON while preserving status counts and limitations. `--open` is an explicit last step after a written Markdown report; it never opens a stdout-only report.

`--lang zh-CN` renders headings, labels, limitations, review-prompt text, CLI messages, and the short summary in Simplified Chinese. `PROOFPACK_LANG=zh-CN` provides the same default without a flag; `--lang` takes precedence. English remains the default. Schema keys, status values, paths, command output, and rule IDs remain unchanged so JSON consumers and scripts are unaffected.

## Interaction rules

- No interactive setup wizard, score, badge, or “safe to merge” verdict.
- Errors say what happened and one next action.
- Every heuristic links to the filename and stable rule ID.
- Long command output remains bounded in both Markdown and JSON.
- The CLI respects `NO_COLOR`, emits no color by default, and does not require a TTY.
- HTML folding, a compact terminal dashboard, and an interactive `init` remain future work; Markdown is canonical.

## MCP host

An MCP host launches `proofpack-mcp` as a local subprocess and calls `proofpack_check`. The tool returns one Markdown report by default, or the versioned JSON report with `format: "json"`. No setup wizard, project command, output file, or system opener is involved. The host may supply `cwd`, `base`, `shareSafe`, and `language`; all other evidence limits remain visible in the report.
