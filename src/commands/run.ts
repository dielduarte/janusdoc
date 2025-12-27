import path from "node:path";
import * as p from "@clack/prompts";
import { loadConfig, loadStyleguide } from "../lib/config.js";
import { scanDocsDirectory, summarizeDocs } from "../lib/docs.js";
import { getChangedFiles, getDiffPatch, filterCodeFiles } from "../lib/git.js";
import {
  createOctokit,
  parseRepo,
  getPRInfo,
  formatComment,
  upsertPRComment,
} from "../lib/github.js";
import { analyzeChanges } from "../lib/analyzer.js";
import type { RunCommandOptions } from "../types.js";

/**
 * Run the documentation analysis on a PR
 */
export async function runCommand(options: RunCommandOptions): Promise<void> {
  const cwd = process.cwd();

  p.intro("🔍 JanusDoc - Analyzing PR");

  const spinner = p.spinner();

  // Load configuration
  spinner.start("Loading configuration...");
  const config = await loadConfig(cwd);
  const styleguide = await loadStyleguide(cwd);
  spinner.stop(`Docs path: ${config.docsPath}`);

  // Initialize GitHub client
  spinner.start("Connecting to GitHub...");
  const octokit = createOctokit(options.token);
  const { owner, repo } = parseRepo(options.repo);

  // Get PR information
  const prInfo = await getPRInfo(octokit, owner, repo, options.pr);
  spinner.stop(`PR #${prInfo.number}: ${prInfo.title}`);

  p.log.info(`Base: ${prInfo.baseBranch} ← Head: ${prInfo.headBranch}`);

  // Get changed files
  spinner.start("Getting changed files...");
  const allChangedFiles = await getChangedFiles(prInfo.baseBranch, "HEAD", cwd);
  const codeFiles = filterCodeFiles(allChangedFiles);
  spinner.stop(
    `Found ${allChangedFiles.length} changed files (${codeFiles.length} code files)`
  );

  if (codeFiles.length === 0) {
    p.log.success("No code changes detected. Nothing to analyze.");
    p.outro("Done!");
    return;
  }

  // Get diff patch
  spinner.start("Getting diff...");
  const diff = await getDiffPatch(
    prInfo.baseBranch,
    "HEAD",
    codeFiles.map((f) => f.path),
    cwd
  );
  spinner.stop("Diff retrieved");

  // Scan existing docs
  spinner.start("Scanning documentation...");
  const absoluteDocsPath = path.resolve(cwd, config.docsPath);
  const docs = await scanDocsDirectory(absoluteDocsPath);
  const summarizedDocs = summarizeDocs(docs);
  spinner.stop(`Found ${docs.length} documentation file(s)`);

  if (docs.length === 0) {
    p.log.warn("No documentation files found. Nothing to analyze.");
    p.outro("Done!");
    return;
  }

  // Analyze changes
  spinner.start("Analyzing changes with AI...");
  const result = await analyzeChanges(
    diff,
    codeFiles,
    summarizedDocs,
    styleguide
  );
  spinner.stop(result.summary);

  // Post comment if there are suggestions
  if (result.suggestions.length > 0) {
    spinner.start(
      `Posting comment with ${result.suggestions.length} suggestion(s)...`
    );
    const comment = formatComment(result);
    await upsertPRComment(octokit, owner, repo, options.pr, comment);
    spinner.stop("Comment posted successfully!");

    // Show suggestions summary
    const suggestionsList = result.suggestions
      .map((s) => `• ${s.docPath}: ${s.reason}`)
      .join("\n");
    p.note(suggestionsList, "Suggested Updates");
  } else {
    p.log.success("No documentation updates needed.");
  }

  p.outro("✨ Analysis complete!");
}
