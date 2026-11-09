import assert from "node:assert/strict";
import test from "node:test";
import { ArgumentError, DEFAULT_TIMEOUT_SECONDS, parseArguments } from "../src/args.js";

test("parses check defaults", () => {
  assert.deepEqual(parseArguments(["check"]), {
    kind: "check",
    commands: [],
    formats: ["markdown"],
    outputPath: undefined,
    timeoutSeconds: DEFAULT_TIMEOUT_SECONDS,
    outputLimitBytes: 32768,
    base: undefined,
    shareSafe: false,
    open: false,
    language: "en",
  });
});

test("parses repeatable commands, formats, output, and timeout", () => {
  assert.deepEqual(
    parseArguments([
      "check",
      "--run",
      "npm test",
      "--run=npm run lint",
      "--format",
      "json,markdown",
      "--output",
      "review.md",
      "--timeout",
      "15",
      "--output-limit-bytes",
      "64",
      "--base",
      "main",
      "--share-safe",
    ]),
    {
      kind: "check",
      commands: ["npm test", "npm run lint"],
      formats: ["markdown", "json"],
      outputPath: "review.md",
      timeoutSeconds: 15,
      outputLimitBytes: 64,
      base: "main",
      shareSafe: true,
      open: false,
      language: "en",
    },
  );
});

test("parses Chinese language option and environment default", () => {
  const parsed = parseArguments(["check", "--lang=zh-CN"]);
  assert.equal(parsed.kind, "check");
  if (parsed.kind === "check") assert.equal(parsed.language, "zh-CN");

  const environmentParsed = parseArguments(["check"]);
  assert.equal(environmentParsed.kind, "check");
  if (environmentParsed.kind === "check") assert.equal(environmentParsed.language, "en");

  const originalLanguage = process.env.PROOFPACK_LANG;
  try {
    process.env.PROOFPACK_LANG = "zh-Hans";
    const environmentChinese = parseArguments(["check"]);
    assert.equal(environmentChinese.kind, "check");
    if (environmentChinese.kind === "check") assert.equal(environmentChinese.language, "zh-CN");
  } finally {
    if (originalLanguage === undefined) delete process.env.PROOFPACK_LANG;
    else process.env.PROOFPACK_LANG = originalLanguage;
  }
});

test("parses --open with an output path", () => {
  const parsed = parseArguments(["check", "--output", "review.md", "--open"]);
  assert.equal(parsed.kind, "check");
  if (parsed.kind === "check") assert.equal(parsed.open, true);
});

test("accepts option values with equals and command-position help", () => {
  const parsed = parseArguments([
    "check",
    "--run=--version",
    "--format=json",
    "--output=.proofpack/report.json",
    "--timeout=1",
  ]);
  assert.equal(parsed.kind, "check");
  if (parsed.kind === "check") {
    assert.deepEqual(parsed.commands, ["--version"]);
    assert.deepEqual(parsed.formats, ["json"]);
  }
  assert.equal(parseArguments(["--help"]).kind, "help");
  assert.equal(parseArguments(["--version"]).kind, "version");
});

test("rejects invalid arguments and ambiguous output/format combinations", () => {
  assert.throws(() => parseArguments([]), ArgumentError);
  assert.throws(() => parseArguments(["review"]), ArgumentError);
  assert.throws(() => parseArguments(["check", "--compare", "main"]), ArgumentError);
  assert.throws(() => parseArguments(["check", "--run"]), ArgumentError);
  assert.throws(() => parseArguments(["check", "--run", "--version"]), ArgumentError);
  assert.throws(() => parseArguments(["check", "--format", "yaml"]), ArgumentError);
  assert.throws(() => parseArguments(["check", "--format", "json,json"]), ArgumentError);
  assert.throws(() => parseArguments(["check", "--format", "markdown,json"]), ArgumentError);
  assert.throws(
    () => parseArguments(["check", "--format", "markdown,json", "--output", "report.txt"]),
    ArgumentError,
  );
  assert.throws(() => parseArguments(["check", "--timeout", "0"]), ArgumentError);
  assert.throws(() => parseArguments(["check", "--timeout", "3601"]), ArgumentError);
  assert.throws(() => parseArguments(["check", "--output-limit-bytes", "0"]), ArgumentError);
  assert.throws(() => parseArguments(["check", "--base", "v1^{commit}"]), ArgumentError);
  assert.throws(() => parseArguments(["check", "--open"]), ArgumentError);
  assert.throws(() => parseArguments(["check", "--lang", "fr"]), ArgumentError);
  assert.throws(() => parseArguments(["check", "--format=json", "--output=a.json", "--open"]), ArgumentError);
  assert.throws(
    () => parseArguments(["check", "--output", "a.md", "--output", "b.md"]),
    ArgumentError,
  );
});
