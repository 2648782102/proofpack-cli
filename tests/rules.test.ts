import assert from "node:assert/strict";
import test from "node:test";
import type { FileChange } from "../src/git.js";
import { buildReviewPrompts } from "../src/rules.js";

function change(filePath: string, deletions: number | undefined = 0): FileChange {
  return {
    path: filePath,
    previousPath: undefined,
    kind: "modified",
    staged: false,
    worktree: true,
    diffStat: {
      insertions: 1,
      deletions,
      binary: false,
    },
  };
}

test("matches dependency, CI, auth, migration, and secret-like paths", () => {
  const promptIds = buildReviewPrompts([
    change("package-lock.json"),
    change(".github/workflows/ci.yml"),
    change("src/auth/session.ts"),
    change("db/migrations/2026.sql"),
    change(".env.production"),
  ]).map((prompt) => prompt.id);

  assert.deepEqual(promptIds.sort(), [
    "PP-SECRET-FILE-001",
    "PP-CI-001",
    "PP-MIGRATION-001",
    "PP-AUTH-001",
    "PP-DEP-001",
  ].sort());
});

test("matches the previous path of a rename and large deletions", () => {
  const renamed: FileChange = {
    ...change("src/parser.ts", 120),
    kind: "renamed",
    previousPath: ".github/workflows/old.yml",
  };
  const prompts = buildReviewPrompts([renamed]);
  assert.ok(prompts.some((prompt) => prompt.id === "PP-CI-001" && prompt.path === "src/parser.ts"));
  assert.ok(prompts.some((prompt) => prompt.id === "PP-LARGE-DELETION-001"));
});

test("does not flag examples or neutral paths", () => {
  assert.deepEqual(buildReviewPrompts([change(".env.example"), change("src/utils/format.ts")]), []);
});
