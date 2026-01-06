import fs from "node:fs/promises";
import path from "node:path";
import * as p from "@clack/prompts";
import {
  withSpinner,
  handleApiKeyError,
  directoryExists,
  findDocsDirectory,
  type Spinner,
} from "../lib/pipeline.js";
import { saveConfig, saveStyleguide, saveDocMap, configExists } from "../lib/config.js";
import { scanDocsDirectory, summarizeDocs } from "../lib/docs.js";
import { generateStyleguide } from "../lib/styleguide-generator.js";
import { generateDocMap } from "../lib/doc-map-generator.js";
import { generateDocEmbeddings, saveEmbeddings } from "../lib/embeddings.js";
import type { InitCommandOptions, JanusDocConfig, DocFile } from "../types.js";

async function checkExistingConfig(cwd: string): Promise<boolean> {
  if (!(await configExists(cwd))) {
    return true;
  }

  const shouldOverwrite = await p.confirm({
    message: "JanusDoc is already initialized. Overwrite?",
    initialValue: false,
  });

  if (p.isCancel(shouldOverwrite) || !shouldOverwrite) {
    p.cancel("Initialization cancelled.");
    return false;
  }

  return true;
}

async function resolveDocsPath(
  cwd: string,
  options: InitCommandOptions,
): Promise<string | null> {
  let docsPath = options.docsPath;
  let docsVerified = false;

  if (!docsPath) {
    const detectedPath = await findDocsDirectory(cwd);

    if (detectedPath) {
      p.log.success(`Found existing docs directory: ${detectedPath}`);
      docsVerified = true;
    }

    const inputPath = await p.text({
      message: "Path to documentation directory",
      placeholder: "docs",
      initialValue: detectedPath || "docs",
      validate: (value) => {
        if (!value.trim()) return "Please enter a path";
      },
    });

    if (p.isCancel(inputPath)) {
      p.cancel("Initialization cancelled.");
      return null;
    }

    docsPath = inputPath;

    if (detectedPath && docsPath === detectedPath) {
      docsVerified = true;
    }
  }

  docsPath = docsPath.replace(/^\.\//, "");
  const absoluteDocsPath = path.join(cwd, docsPath);

  if (!docsVerified && !(await directoryExists(absoluteDocsPath))) {
    const shouldCreate = await p.confirm({
      message: `Directory "${docsPath}" does not exist. Create it?`,
      initialValue: true,
    });

    if (p.isCancel(shouldCreate)) {
      p.cancel("Initialization cancelled.");
      return null;
    }

    if (shouldCreate) {
      await fs.mkdir(absoluteDocsPath, { recursive: true });
      p.log.success(`Created directory: ${docsPath}`);
    } else {
      p.cancel("Initialization cancelled.");
      return null;
    }
  }

  return docsPath;
}

async function createConfig(cwd: string, docsPath: string): Promise<void> {
  const config: JanusDocConfig = { docsPath };
  await saveConfig(config, cwd);
  p.log.success("Created .janusdoc.json");
}

async function generateStyleguideAsset(
  cwd: string,
  summarized: DocFile[],
  spinner: Spinner,
): Promise<void> {
  spinner.start("Generating style guide with AI...");

  try {
    const styleguide = await generateStyleguide(summarized);
    await saveStyleguide(styleguide, cwd);
    spinner.stop("Created .janusdoc/auto_styleguide.md");
  } catch (error) {
    if (handleApiKeyError(error, spinner, { operation: "style guide" })) {
      p.log.warn("Set OPENAI_API_KEY environment variable for AI-powered features.");
      p.log.info("Using default style guide instead.");

      const defaultGuide = await generateStyleguide([]);
      await saveStyleguide(defaultGuide, cwd);
      p.log.success("Created .janusdoc/auto_styleguide.md (default)");
    } else {
      spinner.stop("Failed to generate style guide");
      throw error;
    }
  }
}

async function generateDocMapAsset(
  cwd: string,
  summarized: DocFile[],
  spinner: Spinner,
): Promise<void> {
  spinner.start("Generating documentation map...");

  try {
    const docMap = await generateDocMap(summarized);
    await saveDocMap(docMap, cwd);
    spinner.stop("Created .janusdoc/doc_map.md");
  } catch (error) {
    if (!handleApiKeyError(error, spinner, { operation: "doc map" })) {
      spinner.stop("Failed to generate doc map");
      throw error;
    }
  }
}

async function generateEmbeddingsAsset(
  cwd: string,
  docs: DocFile[],
  spinner: Spinner,
): Promise<void> {
  spinner.start("Generating embeddings for semantic search...");

  try {
    const embeddedDocs = await generateDocEmbeddings(docs);
    await saveEmbeddings(embeddedDocs, cwd);
    spinner.stop(`Created .janusdoc/embeddings.json (${docs.length} docs embedded)`);
  } catch (error) {
    if (
      !handleApiKeyError(error, spinner, {
        operation: "embeddings",
        skipMessage: "Embeddings require OPENAI_API_KEY. Semantic search will be disabled.",
      })
    ) {
      spinner.stop("Failed to generate embeddings");
      throw error;
    }
  }
}

async function generateAssets(cwd: string, docsPath: string): Promise<void> {
  const spinner = p.spinner();
  const absoluteDocsPath = path.join(cwd, docsPath);

  const docs = await withSpinner(
    spinner,
    "Scanning documentation...",
    () => scanDocsDirectory(absoluteDocsPath),
    (d) => `Found ${d.length} documentation file(s)`,
  );

  const summarized = summarizeDocs(docs);

  await generateStyleguideAsset(cwd, summarized, spinner);

  if (docs.length > 0) {
    await generateDocMapAsset(cwd, summarized, spinner);
    await generateEmbeddingsAsset(cwd, docs, spinner);
  }
}

export async function initCommand(options: InitCommandOptions): Promise<void> {
  const cwd = process.cwd();

  p.intro("🚀 JanusDoc Setup");

  const canProceed = await checkExistingConfig(cwd);
  if (!canProceed) {
    process.exit(0);
  }

  const docsPath = await resolveDocsPath(cwd, options);
  if (!docsPath) {
    process.exit(0);
  }

  await createConfig(cwd, docsPath);
  await generateAssets(cwd, docsPath);

  p.note(
    `1. Review and customize .janusdoc/auto_styleguide.md\n2. Add janusdoc to your CI/CD pipeline:\n   janusdoc run --pr <number> --repo <owner/repo>`,
    "Next steps",
  );

  p.outro("✨ JanusDoc initialized successfully!");
}
