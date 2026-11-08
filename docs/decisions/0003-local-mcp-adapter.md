# Decision 0003: Local MCP adapter boundary

- Status: accepted for current source implementation
- Date: 2026-11-08

## Context

The published `0.2.0` package is a CLI. The user wants a direction that lets coding agents reach Proofpack without turning the product into a hosted service or a broad plugin framework. MCP stdio is a local subprocess protocol with broad host support, while the core product promise remains an evidence-first, read-only report.

The MCP specification now includes both a `2026-07-28` modern era with per-request `_meta` envelopes and earlier `initialize`-based handshake versions. Hosts in the wild may use either. The official TypeScript SDK v2 implements both but would add runtime dependencies and a larger surface than this single read-only tool needs.

## Decision

Extract read-only report generation into `src/report-core.ts` and add `src/mcp.ts` as an independent zero-runtime-dependency stdio adapter. The adapter supports legacy and modern MCP openings, advertises one `proofpack_check` tool, and returns the stable `0.3` Markdown or JSON report.

The adapter does not expose `--run`, `--output`, `--open`, command discovery, network calls, model calls, or telemetry. It does not vend SDK code; official specification pages and SDK wire behavior are references only. The published `0.2.0` tarball remains untouched; distribution requires the next package version.

## Consequences

- CLI behavior and report schema stay stable; command execution and output remain CLI-only capabilities.
- The MCP server can be launched by a host with no account, listener, or persistent daemon owned by Proofpack.
- Tool calls are read-only relative to Git inspection, but a host can supply an arbitrary `cwd`; that is not a sandbox boundary.
- Share-safe reports still require human review; the adapter does not add a correctness verdict.
- Implementing protocol framing directly requires regression tests for both eras, malformed messages, unsupported versions, and stdout cleanliness.

## Revisit when

Hosts require an extension feature that this minimal adapter cannot represent, or users repeatedly ask for explicit command execution through MCP. Either case needs a separate trust-boundary decision and must not silently broaden the current tool.
