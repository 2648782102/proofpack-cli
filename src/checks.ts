import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { homedir } from "node:os";
import { StringDecoder } from "node:string_decoder";

export type CheckStatus =
  | "passed"
  | "failed"
  | "timeout"
  | "start-error"
  | "interrupted"
  | "not-run";

export interface CheckResult {
  id: string;
  command: string;
  status: CheckStatus;
  startedAt: string | null;
  endedAt: string | null;
  durationMs: number | null;
  exitCode: number | null;
  signal: string | null;
  stdout: string;
  stderr: string;
  stdoutBytes: number;
  stderrBytes: number;
  truncated: boolean;
  redacted: boolean;
  redactionCount: number;
  outputLimitBytes: number;
  error: string | null;
}

export interface CommandShell {
  executable: string;
  args: string[];
}

export type ShellResolver = (command: string) => CommandShell;

export interface RunChecksOptions {
  cwd: string;
  timeoutMs: number;
  outputLimitBytes?: number;
  now?: () => Date;
  preview?: (message: string) => void;
  abortSignal?: AbortSignal;
  shell?: ShellResolver;
}

export interface RunChecksResult {
  results: CheckResult[];
  interrupted: boolean;
  stoppedEarly: boolean;
}

export interface RedactionResult {
  text: string;
  count: number;
}

export const DEFAULT_OUTPUT_LIMIT_BYTES = 32 * 1024;

type ReplacementFunction = (match: string, ...captureGroups: string[]) => string;
type Replacement = string | ReplacementFunction;

interface ReplacementResult {
  text: string;
  count: number;
}

interface SecretReplacementDefinition {
  pattern: RegExp;
  replacement: Replacement;
}

interface StreamCapture {
  chunks: Buffer[];
  bytes: number;
  truncatedBytes: number;
  limitBytes: number;
}

interface CommandOutcome {
  result: CheckResult;
  abortRemaining: boolean;
}

const SECRET_REPLACEMENTS: SecretReplacementDefinition[] = [
  {
    pattern: /(api[_-]?key|secret|token|password|passwd|authorization|bearer|private[_-]?key)([\s:=]+)(["'`]?)([A-Za-z0-9._~+/\-=]{8,})/gi,
    replacement: (_match: string, keyName: string, separator: string, quote: string) =>
      `${keyName}${separator}${quote}[REDACTED]`,
  },
  { pattern: /\bBearer\s+[A-Za-z0-9._~+/\-=]+/gi, replacement: "Bearer [REDACTED]" },
  { pattern: /\bBasic\s+[A-Za-z0-9+/=]{8,}/gi, replacement: "Basic [REDACTED]" },
  { pattern: /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{20,}\b/g, replacement: "[REDACTED TOKEN]" },
  { pattern: /\bAKIA[0-9A-Z]{16}\b/g, replacement: "[REDACTED TOKEN]" },
  { pattern: /\bsk-[A-Za-z0-9]{16,}\b/g, replacement: "[REDACTED TOKEN]" },
  { pattern: /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, replacement: "[REDACTED JWT]" },
  {
    pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g,
    replacement: "[REDACTED PRIVATE KEY]",
  },
  {
    pattern: /\b([a-z][a-z0-9+.-]*):\/\/[^:\s/@]+:[^@\s/]+@/gi,
    replacement: (_match: string, scheme: string) => `${scheme}://[REDACTED]@`,
  },
];

export function sanitizeText(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\u001b\[[0-?]*[ -/]*[@-~]/g, "")
    .replace(/\u001b\][^\u0007]*(?:\u0007|\u001b\\)/g, "")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "\uFFFD");
}

export function sanitizeForTerminal(text: string): string {
  return sanitizeText(text).replace(/[\r\n\t]+/g, " ").slice(0, 500);
}

export function redactText(text: string, homeDirectory: string = homedir()): RedactionResult {
  let currentText = text;
  let totalCount = 0;

  const applyReplacement = (pattern: RegExp, replacement: Replacement): void => {
    const result = replaceMatches(currentText, new RegExp(pattern.source, pattern.flags), replacement);
    currentText = result.text;
    totalCount += result.count;
  };

  if (homeDirectory.length > 0) {
    applyReplacement(new RegExp(escapeRegExp(homeDirectory), "g"), "[HOME]");
    if (homeDirectory.startsWith("/")) {
      applyReplacement(new RegExp(escapeRegExp(`/private${homeDirectory}`), "g"), "[HOME]");
    }
  }
  for (const definition of SECRET_REPLACEMENTS) {
    applyReplacement(definition.pattern, definition.replacement);
  }

  return { text: currentText, count: totalCount };
}

