# Changelog

All notable changes to Proofpack are documented here. This project is early-stage; report schema versions are independent of npm package versions.

## [0.3.1] - 2026-11-08

### Fixed

- Correct README, UX, MCP host examples, and installation snippets for a package with two binaries by naming `proofpack` or `proofpack-mcp` explicitly.
- Add package-publication smoke checks for both binaries and document the two-binary `npx` behavior in the release checklist.

### Notes

- Runtime behavior, CLI flags, MCP protocol contract, and report schema are unchanged from `0.3.0`.
- The published `0.3.0` tarball cannot be replaced; install `0.3.1` for the corrected package documentation.

[0.3.1]: https://github.com/2648782102/proofpack-cli/releases/tag/v0.3.1

## [0.3.0] - 2026-11-08

### Added

- A read-only shared report core, consumed by both the CLI and the new local MCP stdio adapter.
- `proofpack-mcp`: a zero-runtime-dependency, dual-era MCP server exposing one `proofpack_check` tool with `cwd`, `base`, `format`, and `shareSafe` inputs.
- MCP contract, host configuration, security boundary, verification steps, and protocol reference documentation.
- Automated tests for legacy and modern MCP handshakes, tool calls, share-safe/base reports, protocol errors, malformed input, and stdout cleanliness.

### Safety boundaries

- The MCP tool never executes project commands, writes files, opens a system application, makes network requests, or invokes an LLM.
- Git inspection errors are returned as `isError` tool results; the server remains available.
- The adapter is distributed in `0.3.0`; the earlier `0.2.0` npm tarball remains CLI-only.

[0.3.0]: https://github.com/2648782102/proofpack-cli/releases/tag/v0.3.0

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
