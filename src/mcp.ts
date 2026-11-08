#!/usr/bin/env node

import readline from "node:readline";
import { PROOFPACK_VERSION } from "./version.js";
import { ReportGenerationError, generateReport } from "./report-core.js";

const SERVER_NAME = "proofpack-mcp";
const MODERN_PROTOCOL_VERSION = "2026-07-28";
const LEGACY_PROTOCOL_VERSIONS = [
  "2025-11-25",
  "2025-06-18",
  "2025-03-26",
  "2024-11-05",
  "2024-10-07",
];
const PROTOCOL_VERSION_META_KEY = "io.modelcontextprotocol/protocolVersion";
const CLIENT_INFO_META_KEY = "io.modelcontextprotocol/clientInfo";
const CLIENT_CAPABILITIES_META_KEY = "io.modelcontextprotocol/clientCapabilities";
const SERVER_INFO_META_KEY = "io.modelcontextprotocol/serverInfo";
const MAX_LINE_BYTES = 1024 * 1024;

const SERVER_INFO = { name: SERVER_NAME, version: PROOFPACK_VERSION };
const SERVER_CAPABILITIES = { tools: {} };
const INSTRUCTIONS = "Generate a local, read-only Proofpack acceptance report for the current Git repository. The tool never runs project commands or writes files.";

const TOOL = {
  name: "proofpack_check",
  title: "Proofpack acceptance report",
  description: "Inspect the current Git repository read-only and return a Markdown or JSON acceptance report with change facts, review prompts, unrun checks, and limitations.",
  inputSchema: {
    type: "object",
    properties: {
      cwd: {
        type: "string",
        description: "Optional starting directory for Git discovery. Defaults to the MCP server process working directory.",
      },
      base: {
        type: "string",
        description: "Optional Git ref to compare committed, staged, and working-tree changes against. Untracked files are excluded in this view.",
      },
      format: {
        type: "string",
        enum: ["markdown", "json"],
        description: "Report format. Defaults to markdown.",
      },
      shareSafe: {
        type: "boolean",
        description: "Omit branch, HEAD, paths, base commit, and other identifying evidence on a best-effort basis.",
      },
    },
    additionalProperties: false,
  },
  annotations: {
    title: "Proofpack acceptance report",
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
  },
};

type JsonRecord = Record<string, unknown>;
type RequestId = string | number | null;
type ProtocolEra = "legacy" | "modern";

interface JsonRpcMessage extends JsonRecord {
  jsonrpc: string;
  id?: RequestId;
  method?: string;
  params?: JsonRecord;
  result?: unknown;
  error?: unknown;
}

interface RequestContext {
  era: ProtocolEra;
  message: JsonRpcMessage;
}

class McpProtocolError extends Error {
  readonly code: number;
  readonly data?: unknown;

  constructor(code: number, message: string, data?: unknown) {
    super(message);
    this.code = code;
    if (data !== undefined) this.data = data;
  }
}

class InvalidRequestError extends McpProtocolError {
  constructor(message = "Invalid Request") {
    super(-32600, message);
  }
}

class InvalidParamsError extends McpProtocolError {
  constructor(message: string, data?: unknown) {
    super(-32602, message, data);
  }
}

class MethodNotFoundError extends McpProtocolError {
  constructor(message = "Method not found") {
    super(-32601, message);
  }
}

