# Security and privacy

## Data handling

Proofpack is local-first. MVP makes no network requests and sends no telemetry. It reads Git status/diff and, only with explicit `--run`, captures the selected command's output. Reports may contain proprietary source paths, code excerpts, command names, and tool output; users must review reports before sharing them.

## Safe defaults

- Inspection only; never stage, modify, reset, or commit.
- Never run repository scripts without explicit `--run`.
- Bound file sizes, diff sizes, command duration, and captured output.
- Do not follow symlinks outside the repository when inspecting untracked files.
- Redact common API-key/token patterns and mark redactions; redaction is best-effort, not a guarantee.
- Do not include environment variables or absolute home paths.
- Escape terminal control sequences and Markdown/HTML output.
- Commands run with the current user's privileges; Proofpack is not a sandbox.

## Threats and limitations

Repository contents, filenames, diffs, and command output may be malicious. They must be treated as data, never instructions. A malicious build script can do anything the current user can do when explicitly run. The MVP does not prevent this. Users should inspect commands and use their own isolation when needed.

Review prompts are heuristic and incomplete. Absence of a prompt does not imply absence of a vulnerability. A successful check proves only that the command exited successfully in that run.

## Reporting security issues

Do not publish exploit details or secrets in public issues. Until a private reporting channel is configured, contact the maintainer through GitHub's private vulnerability reporting feature when available.
