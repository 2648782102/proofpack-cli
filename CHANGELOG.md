# Changelog

All notable changes to Proofpack are documented here. This project is early-stage; report schema versions are independent of npm package versions.

## [Unreleased]

### Added

- A read-only shared report core, consumed by both the CLI and the new local MCP stdio adapter.
- `proofpack-mcp`: a zero-runtime-dependency, dual-era MCP server exposing one `proofpack_check` tool with `cwd`, `base`, `format`, and `shareSafe` inputs.
- MCP contract, host configuration, security boundary, verification steps, and protocol reference documentation.
- Automated tests for legacy and modern MCP handshakes, tool calls, share-safe/base reports, protocol errors, malformed input, and stdout cleanliness.

### Safety boundaries

- The MCP tool never executes project commands, writes files, opens a system application, makes network requests, or invokes an LLM.
- Git inspection errors are returned as `isError` tool results; the server remains available.
- The adapter is not included in the already published `0.2.0` npm tarball and requires the next package version for distribution.

## [0.2.0] - 2026-11-07

### Added

- Read-only Git change inspection with porcelain v2 status and diff numstat.
- Repeatable explicit `--run` checks with previews, sequential execution, timeouts, output caps, best-effort redaction, and interruption handling.
- Markdown and versioned `0.3` JSON reports with checks, unrun checks, limitations, and review prompts.
- Deterministic review prompts for dependency files, CI workflows, authentication/permission paths, migrations, secret-like filenames, and large deletions.
- `--base <ref>` comparison against a resolved Git commit, with untracked files excluded from that view.
- `--share-safe` report omission, opt-in `--open`, `--format markdown,json`, `--timeout`, and `--output-limit-bytes`.
- Release checklist, package metadata, CI package dry-run, and 40 automated tests.

### Safety boundaries

- Default `check` makes no network request, runs no project command, and writes no file.
- Explicit commands are not sandboxed and may modify the working tree; reports never claim correctness or readiness to merge.
- Redaction and share-safe omission are best-effort; review reports before sharing.
- Repository-local `init` is intentionally deferred because it would write files to the active worktree.

[0.2.0]: https://github.com/2648782102/proofpack-cli/releases/tag/v0.2.0
