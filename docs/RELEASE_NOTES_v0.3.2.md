# Proofpack 0.3.2 release notes

Tag: `v0.3.2`

Status: Prepared for publication. Runtime and report behavior are unchanged from `0.3.1`.

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

## Boundaries

- The MCP tool remains read-only relative to Git inspection: no project command execution, report-file writing, system opener, network request, or model call.
- CLI `--run` commands are still explicit, unsandboxed, and use the user's shell and privileges.
- Passing checks are evidence of one invocation, not correctness or security.
- The MCP Registry is a preview service; publication is performed through `mcp-publisher`, not a registry pull request.
