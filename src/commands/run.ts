import path from "node:path";
import * as p from "../lib/ui.js";
import { withSpinner, type Spinner } from "../lib/pipeline.js";
import { loadConfig, loadStyleguide, loadDocMap } from "../lib/config.js";
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
import type {
  RunCommandOptions,
  DocFile,
  RunContext,
  GitHubContext,
  ChangesContext,
  DocsContext,
  RelevantDocsContext,
  AnalysisContext,
} from "../types.js";

async function loadContext(cwd: string, spinner: Spinner): Promise<RunContext> {
  return withSpinner(
    spinner,
    "Loading configuration...",
    async () => {
      const config = await loadConfig(cwd);
      const styleguide = await loadStyleguide(cwd);
      const docMap = await loadDocMap(cwd);
      return { cwd, config, styleguide, docMap };
    },
    (ctx) => `Docs path: ${ctx.config.docsPath}`
  );
}

async function connectGitHub(
  ctx: RunContext,
  options: RunCommandOptions,
  spinner: Spinner
): Promise<GitHubContext> {
  spinner.start("Connecting to GitHub...");

  const octokit = createOctokit(options.token);
  const { owner, repo } = parseRepo(options.repo);
  const prInfo = await getPRInfo(octokit, owner, repo, options.pr);

  spinner.stop(`PR #${prInfo.number}: ${prInfo.title}`);
  p.log.info(`Base: ${prInfo.baseBranch} ← Head: ${prInfo.headBranch}`);

  return { ...ctx, octokit, owner, repo, prInfo };
}

async function getChanges(
  ctx: GitHubContext,
  spinner: Spinner
): Promise<ChangesContext | null> {
  const allChangedFiles = await withSpinner(
    spinner,
    "Getting changed files...",
    () =>
      getChangedFiles(ctx.prInfo.baseBranch, ctx.prInfo.headBranch, ctx.cwd),
    (files) => {
      const codeFiles = filterCodeFiles(files);
      return `Found ${files.length} changed files (${codeFiles.length} code files)`;
    }
  );

  const codeFiles = filterCodeFiles(allChangedFiles);

  if (codeFiles.length === 0) {
    p.log.success("No code changes detected. Nothing to analyze.");
    return null;
  }

  const diff = await withSpinner(
    spinner,
    "Getting diff...",
    () =>
      getDiffPatch(
        ctx.prInfo.baseBranch,
        ctx.prInfo.headBranch,
        codeFiles.map((f) => f.path),
        ctx.cwd
      ),
    "Diff retrieved"
  );

  return { ...ctx, codeFiles, diff };
}

async function scanDocs(
  ctx: ChangesContext,
  spinner: Spinner
): Promise<DocsContext | null> {
  const absoluteDocsPath = path.resolve(ctx.cwd, ctx.config.docsPath);

  const allDocs = await withSpinner(
    spinner,
    "Scanning documentation...",
    () => scanDocsDirectory(absoluteDocsPath),
    (docs) => `Found ${docs.length} documentation file(s)`
  );

  if (allDocs.length === 0) {
    p.log.warn("No documentation files found. Nothing to analyze.");
    return null;
  }

  return { ...ctx, allDocs, absoluteDocsPath };
}

