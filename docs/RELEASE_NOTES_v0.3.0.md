# Proofpack 0.3.0 release notes

Tag: `v0.3.0`

Status: Release preparation. npm publication, Git tag, and GitHub Release are pending.

## Highlights

- A shared, read-only report core now backs both the CLI and the local MCP stdio adapter.
- `proofpack-mcp` exposes one `proofpack_check` tool with `cwd`, `base`, `format`, and `shareSafe` inputs.
- The adapter supports modern `2026-07-28` and legacy `initialize`-based MCP openings without runtime dependencies.
- MCP server metadata reports the package version `0.3.0`.
- Host configuration, protocol behavior, security boundaries, and verification steps are documented in `docs/MCP.md`.
- Automated tests cover both MCP eras, tool calls, share-safe and base reports, protocol errors, malformed input, and stdout cleanliness.

## Verification

- Node.js 24.
- `npm run check`, `npm test`, `npm run build`, and `npm pack --dry-run`.
- CI smoke tests `node dist/cli.js --version` and `node dist/mcp.js < /dev/null` after the build.
- Local package smoke tests after publication: `npx proofpack-cli@0.3.0 --version` and the `proofpack-mcp` binary through `npx`.

## Boundaries

- The MCP tool is read-only relative to Git inspection: no project command execution, report-file writing, system opener, network request, or model call.
- `cwd` supplied by an MCP host is a local path, not a sandbox boundary.
- Passing checks are evidence of one invocation, not correctness or security.
- Redaction and share-safe omission are best-effort; review reports before sharing.
- The published `0.2.0` tarball remains CLI-only; this release does not modify it.

## Publication

Publication metadata will be recorded here after npm accepts version `0.3.0`.

- `dist.integrity`: pending
- `dist.shasum`: pending

The package has no runtime dependencies. The CLI binary is `proofpack`; the MCP binary is `proofpack-mcp`.
