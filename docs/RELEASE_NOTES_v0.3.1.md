# Proofpack 0.3.1 release notes

Tag: `v0.3.1`

Status: Published to npm on 2026-11-08 via staged publishing with security-key approval. The Git tag and GitHub Release are created from the final commit.

## Change

- Documentation-only patch for the two-binary package introduced in `0.3.0`.
- README, UX, MCP host examples, and installation snippets now name the executable explicitly: `npx -y --package=proofpack-cli@0.3.1 proofpack ...` and `npx -y --package=proofpack-cli@0.3.1 proofpack-mcp`.
- The release checklist now requires smoke-testing both binaries from a clean temporary install.
- Runtime behavior, CLI flags, MCP protocol contract, and report schema are unchanged.

## Why

`0.3.0` added `proofpack-mcp` alongside `proofpack`. npm cannot infer which executable should run from `npx proofpack-cli@0.3.0 ...` when a package exposes two bins. The published `0.3.0` tarball's README predates the corrected examples; npm does not permit replacing that tarball, so this patch republishes the same runtime with corrected package documentation.

## Verification

- `npm run check`, `npm test`, `npm run build`, and `npm pack --dry-run`.
- CI smoke tests `node dist/cli.js --version` and `node dist/mcp.js < /dev/null` after the build.
- GitHub Actions succeeded for the release-preparation commit on `main`.
- Published package smoke tests: `npx -y --package=proofpack-cli@0.3.1 proofpack --version`, `proofpack check --help`, a `proofpack-mcp` stdio EOF check, and a legacy MCP `initialize` response reporting server version `0.3.1`.

## Boundaries

- The MCP tool remains read-only relative to Git inspection: no project command execution, report-file writing, system opener, network request, or model call.
- `cwd` supplied by an MCP host is a local path, not a sandbox boundary.
- Passing checks are evidence of one invocation, not correctness or security.
- Redaction and share-safe omission are best-effort; review reports before sharing.

## Publication

The version was staged with `PUBLISH_MODE=stage scripts/publish.sh` and approved through npm's security-key flow with `npm stage approve`.

Published tarball metadata:

- `dist.integrity`: `sha512-NWZR+N2sdYNe1Gz7i0CFNFFZ3AKBZ77E+ta/GNuJgtxqLKwAokcVBWzKkddd519A64g635+U6Jm/aFJ/xTTu+g==`
- `dist.shasum`: `3c09086cc5b1068cd6f9bee298d2c67f24b631fb`

The package has no runtime dependencies. The CLI binary is `proofpack`; the MCP binary is `proofpack-mcp`.
