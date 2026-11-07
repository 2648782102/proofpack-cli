# Architecture proposal

## Runtime shape

Proofpack is a local Node.js CLI. It has no server and no browser UI in the MVP.

```text
CLI arguments
  ├─ Git inspector (read-only subprocess)
  ├─ optional explicit check runner (only when --run is present)
  ├─ deterministic review-prompt rules
  ├─ evidence normalizer and redactor
  └─ Markdown / JSON renderers
       └─ local report writer
```

## Proposed modules

- `cli.ts`: parse args, call application flow, print concise status.
- `git/`: Git availability, repository root, diff/status parsing.
- `checks/`: opt-in sequential command runner; bounded output, timeout, cancellation.
- `rules/`: small explicit path/diff heuristics returning rule IDs and explanations.
- `report/`: versioned evidence model and Markdown/JSON renderers.
- `security/`: redaction, path containment, symlink and output limits.

Add a module only when it owns implemented behavior. Keep Git output parsing deterministic and covered by fixtures rather than relying on exact human-formatted output where porcelain formats exist.

## Data model sketch

- `RepositorySnapshot`: repository identity (relative path only), selected base, observed status.
- `FileChange`: relative path, change kind, insertions/deletions when available, binary flag.
- `CheckResult`: displayed command, timestamps, exit code/signal, duration, bounded stdout/stderr, redaction/truncation markers.
- `ReviewPrompt`: stable rule ID, path, short reason, and evidence location.
- `Report`: schema version, generation time, above evidence, and limitations.

## Boundaries

- Git is invoked with argument arrays; avoid shell interpolation for inspection commands.
- User commands are never discovered or run automatically.
- No network client or model SDK in MVP.
- Report paths are constrained to the repository unless the user passes an explicit output path.
- Output is treated as untrusted and escaped by renderers.
- Future integrations consume the stable report schema; they do not access private runtime state in Conchbase.
