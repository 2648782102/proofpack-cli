# Proofpack

**A small, local-first acceptance report for AI-assisted code changes.**

Proofpack helps an individual developer answer three questions after a coding task: what changed, what checks actually ran, and what remains unchecked. It records Git change facts, explicit command evidence, and heuristic review prompts; it does not claim that a change is correct.

> Early development. Version `0.2.0` is published on npm and implements `--base`, `--share-safe`, opt-in `--open`, Markdown/JSON reports, explicit `--run` checks, and rule prompts. Automatic check discovery, AI review, sandboxed execution, and repository-local `init` are not implemented.

Repository: [2648782102/proofpack-cli](https://github.com/2648782102/proofpack-cli) · npm: [proofpack-cli](https://www.npmjs.com/package/proofpack-cli) · Release: [v0.2.0](https://github.com/2648782102/proofpack-cli/releases/tag/v0.2.0)

## Product principles

- One command, one readable report.
- Local by default; no account, daemon, model API, or upload.
- Observed facts, heuristic prompts, and unchecked work are separated.
- No project command runs unless the user explicitly supplies `--run`.
- Git inspection is read-only; explicitly run commands use the user's shell and privileges without a sandbox.

## Install and first use

Use npm without a global install:

```sh
npx proofpack-cli@0.2.0 check
```

Or install the package in a project:

```sh
npm install --save-dev proofpack-cli@0.2.0
npx proofpack check
```

The published binary is named `proofpack`.

This prints a Markdown report to stdout without changing the working tree, running project commands, or making network requests. To save it, pass an explicit path:

```sh
npx proofpack-cli check --output .proofpack/review.md
```

## Explicit checks

```sh
npx proofpack-cli check --run "npm test" --run "npm run lint"
npx proofpack-cli check --run "npm test" --format json
npx proofpack-cli check --run "npm test" --format markdown,json --output .proofpack/review.md
```

Each command is previewed before execution, run sequentially from the repository root through the user's shell, and recorded with timing, exit status, bounded stdout/stderr, truncation, and best-effort redaction. `--timeout <seconds>` defaults to 120 and applies per command. Multiple formats require `--output` and write sibling `.md` / `.json` files.

Commands are not sandboxed and can modify the working tree. Review every command and its output before sharing a report. Passing checks are evidence of those invocations only, not proof of correctness or security.

## Branch/base and sharing

```sh
npx proofpack-cli check --base main
npx proofpack-cli check --run "npm test" --share-safe --output .proofpack/share.md
npx proofpack-cli check --output .proofpack/review.md --open
```

`--base` compares committed, staged, and working-tree changes against a resolved Git ref and excludes untracked files from that view. `--share-safe` omits branch, HEAD, base commit, file paths, output destination, command text, command output, and prompt evidence from both Markdown and JSON; status, counts, timings, and limitations remain. `--open` is opt-in, requires a written Markdown report, and uses the system opener. It never uploads the report.

Review even share-safe reports before sharing: omission is best-effort and aggregate metadata may still be sensitive.

## Development

Requirements: Node.js 24 or newer.

```sh
npm install
npm run dev -- check
npm run check
npm test
npm run build
```

## Documents

- [Product requirements](docs/PRODUCT.md)
- [User experience](docs/UX.md)
- [CLI contract](docs/CLI.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Security and privacy](docs/SECURITY.md)
- [Open-source references](docs/REFERENCES.md)
- [Roadmap](docs/ROADMAP.md)
- [Development handoff](docs/DEVELOPMENT.md)
- [Release checklist](docs/RELEASE.md)
- [Changelog](CHANGELOG.md)
- [Decisions](docs/decisions/)

## License

MIT. See [LICENSE](LICENSE).
