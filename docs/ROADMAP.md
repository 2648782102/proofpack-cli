# Roadmap

## Phase 0 — preparation (mostly implemented)

- Product, UX, CLI, architecture, security, reference, and development documents.
- TypeScript CLI scaffold, repository metadata, CI, and issue templates.
- Confirm the first-run experience and command-execution policy with real personal repositories; remaining item before publishing a package.

## Phase 1 — read-only report (historical)

- Parse arguments and locate Git repository.
- Collect porcelain status and diff summary without modifying the working tree.
- Generate Markdown report with changed files and explicit limitations.
- Add deterministic fixtures for modified, untracked, deleted, renamed, binary, and empty changes.

## Phase 2 — explicit check evidence (historical)

- Add repeatable `--run` with preview, sequential execution, timeout, cancellation, output cap, redaction, and clear exit behavior.
- Add versioned `0.2` JSON output and report schema documentation.
- Add rule-based review prompts with explanations and tests.

## Phase 3 — usable distribution (preparation implemented)

- Add `--base`, `--share-safe`, opt-in `--open`, `0.3` reports, package metadata, and a release checklist.
- Published `0.2.0` to npm through staged publishing with 2FA approval; future releases remain explicit maintainer actions.
- Add a reviewed `init` only if persisted defaults are requested.
- Measure first-run friction through opt-in feedback, without telemetry by default.

## Phase 4 — local MCP adapter (implemented in `0.3.0`)

- Extract a shared read-only report core.
- Add a zero-dependency, dual-era MCP stdio server with one `proofpack_check` tool.
- Document host configuration, protocol compatibility, security boundaries, and verification.
- Publish the adapter in `0.3.0`; do not modify the already published `0.2.0`.

## Later, only if users ask

- Import CI results or agent traces from documented formats.
- GitHub PR summary adapter.
- Conchbase event adapter after its event contract stabilizes.
- Host-specific plugin packages only if a concrete host API requires one.
- Sandboxed command execution as a separately designed feature.
