# Distribution and promotion

This document records repository-owned distribution assets. It does not publish anything automatically.

## Repository metadata

Set these values in the GitHub repository settings:

- Description: `Local, read-only acceptance reports for AI-assisted code changes — CLI + MCP.`
- Homepage: `https://github.com/2648782102/proofpack-cli#readme`
- Topics: `mcp`, `mcp-server`, `cli`, `git`, `developer-tools`, `local-first`, `ai-coding`, `typescript`, `nodejs`
- Social preview: use `docs/assets/proofpack-report.svg` or a terminal recording made from `scripts/demo.sh`.
- Discussions: enabled, with a `Feedback / MCP host compatibility` welcome post.

README and package metadata are the source of truth for the install command. Keep the version in examples synchronized with `package.json`.

## First 30-day goal

Prefer evidence over vanity metrics:

- 10 real outside trials.
- 5 reproducible feedback items.
- Compatibility confirmation from at least 2 MCP hosts.
- GitHub referrers showing which channel brought visitors.

Stars, forks, and npm downloads are secondary signals. npm download counts may include CI and maintainer smoke tests.

## MCP Registry

The package includes `mcpName` in `package.json` and a matching `server.json`. Both use `io.github.2648782102/proofpack` and version `0.3.2`.

Publishing order matters:

1. Commit and push the `0.3.2` preparation.
2. Publish `proofpack-cli@0.3.2` to npm. Publication is a maintainer action and may require staged publishing with 2FA.
3. Verify the live package contains `mcpName` and both binaries.
4. Install `mcp-publisher`, then run `mcp-publisher login github` and `mcp-publisher publish` from this repository.
5. Validate `server.json` before publishing with `mcp-publisher validate`.

Do not open a pull request against `modelcontextprotocol/registry` to add the server. The registry hosts metadata submitted by `mcp-publisher`; its preview may still reset data.

## Community directories and posts

Assets:

- `docs/assets/awesome-mcp-servers.md` — one-line entry and PR checklist.
- `docs/assets/show-hn.md` — Show HN title/body and submission rules.
- `docs/assets/community-post.md` — Chinese article draft.
- `scripts/demo.sh` — reproducible 30-second terminal demo.

Order:

1. Finish metadata, README, and demo.
2. Publish the MCP Registry record.
3. Submit one accurate directory PR.
4. Publish one Show HN or one Chinese community post, not both on the same day.
5. Reply to feedback and record reproducible issues before the next release.

## Guardrails

- Do not buy stars, ask for vote brigades, send unsolicited DMs, or paste links into unrelated issues.
- Do not describe Proofpack as AI review, an approval gate, a correctness score, or a "safe to merge" verdict.
- Do not treat the `2026-11-07` npm download spike as user adoption.
- Do not claim Windows/Linux behavior has been manually verified unless the corresponding release checklist is completed.
- Review every share-safe report before publishing it; redaction is best-effort.
