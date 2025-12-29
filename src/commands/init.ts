import fs from "node:fs/promises";
import path from "node:path";
import * as p from "@clack/prompts";
import { saveConfig, saveStyleguide, configExists } from "../lib/config.js";
import { scanDocsDirectory, summarizeDocs } from "../lib/docs.js";
import { generateStyleguide } from "../lib/styleguide-generator.js";
import { generateDocEmbeddings, saveEmbeddings } from "../lib/embeddings.js";
import type { InitCommandOptions, JanusDocConfig } from "../types.js";

/**
 * Check if a directory exists
 */
async function directoryExists(dirPath: string): Promise<boolean> {
  try {
    const stat = await fs.stat(dirPath);
    return stat.isDirectory();
  } catch {
    return false;
  }
}

/**
 * Find existing docs directory
 */
async function findDocsDirectory(cwd: string): Promise<string | undefined> {
  const commonPaths = ["docs", "documentation", "doc"];

  for (const dir of commonPaths) {
    const fullPath = path.join(cwd, dir);
    if (await directoryExists(fullPath)) {
      return dir;
    }
  }

  return undefined;
}

/**
 * Initialize JanusDoc configuration
 */
export async function initCommand(options: InitCommandOptions): Promise<void> {
  const cwd = process.cwd();

  p.intro("🚀 JanusDoc Setup");

  // Check if already initialized
  if (await configExists(cwd)) {
    const shouldOverwrite = await p.confirm({
      message: "JanusDoc is already initialized. Overwrite?",
      initialValue: false,
    });

    if (p.isCancel(shouldOverwrite) || !shouldOverwrite) {
      p.cancel("Initialization cancelled.");
      process.exit(0);
    }
  }

  // Get docs path
  let docsPath = options.docsPath;
  let docsVerified = false;

  if (!docsPath) {
    // Try to find existing docs directory
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
      process.exit(0);
    }

    docsPath = inputPath;

    // If user accepted the detected path, it's already verified
    if (detectedPath && docsPath === detectedPath) {
      docsVerified = true;
    }
  }

  // Normalize the path (remove ./ prefix if present)
  docsPath = docsPath.replace(/^\.\//, "");

  // Validate docs path (skip if already verified)
  const absoluteDocsPath = path.join(cwd, docsPath);

  if (!docsVerified && !(await directoryExists(absoluteDocsPath))) {
    const shouldCreate = await p.confirm({
      message: `Directory "${docsPath}" does not exist. Create it?`,
      initialValue: true,
    });

    if (p.isCancel(shouldCreate)) {
      p.cancel("Initialization cancelled.");
      process.exit(0);
    }

    if (shouldCreate) {
      await fs.mkdir(absoluteDocsPath, { recursive: true });
      p.log.success(`Created directory: ${docsPath}`);
    } else {
      p.cancel("Initialization cancelled.");
      process.exit(0);
    }
  }

  // Save config
  const config: JanusDocConfig = {
    docsPath,
  };

  await saveConfig(config, cwd);
  p.log.success("Created .janusdoc.json");

  // Scan docs
  const spinner = p.spinner();

  spinner.start("Scanning documentation...");
  const docs = await scanDocsDirectory(absoluteDocsPath);
  spinner.stop(`Found ${docs.length} documentation file(s)`);

  // Generate style guide
  spinner.start("Generating style guide with AI...");
  const summarized = summarizeDocs(docs);

  try {
    const styleguide = await generateStyleguide(summarized);
    await saveStyleguide(styleguide, cwd);
    spinner.stop("Created .janusdoc/auto_styleguide.md");
  } catch (error) {
    if ((error as Error).message?.includes("API key")) {
      spinner.stop("OpenAI API key not found");
      p.log.warn("Set OPENAI_API_KEY environment variable for AI-powered features.");
      p.log.info("Using default style guide instead.");

      // Save default styleguide
      const { generateStyleguide: gen } = await import("../lib/styleguide-generator.js");
      const defaultGuide = await gen([]);
      await saveStyleguide(defaultGuide, cwd);
      p.log.success("Created .janusdoc/auto_styleguide.md (default)");
    } else {
      spinner.stop("Failed to generate style guide");
      throw error;
    }
  }

  // Generate embeddings for semantic search
  if (docs.length > 0) {
    spinner.start("Generating embeddings for semantic search...");
    try {
      const embeddedDocs = await generateDocEmbeddings(docs);
      await saveEmbeddings(embeddedDocs, cwd);
      spinner.stop(`Created .janusdoc/embeddings.json (${docs.length} docs embedded)`);
    } catch (error) {
      if ((error as Error).message?.includes("API key")) {
        spinner.stop("Skipped embeddings (no API key)");
        p.log.warn("Embeddings require OPENAI_API_KEY. Semantic search will be disabled.");
      } else {
        spinner.stop("Failed to generate embeddings");
        throw error;
      }
    }
  }

  p.note(
    `1. Review and customize .janusdoc/auto_styleguide.md\n2. Add janusdoc to your CI/CD pipeline:\n   janusdoc run --pr <number> --repo <owner/repo>`,
    "Next steps",
  );

  p.outro("✨ JanusDoc initialized successfully!");
}