function replaceMatches(text: string, pattern: RegExp, replacement: Replacement): ReplacementResult {
  let count = 0;
  const replaced = text.replace(pattern, (match: string, ...replaceArguments: unknown[]): string => {
    count += 1;
    if (typeof replacement === "function") {
      const captureGroups = replaceArguments.slice(0, -2).map((value) => String(value));
      return replacement(match, ...captureGroups);
    }
    return replacement;
  });
  return { text: replaced, count };
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function defaultShell(command: string): CommandShell {
  if (process.platform === "win32") {
    return {
      executable: process.env.ComSpec?.trim() || "cmd.exe",
      args: ["/d", "/s", "/c", command],
    };
  }
  return {
    executable: process.env.SHELL?.trim() || "/bin/sh",
    args: ["-c", command],
  };
}

function terminateProcessTree(child: ChildProcess, signal: NodeJS.Signals): void {
  if (child.pid === undefined) {
    child.kill(signal);
    return;
  }
  if (process.platform === "win32") {
    spawnSync("taskkill", ["/PID", String(child.pid), "/T", "/F"], { stdio: "ignore" });
    return;
  }
  try {
    process.kill(-child.pid, signal);
  } catch {
    child.kill(signal);
  }
}

function createStreamCapture(limitBytes: number): StreamCapture {
  return { chunks: [], bytes: 0, truncatedBytes: 0, limitBytes };
}

function appendStreamChunk(capture: StreamCapture, chunk: Buffer): void {
  if (capture.bytes >= capture.limitBytes) {
    capture.truncatedBytes += chunk.length;
    return;
  }
  const remaining = capture.limitBytes - capture.bytes;
  const accepted = chunk.subarray(0, remaining);
  capture.chunks.push(accepted);
  capture.bytes += accepted.length;
  capture.truncatedBytes += chunk.length - accepted.length;
}

function captureToString(capture: StreamCapture): string {
  const decoder = new StringDecoder("utf8");
  let text = "";
  for (const chunk of capture.chunks) {
    text += decoder.write(chunk);
  }
  return text + decoder.end();
}

function makeNotRunResult(command: string, index: number, outputLimitBytes: number): CheckResult {
  const redactedCommand = redactText(command);
  return {
    id: `check-${index + 1}`,
    command: redactedCommand.text,
    status: "not-run",
    startedAt: null,
    endedAt: null,
    durationMs: null,
    exitCode: null,
    signal: null,
    stdout: "",
    stderr: "",
    stdoutBytes: 0,
    stderrBytes: 0,
    truncated: false,
    redacted: redactedCommand.count > 0,
    redactionCount: redactedCommand.count,
    outputLimitBytes,
    error: null,
  };
}

async function runCommand(
  command: string,
  index: number,
  total: number,
  options: RunChecksOptions,
  outputLimitBytes: number,
): Promise<CommandOutcome> {
  const readNow = options.now ?? (() => new Date());
  const redactedCommand = redactText(command);
  options.preview?.(
    `Proofpack: running check ${index + 1}/${total}: ${sanitizeForTerminal(redactedCommand.text)}`,
  );

  if (options.abortSignal?.aborted === true) {
    return {
      result: makeNotRunResult(command, index, outputLimitBytes),
      abortRemaining: true,
    };
  }

  const startedAt = readNow();
  const shellResolver = options.shell ?? defaultShell;
  const shell = shellResolver(command);
  const child = spawn(shell.executable, shell.args, {
    cwd: options.cwd,
    env: process.env,
    stdio: ["ignore", "pipe", "pipe"],
    detached: process.platform !== "win32",
    windowsHide: true,
  });

  const stdoutCapture = createStreamCapture(outputLimitBytes);
  const stderrCapture = createStreamCapture(outputLimitBytes);
  child.stdout?.on("data", (chunk: Buffer) => appendStreamChunk(stdoutCapture, chunk));
  child.stderr?.on("data", (chunk: Buffer) => appendStreamChunk(stderrCapture, chunk));

  let spawnErrorMessage: string | null = null;
  let timedOut = false;
  let wasInterrupted = false;
  let childSettled = false;
  const timeoutMs = Math.max(1, options.timeoutMs);

  const timeoutTimer = setTimeout(() => {
    if (childSettled) return;
    timedOut = true;
    terminateProcessTree(child, "SIGTERM");
  }, timeoutMs);
  timeoutTimer.unref();

  const forceKillTimer = setTimeout(() => {
    if (childSettled) return;
    terminateProcessTree(child, "SIGKILL");
  }, timeoutMs + 2000);
  forceKillTimer.unref();

  const abortSignal = options.abortSignal;
  let abortListener: (() => void) | undefined;
  if (abortSignal !== undefined) {
    abortListener = () => {
      if (childSettled) return;
      wasInterrupted = true;
      terminateProcessTree(child, "SIGTERM");
    };
    abortSignal.addEventListener("abort", abortListener, { once: true });
  }

  const exitOutcome = await new Promise<{ exitCode: number | null; signal: NodeJS.Signals | null }>(
    (resolve) => {
      child.once("error", (error: Error) => {
        childSettled = true;
        spawnErrorMessage = error.message;
        resolve({ exitCode: null, signal: null });
      });
      child.once("close", (exitCode: number | null, signal: NodeJS.Signals | null) => {
        childSettled = true;
        resolve({ exitCode, signal });
      });
    },
  );

  clearTimeout(timeoutTimer);
  clearTimeout(forceKillTimer);
  if (abortSignal !== undefined && abortListener !== undefined) {
    abortSignal.removeEventListener("abort", abortListener);
  }

  const endedAt = readNow();
  const durationMs = Math.max(0, endedAt.getTime() - startedAt.getTime());
  const stdoutText = sanitizeText(captureToString(stdoutCapture));
  const stderrText = sanitizeText(captureToString(stderrCapture));
  const stdoutRedaction = redactText(stdoutText);
  const stderrRedaction = redactText(stderrText);

  let errorMessage: string | null = null;
  if (spawnErrorMessage !== null) {
    errorMessage = `Could not start command: ${spawnErrorMessage}`;
  } else if (timedOut) {
    errorMessage = `Command exceeded the ${timeoutMs} ms timeout.`;
  } else if (wasInterrupted) {
    errorMessage = "Command was interrupted.";
  }
  const errorRedaction = errorMessage === null ? { text: null, count: 0 } : redactText(errorMessage);

  const redactionCount =
    redactedCommand.count + stdoutRedaction.count + stderrRedaction.count + errorRedaction.count;
  let status: CheckStatus;
  if (spawnErrorMessage !== null) status = "start-error";
  else if (timedOut) status = "timeout";
  else if (wasInterrupted) status = "interrupted";
  else if (exitOutcome.exitCode === 0) status = "passed";
  else status = "failed";

  const observedSignal =
    exitOutcome.signal ?? (timedOut || wasInterrupted ? "SIGTERM" : null);
  const result: CheckResult = {
    id: `check-${index + 1}`,
    command: redactedCommand.text,
    status,
    startedAt: startedAt.toISOString(),
    endedAt: endedAt.toISOString(),
    durationMs,
    exitCode: exitOutcome.exitCode,
    signal: observedSignal,
    stdout: stdoutRedaction.text,
    stderr: stderrRedaction.text,
    stdoutBytes: stdoutCapture.bytes + stdoutCapture.truncatedBytes,
    stderrBytes: stderrCapture.bytes + stderrCapture.truncatedBytes,
    truncated: stdoutCapture.truncatedBytes > 0 || stderrCapture.truncatedBytes > 0,
    redacted: redactionCount > 0,
    redactionCount,
    outputLimitBytes,
    error: errorRedaction.text === null ? null : sanitizeText(errorRedaction.text),
  };

  return {
    result,
    abortRemaining: spawnErrorMessage !== null || timedOut || wasInterrupted,
  };
}

export async function runChecks(
  commands: readonly string[],
  options: RunChecksOptions,
): Promise<RunChecksResult> {
  const outputLimitBytes = Math.max(1, options.outputLimitBytes ?? DEFAULT_OUTPUT_LIMIT_BYTES);
  const results: CheckResult[] = [];
  let stopped = options.abortSignal?.aborted ?? false;

  for (let index = 0; index < commands.length; index += 1) {
    const command = commands[index];
    if (command === undefined) continue;
    if (stopped) {
      results.push(makeNotRunResult(command, index, outputLimitBytes));
      continue;
    }
    const outcome = await runCommand(command, index, commands.length, options, outputLimitBytes);
    results.push(outcome.result);
    if (outcome.abortRemaining) stopped = true;
  }

  const interrupted = options.abortSignal?.aborted === true;
  if (interrupted) stopped = true;
  return { results, interrupted, stoppedEarly: stopped };
}