class UnsupportedProtocolVersionError extends McpProtocolError {
  constructor(supported: readonly string[], requested: string) {
    super(-32022, "Unsupported protocol version", { supported: [...supported], requested });
  }
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseMessage(line: string): JsonRpcMessage {
  let parsed: unknown;
  try {
    parsed = JSON.parse(line);
  } catch {
    throw new McpProtocolError(-32700, "Parse error");
  }
  if (Array.isArray(parsed)) throw new InvalidRequestError("JSON-RPC batches are not supported.");
  if (!isRecord(parsed) || parsed.jsonrpc !== "2.0") throw new InvalidRequestError();
  if ("result" in parsed || "error" in parsed) {
    throw new InvalidRequestError("JSON-RPC responses are not accepted from clients.");
  }
  if (typeof parsed.method !== "string") throw new InvalidRequestError();
  if ("id" in parsed && parsed.id !== null && typeof parsed.id !== "string" && typeof parsed.id !== "number") {
    throw new InvalidRequestError();
  }
  if ("params" in parsed && !isRecord(parsed.params)) throw new InvalidParamsError("`params` must be an object.");
  return parsed as JsonRpcMessage;
}

function isRequest(message: JsonRpcMessage): boolean {
  return "id" in message;
}

function requestMeta(message: JsonRpcMessage): JsonRecord | undefined {
  const params = message.params;
  if (params === undefined || !isRecord(params._meta)) return undefined;
  return params._meta;
}

function envelopeVersion(message: JsonRpcMessage): string | undefined {
  const value = requestMeta(message)?.[PROTOCOL_VERSION_META_KEY];
  return typeof value === "string" ? value : undefined;
}

function hasEnvelopeClaim(message: JsonRpcMessage): boolean {
  const meta = requestMeta(message);
  return meta !== undefined && PROTOCOL_VERSION_META_KEY in meta;
}

function validateModernEnvelope(message: JsonRpcMessage): void {
  const meta = requestMeta(message);
  const version = envelopeVersion(message);
  if (meta === undefined || version === undefined) {
    throw new InvalidParamsError("Missing modern `_meta` protocol version.", {
      envelope: { key: PROTOCOL_VERSION_META_KEY, problem: "expected a protocol version string" },
    });
  }
  const capabilities = meta[CLIENT_CAPABILITIES_META_KEY];
  if (!isRecord(capabilities)) {
    throw new InvalidParamsError("Missing modern `_meta` client capabilities.", {
      envelope: { key: CLIENT_CAPABILITIES_META_KEY, problem: "missing" },
    });
  }
  const clientInfo = meta[CLIENT_INFO_META_KEY];
  if (clientInfo !== undefined && !isRecord(clientInfo)) {
    throw new InvalidParamsError("Invalid modern `_meta` client info.", {
      envelope: { key: CLIENT_INFO_META_KEY, problem: "expected an object" },
    });
  }
}

function classifyEra(message: JsonRpcMessage): ProtocolEra | "unsupported-revision" | "invalid-envelope" {
  if (message.method === "initialize" && !hasEnvelopeClaim(message)) return "legacy";
  if (!hasEnvelopeClaim(message)) return "legacy";
  try {
    validateModernEnvelope(message);
  } catch {
    return "invalid-envelope";
  }
  const version = envelopeVersion(message);
  if (version !== MODERN_PROTOCOL_VERSION) return "unsupported-revision";
  return "modern";
}

function assertModernRequest(message: JsonRpcMessage): void {
  const meta = requestMeta(message);
  if (meta === undefined) {
    throw new InvalidParamsError("Modern requests require a `_meta` envelope.", {
      envelope: { missing: ["_meta", PROTOCOL_VERSION_META_KEY, CLIENT_CAPABILITIES_META_KEY] },
    });
  }
  validateModernEnvelope(message);
  const version = envelopeVersion(message);
  if (version !== MODERN_PROTOCOL_VERSION) {
    throw new UnsupportedProtocolVersionError([MODERN_PROTOCOL_VERSION], version ?? "unknown");
  }
}

function resultMeta(): JsonRecord {
  return { _meta: { [SERVER_INFO_META_KEY]: SERVER_INFO } };
}

function completeResult(result: JsonRecord): JsonRecord {
  return { resultType: "complete", ...result, ...resultMeta() };
}

function toolListResult(): JsonRecord {
  return { tools: [TOOL], ...resultMeta() };
}

function modernToolListResult(): JsonRecord {
  return {
    resultType: "complete",
    ...toolListResult(),
    ttlMs: 3600000,
    cacheScope: "public",
  };
}

function parseToolArguments(message: JsonRpcMessage): {
  cwd?: string;
  base?: string;
  format: "markdown" | "json";
  shareSafe: boolean;
} {
  const params = message.params;
  if (params === undefined || typeof params.name !== "string") {
    throw new InvalidParamsError("`tools/call` requires a tool name.");
  }
  if (params.name !== TOOL.name) {
    throw new InvalidParamsError(`Unknown tool: ${params.name}`);
  }
  const argumentsValue = params.arguments ?? {};
  if (!isRecord(argumentsValue)) {
    throw new InvalidParamsError("`tools/call` arguments must be an object.");
  }
  const allowedKeys = new Set(["cwd", "base", "format", "shareSafe"]);
  for (const key of Object.keys(argumentsValue)) {
    if (!allowedKeys.has(key)) throw new InvalidParamsError(`Unknown tool argument: ${key}.`);
  }
  const cwd = argumentsValue.cwd;
  const base = argumentsValue.base;
  const format = argumentsValue.format ?? "markdown";
  const shareSafe = argumentsValue.shareSafe ?? false;
  if (cwd !== undefined && (typeof cwd !== "string" || cwd.length === 0 || cwd.includes("\0"))) {
    throw new InvalidParamsError("`cwd` must be a non-empty path string.");
  }
  if (base !== undefined && (typeof base !== "string" || base.length === 0 || base.length > 8192 || base.includes("\0") || base.includes("^{"))) {
    throw new InvalidParamsError("`base` must be a plain Git ref without `^{...}`.");
  }
  if (format !== "markdown" && format !== "json") {
    throw new InvalidParamsError("`format` must be markdown or json.");
  }
  if (typeof shareSafe !== "boolean") {
    throw new InvalidParamsError("`shareSafe` must be a boolean.");
  }
  return {
    ...(cwd === undefined ? {} : { cwd }),
    ...(base === undefined ? {} : { base }),
    format,
    shareSafe,
  };
}

function callTool(message: JsonRpcMessage): JsonRecord {
  const args = parseToolArguments(message);
  try {
    const generated = generateReport({
      ...(args.cwd === undefined ? {} : { cwd: args.cwd }),
      ...(args.base === undefined ? {} : { base: args.base }),
      shareSafe: args.shareSafe,
      formats: [args.format],
      outputLabel: "mcp tool result",
    });
    const text = args.format === "json" ? generated.report.json : generated.report.markdown;
    const toolResult: JsonRecord = {
      content: [{ type: "text", text }],
      structuredContent: {
        schemaVersion: generated.report.document.schemaVersion,
        format: args.format,
        shareSafe: args.shareSafe,
        summary: generated.report.summary,
      },
    };
    return eraFor(message) === "modern" ? completeResult(toolResult) : toolResult;
  } catch (error) {
    if (error instanceof ReportGenerationError) {
      const toolResult: JsonRecord = {
        content: [{ type: "text", text: `Proofpack could not generate a report: ${error.message}` }],
        structuredContent: { error: error.reason },
        isError: true,
      };
      return eraFor(message) === "modern" ? completeResult(toolResult) : toolResult;
    }
    throw error;
  }
}

function initializeResult(message: JsonRpcMessage): JsonRecord {
  const requested = message.params?.protocolVersion;
  const protocolVersion = typeof requested === "string" && LEGACY_PROTOCOL_VERSIONS.includes(requested)
    ? requested
    : LEGACY_PROTOCOL_VERSIONS[0] ?? "2025-11-25";
  return {
    protocolVersion,
    capabilities: SERVER_CAPABILITIES,
    serverInfo: SERVER_INFO,
    instructions: INSTRUCTIONS,
  };
}

function discoverResult(): JsonRecord {
  return {
    resultType: "complete",
    supportedVersions: [MODERN_PROTOCOL_VERSION],
    capabilities: SERVER_CAPABILITIES,
    instructions: INSTRUCTIONS,
    ttlMs: 3600000,
    cacheScope: "public",
    ...resultMeta(),
  };
}

function eraFor(message: JsonRpcMessage): ProtocolEra {
  return hasEnvelopeClaim(message) ? "modern" : "legacy";
}

function dispatch(context: RequestContext): JsonRecord {
  const { message, era } = context;
  if (era === "modern") assertModernRequest(message);
  if (era === "legacy" && hasEnvelopeClaim(message)) {
    throw new InvalidRequestError("Modern `_meta` requests are not valid on a legacy MCP connection.");
  }

  switch (message.method) {
    case "initialize":
      if (era === "modern") throw new MethodNotFoundError("`initialize` is not available in the modern MCP era.");
      return initializeResult(message);
    case "server/discover":
      if (era !== "modern") throw new MethodNotFoundError();
      return discoverResult();
    case "tools/list":
      return era === "modern" ? modernToolListResult() : { tools: [TOOL] };
    case "tools/call":
      return callTool(message);
    case "ping":
      if (era !== "legacy") throw new MethodNotFoundError();
      return {};
    default:
      throw new MethodNotFoundError();
  }
}

function successResponse(id: RequestId, result: JsonRecord): JsonRecord {
  return { jsonrpc: "2.0", id, result };
}

function errorResponse(id: RequestId, code: number, message: string, data?: unknown): JsonRecord {
  const error: JsonRecord = { code, message };
  if (data !== undefined) error.data = data;
  return { jsonrpc: "2.0", id, error };
}

function sanitizeErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(/[\u0000-\u001f\u007f]+/g, " ").trim().slice(0, 500);
}

