#!/usr/bin/env node

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { ArgumentError, HELP_TEXT, parseArguments } from "./args.js";
import { runChecks } from "./checks.js";
import { GitInspectionError, inspectGitChanges } from "./git.js";
import { OpenError, openReport } from "./open.js";
import { OutputError, resolveReportOutputFiles } from "./output.js";
import { buildReport } from "./report.js";
import { buildReviewPrompts } from "./rules.js";

const VERSION = "0.2.0";

interface ExitDecision {
  hadCheckFailure: boolean;
  hadRunnerFailure: boolean;
  interrupted: boolean;
}

function exitCodeFor(decision: ExitDecision): number {
  if (decision.interrupted) return 4;
  if (decision.hadRunnerFailure) return 4;
  if (decision.hadCheckFailure) return 1;
  return 0;
}

function describeError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(/[\u0000-\u001f\u007f]+/g, " ").trim().slice(0, 500);
}

async function main(): Promise<number> {
  const abortController = new AbortController();
  const onInterrupt = (signal: NodeJS.Signals): void => {
    if (!abortController.signal.aborted) {
      process.stderr.write(`\nProofpack: received ${signal}; stopping checks.\n`);
      abortController.abort(new Error(`Received ${signal}`));
    }
  };
  process.once("SIGINT", onInterrupt);
  process.once("SIGTERM", onInterrupt);

  try {
    const args = parseArguments(process.argv.slice(2));
    if (args.kind === "help") {
      process.stdout.write(HELP_TEXT);
      return 0;
    }
    if (args.kind === "version") {
      process.stdout.write(`proofpack ${VERSION}\n`);
      return 0;
    }

    const initialSnapshot = args.base === undefined
      ? inspectGitChanges()
      : inspectGitChanges({ base: args.base });
    const outputFiles = args.outputPath === undefined
      ? undefined
      : resolveReportOutputFiles(args.outputPath, args.formats, {
          repositoryRoot: initialSnapshot.repositoryRoot,
          cwd: initialSnapshot.repositoryRoot,
        });

    const checksResult = await runChecks(args.commands, {
      cwd: initialSnapshot.repositoryRoot,
      timeoutMs: args.timeoutSeconds * 1000,
      outputLimitBytes: args.outputLimitBytes,
      abortSignal: abortController.signal,
      preview: args.shareSafe
        ? (message) => process.stderr.write(message.replace(/check \d+\/\d+:.*$/, "check: [OMITTED]\n"))
        : (message) => process.stderr.write(`${message}\n`),
    });

    const reportSnapshot = args.commands.length === 0
      ? initialSnapshot
      : args.base === undefined
        ? inspectGitChanges()
        : inspectGitChanges({ base: args.base });
    const reviewPrompts = buildReviewPrompts(reportSnapshot.files);
    const report = buildReport(reportSnapshot, checksResult.results, reviewPrompts, {
      formats: args.formats,
      outputPath: args.outputPath,
      shareSafe: args.shareSafe,
    });

    if (outputFiles === undefined) {
      if (args.formats.includes("json")) process.stdout.write(report.json);
      else process.stdout.write(report.markdown);
    } else {
      for (const outputFile of outputFiles) {
        await mkdir(path.dirname(outputFile.absolutePath), { recursive: true });
        await writeFile(
          outputFile.absolutePath,
          outputFile.format === "json" ? report.json : report.markdown,
          "utf8",
        );
      }
      process.stderr.write(`${report.summary}\n`);
      for (const outputFile of outputFiles) {
        process.stderr.write(`Proofpack: wrote ${outputFile.displayPath}\n`);
      }
      if (args.open) {
        const markdownOutput = outputFiles.find((outputFile) => outputFile.format === "markdown");
        if (markdownOutput !== undefined) {
          openReport(markdownOutput.absolutePath);
          process.stderr.write("Proofpack: opened the Markdown report with the system opener.\n");
        }
      }
    }

    return exitCodeFor({
      hadCheckFailure: checksResult.results.some((result) => result.status === "failed"),
      hadRunnerFailure: checksResult.results.some(
        (result) => result.status === "timeout" || result.status === "start-error",
      ),
      interrupted: checksResult.interrupted || (checksResult.stoppedEarly && checksResult.results.some((result) => result.status === "interrupted")),
    });
  } catch (error) {
    if (abortController.signal.aborted) return 4;
    if (error instanceof ArgumentError) {
      process.stderr.write(`Proofpack: ${error.message}\n`);
      return 2;
    }
    if (error instanceof GitInspectionError) {
      process.stderr.write(`Proofpack: ${error.message}\n`);
      process.stderr.write("Next: run the command inside a readable Git repository.\n");
      return 3;
    }
    if (error instanceof OutputError) {
      process.stderr.write(`Proofpack: ${error.message}\n`);
      process.stderr.write("Next: choose an untracked output path inside the repository.\n");
      return 3;
    }
    if (error instanceof OpenError) {
      process.stderr.write(`Proofpack: ${error.message}\n`);
      process.stderr.write("Next: open the written report manually or choose another system opener.\n");
      return 3;
    }
    process.stderr.write(`Proofpack: report generation failed: ${describeError(error)}\n`);
    return 3;
  } finally {
    process.removeListener("SIGINT", onInterrupt);
    process.removeListener("SIGTERM", onInterrupt);
  }
}

const exitCode = await main();
process.exitCode = exitCode;
