export const REPORT_LANGUAGES = ["en", "zh-CN"] as const;
export type ReportLanguage = (typeof REPORT_LANGUAGES)[number];

const LANGUAGE_ALIASES = new Map<string, ReportLanguage>([
  ["en", "en"],
  ["en-us", "en"],
  ["zh", "zh-CN"],
  ["zh-cn", "zh-CN"],
  ["zh-hans", "zh-CN"],
  ["zh-hans-cn", "zh-CN"],
]);

export function parseReportLanguage(value: string | undefined): ReportLanguage | undefined {
  if (value === undefined) return undefined;
  const normalized = value.trim().toLowerCase();
  if (normalized.length === 0) return undefined;
  return LANGUAGE_ALIASES.get(normalized);
}

export function resolveEnvironmentLanguage(env: NodeJS.ProcessEnv = process.env): ReportLanguage {
  return parseReportLanguage(env.PROOFPACK_LANG) ?? "en";
}

export interface CategoryCounts {
  added: number;
  modified: number;
  deleted: number;
  renamedOrCopied: number;
  untracked: number;
  unmerged: number;
}

export interface DiffSummaryText {
  insertions: number;
  deletions: number;
  binary: number;
  unavailableLineCounts: number;
  partial: boolean;
}

export interface CheckOutcomeText {
  passed: number;
  failed: number;
  notRun: number;
  other: number;
}

export interface ChangeViewText {
  shareSafe: boolean;
  base: { ref: string; commit: string } | null;
  untrackedIncluded: boolean;
}

export interface OutputText {
  stdoutBytes: number;
  stderrBytes: number;
  limit: number;
}

export interface ReportDestinationText {
  shareSafe: boolean;
  outputPath: string | undefined;
  outputLabel: string | undefined;
  multipleFormats: boolean;
}

export interface SummaryText extends CheckOutcomeText {
  gitVisibleFiles: number;
  reviewPrompts: number;
  destination: string;
}

export interface ReportText {
  title: string;
  labels: {
    generatedAt: string;
    schemaVersion: string;
    branch: string;
    head: string;
    base: string;
    baseNone: string;
    untrackedIncluded: string;
    shareSafe: string;
    reportFormat: string;
    output: string;
    observedBase: string;
    gitVisibleFiles: string;
    categories: string;
    diffSummary: string;
    explicitCommands: string;
    observedOutcomes: string;
  };
  sections: {
    change: string;
    checks: string;
    notChecked: string;
    reviewPrompts: string;
    limits: string;
  };
  values: {
    omitted: string;
    markdown: string;
    stdout: string;
    yes: string;
    no: string;
    unknown: string;
    binary: string;
    none: string;
    notStarted: string;
    unavailable: string;
    empty: string;
    noneTable: string;
  };
  changeTable: {
    path: string;
    kind: string;
    index: string;
    worktree: string;
    insertions: string;
    deletions: string;
  };
  reviewTable: {
    ruleId: string;
    path: string;
    rule: string;
    reason: string;
    evidence: string;
  };
  checkLabels: {
    command: string;
    startedAt: string;
    endedAt: string;
    duration: string;
    exitCode: string;
    signal: string;
    output: string;
    truncated: string;
    redacted: string;
    error: string;
  };
  passNote: string;
  noExplicitCommands: string;
  noEnabledRules: string;
  heuristicsNote: string;
  notChecked: readonly string[];
  limitations: (input: { untrackedIncluded: boolean }) => readonly string[];
  shareSafeLimitation: string;
  reviewRules: Record<string, { rule: string; reason: string }>;
  matchedPathEvidence: (path: string) => string;
  largeDeletionEvidence: (deletions: number, path: string) => string;
  categories: (counts: CategoryCounts) => string;
  diffSummary: (summary: DiffSummaryText) => string;
  changeView: (input: ChangeViewText) => string;
  observedOutcomes: (counts: CheckOutcomeText) => string;
  output: (input: OutputText) => string;
  pathsOnly: (value: string) => string;
  replacement: (count: number) => string;
  duration: (ms: number | null) => string;
  reportDestination: (input: ReportDestinationText) => string;
  summary: (input: SummaryText) => string;
  cli: {
    runningCheck: (index: number, total: number, command: string, shareSafe: boolean) => string;
    receivedSignal: (signal: string) => string;
    wrote: (path: string) => string;
    opened: string;
    errorPrefix: string;
    nextGitRepository: string;
    nextOutputPath: string;
    nextOpen: string;
    reportGenerationFailed: (message: string) => string;
  };
  mcp: {
    reportFailure: (message: string) => string;
  };
}

