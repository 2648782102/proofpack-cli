# Proofpack

**A small, local-first acceptance report for AI-assisted code changes.**

Proofpack helps an individual developer answer three questions after a coding task: what changed, what checks actually ran, and what remains unchecked. It records evidence from Git and explicitly run commands; it does not claim that a change is correct.

> Early development. This repository contains product and engineering specifications plus a minimal TypeScript CLI scaffold. Evidence collection and report generation are not implemented yet.

## Product principles

- One command, one readable report.
- Local by default; no account, daemon, model API, or upload.
- Observed facts are separated from heuristics and unchecked work.
- Never run project commands unless the user explicitly asks Proofpack to run them.
- Preserve the user's working tree; inspection is read-only.

## Planned first use

```sh
npx proofpack-cli check
```

The first release will inspect the current Git change and optionally run checks explicitly supplied by the user. See [the product spec](docs/PRODUCT.md) and [CLI contract](docs/CLI.md).

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
- [Decisions](docs/decisions/)

## License

MIT. See [LICENSE](LICENSE).
