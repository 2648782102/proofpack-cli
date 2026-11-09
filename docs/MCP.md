# Proofpack MCP server

## Status

Implemented and published in npm package `proofpack-cli@0.3.2`. The `0.2.0` tarball remains CLI-only. The package includes the `proofpack-mcp` binary and this document.

## What it is

`proofpack-mcp` is a thin, local stdio adapter around Proofpack's read-only report core. It gives MCP hosts one tool, `proofpack_check`, without changing the CLI's product boundary.

- Transport: newline-delimited JSON-RPC over stdin/stdout; stdout contains protocol messages only.
- Runtime: no network listener, no HTTP server, no daemon, no LLM client, no telemetry.
- Tool behavior: read-only Git inspection; no project command execution and no file writes.
- Report: the same versioned `0.3` evidence model used by `proofpack check`.
- Dependencies: none at runtime; the adapter is written directly against MCP's protocol contract.

## Protocol compatibility

The server is dual-era:

| Era | Opening request | Supported revisions | Response shape |
|---|---|---|---|
| Legacy | `initialize` | `2025-11-25`, `2025-06-18`, `2025-03-26`, `2024-11-05`, `2024-10-07` | `InitializeResult` |
| Modern | `server/discover` or any request with a modern `_meta` envelope | `2026-07-28` | `DiscoverResult` and `resultType: "complete"` results |

The first request pins a stdio connection to one era. A modern client's requests must carry `_meta` fields `io.modelcontextprotocol/protocolVersion` and `io.modelcontextprotocol/clientCapabilities`; `io.modelcontextprotocol/clientInfo` is optional. Unsupported modern revisions return JSON-RPC error `-32022` with the supported list.

Implemented methods:

- Legacy: `initialize`, `tools/list`, `tools/call`, `ping`, `notifications/initialized`.
- Modern: `server/discover`, `tools/list`, `tools/call`, `notifications/cancelled` as an accepted no-op notification.

Unknown methods return `-32601`. JSON-RPC batches and client responses are rejected. A request line over 1 MiB returns `-32600`. On stdin EOF the process exits without writing to stdout.

## Tool contract

Name: `proofpack_check`.

Input schema:

```json
{
  "type": "object",
  "properties": {
    "cwd": { "type": "string" },
    "base": { "type": "string" },
    "format": { "type": "string", "enum": ["markdown", "json"] },
    "shareSafe": { "type": "boolean" },
    "language": { "type": "string", "enum": ["en", "zh-CN"] }
  },
  "additionalProperties": false
}
```

- `cwd`: optional starting directory for Git discovery. It defaults to the MCP server process working directory, which the host controls.
- `base`: optional Git ref for committed, staged, and worktree comparison. Revision suffix syntax `^{...}` is rejected.
- `format`: `markdown` by default, or `json`.
- `shareSafe`: best-effort omission of identifying fields. Even a share-safe report must be reviewed before sharing.
- `language`: display language for Markdown and JSON text fields. Defaults to `en` or `PROOFPACK_LANG`; the argument overrides the environment variable. Schema keys, status values, paths, command stdout, and rule IDs are not translated.

The tool has `readOnlyHint: true`, `destructiveHint: false`, `idempotentHint: true`, and `openWorldHint: false`. It returns the report as one text content block. Tool results also include small `structuredContent` metadata; it is not a correctness verdict. Modern `tools/list` and `tools/call` results use `resultType: "complete"`; modern `server/discover` and `tools/list` include `ttlMs` and `cacheScope`.

If Git inspection fails, the tool returns `isError: true` with a concise reason, rather than terminating the MCP server. Passing no checks is explicit in the report: the adapter never invents test or build evidence.

## Host configuration

For a source checkout after `npm install` and `npm run build`:

```json
{
  "mcpServers": {
    "proofpack": {
      "command": "node",
      "args": ["/absolute/path/to/proofpack-cli/dist/mcp.js"]
    }
  }
}
```

For a published package that exposes `proofpack-mcp`:

```json
{
  "mcpServers": {
    "proofpack": {
      "command": "npx",
      "args": ["-y", "--package=proofpack-cli@0.3.2", "proofpack-mcp"]
    }
  }
}
```

Prefer setting the host process's working directory to the target repository. Use `cwd` only when the host intentionally permits that directory; it is a path supplied to a local tool, not a sandbox boundary.

## Security boundary

The adapter does not expose `--run`, `--output`, `--open`, or system-opener behavior. It does not read repository file contents; Git status and diff statistics are collected with argument arrays and `GIT_OPTIONAL_LOCKS=0`. An MCP host can still invoke a read-only tool automatically, so the host's human-in-the-loop policy remains important.

Reports may contain proprietary paths, branch names, and heuristic prompts. The tool does not upload them; the host decides what to do with returned content. Redaction and share-safe omission are best-effort and are not security guarantees.

## Verification

```sh
npm run check
npm test
npm run build
npm pack --dry-run
node dist/mcp.js < /dev/null
```

Automated tests cover modern discovery/listing/calls, legacy initialization/listing/calls/ping, share-safe output, `--base` through the tool, unsupported versions, invalid arguments, Git errors as tool results, malformed JSON, batches, and stdout cleanliness. They also assert era-specific result envelopes and cache hints.

## References

- [MCP 2026-07-28 stdio transport](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/stdio)
- [MCP 2026-07-28 versioning](https://modelcontextprotocol.io/specification/2026-07-28/basic/versioning)
- [MCP 2026-07-28 discovery](https://modelcontextprotocol.io/specification/2026-07-28/server/discover)
- [MCP 2026-07-28 tools](https://modelcontextprotocol.io/specification/2026-07-28/server/tools)
- [MCP 2025-11-25 lifecycle](https://modelcontextprotocol.io/specification/2025-11-25/basic/lifecycle)
- [Official TypeScript SDK v2 (`@modelcontextprotocol/server`, Apache-2.0)](https://github.com/modelcontextprotocol/typescript-sdk)

The references document the protocol and SDK behavior. Proofpack does not vendor or link SDK code.
