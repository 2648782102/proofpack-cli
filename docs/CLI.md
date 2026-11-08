# CLI contract

This document describes the implemented `0.3.1` CLI behavior and clearly marks deferred features. Avoid breaking implemented flags after the first published release. The MCP adapter has a separate contract in `docs/MCP.md` and does not change CLI flags or exit codes.

## Commands

### `proofpack check`

Inspect the current Git change and produce a Markdown or JSON report. Default inspection runs no project checks; every explicitly supplied `--run` command is previewed and executed sequentially.

```sh
proofpack check
proofpack check --output .proofpack/review.md
proofpack check --base main
proofpack check --run "npm test" --run "npm run lint"
proofpack check --run "npm test" --format json
proofpack check --run "npm test" --format markdown,json --output .proofpack/review.md
proofpack check --run "npm test" --share-safe --output .proofpack/share.md
proofpack check --output .proofpack/review.md --open
proofpack check --run "npm test" --timeout 30 --output-limit-bytes 65536
```

Implemented options:

- `--run <command>`: repeatable shell command executed from the repository root. Use `--run=<command>` for values starting with `--`. Commands use the current user's shell (`SHELL` on Unix, `ComSpec` on Windows), current environment, and privileges; they are not sandboxed.
- `--base <ref>`: resolve a Git ref with `rev-parse --verify --end-of-options <ref>^{commit}` and compare committed, staged, and working-tree changes against it. Untracked files are excluded from this view and `staged`/`worktree` file flags are `null`. Default view remains HEAD, index, worktree, and untracked paths. Revision suffix syntax `^{...}` is rejected as input.
- `--format <formats>`: `markdown`, `json`, or `markdown,json`; default `markdown`. A single format can go to stdout or a file. Multiple formats require `--output` and write sibling `.md` and `.json` files.
- `--output <path>`: write the report instead of stdout. Paths are resolved from the repository root, must stay inside it, cannot traverse symbolic links or Git metadata, and cannot overwrite tracked files. For multiple formats, a `.md` or `.json` suffix is replaced; otherwise suffixes are appended.
- `--share-safe`: omit identifying data from both report formats. See the redaction contract below.
- `--open`: open a written Markdown report with the system opener after generation. Requires `--output` and a Markdown format. This is an explicit local action, not an upload or default behavior.
- `--timeout <seconds>`: per-command timeout from 1 to 3600 seconds; default 120. On timeout, Proofpack terminates the process tree and marks remaining commands `not-run`.
- `--output-limit-bytes <count>`: per-stream stdout/stderr cap from 1 to 1048576 bytes; default 32768.
- `--help`, `--version` in command position (`proofpack --help`, `proofpack --version`).

Deferred: `init`, automatic check discovery, AI review, sandboxing, and network integrations. Unknown commands/options return exit code `2`. Repository-local `init` is intentionally omitted because it would write files to the active worktree without a reviewed conflict policy.

### Command execution

Each `--run` command is printed to stderr before execution; in `--share-safe` mode the preview shows `[OMITTED]` instead of command text. Commands run sequentially with stdin ignored. stdout/stderr are each capped at the configured output limit (32 KiB by default), sanitized for terminal control sequences, and redacted on a best-effort basis for common token/key formats, URLs with inline credentials, private key blocks, and the current home directory. Reports record observed byte counts, truncation, and replacement counts. Redaction is not a guarantee; review reports before sharing them.

`SIGINT`/`SIGTERM` stop the active process tree; remaining commands are marked `not-run`. On Unix, Proofpack starts each command in its own process group and signals the group; on Windows it uses `taskkill /T`. Commands may still have side effects before termination.

## Share-safe redaction

`--share-safe` sets `shareSafe: true` in the report and omits branch, HEAD, base ref/commit, repository-relative file paths, previous paths, output destination, command text, command output, error text, and review-prompt evidence. Rule IDs, rule names, reasons, check statuses, timings, exit codes, byte counts, truncation/redaction counters, file kinds, counts, and limitations remain.

Omission is applied to the shared evidence model before Markdown and JSON rendering. It is not a guarantee that aggregate metadata is harmless; users must still review the report.

## Exit codes

- `0`: report generated; no explicitly run check failed and no runner error occurred.
- `1`: one or more explicitly run checks exited nonzero; the report was still generated.
- `2`: invalid arguments or configuration.
- `3`: Git inspection, output validation, report generation, or explicit open failed.
- `4`: an explicitly run command timed out, could not be started, or was interrupted; the report was still generated when possible.

## Markdown report

The Markdown report contains generated time, schema version `0.3`, branch/HEAD, base, untracked-inclusion flag, share-safe flag, output destination, Git-visible file rows, explicit check evidence, unrun checks, review prompts, and limits. Paths and command output are escaped/sanitized for Markdown. No environment variables are emitted.

## JSON report schema version `0.3`

The JSON artifact is an object with `schemaVersion`, `generatedAt`, `repository`, `output`, `shareSafe`, `change`, `checks`, `notChecked`, `reviewPrompts`, and `limitations`.

- `repository`: `branch`, `head`, `changeView`, `base` (`ref`/`commit` or `null`), and `untrackedIncluded`.
- `output`: destination string or `null` in share-safe mode.
- `change`: file counts, categories, diff summary, and per-file path/kind/index/worktree/insertion/deletion/binary fields.
- `checks`: counts plus `results`; each result has `id`, `command`, `status`, timestamps, duration, `exitCode`, `signal`, bounded `stdout`/`stderr`, byte counts, `truncated`, `redacted`, `redactionCount`, `outputLimitBytes`, and `error`.
- `reviewPrompts`: stable `id`, `path`, optional `previousPath`, `rule`, `reason`, and `evidence`.
- `notChecked` and `limitations`: explicit strings; passing checks never appear as a correctness verdict.

Statuses are `passed`, `failed`, `timeout`, `start-error`, `interrupted`, and `not-run`. Only `passed` means an explicitly run command exited zero; even that is evidence of one invocation.

## Open contract questions

- Whether importing CI evidence can replace some explicit command execution.
- Cross-platform shell differences for quoted commands and process-tree cancellation.
- Whether untracked file contents should ever be inspected; currently paths only.
- Whether a future `init` should write a config file, and how it should handle tracked/ignored conflicts.
