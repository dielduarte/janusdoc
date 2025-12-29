import { simpleGit, SimpleGit } from "simple-git";
import type { ChangedFile } from "../types.js";

/**
 * Create a simple-git instance
 */
export function createGit(cwd: string = process.cwd()): SimpleGit {
  return simpleGit(cwd);
}

/**
 * Get the list of changed files between two branches
 */
export async function getChangedFiles(
  baseBranch: string,
  headBranch: string = "HEAD",
  cwd: string = process.cwd(),
): Promise<ChangedFile[]> {
  const git = createGit(cwd);

  // Fetch the base branch to ensure we have the latest
  try {
    await git.fetch("origin", baseBranch);
  } catch {
    // Ignore fetch errors (might be running locally without remote)
  }

  // Get diff between base and head
  const diffSummary = await git.diffSummary([`origin/${baseBranch}...${headBranch}`]);

  const changedFiles: ChangedFile[] = diffSummary.files.map((file) => ({
    path: file.file,
    additions: "insertions" in file ? file.insertions : 0,
    deletions: "deletions" in file ? file.deletions : 0,
  }));

  return changedFiles;
}

/**
 * Get the full diff patch for specific files
 */
export async function getDiffPatch(
  baseBranch: string,
  headBranch: string = "HEAD",
  files?: string[],
  cwd: string = process.cwd(),
): Promise<string> {
  const git = createGit(cwd);

  const args = [`origin/${baseBranch}...${headBranch}`];

  if (files && files.length > 0) {
    args.push("--", ...files);
  }

  const diff = await git.diff(args);
  return diff;
}

/**
 * Get the current branch name
 */
export async function getCurrentBranch(cwd: string = process.cwd()): Promise<string> {
  const git = createGit(cwd);
  const branch = await git.revparse(["--abbrev-ref", "HEAD"]);
  return branch.trim();
}

/**
 * Filter changed files to only include code files (not docs)
 */
export function filterCodeFiles(files: ChangedFile[]): ChangedFile[] {
  const codeExtensions = [
    ".ts",
    ".tsx",
    ".js",
    ".jsx",
    ".mjs",
    ".cjs",
    ".py",
    ".rb",
    ".go",
    ".rs",
    ".java",
    ".kt",
    ".c",
    ".cpp",
    ".h",
    ".hpp",
    ".cs",
    ".swift",
    ".vue",
    ".svelte",
    ".astro",
    ".json",
    ".yaml",
    ".yml",
    ".toml",
  ];

  return files.filter((file) => {
    const ext = file.path.toLowerCase().match(/\.[^.]+$/)?.[0];
    return ext && codeExtensions.includes(ext);
  });
}

/**
 * Filter to only get documentation files that changed
 */
export function filterDocFiles(files: ChangedFile[]): ChangedFile[] {
  const docExtensions = [".md", ".mdx", ".rst", ".txt"];

  return files.filter((file) => {
    const ext = file.path.toLowerCase().match(/\.[^.]+$/)?.[0];
    return ext && docExtensions.includes(ext);
  });
}
