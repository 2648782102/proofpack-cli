# Show HN draft

Title:

```text
Show HN: Proofpack – an evidence receipt for AI-assisted code changes
```

Body:

```text
I kept running into the same gap after using coding agents: the assistant would say "done", but I still had to reconstruct what files changed, which commands actually ran, and what was never checked. Existing tools seemed to either review code with another model or become a team workflow.

Proofpack is a small local CLI and MCP server that produces one Markdown/JSON report. It reads Git status and diff statistics, records only commands I explicitly pass with --run, and separates those observed outcomes from heuristic review prompts and unchecked work. It does not claim correctness or "safe to merge".

The MCP tool is deliberately narrower: proofpack_check is read-only, does not run project commands, write files, open apps, call a model, or make network requests. The CLI can record explicit check evidence when I want it to.

Try it in a Git repo:

  npx -y --package=proofpack-cli@0.3.2 proofpack check --run "npm test"

Source and docs: https://github.com/2648782102/proofpack-cli

I'm the author and would especially like feedback on two things: whether the report makes "not run" sufficiently hard to miss, and whether the CLI/MCP boundary is clear. I'll be around to answer questions.
```

Rules to check before submission:

- Start the title with `Show HN`.
- Submit only when the README and install command are ready to try.
- Explain the personal problem and why the project exists.
- Stay available to answer comments.
- Do not ask friends to upvote or comment.
