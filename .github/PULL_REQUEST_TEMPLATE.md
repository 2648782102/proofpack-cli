## What changed

Describe the user-visible change and link any related issue or discussion.

## Product boundary

- [ ] This change keeps default Git inspection read-only.
- [ ] Any command execution remains explicitly requested by the user.
- [ ] MCP behavior remains read-only and has no project command, file write, opener, network, or model capability.
- [ ] Reports do not claim correctness, security, or readiness to merge.

## Verification

- [ ] `npm run check`
- [ ] `npm test`
- [ ] `npm run build`
- [ ] `npm pack --dry-run`, when package contents or metadata changed

List any platform-specific checks and their results. Mark unverified platforms explicitly.

## Documentation

- [ ] README / CLI / MCP / security / release notes updated where relevant.
- [ ] New behavior and limitations are labeled separately from planned work.