async function findRelevantDocs(
  ctx: DocsContext,
  spinner: Spinner
): Promise<RelevantDocsContext | null> {
  let relevantDocs: DocFile[];

  if (await embeddingsExist(ctx.cwd)) {
    const changeSummary = await withSpinner(
      spinner,
      "Summarizing code changes...",
      () => summarizeCodeChanges(ctx.diff),
      (summary) => `Summary: ${summary.slice(0, 100)}...`
    );

    relevantDocs = await withSpinner(
      spinner,
      "Finding relevant documentation...",
      async () => {
        const summaryEmbedding = await generateEmbedding(changeSummary);
        const embeddingsStore = await loadEmbeddings(ctx.cwd);
        const searchResults = searchSimilarDocs(
          summaryEmbedding,
          embeddingsStore.documents,
          ctx.config.search?.topN,
          ctx.config.search?.threshold
        );

        return searchResults
          .map((result) => ctx.allDocs.find((doc) => doc.path === result.path))
          .filter((doc): doc is DocFile => doc !== undefined);
      },
      (docs) => `Found ${docs.length} relevant doc(s) via semantic search`
    );

    if (relevantDocs.length > 0) {
      const docsList = relevantDocs.map((d) => `• ${d.path}`).join("\n");
      p.log.info(`Relevant docs:\n${docsList}`);
    }
  } else {
    p.log.warn(
      "No embeddings found. Using all docs (run 'janusdoc init' to enable semantic search)."
    );
    relevantDocs = ctx.allDocs;
  }

  if (relevantDocs.length === 0) {
    p.log.success("No relevant documentation found for these changes.");
    return null;
  }

  return { ...ctx, relevantDocs };
}

async function analyze(
  ctx: RelevantDocsContext,
  spinner: Spinner
): Promise<AnalysisContext> {
  const result = await withSpinner(
    spinner,
    "Analyzing changes with AI...",
    () =>
      analyzeChanges(
        ctx.diff,
        ctx.codeFiles,
        ctx.relevantDocs,
        ctx.styleguide,
        ctx.docMap
      ),
    (res) => res.summary
  );

  return { ...ctx, result };
}

async function postResults(
  ctx: AnalysisContext,
  options: RunCommandOptions,
  spinner: Spinner
): Promise<void> {
  if (options.dryRun) {
    const output = {
      summary: ctx.result.summary,
      suggestions: ctx.result.suggestions.map((s) => ({
        file: s.docPath,
        reason: s.reason,
        updatedContent: s.updatedContent,
      })),
      metadata: {
        pr: options.pr,
        repo: options.repo,
        filesChanged: ctx.codeFiles.map((f) => f.path),
        relevantDocs: ctx.relevantDocs.map((d) => d.path),
        totalSuggestions: ctx.result.suggestions.length,
      },
    };
    console.log(JSON.stringify(output, null, 2));
    return;
  }

  if (ctx.result.suggestions.length > 0) {
    await withSpinner(
      spinner,
      `Posting comment with ${ctx.result.suggestions.length} suggestion(s)...`,
      async () => {
        const comment = formatComment(ctx.result);
        await upsertPRComment(
          ctx.octokit,
          ctx.owner,
          ctx.repo,
          options.pr,
          comment
        );
      },
      "Comment posted successfully!"
    );

    const suggestionsList = ctx.result.suggestions
      .map((s) => `• ${s.docPath}: ${s.updatedContent}`)
      .join("\n");
    p.note(suggestionsList, "Suggested Updates");
  } else {
    p.log.success("No documentation updates needed.");
  }
}

export async function runCommand(options: RunCommandOptions): Promise<void> {
  const cwd = process.cwd();

  if (options.dryRun) {
    p.setSilentMode(true);
  }

  p.intro("🔍 JanusDoc - Analyzing PR");
  const spinner = p.spinner();

  const ctx = await loadContext(cwd, spinner);
  const githubCtx = await connectGitHub(ctx, options, spinner);

  const changesCtx = await getChanges(githubCtx, spinner);
  if (!changesCtx) {
    p.outro("Done!");
    return;
  }

  const docsCtx = await scanDocs(changesCtx, spinner);
  if (!docsCtx) {
    p.outro("Done!");
    return;
  }

  const relevantDocsCtx = await findRelevantDocs(docsCtx, spinner);
  if (!relevantDocsCtx) {
    p.outro("Done!");
    return;
  }

  const analysisCtx = await analyze(relevantDocsCtx, spinner);
  await postResults(analysisCtx, options, spinner);

  p.outro("✨ Analysis complete!");
}