const ENGLISH: ReportText = {
  title: "# Proofpack acceptance report",
  labels: {
    generatedAt: "Generated at",
    schemaVersion: "Schema version",
    branch: "Branch",
    head: "HEAD",
    base: "Base",
    baseNone: "none (HEAD/worktree view)",
    untrackedIncluded: "Untracked files included",
    shareSafe: "Share-safe",
    reportFormat: "Report format",
    output: "Output",
    observedBase: "Observed base",
    gitVisibleFiles: "Git-visible files",
    categories: "Categories",
    diffSummary: "Diff summary",
    explicitCommands: "Explicit commands requested",
    observedOutcomes: "Observed outcomes",
  },
  sections: {
    change: "## Change",
    checks: "## Checks",
    notChecked: "## Not checked",
    reviewPrompts: "## Review prompts",
    limits: "## Limits",
  },
  values: {
    omitted: "[OMITTED]",
    markdown: "Markdown",
    stdout: "stdout",
    yes: "yes",
    no: "no",
    unknown: "unknown",
    binary: "binary",
    none: "none",
    notStarted: "not started",
    unavailable: "unavailable",
    empty: "(empty)",
    noneTable: "None",
  },
  changeTable: {
    path: "Path",
    kind: "Kind",
    index: "Index",
    worktree: "Worktree",
    insertions: "Insertions",
    deletions: "Deletions",
  },
  reviewTable: {
    ruleId: "Rule ID",
    path: "Path",
    rule: "Rule",
    reason: "Reason",
    evidence: "Evidence",
  },
  checkLabels: {
    command: "Command",
    startedAt: "Started at",
    endedAt: "Ended at",
    duration: "Duration",
    exitCode: "Exit code",
    signal: "Signal",
    output: "Output",
    truncated: "Truncated",
    redacted: "Redacted",
    error: "Error",
  },
  passNote: "A pass records only that the command exited zero in this invocation; absence of evidence does not mean a check passed.",
  noExplicitCommands: "No explicit commands were supplied, so no checks were executed.",
  noEnabledRules: "No enabled rules matched Git-visible paths or diff statistics. This is not evidence that none apply.",
  heuristicsNote: "Heuristics above are review prompts, not findings or a correctness verdict.",
  notChecked: [
    "Commands not supplied through --run were not executed.",
    "Tests, type checks, linters, builds, dependency audits, and runtime behavior are not inferred from the repository.",
    "A successful explicitly run command is evidence of that invocation, not proof of correctness or security.",
  ],
  limitations: ({ untrackedIncluded }) => [
    "This report does not establish correctness, security, or readiness to merge.",
    `It covers only Git-visible changes in the selected view; ignored files, unreadable content, and history outside the selected view are not inspected. Untracked files are ${untrackedIncluded ? "listed by path only; their contents were not read" : "excluded in --base mode"}.`,
    "Line counts are Git diff estimates; binary files and some unusual changes have no line count.",
    "Review prompts are deterministic path/stat heuristics, not findings; absence of a prompt is not evidence of safety.",
    "Command output may contain sensitive data. Redaction is best-effort and reports should be reviewed before sharing.",
    "Explicit --run commands use the user's shell and privileges without a sandbox.",
    "Facts come from local Git metadata and observed command outcomes; heuristics and everything not observed are labeled separately.",
  ],
  shareSafeLimitation: "Share-safe mode omits branch, HEAD, repository paths, output destinations, command text, command output, and base commits. Redaction is still best-effort; review before sharing.",
  reviewRules: {
    "PP-DEP-001": {
      rule: "Dependency manifest/lockfile changed",
      reason: "Dependency changes can alter resolved versions, install scripts, and build behavior.",
    },
    "PP-CI-001": {
      rule: "CI/workflow file changed",
      reason: "Workflow changes can alter automated checks, secrets exposure, and runner permissions.",
    },
    "PP-AUTH-001": {
      rule: "Authentication/permission-related path changed",
      reason: "This path may touch access control or credential handling; this is not a vulnerability finding.",
    },
    "PP-MIGRATION-001": {
      rule: "Migration/schema path changed",
      reason: "Persistent data or schema changes deserve an explicit rollback and compatibility review.",
    },
    "PP-SECRET-FILE-001": {
      rule: "Secret-like filename changed",
      reason: "This filename may contain credentials; Proofpack inspected only the path, not its contents.",
    },
    "PP-LARGE-DELETION-001": {
      rule: "Large deletion",
      reason: "Large deletions deserve a focused review of removed behavior and data.",
    },
  },
  matchedPathEvidence: (path) => `Matched path: ${path}. Suggested inspection: git diff -- ${path}`,
  largeDeletionEvidence: (deletions, path) => `Git numstat reports ${deletions} deletions for ${path}.`,
  categories: (counts) => `${counts.added} added · ${counts.modified} modified · ${counts.deleted} deleted · ${counts.renamedOrCopied} renamed/copied · ${counts.untracked} untracked · ${counts.unmerged} unmerged`,
  diffSummary: (summary) => `${summary.insertions}+ insertions · ${summary.deletions}+ deletions${summary.partial ? " (partial; see table)" : ""} · ${summary.binary} binary · ${summary.unavailableLineCounts} with unavailable line counts`,
  changeView: ({ shareSafe, base, untrackedIncluded }) => {
    if (shareSafe) return "Git-visible changes in the selected view; branch, HEAD, base, paths, and command details omitted";
    if (base !== null) return `committed, staged, and working-tree changes against base ${base.ref} (${base.commit}); untracked files excluded`;
    return untrackedIncluded
      ? "staged index and working tree against HEAD, plus untracked file paths"
      : "staged index and working tree against HEAD; untracked files excluded";
  },
  observedOutcomes: (counts) => `${counts.passed} passed · ${counts.failed} failed · ${counts.notRun} not run · ${counts.other} other`,
  output: ({ stdoutBytes, stderrBytes, limit }) => `${stdoutBytes} stdout bytes · ${stderrBytes} stderr bytes · limit ${limit} bytes per stream`,
  pathsOnly: (value) => `${value} (paths only)`,
  replacement: (count) => `${count} replacement${count === 1 ? "" : "s"}`,
  duration: (ms) => ms === null ? "unknown" : `${ms} ms`,
  reportDestination: ({ shareSafe, outputPath, outputLabel, multipleFormats }) => {
    if (shareSafe) return "redacted";
    if (outputPath === undefined) return `on ${outputLabel ?? "stdout"}`;
    return `written to ${outputPath}${multipleFormats ? " (.md/.json)" : ""}`;
  },
  summary: (input) => {
    const failureSuffix = input.other > 0 ? ` · ${input.other} other` : "";
    return `Proofpack · ${input.gitVisibleFiles} Git-visible files · ${input.passed} passed · ${input.failed} failed · ${input.notRun} not run${failureSuffix} · ${input.reviewPrompts} review prompts · report ${input.destination}`;
  },
  cli: {
    runningCheck: (index, total, command, shareSafe) => shareSafe
      ? "Proofpack: running check: [OMITTED]"
      : `Proofpack: running check ${index}/${total}: ${command}`,
    receivedSignal: (signal) => `Proofpack: received ${signal}; stopping checks.`,
    wrote: (path) => `Proofpack: wrote ${path}`,
    opened: "Proofpack: opened the Markdown report with the system opener.",
    errorPrefix: "Proofpack: ",
    nextGitRepository: "Next: run the command inside a readable Git repository.",
    nextOutputPath: "Next: choose an untracked output path inside the repository.",
    nextOpen: "Next: open the written report manually or choose another system opener.",
    reportGenerationFailed: (message) => `Proofpack: report generation failed: ${message}`,
  },
  mcp: {
    reportFailure: (message) => `Proofpack could not generate a report: ${message}`,
  },
};

