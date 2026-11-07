# Development handoff

## Environment

- Node.js 24+
- TypeScript, ESM, npm
- No runtime dependencies in the initial scaffold

## Commands

- `npm run dev -- check` — run source CLI during development.
- `npm run check` — TypeScript validation.
- `npm test` — Node test runner with TypeScript fixtures.
- `npm run build` — compile to `dist/`.

## Repository conventions

- Keep behavior local and deterministic.
- Add fixtures for Git command output; tests must not depend on the user's actual repository.
- Never run commands from fixture repositories unless the test explicitly creates a harmless controlled script.
- Update `docs/CLI.md` when flags, exit codes, or report schema change.
- Update `docs/SECURITY.md` whenever data collection, command execution, or network behavior changes.
- Keep current behavior separate from planned behavior in README and docs.

## First implementation sequence

1. Decide whether command execution belongs in MVP; default recommendation is defer, but the CLI contract currently allows explicit `--run` as Phase 2.
2. Implement Git discovery and status parsing as read-only functions.
3. Define stable report schema and markdown renderer.
4. Cover paths with spaces, unusual filenames, deleted/renamed files, binary diffs, empty repos, and no-change state.
5. Add opt-in command runner only after security behavior is specified and reviewed.

## Release readiness

- No network requests in default path.
- No implicit execution of package scripts.
- Exit codes documented and tested.
- Reports label unrun checks and heuristic prompts clearly.
- Package contents exclude fixtures, local reports, and secrets.
