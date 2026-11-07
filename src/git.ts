import { spawnSync } from "node:child_process";
import { realpathSync } from "node:fs";

export type FileChangeKind =
  | "added"
  | "modified"
  | "deleted"
  | "renamed"
  | "copied"
  | "untracked"
  | "unmerged";

export interface DiffStat {
  insertions: number | undefined;
  deletions: number | undefined;
  binary: boolean;
}

export interface FileChange {
  path: string;
  previousPath: string | undefined;
  kind: FileChangeKind;
  staged: boolean | undefined;
  worktree: boolean | undefined;
  diffStat: DiffStat;
}

export interface GitSnapshot {
  repositoryRoot: string;
  branch: string;
  head: string;
  changeView: string;
  base: { ref: string; commit: string } | null;
  untrackedIncluded: boolean;
  files: FileChange[];
}

export class GitInspectionError extends Error {}

type GitRunner = (args: readonly string[], cwd: string) => Buffer;

export interface GitInspectorDependencies {
  runGit?: GitRunner;
  cwd?: string;
  repositoryRoot?: string;
  base?: string;
}

interface StatusEntry {
  path: string;
  previousPath: string | undefined;
  kind: FileChangeKind;
  staged: boolean | undefined;
  worktree: boolean | undefined;
}

function defaultRunGit(args: readonly string[], cwd: string): Buffer {
  const result = spawnSync("git", [...args], {
    cwd,
    env: { ...process.env, GIT_OPTIONAL_LOCKS: "0" },
    maxBuffer: 64 * 1024 * 1024,
  });

  if (result.error !== undefined) {
    throw new GitInspectionError(`Could not start Git: ${sanitizeError(result.error.message)}`);
  }
  if (result.status !== 0) {
    throw new GitInspectionError(`Git command failed: ${sanitizeError(result.stderr.toString("utf8"))}`);
  }
  return result.stdout;
}

function sanitizeError(message: string): string {
  return message.replace(/[\u0000-\u001f\u007f]+/g, " ").trim().slice(0, 500);
}

function splitNulTokens(output: Buffer): string[] {
  const tokens = output.toString("utf8").split("\0");
  if (tokens.at(-1) === "") tokens.pop();
  return tokens;
}

export function parseStatusEntries(output: Buffer): {
  branch: string;
  head: string;
  entries: StatusEntry[];
} {
  const tokens = splitNulTokens(output);
  const entries: StatusEntry[] = [];
  let branch = "(unknown)";
  let head = "(initial)";

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token === undefined) continue;

    if (token.startsWith("# branch.oid ")) {
      head = token.slice("# branch.oid ".length);
      continue;
    }
    if (token.startsWith("# branch.head ")) {
      branch = token.slice("# branch.head ".length);
      continue;
    }
    if (token.startsWith("# ")) continue;

    if (token === "?" || token.startsWith("? ")) {
      const filePath = token.slice(2);
      entries.push({
        path: filePath,
        previousPath: undefined,
        kind: "untracked",
        staged: false,
        worktree: true,
      });
      continue;
    }

    if (token === "!" || token.startsWith("! ")) continue;

    if (token === "u" || token.startsWith("u ")) {
      const match = /^u (..) \S+ (\d+) (\d+) (\d+) (\d+) ([0-9a-f]+) ([0-9a-f]+) ([0-9a-f]+) (.+)$/.exec(token);
      if (match === null) {
        throw new GitInspectionError("Unrecognized unmerged Git status record.");
      }
      entries.push({
        path: match[9] ?? "",
        previousPath: undefined,
        kind: "unmerged",
        staged: undefined,
        worktree: undefined,
      });
      continue;
    }

    if (token === "2" || token.startsWith("2 ")) {
      const match = /^2 (..) \S+ (\d+) (\d+) (\d+) ([0-9a-f]+) ([0-9a-f]+) ([A-Z]\d+) (.+)$/.exec(token);
      const previousPath = tokens[index + 1];
      if (match === null || previousPath === undefined) {
        throw new GitInspectionError("Unrecognized renamed Git status record.");
      }
      const status = match[1] ?? "..";
      const filePath = match[8] ?? "";
      const kind: FileChangeKind = status[0] === "C" ? "copied" : "renamed";
      entries.push({
        path: filePath,
        previousPath,
        kind,
        staged: status[0] !== "." && status[0] !== "?",
        worktree: status[1] !== "." && status[1] !== "?",
      });
      index += 1;
      continue;
    }

    if (token === "1" || token.startsWith("1 ")) {
      const match = /^1 (..) \S+ (\d+) (\d+) (\d+) ([0-9a-f]+) ([0-9a-f]+) (.+)$/.exec(token);
      if (match === null) {
        throw new GitInspectionError("Unrecognized Git status record.");
      }
      const status = match[1] ?? "..";
      const filePath = match[7] ?? "";
      entries.push({
        path: filePath,
        previousPath: undefined,
        kind: statusKind(status),
        staged: status[0] !== "." && status[0] !== "?",
        worktree: status[1] !== "." && status[1] !== "?",
      });
      continue;
    }

    throw new GitInspectionError("Unrecognized Git status record.");
  }

  return { branch, head, entries };
}

