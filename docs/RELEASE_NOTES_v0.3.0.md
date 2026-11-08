# Proofpack 0.3.0 release notes

Tag: `v0.3.0`

Status: Published to npm on 2026-11-08 via staged publishing with security-key approval. The Git tag and GitHub Release are created from the final commit.

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
- GitHub Actions succeeded for the release-preparation commit on `main`.
- Published package smoke tests: `npx -y --package=proofpack-cli@0.3.0 proofpack --version`, `proofpack check --help`, a `proofpack-mcp` stdio EOF check, and a legacy MCP `initialize` response reporting server version `0.3.0`.

## Boundaries

- The MCP tool is read-only relative to Git inspection: no project command execution, report-file writing, system opener, network request, or model call.
- `cwd` supplied by an MCP host is a local path, not a sandbox boundary.
- Passing checks are evidence of one invocation, not correctness or security.
- Redaction and share-safe omission are best-effort; review reports before sharing.
- The published `0.2.0` tarball remains CLI-only; this release does not modify it.

## Publication

Direct `npm publish` was blocked by npm's current account policy: the granular access token can stage a package but cannot directly publish. Version `0.3.0` was staged with `PUBLISH_MODE=stage scripts/publish.sh` and approved using a security-key one-time password with `npm stage approve`.

Published tarball metadata:

- `dist.integrity`: `sha512-StYl6DD+SUsWrugtsp38T4mB8Z17J4YoJ1K6lmbImEO9orBl+9DRF/WYFA+QyOaM/maZ1TgTg0+td7lI/0Uuuw==`
- `dist.shasum`: `6d83162728f977a6316186ab6045017c0d27afb1`

The package has no runtime dependencies. The CLI binary is `proofpack`; the MCP binary is `proofpack-mcp`.

Because the package now exposes two binaries, a one-command `npx` invocation must name the executable explicitly, for example `npx -y --package=proofpack-cli@0.3.0 proofpack check`. After `npm install --save-dev proofpack-cli@0.3.0`, `npx proofpack check` works from the project. The older single-binary `npx proofpack-cli@0.2.0 ...` form does not select an executable for `0.3.0`. The `0.3.0` npm README predates these corrected examples; install `0.3.1` for the corrected package documentation.
