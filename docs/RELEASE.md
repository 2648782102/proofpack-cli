# Release checklist

Use this checklist before publishing `proofpack-cli` to npm. Publication itself remains an explicit maintainer action; this repository does not publish from CI.

## Source and tests

- [ ] Confirm `git status` has no unintended changes.
- [ ] Run `npm install` with the committed lockfile.
- [ ] Run `npm run check`.
- [ ] Run `npm test`.
- [ ] Run `npm run build`.
- [ ] Run `npm pack --dry-run` and confirm the tarball contains only `dist`, `README.md`, `LICENSE`, `docs/RELEASE.md`, and `package.json`.
- [ ] Smoke-test `node dist/cli.js --help` and `node dist/cli.js --version`.
- [ ] Smoke-test `node dist/cli.js check` in a temporary Git repository.
- [ ] Smoke-test one explicit `--run` command with JSON output.
- [ ] Smoke-test `--base <ref>`, `--share-safe`, and `--output` with Markdown/JSON reports.
- [ ] Confirm no fixture secrets, personal paths, or generated reports are staged for publication.

## Package metadata

- [ ] Confirm `package.json` version matches the intended tag and CLI `--version`.
- [ ] Confirm `bin`, `files`, `engines`, license, repository, homepage, and bugs fields.
- [ ] Confirm the package name is available and the maintainer has npm publish rights.
- [ ] Confirm `LICENSE` and `README.md` are included.
- [ ] Confirm no runtime dependencies or install scripts are introduced.

## Security and behavior

- [ ] Default `check` makes no network requests, runs no project command, and writes no file.
- [ ] Explicit `--run` commands are previewed and never discovered automatically.
- [ ] Command output caps, truncation markers, and best-effort redaction are tested.
- [ ] `--share-safe` omits branch, HEAD, base commit, paths, output paths, command text, and output from both Markdown and JSON.
- [ ] `--open` is opt-in, requires a written Markdown report, and does not auto-open by default.
- [ ] `--base` uses `--end-of-options`, resolves a commit, and excludes untracked files from that view.
- [ ] Reports never claim correctness, security, or readiness to merge.

## Distribution

- [ ] Verify macOS (`open`), Linux (`xdg-open`), and Windows (`cmd start`) opener behavior where available.
- [ ] Verify Unix and Windows shell/process-tree cancellation behavior where available.
- [ ] Tag the release after merge; prefer provenance-enabled publishing where the npm account supports it.
- [ ] Create a GitHub release with concise, factual notes and no unverified safety claims.
- [ ] Record the published version and tarball integrity in the release notes.

## Rollback

- [ ] If a bad package is published, do not reuse the version; publish a patch fix and document the affected version.
- [ ] If report schema changes unexpectedly, restore the previous `schemaVersion` behavior in a patch and add a regression test.