function statusKind(status: string): FileChangeKind {
  const codes = `${status[0] ?? "."}${status[1] ?? "."}`;
  if (codes === "DD" || codes === "AU" || codes === "UD" || codes === "UA" || codes === "DU" || codes === "AA" || codes === "UU") {
    return "unmerged";
  }
  if (codes.startsWith("A") || codes === ".A" || codes === "?A") return "added";
  if (codes.startsWith("D") || codes === ".D" || codes === "?D") return "deleted";
  return "modified";
}

export function parseDiffNumstat(output: Buffer): Map<string, DiffStat> {
  const tokens = splitNulTokens(output);
  const stats = new Map<string, DiffStat>();

  for (let index = 0; index < tokens.length; index += 1) {
    const record = tokens[index];
    if (record === undefined) continue;
    const firstTab = record.indexOf("\t");
    const secondTab = record.indexOf("\t", firstTab + 1);
    if (firstTab < 0 || secondTab < 0) {
      throw new GitInspectionError("Unrecognized Git numstat record.");
    }

    const insertions = record.slice(0, firstTab);
    const deletions = record.slice(firstTab + 1, secondTab);
    const binary = insertions === "-" && deletions === "-";
    const parsedInsertions = binary ? undefined : parseCount(insertions);
    const parsedDeletions = binary ? undefined : parseCount(deletions);
    const remainder = record.slice(secondTab + 1);
    const paths: string[] = [];
    if (remainder.length > 0) paths.push(remainder);

    while (paths.length < 2) {
      const next = tokens[index + 1];
      if (next === undefined || next.includes("\t")) break;
      paths.push(next);
      index += 1;
    }

    if (paths.length === 0) {
      throw new GitInspectionError("Git numstat record has no path.");
    }
    if (paths.length > 2) {
      throw new GitInspectionError("Git numstat record has unexpected path tokens.");
    }

    const stat: DiffStat = {
      binary,
      insertions: parsedInsertions,
      deletions: parsedDeletions,
    };
    for (const filePath of paths) {
      const existing = stats.get(filePath);
      stats.set(filePath, existing === undefined ? stat : mergeStats(existing, stat));
    }
  }

  return stats;
}

function parseCount(value: string): number {
  if (!/^\d+$/.test(value)) {
    throw new GitInspectionError("Unrecognized Git numstat count.");
  }
  return Number(value);
}

function mergeStats(existing: DiffStat, next: DiffStat): DiffStat {
  return {
    binary: existing.binary || next.binary,
    insertions: sumCounts(existing.insertions, next.insertions),
    deletions: sumCounts(existing.deletions, next.deletions),
  };
}

function sumCounts(existing: number | undefined, next: number | undefined): number | undefined {
  if (existing === undefined || next === undefined) return undefined;
  return existing + next;
}

export function inspectGitChanges(dependencies: GitInspectorDependencies = {}): GitSnapshot {
  const runGit = dependencies.runGit ?? defaultRunGit;
  const cwd = dependencies.cwd ?? process.cwd();
  const rootOutput = dependencies.repositoryRoot ?? runGit(["rev-parse", "--path-format=absolute", "--show-toplevel"], cwd).toString("utf8").trim();
  if (rootOutput.length === 0) {
    throw new GitInspectionError("Git did not return a repository root.");
  }
  const repositoryRoot = realpathSync.native(rootOutput);

  const base = resolveBase(dependencies.base, repositoryRoot, runGit);
  const statusOutput = runGit(
    ["status", "--porcelain=v2", "--branch", "--untracked-files=all", "-z"],
    repositoryRoot,
  );
  const status = parseStatusEntries(statusOutput);
  if (base !== null) {
    return inspectAgainstBase(base, status, repositoryRoot, runGit);
  }

  const cachedDiff = runGit(diffArguments(true), repositoryRoot);
  const worktreeDiff = runGit(diffArguments(false), repositoryRoot);
  const cachedStats = parseDiffNumstat(cachedDiff);
  const worktreeStats = parseDiffNumstat(worktreeDiff);
  const files = status.entries.map((entry): FileChange => {
    const stagedStat = cachedStats.get(entry.path);
    const worktreeStat = worktreeStats.get(entry.path);
    const previousStat = entry.previousPath === undefined ? undefined : cachedStats.get(entry.previousPath);
    const combined = combineStats(stagedStat, worktreeStat, previousStat);
    return {
      path: entry.path,
      previousPath: entry.previousPath,
      kind: entry.kind,
      staged: entry.staged,
      worktree: entry.worktree,
      diffStat: combined,
    };
  });

  return {
    repositoryRoot,
    branch: status.branch,
    head: status.head,
    changeView: "staged index and working tree against HEAD, plus untracked file paths",
    base: null,
    untrackedIncluded: true,
    files,
  };
}

