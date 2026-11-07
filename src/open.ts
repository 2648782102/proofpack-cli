import { spawn } from "node:child_process";

export class OpenError extends Error {}

export type OpenRunner = (filePath: string, platform?: NodeJS.Platform) => void;

export function openReport(
  filePath: string,
  runner: OpenRunner = defaultOpenRunner,
  platform: NodeJS.Platform = process.platform,
): void {
  runner(filePath, platform);
}

function defaultOpenRunner(filePath: string, platform: NodeJS.Platform = process.platform): void {
  const command = platform === "darwin"
    ? "open"
    : platform === "win32"
      ? "cmd"
      : "xdg-open";
  const args = platform === "win32"
    ? ["/d", "/s", "/c", "start", '""', filePath]
    : [filePath];
  const child = spawn(command, args, {
    stdio: "ignore",
    detached: true,
    windowsHide: true,
  });
  child.once("error", (error: Error) => {
    process.stderr.write(`Proofpack: could not open report: ${error.message}\n`);
  });
  child.unref();
}
