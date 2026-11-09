import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, symlinkSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cliEntrypoint = path.join(projectRoot, "src", "cli.ts");
const tsxLoader = path.join(projectRoot, "node_modules", "tsx", "dist", "loader.mjs");

function runCli(args: readonly string[], cwd: string, env: NodeJS.ProcessEnv = process.env) {
  return spawnSync(process.execPath, ["--import", tsxLoader, cliEntrypoint, ...args], {
    cwd,
    encoding: "utf8",
    env,
  });
}

function git(directory: string, ...args: string[]): string {
  const result = spawnSync("git", args, {
    cwd: directory,
    encoding: "utf8",
    env: { ...process.env, GIT_OPTIONAL_LOCKS: "0" },
  });
  if (result.status !== 0) throw new Error(`git failed: ${result.stderr}`);
  return result.stdout;
}

function makeRepository(): string {
  const directory = mkdtempSync(path.join(os.tmpdir(), "proofpack-cli-test-"));
  git(directory, "init", "-q", "-b", "main");
  git(directory, "config", "user.name", "Proofpack Test");
  git(directory, "config", "user.email", "proofpack@example.invalid");
  return directory;
}

test("help and version work without a Git repository", () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), "proofpack-help-test-"));
  assert.equal(runCli(["--help"], directory).status, 0);
  assert.match(runCli(["--help"], directory).stdout, /--lang/);
  assert.match(runCli(["--version"], directory).stdout, /^proofpack 0\.3\.2\n$/);
});

test("MCP entrypoint exits on stdin EOF without writing to stdout", () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), "proofpack-mcp-eof-"));
  const result = spawnSync(
    process.execPath,
    ["--import", tsxLoader, path.join(projectRoot, "src", "mcp.ts")],
    { cwd: directory, input: "", encoding: "utf8", env: process.env },
  );
  assert.equal(result.status, 0);
  assert.equal(result.stdout, "");
  assert.equal(result.stderr, "");
});

test("argument errors use exit code 2", () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), "proofpack-args-test-"));
  const result = runCli(["check", "--compare", "main"], directory);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /Unknown option/);
});

test("non-Git directories use exit code 3 with a next action", () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), "proofpack-non-git-cli-"));
  const result = runCli(["check"], directory);
  assert.equal(result.status, 3);
  assert.match(result.stderr, /Next:/);
});

