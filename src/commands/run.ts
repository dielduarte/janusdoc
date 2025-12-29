import path from "node:path";
import * as p from "@clack/prompts";
import { loadConfig, loadStyleguide } from "../lib/config.js";
import { scanDocsDirectory } from "../lib/docs.js";
import { getChangedFiles, getDiffPatch, filterCodeFiles } from "../lib/git.js";
import {
  createOctokit,
  parseRepo,
  getPRInfo,
  formatComment,
  upsertPRComment,
} from "../lib/github.js";
import { analyzeChanges } from "../lib/analyzer.js";
import { summarizeCodeChanges } from "../lib/summarizer.js";
import {
  loadEmbeddings,
  generateEmbedding,
  searchSimilarDocs,
  embeddingsExist,
} from "../lib/embeddings.js";
import type { RunCommandOptions, DocFile } from "../types.js";

/**
 * Run the documentation analysis on a PR
 */
export async function runCommand(options: RunCommandOptions): Promise<void> {
  const cwd = process.cwd();

  // Suppress UI output in dry-run mode
  const isDryRun = options.dryRun;

  if (!isDryRun) {
    p.intro("🔍 JanusDoc - Analyzing PR");
  }

  const spinner = isDryRun ? { start: () => {}, stop: () => {} } : p.spinner();

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

  if (!isDryRun) {
    p.log.info(`Base: ${prInfo.baseBranch} ← Head: ${prInfo.headBranch}`);
  }

  // Get changed files
  spinner.start("Getting changed files...");
  const allChangedFiles = await getChangedFiles(prInfo.baseBranch, prInfo.headBranch, cwd);
  const codeFiles = filterCodeFiles(allChangedFiles);
  spinner.stop(`Found ${allChangedFiles.length} changed files (${codeFiles.length} code files)`);

  if (codeFiles.length === 0) {
    if (!isDryRun) {
      p.log.success("No code changes detected. Nothing to analyze.");
      p.outro("Done!");
    }
    return;
  }

  // Get diff patch
  spinner.start("Getting diff...");
  const diff = await getDiffPatch(
    prInfo.baseBranch,
    prInfo.headBranch,
    codeFiles.map((f) => f.path),
    cwd,
  );
  spinner.stop("Diff retrieved");

  // Scan existing docs
  spinner.start("Scanning documentation...");
  const absoluteDocsPath = path.resolve(cwd, config.docsPath);
  const allDocs = await scanDocsDirectory(absoluteDocsPath);
  spinner.stop(`Found ${allDocs.length} documentation file(s)`);

  if (allDocs.length === 0) {
    if (!isDryRun) {
      p.log.warn("No documentation files found. Nothing to analyze.");
      p.outro("Done!");
    }
    return;
  }

  // Find relevant docs using embeddings
  let relevantDocs: DocFile[];

  if (await embeddingsExist(cwd)) {
    // Use semantic search with embeddings
    spinner.start("Summarizing code changes...");
    const changeSummary = await summarizeCodeChanges(diff);
    spinner.stop(`Summary: ${changeSummary.slice(0, 100)}...`);

    spinner.start("Finding relevant documentation...");
    const summaryEmbedding = await generateEmbedding(changeSummary);
    const embeddingsStore = await loadEmbeddings(cwd);
    const searchResults = searchSimilarDocs(
      summaryEmbedding,
      embeddingsStore.documents,
      5, // top 5 docs
      0.5, // similarity threshold
    );

    // Map search results back to full doc content
    relevantDocs = searchResults
      .map((result) => allDocs.find((doc) => doc.path === result.path))
      .filter((doc): doc is DocFile => doc !== undefined);

    spinner.stop(`Found ${relevantDocs.length} relevant doc(s) via semantic search`);

    if (!isDryRun && relevantDocs.length > 0) {
      const docsList = relevantDocs.map((d) => `• ${d.path}`).join("\n");
      p.log.info(`Relevant docs:\n${docsList}`);
    }
  } else {
    // Fallback: use all docs (legacy behavior)
    if (!isDryRun) {
      p.log.warn(
        "No embeddings found. Using all docs (run 'janusdoc init' to enable semantic search).",
      );
    }
    relevantDocs = allDocs;
  }

  if (relevantDocs.length === 0) {
    if (!isDryRun) {
      p.log.success("No relevant documentation found for these changes.");
      p.outro("Done!");
    }
    return;
  }

  // Analyze changes with relevant docs only
  spinner.start("Analyzing changes with AI...");
  const result = await analyzeChanges(diff, codeFiles, relevantDocs, styleguide);
  spinner.stop(result.summary);

  // If dry-run mode, output JSON and exit
  if (options.dryRun) {
    const output = {
      summary: result.summary,
      suggestions: result.suggestions.map((s) => ({
        file: s.docPath,
        reason: s.reason,
        updatedContent: s.updatedContent,
      })),
      metadata: {
        pr: options.pr,
        repo: options.repo,
        filesChanged: codeFiles.map((f) => f.path),
        totalSuggestions: result.suggestions.length,
      },
    };
    console.log(JSON.stringify(output, null, 2));
    return;
  }

  // Post comment if there are suggestions
  if (result.suggestions.length > 0) {
    spinner.start(`Posting comment with ${result.suggestions.length} suggestion(s)...`);
    const comment = formatComment(result);
    await upsertPRComment(octokit, owner, repo, options.pr, comment);
    spinner.stop("Comment posted successfully!");

    // Show suggestions summary
    if (!isDryRun) {
      const suggestionsList = result.suggestions
        .map((s) => `• ${s.docPath}: ${s.updatedContent}`)
        .join("\n");
      p.note(suggestionsList, "Suggested Updates");
    }
  } else {
    if (!isDryRun) {
      p.log.success("No documentation updates needed.");
    }
  }

  if (!isDryRun) {
    p.outro("✨ Analysis complete!");
  }
}
