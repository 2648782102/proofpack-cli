import type { CheckResult } from "./checks.js";
import type { FileChange, GitSnapshot } from "./git.js";
import { getReportText, type CategoryCounts, type ReportLanguage } from "./locale.js";
import type { ReviewPrompt } from "./rules.js";

export interface ReportOptions {
  outputPath: string | undefined;
  formats: readonly ("markdown" | "json")[];
  generatedAt?: string;
  shareSafe?: boolean;
  outputLabel?: string;
  language?: ReportLanguage;
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
    categories: CategoryCounts;
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
  const text = getReportText(options.language ?? "en");
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
  const notChecked = [...text.notChecked];
  const limitations = [
    ...text.limitations({ untrackedIncluded: snapshot.untrackedIncluded }),
    ...(shareSafe ? [text.shareSafeLimitation] : []),
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
  const localizedPrompts: ReviewPrompt[] = reviewPrompts.map((prompt) => ({
    ...prompt,
    ...(text.reviewRules[prompt.id] ?? {}),
  }));
  const sanitizedPrompts: ReviewPrompt[] = localizedPrompts.map((prompt) => ({
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
      changeView: text.changeView({
        shareSafe,
        base: snapshot.base,
        untrackedIncluded: snapshot.untrackedIncluded,
      }),
      base: shareSafe || snapshot.base === null ? null : snapshot.base,
      untrackedIncluded: snapshot.untrackedIncluded,
    },
    output: shareSafe ? null : (options.outputPath ?? options.outputLabel ?? "stdout"),
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

  const reportOptions = { ...options, language: options.language ?? "en" };
  return {
    document,
    markdown: renderMarkdown(document, reportOptions),
    json: `${JSON.stringify(document, null, 2)}\n`,
    summary: buildSummary(document, reportOptions),
  };
}

function renderMarkdown(document: ReportDocument, options: ReportOptions): string {
  const shareSafe = document.shareSafe;
  const text = getReportText(options.language ?? "en");
  const lines: string[] = [
    text.title,
    "",
    `- ${text.labels.generatedAt}: \`${document.generatedAt}\``,
    `- ${text.labels.schemaVersion}: \`${document.schemaVersion}\``,
    `- ${text.labels.branch}: ${inlineCode(document.repository.branch)}`,
    `- ${text.labels.head}: ${inlineCode(document.repository.head)}`,
    `- ${text.labels.base}: ${document.repository.base === null ? text.labels.baseNone : `${inlineCode(document.repository.base.ref)} → ${inlineCode(document.repository.base.commit)}`}`,
    `- ${text.labels.untrackedIncluded}: ${document.repository.untrackedIncluded ? text.pathsOnly(text.values.yes) : text.values.no}`,
    `- ${text.labels.shareSafe}: ${shareSafe ? text.values.yes : text.values.no}`,
    `- ${text.labels.reportFormat}: ${text.values.markdown}`,
    `- ${text.labels.output}: ${document.output === null ? text.values.omitted : (document.output === "stdout" ? text.values.stdout : inlineCode(document.output))}`,
    "",
    text.sections.change,
    "",
    `- ${text.labels.observedBase}: ${document.repository.changeView}。`,
    `- ${text.labels.gitVisibleFiles}: ${document.change.gitVisibleFiles}`,
    `- ${text.labels.categories}: ${text.categories(document.change.categories)}`,
    `- ${text.labels.diffSummary}: ${text.diffSummary(document.change.diffSummary)}`,
    "",
    `| ${text.changeTable.path} | ${text.changeTable.kind} | ${text.changeTable.index} | ${text.changeTable.worktree} | ${text.changeTable.insertions} | ${text.changeTable.deletions} |`,
    "| --- | --- | --- | --- | --- | --- |",
  ];

  if (document.change.files.length === 0) {
    lines.push(`| ${text.values.noneTable} | — | — | — | — | — |`);
  } else {
    for (const file of document.change.files) {
      const pathLabel = file.previousPath === null
        ? inlineCode(file.path)
        : `${inlineCode(file.previousPath)} → ${inlineCode(file.path)}`;
      const insertions = file.binary ? text.values.binary : String(file.insertions ?? text.values.unknown);
      const deletions = file.binary ? text.values.binary : String(file.deletions ?? text.values.unknown);
      lines.push(
        `| ${escapeTableCell(pathLabel)} | ${file.kind} | ${renderFlag(file.staged, text.values)} | ${renderFlag(file.worktree, text.values)} | ${insertions} | ${deletions} |`,
      );
    }
  }

  lines.push(
    "",
    text.sections.checks,
    "",
    `- ${text.labels.explicitCommands}: ${document.checks.requested}`,
    `- ${text.labels.observedOutcomes}: ${text.observedOutcomes(document.checks)}`,
    `- ${text.passNote}`,
    "",
  );

  if (document.checks.results.length === 0) {
    lines.push(`- ${text.noExplicitCommands}`);
  } else {
    for (const result of document.checks.results) {
      lines.push(
        `### ${inlineCode(result.id)} · ${result.status}`,
        "",
        `- ${text.checkLabels.command}: ${shareSafe ? text.values.omitted : inlineCode(result.command)}`,
        `- ${text.checkLabels.startedAt}: ${result.startedAt === null ? text.values.notStarted : inlineCode(result.startedAt)}`,
        `- ${text.checkLabels.endedAt}: ${result.endedAt === null ? text.values.notStarted : inlineCode(result.endedAt)}`,
        `- ${text.checkLabels.duration}: ${text.duration(result.durationMs)}`,
        `- ${text.checkLabels.exitCode}: ${result.exitCode === null ? text.values.unavailable : result.exitCode} · ${text.checkLabels.signal}: ${result.signal === null ? text.values.none : inlineCode(result.signal)}`,
        `- ${text.checkLabels.output}: ${text.output({ stdoutBytes: result.stdoutBytes, stderrBytes: result.stderrBytes, limit: result.outputLimitBytes })}`,
        `- ${text.checkLabels.truncated}: ${result.truncated ? text.values.yes : text.values.no} · ${text.checkLabels.redacted}: ${result.redacted ? text.values.yes : text.values.no} (${text.replacement(result.redactionCount)})`,
      );
      if (result.error !== null) {
        lines.push(`- ${text.checkLabels.error}: ${shareSafe ? text.values.omitted : inlineCode(result.error)}`);
      }
      lines.push(
        "",
        "```text",
        "stdout:",
        renderCodeBlock(result.stdout, shareSafe ? text.values.omitted : text.values.empty),
        "stderr:",
        renderCodeBlock(result.stderr, shareSafe ? text.values.omitted : text.values.empty),
        "```",
        "",
      );
    }
  }

  lines.push(text.sections.notChecked, "");
  for (const item of document.notChecked) lines.push(`- ${item}`);
  lines.push("", text.sections.reviewPrompts, "");
  if (document.reviewPrompts.length === 0) {
    lines.push(`- ${text.noEnabledRules}`);
  } else {
    lines.push(
      `| ${text.reviewTable.ruleId} | ${text.reviewTable.path} | ${text.reviewTable.rule} | ${text.reviewTable.reason} | ${text.reviewTable.evidence} |`,
      "| --- | --- | --- | --- | --- |",
    );
    for (const prompt of document.reviewPrompts) {
      const pathLabel = prompt.previousPath === null
        ? (shareSafe ? text.values.omitted : inlineCode(prompt.path))
        : `${inlineCode(prompt.previousPath)} → ${inlineCode(prompt.path)}`;
      lines.push(
        `| ${inlineCode(prompt.id)} | ${escapeTableCell(pathLabel)} | ${escapeTableCell(prompt.rule)} | ${escapeTableCell(prompt.reason)} | ${shareSafe ? text.values.omitted : escapeTableCell(prompt.evidence)} |`,
      );
    }
    lines.push("", `- ${text.heuristicsNote}`);
  }
  lines.push("", text.sections.limits, "");
  for (const limitation of document.limitations) lines.push(`- ${limitation}`);
  lines.push("");

  return lines.join("\n");
}

function buildSummary(document: ReportDocument, options: ReportOptions): string {
  const text = getReportText(options.language ?? "en");
  return text.summary({
    gitVisibleFiles: document.change.gitVisibleFiles,
    passed: document.checks.passed,
    failed: document.checks.failed,
    notRun: document.checks.notRun,
    other: document.checks.other,
    reviewPrompts: document.reviewPrompts.length,
    destination: text.reportDestination({
      shareSafe: document.shareSafe,
      outputPath: options.outputPath,
      outputLabel: options.outputLabel,
      multipleFormats: options.formats.length > 1,
    }),
  });
}

function countChanges(files: readonly FileChange[]): CategoryCounts {
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

function renderFlag(value: boolean | null, labels: { unknown: string; yes: string; no: string }): string {
  return value === null ? labels.unknown : value ? labels.yes : labels.no;
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
