import type { CheckResult } from "./checks.js";
import type { FileChange, GitSnapshot } from "./git.js";
import type { ReviewPrompt } from "./rules.js";

export interface ReportOptions {
  outputPath: string | undefined;
  formats: readonly ("markdown" | "json")[];
  generatedAt?: string;
  shareSafe?: boolean;
}

export interface ReportDocument {
  schemaVersion: string;
  generatedAt: string;
  repository: {
    branch: string;
    head: string;
    changeView: string;
    base: { ref: string; commit: string } | null;
    untrackedIncluded: boolean;
  };
  output: string | null;
  shareSafe: boolean;
  change: {
    gitVisibleFiles: number;
    categories: Record<string, number>;
    diffSummary: {
      insertions: number;
      deletions: number;
      binary: number;
      unavailableLineCounts: number;
      partial: boolean;
    };
    files: Array<{
      path: string;
      previousPath: string | null;
      kind: string;
      staged: boolean | null;
      worktree: boolean | null;
      insertions: number | null;
      deletions: number | null;
      binary: boolean;
    }>;
  };
  checks: {
    requested: number;
    executed: number;
    passed: number;
    failed: number;
    notRun: number;
    other: number;
    explicitOnly: boolean;
    results: CheckResult[];
  };
  notChecked: string[];
  reviewPrompts: ReviewPrompt[];
  limitations: string[];
}

export interface Report {
  markdown: string;
  json: string;
  summary: string;
  document: ReportDocument;
}

export const SCHEMA_VERSION = "0.3";

export function buildReport(
  snapshot: GitSnapshot,
  checks: readonly CheckResult[],
  reviewPrompts: readonly ReviewPrompt[],
  options: ReportOptions,
): Report {
  const generatedAt = options.generatedAt ?? new Date().toISOString();
  const shareSafe = options.shareSafe ?? false;
  const counts = countChanges(snapshot.files);
  const totals = totalDiffStats(snapshot.files);
  const checkCounts = {
    passed: checks.filter((check) => check.status === "passed").length,
    failed: checks.filter((check) => check.status === "failed").length,
    notRun: checks.filter((check) => check.status === "not-run").length,
  };
  const otherChecks = checks.filter(
    (check) => check.status !== "passed" && check.status !== "failed" && check.status !== "not-run",
  ).length;
  const executedChecks = checks.filter((check) => check.status !== "not-run").length;
  const notChecked = [
    "Commands not supplied through --run were not executed.",
    "Tests, type checks, linters, builds, dependency audits, and runtime behavior are not inferred from the repository.",
    "A successful explicitly run command is evidence of that invocation, not proof of correctness or security.",
  ];
  const limitations = [
    "This report does not establish correctness, security, or readiness to merge.",
    `It covers only Git-visible changes in the selected view; ignored files, unreadable content, and history outside the selected view are not inspected. Untracked files are ${snapshot.untrackedIncluded ? "listed by path only; their contents were not read" : "excluded in --base mode"}.`,
    "Line counts are Git diff estimates; binary files and some unusual changes have no line count.",
    "Review prompts are deterministic path/stat heuristics, not findings; absence of a prompt is not evidence of safety.",
    "Command output may contain sensitive data. Redaction is best-effort and reports should be reviewed before sharing.",
    "Explicit --run commands use the user's shell and privileges without a sandbox.",
    "Facts come from local Git metadata and observed command outcomes; heuristics and everything not observed are labeled separately.",
    ...(shareSafe
      ? ["Share-safe mode omits branch, HEAD, repository paths, output destinations, command text, command output, and base commits. Redaction is still best-effort; review before sharing."]
      : []),
  ];
  const resultDocuments: CheckResult[] = [...checks].map((check) => (
    shareSafe
      ? {
          ...check,
          command: "[OMITTED]",
          stdout: "",
          stderr: "",
          error: check.error === null ? null : "[OMITTED]",
        }
      : check
  ));
  const sanitizedPrompts: ReviewPrompt[] = reviewPrompts.map((prompt) => ({
    ...prompt,
    path: shareSafe ? "[OMITTED]" : prompt.path,
    previousPath: shareSafe ? null : prompt.previousPath,
    evidence: shareSafe ? "[OMITTED]" : prompt.evidence,
  }));
  const document: ReportDocument = {
    schemaVersion: SCHEMA_VERSION,
    generatedAt,
    repository: {
      branch: shareSafe ? "[OMITTED]" : snapshot.branch,
      head: shareSafe ? "[OMITTED]" : snapshot.head,
      changeView: shareSafe
        ? "Git-visible changes in the selected view; branch, HEAD, base, paths, and command details omitted"
        : snapshot.changeView,
      base: shareSafe || snapshot.base === null ? null : snapshot.base,
      untrackedIncluded: snapshot.untrackedIncluded,
    },
    output: shareSafe ? null : (options.outputPath ?? "stdout"),
    shareSafe,
    change: {
      gitVisibleFiles: snapshot.files.length,
      categories: counts,
      diffSummary: {
        insertions: totals.insertions,
        deletions: totals.deletions,
        binary: totals.binary,
        unavailableLineCounts: totals.unknown,
        partial: totals.partial,
      },
      files: snapshot.files.map((file) => ({
        path: shareSafe ? "[OMITTED]" : file.path,
        previousPath: shareSafe ? null : (file.previousPath ?? null),
        kind: file.kind,
        staged: file.staged ?? null,
        worktree: file.worktree ?? null,
        insertions: file.diffStat.insertions ?? null,
        deletions: file.diffStat.deletions ?? null,
        binary: file.diffStat.binary,
      })),
    },
    checks: {
      requested: checks.length,
      executed: executedChecks,
      passed: checkCounts.passed,
      failed: checkCounts.failed,
      notRun: checkCounts.notRun,
      other: otherChecks,
      explicitOnly: true,
      results: resultDocuments,
    },
    notChecked,
    reviewPrompts: sanitizedPrompts,
    limitations,
  };

  return {
    document,
    markdown: renderMarkdown(document, options),
    json: `${JSON.stringify(document, null, 2)}\n`,
    summary: buildSummary(document, options),
  };
}

