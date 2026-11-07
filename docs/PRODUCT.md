# Product requirements

## Product

Proofpack produces a compact local acceptance report for an individual reviewing code changes, especially changes made with a coding agent. It helps the user inspect evidence; it does not approve or reject code on the user's behalf.

## User and problem

Primary user: a solo developer using one or more coding assistants in a local Git repository. They want to know what changed and which checks were actually run without adopting a team platform or reading a long agent transcript.

Core job: “Before I keep or share this change, show me the change and the evidence I can verify.”

## Product promise

In under a minute, a user can see:

1. the changed files and diff summary;
2. the checks they explicitly asked Proofpack to run, with command, timestamp, exit status, and concise output;
3. checks not run and rule-based items that deserve attention.

Proofpack reports evidence, not correctness. A successful test is not proof that every behavior is correct.

## MVP

- Inspect a Git working tree without modifying it.
- Summarize changed, added, deleted, renamed, and untracked files.
- Run only check commands explicitly passed to the current invocation; default behavior runs none.
- Capture exit status and bounded output, redact common secret formats, and note truncation.
- Generate a self-contained Markdown report and optional JSON evidence file under `.proofpack/`.
- Identify a small documented set of risk signals: dependency manifests/lockfiles, CI/workflow files, permission/authentication code, migrations, secret-like filenames, and large deletions.
- Mark signals as “review prompt”, never as a vulnerability finding.
- Add `--open` only as an explicit user action after report generation; do not auto-open a browser.

## Explicitly out of scope for MVP

- AI-generated review, correctness scores, automatic approval, or “safe to merge” verdicts.
- Background monitoring, accounts, cloud storage, team dashboards, or telemetry.
- Running package scripts discovered from the repository without an explicit command from the user.
- Sandboxing arbitrary project commands; MVP does not run commands by default.
- Parsing proprietary agent session logs or relying on Conchbase APIs.
- Automatically changing Git state, files, permissions, or configuration.

## Success criteria

- A new user can install/run the CLI and produce a useful report without editing a config file.
- A report makes it impossible to confuse “not run” with “passed”.
- Default inspection makes no network requests and executes no project command.
- A report can be understood by its author without an AI summary.
- On a small/medium repository, report generation completes promptly and handles binary/large files safely.

## Product boundary with existing projects

Conchbase owns agent execution and policy. Pagurus is its control console. Proofpack is a separate local inspection tool for Git changes and check evidence; it must remain useful without either project. A future adapter may import Conchbase task events, but only after its public event contract is stable.