test("default check prints Markdown to stdout and runs no commands", () => {
  const directory = makeRepository();
  mkdirSync(path.join(directory, "nested"));
  writeFileSync(path.join(directory, "tracked.txt"), "one\n");
  git(directory, "add", ".");
  git(directory, "commit", "-qm", "initial");
  writeFileSync(path.join(directory, "tracked.txt"), "one\ntwo\n");

  const result = runCli(["check"], path.join(directory, "nested"));
  assert.equal(result.status, 0);
  assert.match(result.stdout, /# Proofpack acceptance report/);
  assert.match(result.stdout, /No explicit commands were supplied/);
  assert.equal(result.stdout.includes(".proofpack/latest.md"), false);
  assert.equal(readFileSync(path.join(directory, "tracked.txt"), "utf8"), "one\ntwo\n");
});

test("explicit checks, JSON, and review prompts are recorded", () => {
  const directory = makeRepository();
  writeFileSync(path.join(directory, "package.json"), "{}\n");
  git(directory, "add", ".");
  git(directory, "commit", "-qm", "initial");
  writeFileSync(path.join(directory, "package.json"), "{\"name\":\"changed\"}\n");

  const result = runCli([
    "check",
    "--run",
    "node -e \"console.log('hello')\"",
    "--format=json",
  ], directory);
  assert.equal(result.status, 0);
  assert.match(result.stderr, /running check 1\/1/);
  const parsed = JSON.parse(result.stdout) as {
    schemaVersion: string;
    checks: { passed: number; results: Array<{ stdout: string }> };
    reviewPrompts: Array<{ id: string }>;
  };
  assert.equal(parsed.schemaVersion, "0.3");
  assert.equal(parsed.checks.passed, 1);
  assert.match(parsed.checks.results[0]?.stdout ?? "", /hello/);
  assert.ok(parsed.reviewPrompts.some((prompt) => prompt.id === "PP-DEP-001"));
});

test("failed checks use exit code 1 and still emit a report", () => {
  const directory = makeRepository();
  const result = runCli(
    ["check", "--run", "node -e \"process.exit(2)\"", "--format", "json"],
    directory,
  );
  assert.equal(result.status, 1);
  const parsed = JSON.parse(result.stdout) as { checks: { failed: number } };
  assert.equal(parsed.checks.failed, 1);
});

test("timeout and spawn errors use exit code 4", () => {
  const directory = makeRepository();
  const timedOut = runCli(
    ["check", "--run", "node -e \"setInterval(() => {}, 1000)\"", "--timeout", "1"],
    directory,
    { ...process.env, SHELL: "/bin/sh" },
  );
  assert.equal(timedOut.status, 4);
  assert.match(timedOut.stdout, /timeout/);

  const capped = runCli(
    [
      "check",
      "--run",
      "node -e \"process.stdout.write('A'.repeat(20))\"",
      "--output-limit-bytes=8",
      "--format=json",
    ],
    directory,
  );
  assert.equal(capped.status, 0);
  const cappedReport = JSON.parse(capped.stdout) as {
    checks: { results: Array<{ stdout: string; truncated: boolean }> };
  };
  assert.equal(cappedReport.checks.results[0]?.stdout, "A".repeat(8));
  assert.equal(cappedReport.checks.results[0]?.truncated, true);

  const noOutputPath = mkdtempSync(path.join(os.tmpdir(), "proofpack-no-output-path-"));
  const spawnFailure = runCli(
    ["check", "--run", "ignored", "--output", path.join(noOutputPath, "outside.md")],
    directory,
  );
  assert.equal(spawnFailure.status, 3);
});

test("multiple formats write sibling Markdown and JSON files", () => {
  const directory = makeRepository();
  writeFileSync(path.join(directory, "tracked.txt"), "one\n");
  git(directory, "add", ".");
  git(directory, "commit", "-qm", "initial");
  const result = runCli(
    ["check", "--format", "markdown,json", "--output", ".proofpack/review.md"],
    directory,
    { ...process.env, NO_COLOR: "1" },
  );
  assert.equal(result.status, 0);
  assert.equal(result.stdout, "");
  assert.match(readFileSync(path.join(directory, ".proofpack", "review.md"), "utf8"), /# Proofpack/);
  assert.equal(
    (JSON.parse(readFileSync(path.join(directory, ".proofpack", "review.json"), "utf8")) as { schemaVersion: string }).schemaVersion,
    "0.3",
  );
  assert.match(result.stderr, /review\.md/);
  assert.match(result.stderr, /review\.json/);
});

test("reports committed and working-tree changes against --base", () => {
  const directory = makeRepository();
  writeFileSync(path.join(directory, "tracked.txt"), "base\n");
  git(directory, "add", ".");
  git(directory, "commit", "-qm", "base");
  git(directory, "tag", "v0.1");
  writeFileSync(path.join(directory, "tracked.txt"), "committed\n");
  writeFileSync(path.join(directory, "added.txt"), "new\n");
  git(directory, "add", ".");
  git(directory, "commit", "-qm", "one");
  writeFileSync(path.join(directory, "tracked.txt"), "worktree\n");
  writeFileSync(path.join(directory, "untracked.txt"), "ignored in base view\n");

  const result = runCli(["check", "--base", "v0.1", "--format=json"], directory);
  assert.equal(result.status, 0);
  const parsed = JSON.parse(result.stdout) as {
    repository: { base: { ref: string } | null; untrackedIncluded: boolean };
    change: { files: Array<{ path: string }> };
  };
  assert.equal(parsed.repository.base?.ref, "v0.1");
  assert.equal(parsed.repository.untrackedIncluded, false);
  assert.ok(parsed.change.files.some((file) => file.path === "added.txt"));
  assert.ok(!parsed.change.files.some((file) => file.path === "untracked.txt"));
});

test("share-safe omits paths and command output from a written report", () => {
  const directory = makeRepository();
  const result = runCli(
    [
      "check",
      "--run",
      "node -e \"console.log('secret output marker')\"",
      "--share-safe",
      "--output",
      ".proofpack/share.md",
    ],
    directory,
  );
  assert.equal(result.status, 0);
  const report = readFileSync(path.join(directory, ".proofpack", "share.md"), "utf8");
  assert.equal(report.includes("secret output marker"), false);
  assert.equal(report.includes("secret output marker"), false);
  assert.equal(report.includes("node -e"), false);
  assert.equal(report.includes(".proofpack/share.md"), false);
  assert.equal(report.includes("Share-safe: yes"), true);
  assert.equal(report.includes(".proofpack/share.md"), false);
  assert.match(result.stderr, /\[OMITTED\]/);
  assert.equal(result.stderr.includes("secret output marker"), false);
  assert.equal(result.stderr.includes("node -e"), false);
});

test("Chinese language renders localized Markdown and CLI messages", () => {
  const directory = makeRepository();
  const result = runCli(
    [
      "check",
      "--lang",
      "zh-CN",
      "--run",
      "node -e \"console.log('hello')\"",
    ],
    directory,
  );
  assert.equal(result.status, 0);
  assert.match(result.stdout, /# Proofpack 验收报告/);
  assert.match(result.stdout, /## 未检查/);
  assert.match(result.stderr, /正在执行检查/);
});

test("PROOFPACK_LANG selects Chinese without a flag", () => {
  const directory = makeRepository();
  const result = runCli(["check"], directory, { ...process.env, PROOFPACK_LANG: "zh-Hans" });
  assert.equal(result.status, 0);
  assert.match(result.stdout, /# Proofpack 验收报告/);
});

test("output validation rejects tracked files, outside paths, and symlink traversal", () => {
  const directory = makeRepository();
  const outside = mkdtempSync(path.join(os.tmpdir(), "proofpack-outside-"));
  writeFileSync(path.join(directory, "tracked.txt"), "one\n");
  git(directory, "add", ".");
  git(directory, "commit", "-qm", "initial");
  mkdirSync(path.join(directory, "link-target"));
  symlinkSync(path.join(directory, "link-target"), path.join(directory, "link"));

  const tracked = runCli(["check", "--output", "tracked.txt"], directory);
  assert.equal(tracked.status, 3);
  assert.match(tracked.stderr, /tracked file/);
  assert.equal(readFileSync(path.join(directory, "tracked.txt"), "utf8"), "one\n");

  const outsideResult = runCli(["check", "--output", path.join(outside, "review.md")], directory);
  assert.equal(outsideResult.status, 3);
  assert.match(outsideResult.stderr, /inside the current repository/);

  const symlinkResult = runCli(["check", "--output", path.join("link", "review.md")], directory);
  assert.equal(symlinkResult.status, 3);
  assert.match(symlinkResult.stderr, /symbolic link/);
});
