# Open-source references

Reviewed 2026-11-07 for product overlap and implementation ideas. Recheck repository content and license before copying code or depending on behavior.

| Project | Relevant approach | Borrow conceptually | Keep distinct | License status |
|---|---|---|---|---|
| [Agent Run Trace Pack](https://aolingge.github.io/agent-run-trace-pack/) | Wrap a run and package output, Git diff, exit status, and risk signals | Compact evidence bundle; deterministic fixture approach | Proofpack defaults to no command execution and starts with a simple acceptance report | Verify repository license before code reuse; landing page is not a license grant |
| [Stroq](https://stroq.dev/docs/) | Local hooks, command/session audit, secret redaction, integrity checks, skill/MCP vetting | Local evidence, redaction, explicit limits | Do not recreate policy interception or a broad agent-security suite | Verify current LICENSE in source repository before reuse |
| [nd7](https://nd7.dev/) | OS-enforced sandbox and audit log | Clear trust boundary; show command intent vs observed behavior | Sandboxing is out of MVP; do not imply Proofpack provides isolation | Verify current LICENSE in source repository before reuse |
| [Agenttrail](https://github.com/sodiumsun/agenttrail) | Local visibility into repository and agent activity | Low-friction summary and progressive detail | No live map/3D activity dashboard; report remains a one-shot artifact | Verify current LICENSE in source repository before reuse |
| [PR-Agent](https://github.com/qodo-ai/pr-agent) | AI PR description/review and command workflows | Familiar PR entry point may be a later adapter | No LLM review or inline PR comments in MVP | MIT according to repository metadata at time of review; verify before reuse |
| [Worktrunk](https://github.com/max-sixty/worktrunk) | Git worktree management for parallel agents | Potential future workflow integration | Do not manage branches/worktrees in MVP | MIT OR Apache-2.0 according to repository metadata at time of review; verify before reuse |

## Design conclusion

The adjacent space is crowded around agent interception, dashboards, sandboxing, and AI code review. Proofpack should remain deliberately small: a local Git change summary plus evidence of explicitly run checks, with “not checked” visible. Its differentiator is the evidence-first report and conservative defaults, not a new model or orchestration framework.

## Reuse policy

This table records product research, not legal advice or blanket permission. Before copying source, confirm the exact upstream repository, pinned revision, applicable license, notices, and dependency obligations. Prefer independent implementation from public behavior descriptions unless code reuse is necessary.
