# Project guidance

Read `docs/DEVELOPMENT.md`, then the relevant product and architecture documents before changing behavior.

- Proofpack is a local-first CLI for individual developers.
- Inspection is read-only. Never modify the worktree, stage changes, or commit.
- Never execute repository commands except those explicitly supplied by the user for this run.
- Do not invoke an LLM, network service, daemon, or telemetry in the MVP.
- Label facts, heuristics, and unknowns separately. Never claim a change is correct based on a passing command alone.
- Keep dependencies minimal and the report understandable without prior setup.
- Run `npm run check`, `npm test`, and `npm run build` after implementation changes.