export function handleMessage(line: string, pinnedEra?: ProtocolEra): {
  response: JsonRecord | undefined;
  era: ProtocolEra | undefined;
} {
  let message: JsonRpcMessage;
  try {
    message = parseMessage(line);
  } catch (error) {
    if (error instanceof McpProtocolError) {
      return { response: errorResponse(null, error.code, error.message, error.data), era: pinnedEra };
    }
    return { response: errorResponse(null, -32603, "Internal error"), era: pinnedEra };
  }

  if (!isRequest(message)) return { response: undefined, era: pinnedEra };

  try {
    let era = pinnedEra;
    if (era === undefined) {
      const classification = classifyEra(message);
      if (classification === "invalid-envelope") {
        validateModernEnvelope(message);
        throw new McpProtocolError(-32600, "Invalid modern envelope.");
      }
      if (classification === "unsupported-revision") {
        const requested = envelopeVersion(message) ?? "unknown";
        throw new UnsupportedProtocolVersionError([MODERN_PROTOCOL_VERSION], requested);
      }
      era = classification;
    }
    const result = dispatch({ era, message });
    return { response: successResponse(message.id ?? null, result), era };
  } catch (error) {
    if (error instanceof McpProtocolError) {
      return {
        response: errorResponse(message.id ?? null, error.code, error.message, error.data),
        era: pinnedEra,
      };
    }
    return {
      response: errorResponse(message.id ?? null, -32603, sanitizeErrorMessage(error)),
      era: pinnedEra,
    };
  }
}

export function startMcpServer(): void {
  let pinnedEra: ProtocolEra | undefined;
  let closed = false;

  const write = (response: JsonRecord): void => {
    if (!closed) process.stdout.write(`${JSON.stringify(response)}\n`);
  };
  const failLine = (error: unknown): void => {
    if (error instanceof McpProtocolError) write(errorResponse(null, error.code, error.message, error.data));
    else write(errorResponse(null, -32603, sanitizeErrorMessage(error)));
  };

  const input = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
  input.on("line", (line) => {
    if (Buffer.byteLength(line, "utf8") > MAX_LINE_BYTES) {
      write(errorResponse(null, -32600, "Request line exceeds 1 MiB."));
      return;
    }
    try {
      const outcome = handleMessage(line, pinnedEra);
      if (outcome.era !== undefined) pinnedEra = outcome.era;
      if (outcome.response !== undefined) write(outcome.response);
    } catch (error) {
      failLine(error);
    }
  });
  input.on("close", () => {
    closed = true;
    process.exitCode = 0;
  });
}

startMcpServer();
