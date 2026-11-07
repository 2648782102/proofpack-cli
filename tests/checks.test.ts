import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { redactText, runChecks, sanitizeText } from "../src/checks.js";

function shellFor(command: string) {
  return { executable: process.execPath, args: ["-e", command] };
}

test("records passed, failed, and not-run commands in sequence", async () => {
  const cwd = mkdtempSync(path.join(os.tmpdir(), "proofpack-checks-"));
  const markerPath = path.join(cwd, "marker.txt");
  const script = `const fs = require("node:fs"); const marker = ${JSON.stringify(markerPath)}; let count = 0; try { count = Number(fs.readFileSync(marker, "utf8")); } catch {} fs.writeFileSync(marker, String(count + 1));`;
  const result = await runChecks([script, `${script} process.exit(2);`, script], {
    cwd,
    timeoutMs: 5000,
    now: () => new Date("2026-11-07T12:00:00.000Z"),
    shell: shellFor,
  });

  assert.equal(result.interrupted, false);
  assert.deepEqual(result.results.map((check) => check.status), ["passed", "failed", "passed"]);
  assert.equal(readFileSync(markerPath, "utf8"), "3");
  assert.equal(result.results[1]?.exitCode, 2);
  assert.equal(result.results[0]?.startedAt, "2026-11-07T12:00:00.000Z");
});

test("caps output, redacts secrets, and removes control sequences", async () => {
  const cwd = mkdtempSync(path.join(os.tmpdir(), "proofpack-output-cap-"));
  const command = "process.stdout.write('A'.repeat(20)); console.log('token=abcdefgh12345678'); process.stdout.write('\\u001b[31mRED\\u001b[0m')";
  const result = await runChecks([command], {
    cwd,
    timeoutMs: 5000,
    outputLimitBytes: 12,
    shell: shellFor,
  });
  const check = result.results[0];
  assert.equal(check?.status, "passed");
  assert.equal(check?.truncated, true);
  assert.equal(check?.stdout, "A".repeat(12));
  assert.ok((check?.stdoutBytes ?? 0) > 12);

  const redacted = await runChecks(["console.log('token=abcdefgh12345678')"], {
    cwd,
    timeoutMs: 5000,
    shell: shellFor,
  });
  assert.match(redacted.results[0]?.stdout ?? "", /\[REDACTED\]/);
  assert.equal(redacted.results[0]?.redacted, true);
  assert.equal(sanitizeText("x\u001b[31my\u001b[0m\u0000"), "xy\uFFFD");
});

test("times out a long-running process tree and marks subsequent commands not run", async () => {
  const cwd = mkdtempSync(path.join(os.tmpdir(), "proofpack-timeout-"));
  const command = "setInterval(() => {}, 1000)";
  const result = await runChecks([command, "console.log('later')"], {
    cwd,
    timeoutMs: 50,
    shell: shellFor,
  });
  assert.equal(result.interrupted, false);
  assert.equal(result.stoppedEarly, true);
  assert.equal(result.results[0]?.status, "timeout");
  assert.equal(result.results[1]?.status, "not-run");
  assert.match(result.results[0]?.error ?? "", /timeout/);
});

test("marks a failed spawn as a runner error", async () => {
  const cwd = mkdtempSync(path.join(os.tmpdir(), "proofpack-spawn-error-"));
  const result = await runChecks(["ignored"], {
    cwd,
    timeoutMs: 5000,
    shell: () => ({ executable: path.join(cwd, "missing-shell"), args: [] }),
  });
  assert.equal(result.results[0]?.status, "start-error");
  assert.equal(result.results[0]?.exitCode, null);
  assert.match(result.results[0]?.error ?? "", /Could not start/);
});

test("redacts common secret formats and home paths", () => {
  const result = redactText(
    "token=abcdefgh12345678 Bearer abcdefghijklmnop ghp_abcdefghijklmnopqrstuvwxyz1234567890 https://user:pass@example.com /Users/test/file",
    "/Users/test",
  );
  assert.equal(result.text.includes("abcdefgh12345678"), false);
  assert.equal(result.text.includes("ghp_abcdefghijklmnopqrstuvwxyz1234567890"), false);
  assert.match(result.text, /https:\/\/\[REDACTED\]@/);
  assert.match(result.text, /\[HOME\]\/file/);
  assert.ok(result.count >= 5);
});

test("honors an already-aborted signal", async () => {
  const cwd = mkdtempSync(path.join(os.tmpdir(), "proofpack-abort-"));
  const abortController = new AbortController();
  abortController.abort();
  const result = await runChecks(["console.log('never')"], {
    cwd,
    timeoutMs: 5000,
    abortSignal: abortController.signal,
    shell: shellFor,
  });
  assert.equal(result.results[0]?.status, "not-run");
  assert.equal(result.interrupted, true);
});
