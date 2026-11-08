# Release checklist

Use this checklist before publishing `proofpack-cli` to npm. Publication itself remains an explicit maintainer action; this repository does not publish from CI.

## Source and tests

- [ ] Confirm `git status` has no unintended changes.
- [ ] Run `npm install` with the committed lockfile.
- [ ] Run `npm run check`.
- [ ] Run `npm test`.
- [ ] Run `npm run build`.
- [ ] Run `npm pack --dry-run` and confirm the tarball contains only `dist`, `README.md`, `CHANGELOG.md`, `LICENSE`, `docs/RELEASE.md`, `docs/MCP.md`, and `package.json`.
- [ ] Smoke-test `node dist/cli.js --help` and `node dist/cli.js --version`.
- [ ] Smoke-test `node dist/mcp.js < /dev/null` and confirm stdout is empty.
- [ ] Confirm both `proofpack` and `proofpack-mcp` binaries are present in `package.json` and the built tarball.
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
- [ ] Confirm share-safe stdout, stderr, and written reports contain no command text or command output.
- [ ] `--open` is opt-in, requires a written Markdown report, and does not auto-open by default.
- [ ] `--base` uses `--end-of-options`, resolves a commit, and excludes untracked files from that view.
- [ ] MCP tests cover modern discovery/tool calls, legacy initialization/tool calls, share-safe output, Git errors as `isError` results, and malformed protocol input.
- [ ] Confirm the MCP tool exposes no project command execution, file writing, opener, network, or model capability.
- [ ] Reports never claim correctness, security, or readiness to merge.

## Distribution

- [ ] Verify macOS (`open`), Linux (`xdg-open`), and Windows (`cmd start`) opener behavior where available.
- [ ] Verify Unix and Windows shell/process-tree cancellation behavior where available.
- [ ] Log in to npm (`npm login`) and confirm a publish-capable credential. npm currently requires 2FA, a granular access token with bypass 2FA, trusted publishing (OIDC), or staged publishing with 2FA approval.
- [ ] Create a granular access token with publish permission and bypass 2FA. For unscoped `proofpack-cli`, choose package access "All packages" or explicitly include `proofpack-cli` with Read and write, and enable "Bypass two-factor authentication"; a token scoped only to `@2648782102h` or without bypass 2FA returns E403. On macOS, run `scripts/setup-npm-token.sh` to store it in Keychain with hidden input; `scripts/publish.sh` reads it without putting the token in shell history, `.npmrc`, or the repository.
- [ ] Alternatively, expose the token as `NPM_TOKEN` only for the publish command. In `zsh`, use `read -rs NPM_TOKEN; export NPM_TOKEN` so the value is hidden and not saved in history; do not put the literal token in a command line or committed file.
- [ ] Use `PROVENANCE=1 scripts/publish.sh` only from an environment with npm provenance support, such as GitHub Actions OIDC. Local publishing defaults to plain `npm publish`; provenance is optional and not required for the first release.
- [ ] If npm returns `E_STAGE_REQUIRED`, run `PUBLISH_MODE=stage scripts/publish.sh`. The script stages the current package version; approve it in npmjs.com's Staged Packages tab with 2FA. Enable 2FA on the npm account first if it is disabled.
- [ ] If the registry still returns E403, stop and resolve the account policy before retrying; do not repeatedly republish.
- [ ] If `npm publish` returns E403 with "You may not perform that action with these credentials", verify the token's package scope. If it says "Two-factor authentication or granular access token with bypass 2fa enabled is required", recreate the token with Bypass 2FA enabled. If it says `E_STAGE_REQUIRED`, use staged publishing. The follow-up `npm view` 404 is a consequence of a failed direct publish, not a second failure.
- [ ] Record the exact published tarball shasum/integrity from `npm stage publish` or `npm publish` output and reconcile it with `npm view proofpack-cli@<version> dist.integrity`.
- [ ] Tag the release after merge; enable provenance only where the runtime supports it.
- [ ] Push the `v<version>` tag only after the matching `docs/RELEASE_NOTES_v<version>.md` is committed. `.github/workflows/release.yml` creates or updates the GitHub Release with those notes.
- [ ] Verify repository visibility before treating the release as a public distribution; release notes must contain no unverified safety claims.
- [ ] Record the published version and tarball integrity in the release notes.

## Local token setup

`scripts/setup-npm-token.sh` stores the npm token under the macOS Keychain service `proofpack-cli-npm-token` for account `2648782102h`. It opens a hidden macOS dialog and does not require an interactive shell, then uses `security add-generic-password -U -X`, so the token is not echoed, written to shell history, placed on an interactive command line, or added to `.npmrc`. `scripts/publish.sh` prefers an existing `NPM_TOKEN` environment variable; otherwise it reads the Keychain entry and writes a temporary npm userconfig that is deleted on exit.

To remove the stored credential later:

```sh
security delete-generic-password -a 2648782102h -s proofpack-cli-npm-token
```

Do not run this deletion before publication unless the token is no longer needed.

`scripts/publish.sh` defaults to direct publishing. Set `PUBLISH_MODE=stage` for npm's staged flow; the script still runs all local checks, stages the package, and prints the staged-version list. Approval is intentionally a human 2FA action and is not performed by the script.

After approval, verify with `npm view proofpack-cli@<version> version dist.integrity dist.shasum`, then smoke-test both binaries from a clean temporary install. Because `0.3.0` exposes two binaries, use `npx -y --package=proofpack-cli@<version> proofpack --version` and `npx -y --package=proofpack-cli@<version> proofpack-mcp < /dev/null`; `npx proofpack-cli@<version> --version` cannot infer an executable. Do not restage or republish an already approved version.

If the stored token was ever displayed in a local diagnostic dialog, revoke it at [npm token settings](https://www.npmjs.com/settings/2648782102h/tokens), generate a replacement with the package scope above, and run `scripts/setup-npm-token.sh` again. Do not paste token values into chat, shell history, `.npmrc`, or repository files.

## Rollback

- [ ] If a bad package is published, do not reuse the version; publish a patch fix and document the affected version.
- [ ] If report schema changes unexpectedly, restore the previous `schemaVersion` behavior in a patch and add a regression test.
