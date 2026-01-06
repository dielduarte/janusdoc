import fs from "node:fs/promises";
import path from "node:path";
import * as p from "./ui.js";

export type Spinner = ReturnType<typeof p.spinner>;

export interface StepContext {
  cwd: string;
  spinner: Spinner;
}

export async function withSpinner<T>(
  spinner: Spinner,
  startMessage: string,
  work: () => Promise<T>,
  stopMessage: string | ((result: T) => string),
): Promise<T> {
  spinner.start(startMessage);
  const result = await work();
  const message = typeof stopMessage === "function" ? stopMessage(result) : stopMessage;
  spinner.stop(message);
  return result;
}

export function isApiKeyError(error: unknown): boolean {
  return (error as Error).message?.includes("API key") ?? false;
}

export function handleApiKeyError(
  error: unknown,
  spinner: Spinner,
  context: { operation: string; skipMessage?: string },
): boolean {
  if (!isApiKeyError(error)) {
    return false;
  }

  spinner.stop(`Skipped ${context.operation} (no API key)`);
  if (context.skipMessage) {
    p.log.warn(context.skipMessage);
  }
  return true;
}

export async function directoryExists(dirPath: string): Promise<boolean> {
  try {
    const stat = await fs.stat(dirPath);
    return stat.isDirectory();
  } catch {
    return false;
  }
}

export async function findDocsDirectory(cwd: string): Promise<string | undefined> {
  const commonPaths = ["docs", "documentation", "doc"];

  for (const dir of commonPaths) {
    const fullPath = path.join(cwd, dir);
    if (await directoryExists(fullPath)) {
      return dir;
    }
  }

  return undefined;
}