function renderMarkdown(document: ReportDocument, options: ReportOptions): string {
  const shareSafe = document.shareSafe;
  const lines: string[] = [
    "# Proofpack acceptance report",
    "",
    `- Generated at: \`${document.generatedAt}\``,
    `- Schema version: \`${document.schemaVersion}\``,
    `- Branch: ${inlineCode(document.repository.branch)}`,
    `- HEAD: ${inlineCode(document.repository.head)}`,
    `- Base: ${document.repository.base === null ? "none (HEAD/worktree view)" : `${inlineCode(document.repository.base.ref)} → ${inlineCode(document.repository.base.commit)}`}`,
    `- Untracked files included: ${document.repository.untrackedIncluded ? "yes (paths only)" : "no"}`,
    `- Share-safe: ${shareSafe ? "yes" : "no"}`,
    "- Report format: Markdown",
    `- Output: ${document.output === null ? "[OMITTED]" : (document.output === "stdout" ? "stdout" : inlineCode(document.output))}`,
    "",
    "## Change",
    "",
    `- Observed base: ${document.repository.changeView}.`,
    `- Git-visible files: ${document.change.gitVisibleFiles}`,
    `- Categories: ${formatCategories(document.change.categories)}`,
    `- Diff summary: ${formatTotal(document.change.diffSummary.insertions, "insertions")} · ${formatTotal(document.change.diffSummary.deletions, "deletions")}${document.change.diffSummary.partial ? " (partial; see table)" : ""} · ${document.change.diffSummary.binary} binary · ${document.change.diffSummary.unavailableLineCounts} with unavailable line counts`,
    "",
    "| Path | Kind | Index | Worktree | Insertions | Deletions |",
    "| --- | --- | --- | --- | --- | --- |",
  ];

  if (document.change.files.length === 0) {
    lines.push("| None | — | — | — | — | — |");
  } else {
    for (const file of document.change.files) {
      const pathLabel = file.previousPath === null
        ? inlineCode(file.path)
        : `${inlineCode(file.previousPath)} → ${inlineCode(file.path)}`;
      const insertions = file.binary ? "binary" : String(file.insertions ?? "unknown");
      const deletions = file.binary ? "binary" : String(file.deletions ?? "unknown");
      lines.push(
        `| ${escapeTableCell(pathLabel)} | ${file.kind} | ${renderFlag(file.staged)} | ${renderFlag(file.worktree)} | ${insertions} | ${deletions} |`,
      );
    }
  }

  lines.push(
    "",
    "## Checks",
    "",
    `- Explicit commands requested: ${document.checks.requested}`,
    `- Observed outcomes: ${document.checks.passed} passed · ${document.checks.failed} failed · ${document.checks.notRun} not run · ${document.checks.other} other`,
    "- A pass records only that the command exited zero in this invocation; absence of evidence does not mean a check passed.",
    "",
  );

  if (document.checks.results.length === 0) {
    lines.push("- No explicit commands were supplied, so no checks were executed.");
  } else {
    for (const result of document.checks.results) {
      lines.push(
        `### ${inlineCode(result.id)} · ${result.status}`,
        "",
        `- Command: ${shareSafe ? "[OMITTED]" : inlineCode(result.command)}`,
        `- Started at: ${result.startedAt === null ? "not started" : inlineCode(result.startedAt)}`,
        `- Ended at: ${result.endedAt === null ? "not started" : inlineCode(result.endedAt)}`,
        `- Duration: ${result.durationMs === null ? "unknown" : `${result.durationMs} ms`}`,
        `- Exit code: ${result.exitCode === null ? "unavailable" : result.exitCode} · Signal: ${result.signal === null ? "none" : inlineCode(result.signal)}`,
        `- Output: ${result.stdoutBytes} stdout bytes · ${result.stderrBytes} stderr bytes · limit ${result.outputLimitBytes} bytes per stream`,
        `- Truncated: ${result.truncated ? "yes" : "no"} · Redacted: ${result.redacted ? "yes" : "no"} (${result.redactionCount} replacement${result.redactionCount === 1 ? "" : "s"})`,
      );
      if (result.error !== null) {
        lines.push(`- Error: ${shareSafe ? "[OMITTED]" : inlineCode(result.error)}`);
      }
      lines.push(
        "",
        "```text",
        "stdout:",
        renderCodeBlock(result.stdout, shareSafe ? "[OMITTED]" : "(empty)"),
        "stderr:",
        renderCodeBlock(result.stderr, shareSafe ? "[OMITTED]" : "(empty)"),
        "```",
        "",
      );
    }
  }

  lines.push("## Not checked", "");
  for (const item of document.notChecked) lines.push(`- ${item}`);
  lines.push("", "## Review prompts", "");
  if (document.reviewPrompts.length === 0) {
    lines.push("- No enabled rules matched Git-visible paths or diff statistics. This is not evidence that none apply.");
  } else {
    lines.push(
      "| Rule ID | Path | Rule | Reason | Evidence |",
      "| --- | --- | --- | --- | --- |",
    );
    for (const prompt of document.reviewPrompts) {
      const pathLabel = prompt.previousPath === null
        ? (shareSafe ? "[OMITTED]" : inlineCode(prompt.path))
        : `${inlineCode(prompt.previousPath)} → ${inlineCode(prompt.path)}`;
      lines.push(
        `| ${inlineCode(prompt.id)} | ${escapeTableCell(pathLabel)} | ${escapeTableCell(prompt.rule)} | ${escapeTableCell(prompt.reason)} | ${shareSafe ? "[OMITTED]" : escapeTableCell(prompt.evidence)} |`,
      );
    }
    lines.push("", "- Heuristics above are review prompts, not findings or a correctness verdict.");
  }
  lines.push("", "## Limits", "");
  for (const limitation of document.limitations) lines.push(`- ${limitation}`);
  lines.push("");

  return lines.join("\n");
}

