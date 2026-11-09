import path from "node:path";
import { parseReportLanguage, REPORT_LANGUAGES, resolveEnvironmentLanguage, type ReportLanguage } from "./locale.js";

export type ReportFormat = "markdown" | "json";

export type CliArguments =
  | { kind: "help" }
  | { kind: "version" }
  | {
      kind: "check";
      commands: string[];
      formats: ReportFormat[];
      outputPath: string | undefined;
      timeoutSeconds: number;
      outputLimitBytes: number;
      base: string | undefined;
      shareSafe: boolean;
      open: boolean;
      language: ReportLanguage;
    };

export class ArgumentError extends Error {}

export const DEFAULT_TIMEOUT_SECONDS = 120;
const DEFAULT_OUTPUT_LIMIT_BYTES = 32 * 1024;
const MAX_TIMEOUT_SECONDS = 3600;
const MAX_OPTION_VALUE_LENGTH = 8192;
const VALID_FORMATS = new Set<ReportFormat>(["markdown", "json"]);

export const HELP_TEXT = `Proofpack — local acceptance report for Git changes

Usage:
  proofpack check [--run <command> ...] [--base <ref>] [--format <formats>] [--output <path>] [--share-safe] [--open] [--timeout <seconds>] [--output-limit-bytes <count>] [--lang <language>]
  proofpack --help
  proofpack --version

Options:
  --run <command>     Run this shell command from the repository root. Repeatable.
                      Use --run=<command> when the command starts with "--".
  --format <formats>  markdown, json, or markdown,json. Default markdown.
                      Multiple formats require --output.
  --output <path>     Write the report instead of stdout. Multiple formats write
                      .md and .json siblings; paths are relative to the repository root.
  --base <ref>        Compare committed, staged, and worktree changes against a Git ref.
                      Default: HEAD only, plus untracked file paths.
  --share-safe        Omit command text, command output, branch, HEAD, and absolute paths.
  --open              Open a written Markdown report after generation; requires
                      --output and a Markdown format.
  --timeout <seconds> Per-command timeout from 1 to 3600 seconds. Default 120.
  --output-limit-bytes <count>  Per-stream stdout/stderr cap, 1 to 1048576 bytes. Default 32768.
  --lang <language>   Display language: en (default) or zh-CN. PROOFPACK_LANG also works.
  --help              Show this help.
  --version           Show the version.

Default check is read-only. Explicit --run commands are previewed, redacted on a
best-effort basis, run sequentially with the user's shell and privileges, and are
not sandboxed. Proofpack never claims that a passing command makes code correct.
`;

interface OptionValue {
  value: string;
  nextIndex: number;
}

function readOptionValue(args: readonly string[], index: number, optionName: string): OptionValue {
  const token = args[index];
  if (token === undefined) {
    throw new ArgumentError(`Missing value for ${optionName}.`);
  }

  const equalsIndex = token.indexOf("=");
  if (equalsIndex >= 0) {
    const value = token.slice(equalsIndex + 1);
    if (value.length === 0) {
      throw new ArgumentError(`${optionName} requires a non-empty value.`);
    }
    if (value.length > MAX_OPTION_VALUE_LENGTH || value.includes("\0")) {
      throw new ArgumentError(`${optionName} has an invalid value.`);
    }
    return { value, nextIndex: index };
  }

  const value = args[index + 1];
  if (value === undefined || value.length === 0 || value.startsWith("--")) {
    throw new ArgumentError(`${optionName} requires a value; use ${optionName}=<value> for values starting with "--".`);
  }
  if (value.length > MAX_OPTION_VALUE_LENGTH || value.includes("\0")) {
    throw new ArgumentError(`${optionName} has an invalid value.`);
  }
  return { value, nextIndex: index + 1 };
}

function parseFormats(value: string): ReportFormat[] {
  const parts = value.split(",").map((part) => part.trim());
  if (parts.length === 0 || parts.some((part) => part.length === 0)) {
    throw new ArgumentError("`--format` requires markdown, json, or markdown,json.");
  }

  const parsedFormats: ReportFormat[] = [];
  for (const part of parts) {
    if (!VALID_FORMATS.has(part as ReportFormat)) {
      throw new ArgumentError(`Unknown report format: ${part}.`);
    }
    parsedFormats.push(part as ReportFormat);
  }

  const uniqueFormats = new Set(parsedFormats);
  if (uniqueFormats.size !== parsedFormats.length) {
    throw new ArgumentError("`--format` contains duplicate formats.");
  }
  if (uniqueFormats.size === 2) return ["markdown", "json"];
  return [...uniqueFormats];
}

function parseTimeout(value: string): number {
  if (!/^\d+$/.test(value)) {
    throw new ArgumentError("`--timeout` requires an integer number of seconds.");
  }
  const seconds = Number(value);
  if (seconds < 1 || seconds > MAX_TIMEOUT_SECONDS) {
    throw new ArgumentError(`\`--timeout\` must be between 1 and ${MAX_TIMEOUT_SECONDS} seconds.`);
  }
  return seconds;
}

