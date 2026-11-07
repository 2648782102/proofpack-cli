# CLI contract proposal

This document is the proposed user-facing command contract. Avoid breaking flags after the first published release.

## Commands

### `proofpack check`

Inspect the current Git change and write a report. It runs no project checks unless one or more `--run` flags are supplied.

```sh
proofpack check
proofpack check --base main
proofpack check --run "npm test" --run "npm run lint"
proofpack check --format markdown,json
proofpack check --output .proofpack/review.md
```

Options:

- `--base <ref>`: compare against a Git ref; default is working-tree changes plus untracked file metadata.
- `--run <command>`: explicitly run this command from the repository root. Repeatable; shell execution must be clearly shown and require an explicit flag.
- `--output <path>`: report path; default `.proofpack/latest.md`.
- `--format <formats>`: `markdown`, `json`, or both; default `markdown`.
- `--open`: open the generated report after writing it.
- `--help`, `--version`.

MVP safety constraint: if `--run` is supplied, print each command before execution, execute sequentially, capture bounded output, and never elevate privileges. A later design must specify shell semantics and cancellation before implementation.

### `proofpack init` (post-MVP)

Generate an optional starter configuration only after the core flow is usable. It must not overwrite existing files without explicit confirmation.

## Exit codes

- `0`: report generated; all explicitly run checks exited successfully.
- `1`: one or more explicitly run checks failed; report was still generated.
- `2`: invalid arguments or configuration.
- `3`: Git inspection or report generation failed.
- `4`: requested command could not be started or was interrupted.

## Report schema

The JSON format is versioned and contains `schemaVersion`, `generatedAt`, `repository`, `change`, `checks`, `reviewPrompts`, and `limitations`. Commands and outputs are untrusted text. Paths are repository-relative where possible. Output may be redacted or truncated; metadata records both. No raw environment variables, credentials, or absolute home paths are included.

## Open contract questions

- Whether `--base` should default to merge-base with the upstream branch or remain unset.
- Whether command execution belongs in the MVP or should be deferred in favor of importing CI evidence.
- Cross-platform shell behavior and process-tree cancellation.
- Whether untracked file contents should be read; proposal: list paths, inspect only files under a documented size limit, and never follow symlinks outside the repository.
