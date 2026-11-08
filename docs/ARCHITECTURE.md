# Architecture

## Runtime shape

Proofpack is a local Node.js CLI with a companion MCP stdio entrypoint. The MCP adapter is host-launched; it is not a network server. The runtime has no browser UI, LLM client, network client, daemon, or telemetry. `--open` is an explicit local system-opener action.

```text
CLI arguments
  ├─ report core (read-only)
  │   ├─ Git inspector (read-only subprocesses)
  │   │   └─ optional --base ref resolution and base diff
  │   ├─ deterministic path/stat review-prompt rules
  │   ├─ versioned 0.3 evidence model
  │   ├─ share-safe evidence omission
  │   └─ Markdown / JSON renderers
  ├─ opt-in sequential check runner (only for explicit --run commands)
  ├─ stdout writer (default)
  └─ opt-in local file writer (--output only)
       └─ opt-in system opener (--open only)

MCP host
  └─ newline-delimited JSON-RPC over stdio
       └─ proofpack_check tool
            └─ report core (read-only; no --run / --output / --open)
```

## Implemented modules

- `src/args.ts`: parse commands, base ref, formats, output, sharing, open, timeout, and output limit; reject unknown/deferred flags.
- `src/version.ts`: single source for the package/CLI/MCP implementation version.
- `src/report-core.ts`: shared read-only Git inspection, review prompts, and `0.3` report generation without command execution or file writes.
- `src/git.ts`: locate the repository root, parse porcelain v2 status and numstat with NUL-delimited Buffers, resolve an optional base ref with `--end-of-options`, and parse base name-status/numstat.
- `src/checks.ts`: preview and run explicit shell commands sequentially; bound process output, sanitize control sequences, redact common secrets/home paths, track timing, timeout, interruption, and spawn errors.
- `src/rules.ts`: deterministic path/stat review prompts with stable IDs and evidence strings.
- `src/report.ts`: build the `0.3` evidence model, apply share-safe omission before rendering, and separate facts, heuristics, unrun checks, and limits.
- `src/output.ts`: constrain single/multiple output paths to the repository and reject tracked files, Git metadata, outside paths, or symlink traversal.
- `src/cli.ts`: coordinate inspection, explicit checks, rendering, stdout/file output, and documented exit codes.
- `src/open.ts`: launch the platform's system opener only for an explicit `--open` invocation.
- `src/mcp.ts`: dual-era local stdio MCP adapter. stdout carries JSON-RPC only; the single tool calls `src/report-core.ts` and never exposes CLI-only side effects.

Git inspection invokes argument arrays with `GIT_OPTIONAL_LOCKS=0` and uses `rev-parse`, `status`, `diff --cached`, and `diff` only. Explicit checks invoke the user's shell through argument arrays; the shell command string itself is intentional user input, never repository-discovered configuration. No module reads repository file contents.

## Data model

- `GitSnapshot`: repository root, branch, HEAD, and observed status entries.
- `FileChange`: repository-relative path, optional previous path, change kind, index/worktree flags, insertions/deletions when available, binary flag.
- `CheckResult`: command, status, timestamps, duration, exit code/signal, bounded stdout/stderr, byte counts, truncation, redaction metadata, output limit, and error text.
- `ReviewPrompt`: stable rule ID, path, optional previous path, rule, reason, and evidence.
- `ReportDocument`: version `0.3`; repository (including optional base/untracked metadata), output, `shareSafe`, change, checks, `notChecked`, review prompts, and limitations.

## Boundaries

- Git is invoked with argument arrays; avoid shell interpolation for inspection commands.
- User commands are never discovered or run automatically.
- Explicit commands run with the current user's shell, environment, and privileges; they are not sandboxed and may modify the working tree.
- When explicit commands are supplied, Git inspection is repeated afterward so the report describes the observed post-command view.
- Default inspection makes no network requests; no model SDK is present.
- The MCP adapter is a protocol adapter, not an autonomous agent: it exposes one read-only report tool and has no runtime dependencies.
- The default flow writes nothing to disk; explicitly supplied report paths are validated before commands run.
- Git paths, command text, and command output are untrusted data; renderers escape/sanitize them and redaction is best-effort.
- `cwd` from an MCP client is a local path input, not a sandbox boundary; the host controls process privileges and working directory.
- Future integrations consume the stable report schema; they do not access private runtime state in Conchbase.
