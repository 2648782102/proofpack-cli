# Proofpack 0.3.2 release notes

Tag: `v0.3.2`

Status: Published to npm as `proofpack-cli@0.3.2` on 2026-11-10 (Asia/Shanghai). Runtime and report behavior are unchanged from `0.3.1`.

## Distribution

- Add `mcpName: io.github.2648782102/proofpack` to package metadata for MCP Registry ownership verification.
- Add a matching `server.json` with one npm package and a local stdio transport.
- Add the MCP Registry metadata file to the npm tarball contents.
- Refresh the README first screen around the evidence-receipt use case, a 30-second command, an example report image, and explicit non-goals.
- Add a reproducible demo script, distribution plan, social preview, directory entry, Show HN draft, and Chinese community post draft.
- Expand npm keywords for MCP and developer-tool discovery.

## Verification

- `npm run check`.
- `npm test`.
- `npm run build`.
- `npm pack --dry-run`.
- `mcp-publisher validate server.json` when the publisher CLI is available.
- Clean-install smoke tests for `proofpack` and `proofpack-mcp` after npm approval.
- `npm view proofpack-cli@0.3.2 version dist.integrity dist.shasum mcpName` reports the expected version, integrity, shasum, and `io.github.2648782102/proofpack`.
- `npx -y --package=proofpack-cli@0.3.2 proofpack --version` prints `proofpack 0.3.2` from a clean working directory.
- `npx -y --package=proofpack-cli@0.3.2 proofpack-mcp < /dev/null` exits with clean stdout and stderr from a clean working directory.
- A clean temporary `npm install proofpack-cli@0.3.2` exposes both `proofpack` and `proofpack-mcp` binaries.
- `mcp-publisher validate server.json` passes against the MCP Registry schema.
- `mcp-publisher publish server.json` publishes `io.github.2648782102/proofpack@0.3.2`.
- The MCP Registry search API returns one active, latest record for `io.github.2648782102/proofpack@0.3.2`.

## npm artifact

- `dist.integrity`: `sha512-ZzvIKNWNqvXH/KU4IVcGFm1s/4HlCMZuqHpaVVglsC5yPir89GHM/lPIogQjV4lpWf9PbxZIW+wTK7ccTTdhyA==`
- `dist.shasum`: `8767360b055e2a0c610aa42d2d842adecfa8d47b`

## Boundaries

- The MCP tool remains read-only relative to Git inspection: no project command execution, report-file writing, system opener, network request, or model call.
- CLI `--run` commands are still explicit, unsandboxed, and use the user's shell and privileges.
- Passing checks are evidence of one invocation, not correctness or security.
- The MCP Registry is a preview service; publication is performed through `mcp-publisher`, not a registry pull request.
