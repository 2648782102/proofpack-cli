# Decision 0002: Phase 3 boundaries

- Status: accepted for Phase 3 preparation
- Date: 2026-11-07

## Context

Phase 2 implemented explicit command evidence and versioned reports. Phase 3 needs a usable distribution without expanding the trust boundary. Repository-local `init` would write files to the active worktree, while current project guidance says inspection must be read-only and no file-writing behavior was explicitly requested.

## Decision

Implement `--base`, `--share-safe`, and opt-in `--open`, plus a release checklist and package metadata. Do not implement `init` in this phase. Do not commit, push, publish, or create a release automatically. The default flow remains read-only and local.

## Consequences

- Users can inspect branch/base changes and create a lower-information share artifact without adopting a config file.
- Report schema moves to `0.3`; consumers must treat fields as versioned.
- `--open` invokes the system opener only after an explicit flag and a written Markdown report; it is not a browser upload or network request.
- A future `init` needs separate authorization and design for file conflicts, tracking, and overwrite rules.

## Revisit when

Users repeatedly ask for persisted per-repository defaults, and a read/write design for `init` has been reviewed.