function buildSummary(document: ReportDocument, options: ReportOptions): string {
  const failureSuffix = document.checks.other > 0 ? ` · ${document.checks.other} other` : "";
  const reportDestination = document.shareSafe
    ? "redacted"
    : options.outputPath === undefined
    ? "on stdout"
    : `written to ${options.outputPath}${options.formats.length > 1 ? " (.md/.json)" : ""}`;
  return `Proofpack · ${document.change.gitVisibleFiles} Git-visible files · ${document.checks.passed} passed · ${document.checks.failed} failed · ${document.checks.notRun} not run${failureSuffix} · ${document.reviewPrompts.length} review prompts · report ${reportDestination}`;
}

function countChanges(files: readonly FileChange[]): Record<string, number> {
  const counts = {
    added: 0,
    modified: 0,
    deleted: 0,
    renamedOrCopied: 0,
    untracked: 0,
    unmerged: 0,
  };
  for (const file of files) {
    if (file.kind === "added") counts.added += 1;
    else if (file.kind === "modified") counts.modified += 1;
    else if (file.kind === "deleted") counts.deleted += 1;
    else if (file.kind === "renamed" || file.kind === "copied") counts.renamedOrCopied += 1;
    else if (file.kind === "untracked") counts.untracked += 1;
    else counts.unmerged += 1;
  }
  return counts;
}