const SIMPLIFIED_CHINESE: ReportText = {
  title: "# Proofpack 验收报告",
  labels: {
    generatedAt: "生成时间",
    schemaVersion: "结构版本",
    branch: "分支",
    head: "HEAD",
    base: "基准",
    baseNone: "无（HEAD/工作区视图）",
    untrackedIncluded: "包含未跟踪文件",
    shareSafe: "分享安全模式",
    reportFormat: "报告格式",
    output: "输出",
    observedBase: "观察基准",
    gitVisibleFiles: "Git 可见文件",
    categories: "变更分类",
    diffSummary: "差异统计",
    explicitCommands: "显式请求的命令",
    observedOutcomes: "观察到的结果",
  },
  sections: {
    change: "## 变更",
    checks: "## 检查",
    notChecked: "## 未检查",
    reviewPrompts: "## 复核提示",
    limits: "## 限制",
  },
  values: {
    omitted: "[OMITTED]",
    markdown: "Markdown",
    stdout: "stdout",
    yes: "是",
    no: "否",
    unknown: "未知",
    binary: "二进制",
    none: "none",
    notStarted: "未开始",
    unavailable: "不可用",
    empty: "（空）",
    noneTable: "无",
  },
  changeTable: {
    path: "路径",
    kind: "类型",
    index: "索引区",
    worktree: "工作区",
    insertions: "新增行",
    deletions: "删除行",
  },
  reviewTable: {
    ruleId: "规则 ID",
    path: "路径",
    rule: "规则",
    reason: "原因",
    evidence: "证据",
  },
  checkLabels: {
    command: "命令",
    startedAt: "开始时间",
    endedAt: "结束时间",
    duration: "耗时",
    exitCode: "退出码",
    signal: "信号",
    output: "输出",
    truncated: "已截断",
    redacted: "已脱敏",
    error: "错误",
  },
  passNote: "通过仅表示本次调用中命令退出码为 0；缺少证据不代表检查已通过。",
  noExplicitCommands: "未提供显式命令，因此没有执行任何检查。",
  noEnabledRules: "没有启用的规则匹配 Git 可见路径或差异统计；这不代表没有需要注意的项目。",
  heuristicsNote: "以上启发式结果只是复核提示，不是结论或正确性判定。",
  notChecked: [
    "未通过 --run 提供的命令没有执行。",
    "不会从仓库推断测试、类型检查、lint、构建、依赖审计或运行时行为。",
    "显式命令执行成功只代表该次调用的证据，不代表正确性或安全性。",
  ],
  limitations: ({ untrackedIncluded }) => [
    "本报告不证明正确性、安全性或可以合并。",
    `仅覆盖所选视图中的 Git 可见变更；忽略的文件、不可读内容以及所选视图之外的历史均不检查。未跟踪文件${untrackedIncluded ? "仅按路径列出，未读取内容" : "在 --base 模式下被排除"}。`,
    "行数是 Git diff 估算值；二进制文件和部分特殊变更没有行数统计。",
    "复核提示只是基于路径/统计的确定性启发式，不是发现结论；没有提示不代表安全。",
    "命令输出可能包含敏感信息；脱敏是尽力而为，分享前仍需复核报告。",
    "显式 --run 命令使用当前用户的 shell 和权限，没有沙箱。",
    "事实来自本地 Git 元数据和观察到的命令结果；启发式与未观察项均单独标注。",
  ],
  shareSafeLimitation: "分享安全模式会省略分支、HEAD、仓库路径、输出目标、命令文本、命令输出和基准提交；脱敏仍是尽力而为，分享前请复核。",
  reviewRules: {
    "PP-DEP-001": {
      rule: "依赖清单或锁文件发生变更",
      reason: "依赖变化可能影响解析版本、安装脚本和构建行为。",
    },
    "PP-CI-001": {
      rule: "CI/工作流文件发生变更",
      reason: "工作流变化可能影响自动检查、密钥暴露和 runner 权限。",
    },
    "PP-AUTH-001": {
      rule: "认证/权限相关路径发生变更",
      reason: "该路径可能涉及访问控制或凭据处理；这不是漏洞结论。",
    },
    "PP-MIGRATION-001": {
      rule: "迁移/数据结构路径发生变更",
      reason: "持久化数据或结构变化值得明确检查回滚与兼容性。",
    },
    "PP-SECRET-FILE-001": {
      rule: "类密钥文件名发生变更",
      reason: "该文件名可能包含凭据；Proofpack 只检查了路径，未读取内容。",
    },
    "PP-LARGE-DELETION-001": {
      rule: "大量删除",
      reason: "大量删除值得集中复核被移除的行为和数据。",
    },
  },
  matchedPathEvidence: (path) => `匹配路径：${path}。建议检查：git diff -- ${path}`,
  largeDeletionEvidence: (deletions, path) => `Git numstat 显示 ${path} 删除了 ${deletions} 行。`,
  categories: (counts) => `${counts.added} 个新增 · ${counts.modified} 个修改 · ${counts.deleted} 个删除 · ${counts.renamedOrCopied} 个重命名/复制 · ${counts.untracked} 个未跟踪 · ${counts.unmerged} 个未合并`,
  diffSummary: (summary) => `${summary.insertions}+ 行新增 · ${summary.deletions}+ 行删除${summary.partial ? "（部分统计，详见表格）" : ""} · ${summary.binary} 个二进制文件 · ${summary.unavailableLineCounts} 个文件缺少行数统计`,
  changeView: ({ shareSafe, base, untrackedIncluded }) => {
    if (shareSafe) return "仅显示所选视图中的 Git 可见变更；分支、HEAD、基准、路径和命令细节已省略";
    if (base !== null) return `以基准 ${base.ref}（${base.commit}）对比已提交、暂存和工作区变更；不包含未跟踪文件`;
    return untrackedIncluded
      ? "以 HEAD 为基准观察暂存区和工作区变更，并仅列出未跟踪文件路径"
      : "以 HEAD 为基准观察暂存区和工作区变更；不包含未跟踪文件";
  },
  observedOutcomes: (counts) => `${counts.passed} passed · ${counts.failed} failed · ${counts.notRun} not run · ${counts.other} other`,
  output: ({ stdoutBytes, stderrBytes, limit }) => `${stdoutBytes} 字节 stdout · ${stderrBytes} 字节 stderr · 每流上限 ${limit} 字节`,
  pathsOnly: (value) => `${value}（仅路径）`,
  replacement: (count) => `${count} 处替换`,
  duration: (ms) => ms === null ? "未知" : `${ms} 毫秒`,
  reportDestination: ({ shareSafe, outputPath, outputLabel, multipleFormats }) => {
    if (shareSafe) return "已脱敏";
    if (outputPath === undefined) return `输出至 ${outputLabel ?? "stdout"}`;
    return `已写入 ${outputPath}${multipleFormats ? " (.md/.json)" : ""}`;
  },
  summary: (input) => {
    const failureSuffix = input.other > 0 ? ` · ${input.other} other` : "";
    return `Proofpack · ${input.gitVisibleFiles} 个 Git 可见文件 · ${input.passed} passed · ${input.failed} failed · ${input.notRun} not run${failureSuffix} · ${input.reviewPrompts} 条复核提示 · 报告${input.destination}`;
  },
  cli: {
    runningCheck: (index, total, command, shareSafe) => shareSafe
      ? "Proofpack：正在执行检查：[OMITTED]"
      : `Proofpack：正在执行检查 ${index}/${total}：${command}`,
    receivedSignal: (signal) => `Proofpack：收到 ${signal}，正在停止检查。`,
    wrote: (path) => `Proofpack：已写入 ${path}`,
    opened: "Proofpack：已使用系统默认程序打开 Markdown 报告。",
    errorPrefix: "Proofpack：",
    nextGitRepository: "下一步：请在可读的 Git 仓库内运行命令。",
    nextOutputPath: "下一步：请选择仓库内未被跟踪的输出路径。",
    nextOpen: "下一步：请手动打开已写入的报告，或换一个系统默认程序。",
    reportGenerationFailed: (message) => `Proofpack：报告生成失败：${message}`,
  },
  mcp: {
    reportFailure: (message) => `Proofpack 无法生成验收报告：${message}`,
  },
};

export function getReportText(language: ReportLanguage): ReportText {
  return language === "zh-CN" ? SIMPLIFIED_CHINESE : ENGLISH;
}
