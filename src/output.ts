import { spawnSync } from "node:child_process";
import { lstatSync, realpathSync } from "node:fs";
import path from "node:path";
import type { ReportFormat } from "./args.js";

export class OutputError extends Error {}

export interface OutputDependencies {
  repositoryRoot: string;
  cwd?: string;
  isTracked?: (relativePath: string) => boolean;
}

export interface ReportOutputFile {
  format: ReportFormat;
  absolutePath: string;
  displayPath: string;
}

export function validateOutputPath(outputPath: string, dependencies: OutputDependencies): string {
  if (outputPath.includes("\0")) {
    throw new OutputError("Output path contains an invalid character.");
  }

  const cwd = dependencies.cwd ?? process.cwd();
  const absolutePath = path.resolve(cwd, outputPath);
  const relativePath = path.relative(dependencies.repositoryRoot, absolutePath);
  if (relativePath === "" || relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    throw new OutputError("Output path must be inside the current repository.");
  }
  if (relativePath.split(path.sep)[0]?.toLowerCase() === ".git") {
    throw new OutputError("Output path must not be inside Git metadata.");
  }

  const resolvedRoot = realpathSync.native(dependencies.repositoryRoot);
  for (let current = absolutePath; current !== resolvedRoot; current = path.dirname(current)) {
    if (path.dirname(current) === current) {
      throw new OutputError("Output path must be inside the current repository.");
    }
    try {
      if (lstatSync(current).isSymbolicLink()) {
        throw new OutputError("Output path must not traverse a symbolic link.");
      }
    } catch (error) {
      if (error instanceof OutputError) throw error;
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== "ENOENT" && code !== "ENOTDIR") throw error;
    }
  }

  const relativeFile = relativePath.split(path.sep).join("/");
  const isTracked = dependencies.isTracked ?? ((candidate: string) => defaultIsTracked(candidate, cwd));
  if (isTracked(relativeFile)) {
    throw new OutputError("Output path must not overwrite a tracked file.");
  }
  return absolutePath;
}

export function resolveReportOutputFiles(
  outputPath: string,
  formats: readonly ReportFormat[],
  dependencies: OutputDependencies,
): ReportOutputFile[] {
  validateOutputPath(outputPath, dependencies);
  const cwd = dependencies.cwd ?? process.cwd();
  const root = realpathSync.native(dependencies.repositoryRoot);

  if (formats.length === 1) {
    const validatedPath = validateOutputPath(outputPath, dependencies);
    return [
      {
        format: formats[0] ?? "markdown",
        absolutePath: validatedPath,
        displayPath: normalizedDisplayPath(path.relative(root, validatedPath)),
      },
    ];
  }

  const baseAbsolutePath = validateOutputPath(outputPath, dependencies);
  const extension = path.extname(baseAbsolutePath).toLowerCase();
  const basePath = extension === ".md" || extension === ".json"
    ? baseAbsolutePath.slice(0, -extension.length)
    : baseAbsolutePath;
  return formats.map((format) => {
    const candidatePath = `${basePath}.${format === "markdown" ? "md" : "json"}`;
    const absolutePath = validateOutputPath(candidatePath, { ...dependencies, cwd });
    return {
      format,
      absolutePath,
      displayPath: normalizedDisplayPath(path.relative(root, absolutePath)),
    };
  });
}

function normalizedDisplayPath(relativePath: string): string {
  return relativePath.split(path.sep).join("/");
}

function defaultIsTracked(relativePath: string, cwd: string): boolean {
  const result = spawnSync(
    "git",
    ["ls-files", "--error-unmatch", "-z", "--full-name", "--", `:(top,literal)${relativePath}`],
    {
      cwd,
      env: { ...process.env, GIT_OPTIONAL_LOCKS: "0" },
    },
  );
  if (result.error !== undefined) {
    throw new OutputError(`Could not inspect output path: ${result.error.message}`);
  }
  return result.status === 0;
}