export function parseArguments(args: readonly string[]): CliArguments {
  if (args.length === 0) {
    throw new ArgumentError("Missing command. Try `proofpack --help`.");
  }

  const firstArgument = args[0];
  if (firstArgument === "--help" || firstArgument === "-h") return { kind: "help" };
  if (firstArgument === "--version" || firstArgument === "-v") return { kind: "version" };
  if (firstArgument !== "check") {
    throw new ArgumentError(`Unknown command: ${String(firstArgument)}. Try \`proofpack --help\`.`);
  }

  const commands: string[] = [];
  let formats: ReportFormat[] = ["markdown"];
  let formatsProvided = false;
  let outputPath: string | undefined;
  let outputProvided = false;
  let timeoutSeconds = DEFAULT_TIMEOUT_SECONDS;
  let timeoutProvided = false;
  let outputLimitBytes = DEFAULT_OUTPUT_LIMIT_BYTES;
  let outputLimitProvided = false;
  let base: string | undefined;
  let baseProvided = false;
  let shareSafe = false;
  let shareSafeProvided = false;
  let open = false;
  let openProvided = false;
  let language = resolveEnvironmentLanguage();
  let languageProvided = false;

  for (let index = 1; index < args.length; index += 1) {
    const token = args[index];
    if (token === undefined) continue;
    if (token === "--help" || token === "-h") return { kind: "help" };
    if (token === "--version" || token === "-v") return { kind: "version" };

    if (token === "--run" || token.startsWith("--run=")) {
      const optionValue = readOptionValue(args, index, "--run");
      commands.push(optionValue.value);
      index = optionValue.nextIndex;
      continue;
    }

    if (token === "--format" || token.startsWith("--format=")) {
      if (formatsProvided) throw new ArgumentError("`--format` may be supplied only once.");
      const optionValue = readOptionValue(args, index, "--format");
      formats = parseFormats(optionValue.value);
      formatsProvided = true;
      index = optionValue.nextIndex;
      continue;
    }

    if (token === "--base" || token.startsWith("--base=")) {
      if (baseProvided) throw new ArgumentError("`--base` may be supplied only once.");
      const optionValue = readOptionValue(args, index, "--base");
      if (optionValue.value.includes("^{")) {
        throw new ArgumentError("`--base` may not contain revision suffix syntax `^{...}`.");
      }
      base = optionValue.value;
      baseProvided = true;
      index = optionValue.nextIndex;
      continue;
    }

    if (token === "--share-safe") {
      if (shareSafeProvided) throw new ArgumentError("`--share-safe` may be supplied only once.");
      shareSafe = true;
      shareSafeProvided = true;
      continue;
    }

    if (token === "--open") {
      if (openProvided) throw new ArgumentError("`--open` may be supplied only once.");
      open = true;
      openProvided = true;
      continue;
    }

    if (token === "--output" || token.startsWith("--output=")) {
      if (outputProvided) throw new ArgumentError("`--output` may be supplied only once.");
      const optionValue = readOptionValue(args, index, "--output");
      if (optionValue.value.endsWith("/") || optionValue.value.endsWith(path.sep)) {
        throw new ArgumentError("`--output` must name a file, not a directory.");
      }
      outputPath = optionValue.value;
      outputProvided = true;
      index = optionValue.nextIndex;
      continue;
    }

    if (token === "--timeout" || token.startsWith("--timeout=")) {
      if (timeoutProvided) throw new ArgumentError("`--timeout` may be supplied only once.");
      const optionValue = readOptionValue(args, index, "--timeout");
      timeoutSeconds = parseTimeout(optionValue.value);
      timeoutProvided = true;
      index = optionValue.nextIndex;
      continue;
    }

    if (token === "--output-limit-bytes" || token.startsWith("--output-limit-bytes=")) {
      if (outputLimitProvided) {
        throw new ArgumentError("`--output-limit-bytes` may be supplied only once.");
      }
      const optionValue = readOptionValue(args, index, "--output-limit-bytes");
      if (!/^\d+$/.test(optionValue.value)) {
        throw new ArgumentError("`--output-limit-bytes` requires an integer byte count.");
      }
      const parsedLimit = Number(optionValue.value);
      if (parsedLimit < 1 || parsedLimit > 1024 * 1024) {
        throw new ArgumentError("`--output-limit-bytes` must be between 1 and 1048576.");
      }
      outputLimitBytes = parsedLimit;
      outputLimitProvided = true;
      index = optionValue.nextIndex;
      continue;
    }

    if (token === "--lang" || token.startsWith("--lang=")) {
      if (languageProvided) throw new ArgumentError("`--lang` may be supplied only once.");
      const optionValue = readOptionValue(args, index, "--lang");
      const parsedLanguage = parseReportLanguage(optionValue.value);
      if (parsedLanguage === undefined) {
        throw new ArgumentError(`\`--lang\` must be one of: ${REPORT_LANGUAGES.join(", ")}.`);
      }
      language = parsedLanguage;
      languageProvided = true;
      index = optionValue.nextIndex;
      continue;
    }

    throw new ArgumentError(`Unknown option: ${token}. Try \`proofpack --help\`.`);
  }

  if (formats.length > 1 && outputPath === undefined) {
    throw new ArgumentError("Multiple report formats require `--output <path>`.");
  }
  if (formats.length > 1 && outputPath !== undefined) {
    const extension = path.extname(outputPath).toLowerCase();
    if (extension !== "" && extension !== ".md" && extension !== ".json") {
      throw new ArgumentError("Multiple report formats require an output path with .md, .json, or no extension.");
    }
  }
  if (open && (outputPath === undefined || !formats.includes("markdown"))) {
    throw new ArgumentError("`--open` requires `--output <path>` and a Markdown report.");
  }

  return {
    kind: "check",
    commands,
    formats,
    outputPath,
    timeoutSeconds,
    outputLimitBytes,
    base,
    shareSafe,
    open,
    language,
  };
}
