# Development handoff

## Environment

- Node.js 24+
- TypeScript, ESM, npm
- No runtime dependencies

## Commands

- `npm run dev -- check` — run source CLI during development (from the project root).
- `npm run dev:mcp` — run the source MCP stdio adapter during development.
- `npm run check` — TypeScript validation.
- `npm test` — Node test runner with TypeScript fixtures.
- `npm run build` — compile to `dist/`.

## Repository conventions

- Keep behavior local and deterministic apart from intentional temporary Git fixtures and harmless explicitly created test commands.
- Add fixtures for Git command output; tests must not depend on the user's actual repository.
- Never run commands from fixture repositories unless the test explicitly creates a harmless controlled script.
- Update `docs/CLI.md` when flags, exit codes, or report schema change.
- Update `docs/SECURITY.md` whenever data collection, command execution, or network behavior changes.
- Keep current behavior separate from planned behavior in README and docs.

## Phase 3 implementation

1. Repeatable `--run` commands are explicit, previewed, sequential, bounded, redacted on a best-effort basis, timeout-aware, and never discovered automatically.
2. Git discovery remains read-only and uses porcelain v2 plus numstat.
3. The `0.3` report model has Markdown and JSON renderers, share-safe omission, base metadata, and separates Git facts, observed command outcomes, heuristic prompts, unrun checks, and unknowns.
4. Tests cover paths with spaces, unusual filenames, deleted/renamed files, binary diffs, empty repos, no-change state, ignored files, argument errors, output errors, exit codes, passing/failing/timed-out commands, output caps, redaction, review rules, base refs, and share-safe reports.
5. Sandboxed execution, repository-local `init`, automatic check discovery, and Conchbase integrations remain deferred.

## MCP implementation

1. `src/report-core.ts` owns read-only report generation; the CLI adds optional command evidence and output behavior on top.
2. `src/mcp.ts` owns newline-delimited JSON-RPC framing, dual-era protocol compatibility, argument validation, and tool result shaping. stdout is reserved for protocol messages.
3. The MCP tool never invokes `runChecks`, `resolveReportOutputFiles`, or `openReport`. Tests create temporary Git repositories and communicate with the entrypoint as a subprocess.
4. Update `docs/MCP.md` when protocol versions, methods, tool schemas, or host configuration change.

## Release readiness

- No network requests or telemetry in default or explicit-check paths.
- MCP stdio remains local and emits no stdout outside JSON-RPC responses and errors.
- No implicit execution of package scripts.
- Exit codes documented and tested.
- Reports label unrun checks, command outcomes, and heuristic prompts clearly.
- Package contents exclude fixtures, local reports, and secrets.
- Follow `docs/RELEASE.md` before publication; confirm the npm package, shell compatibility, Windows process-tree behavior, system opener behavior, and redaction caveats.
