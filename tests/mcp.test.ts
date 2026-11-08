import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const mcpEntrypoint = path.join(projectRoot, "src", "mcp.ts");
const tsxLoader = path.join(projectRoot, "node_modules", "tsx", "dist", "loader.mjs");
const MODERN_VERSION = "2026-07-28";

function runMcp(lines: readonly unknown[], cwd: string) {
  const input = lines.map((line) => JSON.stringify(line)).join("\n") + "\n";
  const result = spawnSync(process.execPath, ["--import", tsxLoader, mcpEntrypoint], {
    cwd,
    input,
    encoding: "utf8",
    env: process.env,
  });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr, "");
  return result.stdout.trim().split("\n").filter((line) => line.length > 0).map((line) => JSON.parse(line) as unknown);
}

function modernMeta(): Record<string, unknown> {
  return {
    "io.modelcontextprotocol/protocolVersion": MODERN_VERSION,
    "io.modelcontextprotocol/clientInfo": { name: "proofpack-test", version: "1.0.0" },
    "io.modelcontextprotocol/clientCapabilities": {},
  };
}

function request(id: number, method: string, params: Record<string, unknown> = {}): Record<string, unknown> {
  return { jsonrpc: "2.0", id, method, params };
}

function makeRepository(): string {
  const directory = mkdtempSync(path.join(os.tmpdir(), "proofpack-mcp-test-"));
  const git = (...args: string[]): void => {
    const result = spawnSync("git", args, { cwd: directory, encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
  };
  git("init", "-q", "-b", "main");
  git("config", "user.name", "Proofpack Test");
  git("config", "user.email", "proofpack@example.invalid");
  writeFileSync(path.join(directory, "tracked.txt"), "one\n");
  git("add", ".");
  git("commit", "-qm", "initial");
  git("tag", "v0.1");
  writeFileSync(path.join(directory, "tracked.txt"), "one\ntwo\n");
  return directory;
}

test("modern discovery, tool listing, and read-only report call work", () => {
  const directory = makeRepository();
  const responses = runMcp([
    request(1, "server/discover", { _meta: modernMeta() }),
    request(2, "tools/list", { _meta: modernMeta() }),
    request(3, "tools/call", {
      _meta: modernMeta(),
      name: "proofpack_check",
      arguments: { cwd: directory, format: "json", base: "v0.1" },
    }),
  ], directory) as Array<Record<string, any>>;

  assert.equal(responses[0]?.result?.resultType, "complete");
  assert.deepEqual(responses[0]?.result?.supportedVersions, [MODERN_VERSION]);
  assert.equal(responses[0]?.result?._meta?.["io.modelcontextprotocol/serverInfo"]?.name, "proofpack-mcp");
  assert.equal(responses[0]?.result?._meta?.["io.modelcontextprotocol/serverInfo"]?.version, "0.3.0");
  assert.equal(responses[0]?.result?.ttlMs, 3600000);
  assert.equal(responses[0]?.result?.cacheScope, "public");
  assert.equal(responses[1]?.result?.resultType, "complete");
  assert.equal(responses[1]?.result?.ttlMs, 3600000);
  assert.equal(responses[1]?.result?.tools?.[0]?.name, "proofpack_check");
  assert.equal(responses[1]?.result?.tools?.[0]?.annotations?.readOnlyHint, true);
  const reportText = responses[2]?.result?.content?.[0]?.text as string;
  const document = JSON.parse(reportText) as { schemaVersion: string; repository: { base: { ref: string } | null }; checks: { results: unknown[] } };
  assert.equal(document.schemaVersion, "0.3");
  assert.equal(document.repository.base?.ref, "v0.1");
  assert.equal(document.checks.results.length, 0);
  assert.equal(responses[2]?.result?.resultType, "complete");
  assert.equal(responses[2]?.result?.isError, undefined);
});

test("legacy initialization, tool listing, share-safe call, and ping work", () => {
  const directory = makeRepository();
  const responses = runMcp([
    request(1, "initialize", {
      protocolVersion: "2025-11-25",
      capabilities: {},
      clientInfo: { name: "proofpack-test", version: "1.0.0" },
    }),
    { jsonrpc: "2.0", method: "notifications/initialized" },
    request(2, "tools/list"),
    request(3, "tools/call", { name: "proofpack_check", arguments: { cwd: directory, shareSafe: true } }),
    request(4, "ping"),
    request(5, "tools/list", { _meta: modernMeta() }),
  ], directory) as Array<Record<string, any>>;

  assert.equal(responses[0]?.result?.protocolVersion, "2025-11-25");
  assert.equal(responses[0]?.result?.serverInfo?.name, "proofpack-mcp");
  assert.equal(responses[1]?.result?.tools?.[0]?.name, "proofpack_check");
  assert.equal(responses[1]?.result?.resultType, undefined);
  const reportText = responses[2]?.result?.content?.[0]?.text as string;
  assert.match(reportText, /Share-safe: yes/);
  assert.equal(reportText.includes("tracked.txt"), false);
  assert.equal(responses[2]?.result?.resultType, undefined);
  assert.deepEqual(responses[3]?.result, {});
  assert.equal(responses[4]?.error?.code, -32600);
  assert.match(responses[4]?.error?.message, /legacy MCP connection/);
});

test("unsupported modern versions and invalid tool arguments return protocol errors", () => {
  const directory = makeRepository();
  const responses = runMcp([
    request(1, "server/discover", {
      _meta: {
        ...modernMeta(),
        "io.modelcontextprotocol/protocolVersion": "1900-01-01",
      },
    }),
    request(2, "tools/call", {
      _meta: modernMeta(),
      name: "proofpack_check",
      arguments: { format: "yaml" },
    }),
  ], directory) as Array<Record<string, any>>;

  assert.equal(responses[0]?.error?.code, -32022);
  assert.deepEqual(responses[0]?.error?.data?.supported, [MODERN_VERSION]);
  assert.equal(responses[1]?.error?.code, -32602);
});

test("MCP errors are tool results, not process failures", () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), "proofpack-mcp-non-git-"));
  const responses = runMcp([
    request(1, "tools/call", {
      _meta: modernMeta(),
      name: "proofpack_check",
      arguments: { cwd: directory },
    }),
  ], directory) as Array<Record<string, any>>;

  assert.equal(responses[0]?.result?.isError, true);
  assert.equal(responses[0]?.result?.structuredContent?.error, "git-inspection");
  assert.match(responses[0]?.result?.content?.[0]?.text, /could not generate a report/);
});

test("malformed protocol messages return parse or invalid-request errors", () => {
  const directory = makeRepository();
  const result = spawnSync(process.execPath, ["--import", tsxLoader, mcpEntrypoint], {
    cwd: directory,
    input: "not json\n[1,2]\n",
    encoding: "utf8",
    env: process.env,
  });
  assert.equal(result.status, 0);
  const responses = result.stdout.trim().split("\n").map((line) => JSON.parse(line)) as Array<Record<string, any>>;
  assert.equal(responses[0]?.error?.code, -32700);
  assert.equal(responses[1]?.error?.code, -32600);
});
