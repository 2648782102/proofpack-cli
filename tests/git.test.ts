import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import test from "node:test";
import path from "node:path";
import os from "node:os";
import {
  GitInspectionError,
  inspectGitChanges,
  parseDiffNumstat,
  parseNameStatus,
  parseStatusEntries,
} from "../src/git.js";

function git(directory: string, ...args: string[]): string {
  const result = spawnSync("git", args, {
    cwd: directory,
    encoding: "utf8",
    env: { ...process.env, GIT_OPTIONAL_LOCKS: "0" },
  });
  if (result.status !== 0) {
    throw new Error(`git ${args.join(" ")} failed: ${result.stderr}`);
  }
  return result.stdout;
}

function makeRepository(): string {
  const directory = mkdtempSync(path.join(os.tmpdir(), "proofpack-git-test-"));
  git(directory, "init", "-q", "-b", "main");
  git(directory, "config", "user.name", "Proofpack Test");
  git(directory, "config", "user.email", "proofpack@example.invalid");
  git(directory, "config", "core.autocrlf", "false");
  return directory;
}

function write(directory: string, relativePath: string, content: string | Buffer): void {
  const absolutePath = path.join(directory, relativePath);
  mkdirSync(path.dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, content);
}

function nulTokens(...values: string[]): Buffer {
  return Buffer.from(`${values.join("\0")}\0`, "utf8");
}

function snapshotBase() {
  return {
    repositoryRoot: "/repo",
    branch: "main",
    head: "abc123",
    changeView: "staged index and working tree against HEAD, plus untracked file paths",
    base: null,
    untrackedIncluded: true,
  };
}

function assertBaseSnapshot(value: unknown): asserts value is {
  base: { ref: string; commit: string } | null;
  changeView: string;
  untrackedIncluded: boolean;
  files: Array<{ path: string; kind: string; diffStat: { insertions: number | undefined; deletions: number | undefined; binary: boolean } }>;
} {
  assert.equal(typeof value, "object");
  assert.notEqual(value, null);
}

test("parses porcelain status with rename, untracked, deleted, and unusual paths", () => {
  const status = parseStatusEntries(nulTokens(
    "# branch.oid abc123",
    "# branch.head main",
    "1 .M N... 100644 100644 100644 aaa bbb blob.bin",
    "2 R. N... 100644 100644 100644 814f4a422927b82f5f8a43f8fab6d3839e3983f2 814f4a422927b82f5f8a43f8fab6d3839e3983f2 R100 renamed file.txt",
    "name with space.txt",
    "1 A. N... 000000 100644 100644 0000000000000000000000000000000000000000 19d9cc8584ac2c7dcf57d2680375e80f099dc481 staged.txt",
    "1 D. N... 100644 000000 000000 df967b96a579e45a18b8251732d16804b2e56a55 0000000000000000000000000000000000000000 tracked.txt",
    "? tick`name.txt",
    "? untracked.txt",
    "u UU N... 100644 100644 100644 100644 df967b96a579e45a18b8251732d16804b2e56a55 ba2906d0666cf726c7eaadd2cd3db615dedfdf3a e45c9c2666d44e0327c1f9c239a74c508336053e conflict.txt",
  ));

  assert.equal(status.head, "abc123");
  assert.equal(status.branch, "main");
  assert.deepEqual(status.entries.map((entry) => entry.kind), [
    "modified",
    "renamed",
    "added",
    "deleted",
    "untracked",
    "untracked",
    "unmerged",
  ]);
  assert.equal(status.entries[1]?.path, "renamed file.txt");
  assert.equal(status.entries[1]?.previousPath, "name with space.txt");
  assert.equal(status.entries[4]?.path, "tick`name.txt");
  assert.equal(status.entries.at(-1)?.staged, undefined);
});

test("parses numstat with normal, binary, and rename path tokens", () => {
  const stats = parseDiffNumstat(nulTokens(
    "2\t0\ta.txt",
    "-\t-\tblob.bin",
    "1\t0\t",
    "name with space.txt",
    "renamed file.txt",
  ));

  assert.deepEqual(stats.get("a.txt"), { insertions: 2, deletions: 0, binary: false });
  assert.deepEqual(stats.get("blob.bin"), { insertions: undefined, deletions: undefined, binary: true });
  assert.deepEqual(stats.get("name with space.txt"), { insertions: 1, deletions: 0, binary: false });
  assert.deepEqual(stats.get("renamed file.txt"), { insertions: 1, deletions: 0, binary: false });
});

test("parses name-status records with unusual and binary paths", () => {
  assert.deepEqual(parseNameStatus(nulTokens("A\tadded.txt", "M\tname with space.txt", "M\tblob.bin")), [
    { path: "added.txt", kind: "added" },
    { path: "name with space.txt", kind: "modified" },
    { path: "blob.bin", kind: "modified" },
  ]);
});

test("rejects malformed porcelain tokens", () => {
  assert.throws(() => parseStatusEntries(nulTokens("x unexpected")), GitInspectionError);
  assert.throws(() => parseDiffNumstat(nulTokens("not\ta\tcount\ta.txt")), GitInspectionError);
});

