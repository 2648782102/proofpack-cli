# Roadmap

## Phase 0 — preparation

- Product, UX, CLI, architecture, security, reference, and development documents.
- TypeScript CLI scaffold, repository metadata, CI, and issue templates.
- Confirm the first-run experience and command-execution policy with real personal repositories.

## Phase 1 — read-only report

- Parse arguments and locate Git repository.
- Collect porcelain status and diff summary without modifying the working tree.
- Generate Markdown report with changed files and explicit limitations.
- Add deterministic fixtures for modified, untracked, deleted, renamed, binary, and empty changes.

## Phase 2 — explicit check evidence

- Add repeatable `--run` with preview, sequential execution, timeout, cancellation, output cap, redaction, and clear exit behavior.
- Add versioned JSON output and report schema documentation.
- Add rule-based review prompts with explanations and tests.

## Phase 3 — usable distribution

- Publish npm package after a release checklist and provenance review.
- Add optional `--open` and share-safe export flow.
- Measure first-run friction through opt-in feedback, without telemetry by default.

## Later, only if users ask

- Import CI results or agent traces from documented formats.
- GitHub PR summary adapter.
- Conchbase event adapter after its event contract stabilizes.
- Sandboxed command execution as a separately designed feature.
