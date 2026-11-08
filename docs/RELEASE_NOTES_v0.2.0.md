# Proofpack 0.2.0 release notes

Tag: `v0.2.0`

Status: Published to npm on 2026-11-08 via staged publishing with 2FA approval.

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
- Published package smoke test: `npx proofpack-cli@0.2.0 --version` and `check --help`.

## Boundaries

- Default `check` makes no network request, runs no project command, and writes no file.
- Explicit commands are not sandboxed and may modify the working tree.
- Passing checks are evidence of one invocation, not correctness or security.
- Redaction and share-safe omission are best-effort; review reports before sharing.
- The repository is public as of 2026-11-08.

## Publication

Direct `npm publish` was blocked by npm's current account policy: a granular access token with bypass 2FA can stage a package but cannot directly publish a package that does not yet exist. The release was staged with `PUBLISH_MODE=stage scripts/publish.sh` and approved with 2FA using `npm stage approve`.

Published tarball metadata:

- `dist.integrity`: `sha512-QQE6gm7aiEt3nwohp9GDI33sWI1V430Re0TJS9htO1j9FICJEfaOYMR4PU+j1P5H2Ck+ed8kij+zbicsC8ROMg==`
- `dist.shasum`: `b9be0399f8b6ea8604efb09ad41807c2ede0a88e`

The package has no runtime dependencies. `npx proofpack-cli@0.2.0 check --help` resolves the `proofpack` binary. GitHub Release notes use the existing `v0.2.0` tag; no second tag is created.