test("inspects staged, unstaged, renamed, deleted, untracked, and binary changes", () => {
  const directory = makeRepository();
  write(directory, "name with space.txt", "one\ntwo\n");
  write(directory, "tracked.txt", "base\n");
  write(directory, "blob.bin", Buffer.from("binary\0data\0"));
  write(directory, ".gitignore", "ignored.txt\n");
  git(directory, "add", ".");
  git(directory, "commit", "-qm", "initial");

  git(directory, "mv", "name with space.txt", "renamed file.txt");
  write(directory, "renamed file.txt", "one\ntwo\nthree\n");
  write(directory, "staged.txt", "staged\n");
  git(directory, "add", "staged.txt");
  write(directory, "tick`name.txt", "untracked\n");
  write(directory, "blob.bin", Buffer.from("more\0binary\0"));
  git(directory, "rm", "-q", "tracked.txt");
  write(directory, "ignored.txt", "not visible\n");

  const snapshot = inspectGitChanges({ cwd: directory });
  assertBaseSnapshot(snapshot);
  const paths = snapshot.files.map((file) => file.path);
  assert.equal(snapshot.branch, "main");
  assert.match(snapshot.head, /^[0-9a-f]{40}$/);
  assert.ok(paths.includes("renamed file.txt"));
  assert.ok(paths.includes("staged.txt"));
  assert.ok(paths.includes("tracked.txt"));
  assert.ok(paths.includes("tick`name.txt"));
  assert.ok(!paths.includes("ignored.txt"));

  const renamed = snapshot.files.find((file) => file.path === "renamed file.txt");
  assert.equal(renamed?.kind, "renamed");
  assert.equal(renamed?.previousPath, "name with space.txt");
  assert.deepEqual(renamed?.diffStat, { insertions: 3, deletions: 2, binary: false });
  const binary = snapshot.files.find((file) => file.path === "blob.bin");
  assert.equal(binary?.diffStat.binary, true);
  const untracked = snapshot.files.find((file) => file.path === "tick`name.txt");
  assert.equal(untracked?.kind, "untracked");
  assert.equal(untracked?.diffStat.insertions, undefined);
});

test("inspects an unborn HEAD and reports staged additions", () => {
  const directory = makeRepository();
  write(directory, "staged.txt", "one\n");
  git(directory, "add", "staged.txt");
  write(directory, "untracked.txt", "two\n");

  const snapshot = inspectGitChanges({ cwd: directory });
  assertBaseSnapshot(snapshot);
  assert.equal(snapshot.head, "(initial)");
  assert.deepEqual(snapshot.files.map((file) => file.path), ["staged.txt", "untracked.txt"]);
  assert.equal(snapshot.files[0]?.kind, "added");
  assert.deepEqual(snapshot.files[0]?.diffStat, { insertions: 1, deletions: 0, binary: false });
});

test("reports a repository with no visible changes", () => {
  const directory = makeRepository();
  write(directory, "tracked.txt", "one\n");
  git(directory, "add", ".");
  git(directory, "commit", "-qm", "initial");

  const snapshot = inspectGitChanges({ cwd: directory });
  assertBaseSnapshot(snapshot);
  assert.deepEqual(snapshot.files, []);
});

test("does not list ignored files as Git-visible changes", () => {
  const directory = makeRepository();
  write(directory, ".gitignore", "*.proofpack.md\n");
  git(directory, "add", ".");
  git(directory, "commit", "-qm", "initial");
  write(directory, "review.proofpack.md", "report\n");

  const snapshot = inspectGitChanges({ cwd: directory });
  assertBaseSnapshot(snapshot);
  assert.deepEqual(snapshot.files, []);
});

test("fails outside a Git repository", () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), "proofpack-non-git-"));
  assert.throws(() => inspectGitChanges({ cwd: directory }), GitInspectionError);
});

test("compares committed, staged, and worktree changes against an explicit base", () => {
  const directory = makeRepository();
  write(directory, "tracked.txt", "base\n");
  write(directory, "blob.bin", Buffer.from("binary\0base\0"));
  git(directory, "add", ".");
  git(directory, "commit", "-qm", "base");
  git(directory, "tag", "v0.1");

  write(directory, "tracked.txt", "committed\n");
  write(directory, "added.txt", "new\n");
  write(directory, "blob.bin", Buffer.from("binary\0changed\0"));
  git(directory, "add", ".");
  git(directory, "commit", "-qm", "one");
  write(directory, "tracked.txt", "worktree\n");
  write(directory, "untracked.txt", "untracked\n");

  const snapshot = inspectGitChanges({ cwd: directory, base: "v0.1" });
  const paths = snapshot.files.map((file) => file.path);
  assert.equal(snapshot.base?.ref, "v0.1");
  assert.match(snapshot.base?.commit ?? "", /^[0-9a-f]{40}$/);
  assert.equal(snapshot.untrackedIncluded, false);
  assert.ok(paths.includes("added.txt"));
  assert.ok(paths.includes("tracked.txt"));
  assert.ok(paths.includes("blob.bin"));
  assert.ok(!paths.includes("untracked.txt"));
  assert.equal(snapshot.files.find((file) => file.path === "added.txt")?.kind, "added");
  assert.equal(snapshot.files.find((file) => file.path === "blob.bin")?.diffStat.binary, true);
  assert.equal(snapshot.files.find((file) => file.path === "tracked.txt")?.diffStat.insertions, 1);
});

test("rejects an invalid --base ref", () => {
  const directory = makeRepository();
  assert.throws(
    () => inspectGitChanges({ cwd: directory, base: "not-a-ref" }),
    GitInspectionError,
  );
});
