# Proofpack 0.3.1 release notes

Tag: `v0.3.1`

Status: Release preparation. npm publication, Git tag, and GitHub Release are pending.

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
- Published package smoke tests after approval: both `proofpack` and `proofpack-mcp` through explicit `npx --package` invocations, plus a legacy MCP `initialize` response.

## Boundaries

- The MCP tool remains read-only relative to Git inspection: no project command execution, report-file writing, system opener, network request, or model call.
- `cwd` supplied by an MCP host is a local path, not a sandbox boundary.
- Passing checks are evidence of one invocation, not correctness or security.
- Redaction and share-safe omission are best-effort; review reports before sharing.

## Publication

The version is staged with `PUBLISH_MODE=stage scripts/publish.sh` and approved through npm's security-key flow. Exact tarball metadata will be recorded here after approval.

- `dist.integrity`: pending
- `dist.shasum`: pending

The package has no runtime dependencies. The CLI binary is `proofpack`; the MCP binary is `proofpack-mcp`.