function resolveBase(
  requestedBase: string | undefined,
  repositoryRoot: string,
  runGit: GitRunner,
): { ref: string; commit: string } | null {
  if (requestedBase === undefined) return null;
  const revision = `${requestedBase}^{commit}`;
  const output = runGit(["rev-parse", "--verify", "--end-of-options", revision], repositoryRoot);
  const commit = output.toString("utf8").trim().split("\n")[0] ?? "";
  if (!/^[0-9a-f]{40,64}$/.test(commit)) {
    throw new GitInspectionError("Git did not resolve --base to a commit.");
  }
  return { ref: requestedBase, commit };
}

function inspectAgainstBase(
  base: { ref: string; commit: string },
  status: { branch: string; head: string },
  repositoryRoot: string,
  runGit: GitRunner,
): GitSnapshot {
  const nameStatus = runGit(
    ["diff", "--name-status", "-z", "--no-ext-diff", "--no-renames", base.commit, "--"],
    repositoryRoot,
  );
  const numstat = runGit(
    ["diff", "--numstat", "-z", "--no-ext-diff", "--no-textconv", "--no-renames", base.commit, "--"],
    repositoryRoot,
  );
  const changes = parseNameStatus(nameStatus);
  const stats = parseDiffNumstat(numstat);
  const files = changes.map((entry): FileChange => ({
    path: entry.path,
    previousPath: undefined,
    kind: entry.kind,
    staged: undefined,
    worktree: undefined,
    diffStat: stats.get(entry.path) ?? { insertions: undefined, deletions: undefined, binary: false },
  }));

  return {
    repositoryRoot,
    branch: status.branch,
    head: status.head,
    changeView: `committed, staged, and working-tree changes against base ${base.ref} (${base.commit}); untracked files excluded`,
    base,
    untrackedIncluded: false,
    files,
  };
}

export function parseNameStatus(output: Buffer): Array<{ path: string; kind: FileChangeKind }> {
  const tokens = splitNulTokens(output);
  const entries: Array<{ path: string; kind: FileChangeKind }> = [];

  for (let index = 0; index < tokens.length; index += 1) {
    const statusAndPath = tokens[index];
    if (statusAndPath === undefined) {
      throw new GitInspectionError("Unrecognized Git name-status record.");
    }
    const firstTab = statusAndPath.indexOf("\t");
    const status = firstTab < 0 ? statusAndPath : statusAndPath.slice(0, firstTab);
    const inlinePath = firstTab < 0 ? undefined : statusAndPath.slice(firstTab + 1);
    const filePath = inlinePath ?? tokens[index + 1];
    if (filePath === undefined) {
      throw new GitInspectionError("Unrecognized Git name-status record.");
    }
    if (inlinePath === undefined) index += 1;
    const kind = nameStatusKind(status);
    entries.push({ path: filePath, kind });
    if ((status.startsWith("R") || status.startsWith("C")) && inlinePath === undefined) {
      const previousPath = tokens[index + 1];
      if (previousPath === undefined) {
        throw new GitInspectionError("Unrecognized Git name-status rename record.");
      }
      index += 1;
    }
  }

  return entries;
}

function nameStatusKind(status: string): FileChangeKind {
  const code = status[0] ?? "M";
  if (code === "A") return "added";
  if (code === "D") return "deleted";
  if (code === "R") return "renamed";
  if (code === "C") return "copied";
  if (code === "U") return "unmerged";
  return "modified";
}
function diffArguments(cached: boolean): string[] {
  return [
    "diff",
    ...(cached ? ["--cached"] : []),
    "--numstat",
    "-z",
    "--no-ext-diff",
    "--no-textconv",
    "--no-renames",
    ...(cached ? [] : ["--"]),
  ];
}

function combineStats(...stats: Array<DiffStat | undefined>): DiffStat {
  const present = stats.filter((stat): stat is DiffStat => stat !== undefined);
  if (present.length === 0) return { insertions: undefined, deletions: undefined, binary: false };
  if (present.some((stat) => stat.binary)) return { insertions: undefined, deletions: undefined, binary: true };
  if (present.some((stat) => stat.insertions === undefined || stat.deletions === undefined)) {
    return { insertions: undefined, deletions: undefined, binary: false };
  }
  let insertions = 0;
  let deletions = 0;
  for (const stat of present) {
    insertions += stat.insertions ?? 0;
    deletions += stat.deletions ?? 0;
  }
  return { insertions, deletions, binary: false };
}