function totalDiffStats(files: readonly FileChange[]): {
  insertions: number;
  deletions: number;
  binary: number;
  unknown: number;
  partial: boolean;
} {
  let hasUnknown = false;
  let binary = 0;
  let insertions = 0;
  let deletions = 0;
  for (const file of files) {
    if (file.diffStat.binary) {
      binary += 1;
      hasUnknown = true;
      continue;
    }
    if (file.diffStat.insertions === undefined || file.diffStat.deletions === undefined) {
      hasUnknown = true;
      continue;
    }
    insertions += file.diffStat.insertions;
    deletions += file.diffStat.deletions;
  }
  return {
    insertions,
    deletions,
    binary,
    unknown: files.filter((file) => !file.diffStat.binary && (file.diffStat.insertions === undefined || file.diffStat.deletions === undefined)).length,
    partial: hasUnknown,
  };
}

function formatCategories(categories: Record<string, number>): string {
  return `${categories.added} added · ${categories.modified} modified · ${categories.deleted} deleted · ${categories.renamedOrCopied} renamed/copied · ${categories.untracked} untracked · ${categories.unmerged} unmerged`;
}

function formatTotal(value: number, label: string): string {
  return `${value}+ ${label}`;
}

function renderFlag(value: boolean | null): string {
  return value === null ? "unknown" : value ? "yes" : "no";
}

export function escapeInlineCode(value: string): string {
  const sanitized = value.replace(/[\u0000-\u001f\u007f]/g, " ");
  const longestBacktickRun = Math.max(0, ...Array.from(sanitized.matchAll(/`+/g), (match) => match[0].length));
  const fence = "`".repeat(Math.max(1, longestBacktickRun + 1));
  const padding = sanitized.includes("`") ? " " : "";
  return `${fence}${padding}${sanitized}${padding}${fence}`;
}

function inlineCode(value: string): string {
  return escapeInlineCode(value);
}

function escapeTableCell(value: string): string {
  return value.replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
}

function renderCodeBlock(value: string, emptyLabel: string): string {
  const sanitized = value.length === 0 ? emptyLabel : value.replace(/\n+$/, "");
  const longestBacktickRun = Math.max(0, ...Array.from(sanitized.matchAll(/`+/g), (match) => match[0].length));
  if (longestBacktickRun >= 3) return sanitized.replace(/`/g, "'");
  return sanitized;
}
