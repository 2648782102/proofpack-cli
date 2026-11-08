import type { CheckResult } from "./checks.js";
import { GitInspectionError, inspectGitChanges, type GitSnapshot } from "./git.js";
import { buildReport, type Report } from "./report.js";
import type { ReportFormat } from "./args.js";
import { buildReviewPrompts } from "./rules.js";

export interface GenerateReportOptions {
  cwd?: string;
  base?: string;
  shareSafe?: boolean;
  formats?: readonly ReportFormat[];
  outputLabel?: string;
  generatedAt?: string;
  inspection?: () => GitSnapshot;
}

export interface GenerateReportResult {
  report: Report;
  snapshot: GitSnapshot;
  checkResults: readonly CheckResult[];
  reviewPrompts: ReturnType<typeof buildReviewPrompts>;
}

export class ReportGenerationError extends Error {
  readonly reason: "invalid-base" | "git-inspection" | "generation";

  constructor(reason: ReportGenerationError["reason"], message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "ReportGenerationError";
    this.reason = reason;
  }
}

export function validateBaseRef(base: string | undefined): void {
  if (base === undefined) return;
  if (base.length === 0 || base.length > 8192 || base.includes("\0") || base.includes("^{")) {
    throw new ReportGenerationError("invalid-base", "`base` must be a plain Git ref without `^{...}`.");
  }
}

function defaultInspection(cwd: string | undefined, base: string | undefined): () => GitSnapshot {
  return () => inspectGitChanges({
    ...(cwd === undefined ? {} : { cwd }),
    ...(base === undefined ? {} : { base }),
  });
}

export function generateReport(options: GenerateReportOptions = {}): GenerateReportResult {
  validateBaseRef(options.base);
  const inspect = options.inspection ?? defaultInspection(options.cwd, options.base);
  let snapshot: GitSnapshot;
  try {
    snapshot = inspect();
  } catch (error) {
    if (error instanceof GitInspectionError) {
      throw new ReportGenerationError("git-inspection", error.message, { cause: error });
    }
    throw error;
  }

  const reviewPrompts = buildReviewPrompts(snapshot.files);
  const report = buildReport(snapshot, [], reviewPrompts, {
    formats: options.formats ?? ["markdown", "json"],
    outputPath: undefined,
    ...(options.shareSafe === undefined ? {} : { shareSafe: options.shareSafe }),
    ...(options.generatedAt === undefined ? {} : { generatedAt: options.generatedAt }),
    ...(options.outputLabel === undefined ? {} : { outputLabel: options.outputLabel }),
  });

  return { report, snapshot, checkResults: [], reviewPrompts };
}
