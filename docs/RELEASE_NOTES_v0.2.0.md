# Proofpack 0.2.0 release notes draft

Tag: `v0.2.0`

Status: GitHub tag pushed; npm publication pending an authorized publish credential.

## Highlights

- Read-only Git change summary with explicit untracked-file handling.
- Explicit `--run` check evidence with timing, exit status, bounded output, timeout, redaction, and truncation metadata.
- Markdown and versioned `0.3` JSON reports.
- Deterministic review prompts for dependency, CI, auth/permission, migration, secret-like filename, and large-deletion heuristics.
- `--base <ref>` comparison, `--share-safe` omission, and opt-in local `--open`.
- Release checklist, publish script, changelog, package metadata, and 40 automated tests.

## Verification

- Node.js 24.
- `npm run check`, `npm test`, `npm run build`, `npm pack --dry-run`.
- Clean checkout install/build/test smoke.
- Local tarball CLI smoke for `--version`, default check, explicit check, `--base`, and share-safe report.
- GitHub Actions succeeded for `main` and `v0.2.0`.

## Boundaries

- Default `check` makes no network request, runs no project command, and writes no file.
- Explicit commands are not sandboxed and may modify the working tree.
- Passing checks are evidence of one invocation, not correctness or security.
- Redaction and share-safe omission are best-effort; review reports before sharing.
- The repository is private unless visibility is changed explicitly.

## Publication

Direct `npm publish` was blocked by npm's account policy: two-factor authentication or a granular access token with bypass 2FA is required. After an authorized credential is available, run `NPM_TOKEN=<token> scripts/publish.sh`, then verify `npm view proofpack-cli@0.2.0 version dist.integrity`.

For the GitHub Release UI, use the existing `v0.2.0` tag and these notes. Do not create a second tag.
