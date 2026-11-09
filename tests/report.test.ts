import assert from "node:assert/strict";
import test from "node:test";
import type { CheckResult } from "../src/checks.js";
import type { GitSnapshot } from "../src/git.js";
import type { ReviewPrompt } from "../src/rules.js";
import { buildReport, escapeInlineCode, SCHEMA_VERSION } from "../src/report.js";
import { buildReviewPrompts } from "../src/rules.js";

const snapshot: GitSnapshot = {
  repositoryRoot: "/repo",
  branch: "main",
  head: "abc123",
  changeView: "staged index and working tree against HEAD, plus untracked file paths",
  base: null,
  untrackedIncluded: true,
  files: [
    {
      path: "tick`name.txt",
      previousPath: undefined,
      kind: "untracked",
      staged: false,
      worktree: true,
      diffStat: { insertions: undefined, deletions: undefined, binary: false },
    },
    {
      path: "a|b.txt",
      previousPath: "old.txt",
      kind: "renamed",
      staged: true,
      worktree: false,
      diffStat: { insertions: 2, deletions: 1, binary: false },
    },
    {
      path: "blob.bin",
      previousPath: undefined,
      kind: "modified",
      staged: false,
      worktree: true,
      diffStat: { insertions: undefined, deletions: undefined, binary: true },
    },
  ],
};

function passedCheck(): CheckResult {
  return {
    id: "check-1",
    command: "npm test",
    status: "passed",
    startedAt: "2026-11-07T12:00:00.000Z",
    endedAt: "2026-11-07T12:00:01.000Z",
    durationMs: 1000,
    exitCode: 0,
    signal: null,
    stdout: "2 tests passed\n",
    stderr: "",
    stdoutBytes: 15,
    stderrBytes: 0,
    truncated: false,
    redacted: false,
    redactionCount: 0,
    outputLimitBytes: 32768,
    error: null,
  };
}

const reviewPrompt: ReviewPrompt = {
  id: "PP-DEP-001",
  path: "package.json",
  previousPath: null,
  rule: "Dependency manifest/lockfile changed",
  reason: "Review resolved versions.",
  evidence: "Matched path: package.json",
};

test("builds Markdown and JSON with facts, checks, prompts, and limits", () => {
  const report = buildReport(snapshot, [passedCheck()], [reviewPrompt], {
    formats: ["markdown", "json"],
    outputPath: ".proofpack/review.md",
    generatedAt: "2026-11-07T12:00:00.000Z",
  });

  assert.equal(report.document.schemaVersion, "0.3");
  assert.equal(report.document.checks.passed, 1);
  assert.equal(report.document.reviewPrompts.length, 1);
  assert.match(report.markdown, /# Proofpack acceptance report/);
  assert.match(report.markdown, /`` tick`name\.txt ``/);
  assert.match(report.markdown, /old\.txt.*a\\\|b\.txt/);
  assert.match(report.markdown, /2 tests passed/);
  assert.match(report.markdown, /PP-DEP-001/);
  assert.match(report.markdown, /does not establish correctness/);
  assert.match(report.summary, /1 passed · 0 failed · 0 not run/);
  const parsed = JSON.parse(report.json) as { schemaVersion: string; checks: { results: CheckResult[] } };
  assert.equal(parsed.schemaVersion, SCHEMA_VERSION);
  assert.equal(parsed.checks.results[0]?.command, "npm test");
});

test("share-safe mode omits identifying paths, command evidence, and output destination", () => {
  const report = buildReport(snapshot, [passedCheck()], [reviewPrompt], {
    formats: ["markdown", "json"],
    outputPath: ".proofpack/review.md",
    shareSafe: true,
    generatedAt: "2026-11-07T12:00:00.000Z",
  });

  assert.equal(report.document.shareSafe, true);
  assert.equal(report.document.output, null);
  assert.equal(report.document.repository.branch, "[OMITTED]");
  assert.equal(report.document.repository.head, "[OMITTED]");
  assert.equal(report.document.change.files[0]?.path, "[OMITTED]");
  assert.equal(report.document.checks.results[0]?.command, "[OMITTED]");
  assert.equal(report.document.checks.results[0]?.stdout, "");
  assert.equal(report.document.reviewPrompts[0]?.path, "[OMITTED]");
  assert.equal(report.document.reviewPrompts[0]?.evidence, "[OMITTED]");
  assert.equal(report.json.includes("tick`name.txt"), false);
  assert.equal(report.json.includes("npm test"), false);
  assert.equal(report.markdown.includes("tick`name.txt"), false);
  assert.equal(report.markdown.includes("npm test"), false);
});

test("keeps no checks and no prompt matches explicitly unknown, not passed", () => {
  const report = buildReport(snapshot, [], [], {
    formats: ["markdown"],
    outputPath: undefined,
    generatedAt: "2026-11-07T12:00:00.000Z",
  });
  assert.match(report.markdown, /No explicit commands were supplied/);
  assert.match(report.markdown, /No enabled rules matched/);
  assert.match(report.markdown, /not evidence that none apply/);
  assert.match(report.summary, /0 passed · 0 failed · 0 not run/);
});

test("escapes inline code containing backticks and control characters", () => {
  assert.equal(escapeInlineCode("a``b\n`c"), "``` a``b `c ```");
});

test("renders Simplified Chinese Markdown and JSON text fields while keeping the schema stable", () => {
  const localizedPrompt = buildReviewPrompts([
    {
      path: "package.json",
      previousPath: undefined,
      kind: "modified",
      staged: false,
      worktree: true,
      diffStat: { insertions: 1, deletions: 0, binary: false },
    },
  ], "zh-CN")[0];
  assert.ok(localizedPrompt);
  const report = buildReport(snapshot, [passedCheck()], [localizedPrompt], {
    formats: ["markdown", "json"],
    outputPath: undefined,
    language: "zh-CN",
    generatedAt: "2026-11-07T12:00:00.000Z",
  });

  assert.match(report.markdown, /# Proofpack 验收报告/);
  assert.match(report.markdown, /## 变更/);
  assert.match(report.markdown, /## 未检查/);
  assert.match(report.markdown, /## 复核提示/);
  assert.match(report.markdown, /## 限制/);
  assert.match(report.markdown, /依赖清单或锁文件发生变更/);
  assert.match(report.markdown, /本报告不证明正确性/);
  assert.match(report.summary, /个 Git 可见文件/);

  const parsed = JSON.parse(report.json) as {
    schemaVersion: string;
    repository: { changeView: string };
    checks: { results: Array<{ status: string }> };
    reviewPrompts: Array<{ rule: string }>;
    limitations: string[];
  };
  assert.equal(parsed.schemaVersion, SCHEMA_VERSION);
  assert.match(parsed.repository.changeView, /HEAD/);
  assert.equal(parsed.checks.results[0]?.status, "passed");
  assert.match(parsed.reviewPrompts[0]?.rule ?? "", /依赖清单/);
  assert.match(parsed.limitations[0] ?? "", /不证明正确性/);
});
