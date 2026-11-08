# Product requirements

## Product

Proofpack produces a compact local acceptance report for an individual reviewing code changes, especially changes made with a coding agent. It helps the user inspect evidence; it does not approve or reject code on the user's behalf.

## User and problem

Primary user: a solo developer using one or more coding assistants in a local Git repository. They want to know what changed and which checks were actually run without adopting a team platform or reading a long agent transcript.

Core job: “Before I keep or share this change, show me the change and the evidence I can verify.”

## Product promise

In under a minute, a user can see:

1. the changed files and diff summary;
2. the checks they explicitly asked Proofpack to run, with command, timing, exit status, and bounded output;
3. checks not run and rule-based items that deserve attention.

Proofpack reports evidence, not correctness. A successful test is not proof that every behavior is correct.

## Phase 3 — implemented

- Inspect a Git working tree with read-only Git subprocesses.
- Summarize changed, added, deleted, renamed, copied, untracked, unmerged, and binary files.
- Print a Markdown report to stdout by default; write it only with an explicit `--output <path>`.
- Run repeatable `--run <command>` checks only when explicitly supplied; preview before execution, capture bounded output, redact common secret patterns best-effort, and mark truncation/redaction.
- Add `--base <ref>` for committed, staged, and worktree comparisons against a resolved Git ref; untracked files are excluded from that view.
- Add `--share-safe` omission for branch, HEAD, base commit, paths, output destination, command text, command output, and prompt evidence.
- Add opt-in `--open` for a written Markdown report using the system opener.
- Offer versioned `0.3` JSON alongside Markdown; multiple formats write `.md` and `.json` siblings.
- Generate deterministic review prompts for dependency manifests/lockfiles, CI workflows, authentication/permission paths, migrations, secret-like filenames, and large deletions.
- Separate observed facts, heuristics, unrun checks, and limitations.
- Make no network requests, collect no telemetry, and invoke no model.

## Later phases — planned

- Add a reviewed `init` only if persisted per-repository defaults prove useful.
- Import CI results or agent traces from documented formats.
- Add a Conchbase adapter only after its public event contract stabilizes.

## Explicitly out of scope

- AI-generated review, correctness scores, automatic approval, or “safe to merge” verdicts.
- Background monitoring, accounts, cloud storage, team dashboards, or telemetry.
- Running package scripts discovered from the repository without an explicit `--run` command.
- Sandboxing arbitrary project commands; explicitly run commands use the user's shell and privileges.
- Parsing proprietary agent session logs or relying on Conchbase APIs.
- Automatically changing Git state, files, permissions, or configuration through inspection.

## Success criteria

- A new user can install/run the CLI and produce a useful report without editing a config file.
- A report makes it impossible to confuse “not run”, “passed”, and “failed”.
- Default inspection makes no network requests and executes no user-supplied command.
- A report can be understood by its author without an AI summary.
- On a small/medium repository, report generation completes promptly and handles binary/large files safely; Git file contents are never read by Proofpack.

## Product boundary with existing projects

Conchbase owns agent execution and policy. Pagurus is its control console. Proofpack is a separate local inspection tool for Git changes and check evidence; it must remain useful without either project. A future adapter may import Conchbase task events, but only after its public event contract is stable.
