# Security and privacy

## Data handling

Proofpack is local-first. Default inspection makes no network requests, sends no telemetry, runs no user command, and reads only Git status and diff statistics. With explicit `--run`, Proofpack also captures bounded stdout/stderr, command text, timing, and exit outcomes. Reports may contain proprietary source paths, branch names, commands, and command output; users must review reports before sharing them.

## Safe defaults

- Git inspection only; Proofpack never stages, resets, or commits.
- Never run repository scripts unless the user explicitly supplies `--run` in the current invocation.
- Print each explicit command before execution and run commands sequentially with stdin ignored.
- Bound each output stream to 32 KiB by default (configurable with `--output-limit-bytes`); record observed byte counts and truncation.
- Sanitize ANSI/control sequences and best-effort redact common token/key patterns, URLs with inline credentials, private key blocks, and the current home directory. Record replacement counts.
- Reject explicit output paths outside the repository, inside `.git`, through symbolic links, or over tracked files.
- Resolve `--base` with `--end-of-options` and a pinned commit before diffing; base-mode untracked files are excluded.
- Apply `--share-safe` omission to the evidence model before both renderers; review even share-safe reports before sharing.
- Launch the system opener only with explicit `--open` plus a written Markdown report; no browser upload or network service is used by Proofpack.
- Do not emit raw environment variables in reports.
- Escape terminal control sequences and Markdown table/inline-code output.
- Constrain Git diff inspection with `--no-ext-diff`, `--no-textconv`, and `--no-renames`; invoke Git with argument arrays and `GIT_OPTIONAL_LOCKS=0`.

## Explicit command boundary

`--run` commands use the current user's shell and privileges and inherit the current environment. Proofpack is not a sandbox: an explicit build script or test can read, write, delete, or make network requests with the user's authority. Proofpack does not infer or auto-approve commands, elevate privileges, or isolate the filesystem. Use a separate worktree, container, VM, or other isolation when running untrusted commands.

On timeout or `SIGINT`/`SIGTERM`, Proofpack signals the child process tree and marks remaining commands `not-run`; already-started side effects are not rolled back. Per-command timeout defaults to 120 seconds and is configurable with `--timeout`.

`--open` invokes `open` on macOS, `xdg-open` on Linux/other Unix-like systems, and `cmd /c start` on Windows with the written report path. The opener is OS-provided and may have its own behavior; Proofpack passes no content to a remote service.

## Threats and limitations

Repository filenames, Git metadata, refs, command text, and command output may be malicious. They are treated as data, never instructions. Git is not a sandbox: repository-controlled configuration can still influence Git's behavior. Redaction and share-safe omission are heuristic and incomplete; absence of a replacement does not imply absence of a secret, and aggregate metadata may remain sensitive.

Review prompts are deterministic path/stat heuristics, not vulnerability findings. Absence of a prompt does not imply absence of a vulnerability. A passing check proves only that one command exited zero in one invocation; it does not establish correctness, security, or readiness to merge.

## Reporting security issues

Do not publish exploit details or secrets in public issues. Until a private reporting channel is configured, contact the maintainer through GitHub's private vulnerability reporting feature when available.
