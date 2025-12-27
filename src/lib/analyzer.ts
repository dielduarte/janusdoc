import { generateObject } from "ai";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";
import type {
  DocFile,
  ChangedFile,
  AnalysisResult,
  DocUpdateSuggestion,
} from "../types.js";

const SuggestionSchema = z.object({
  docPath: z
    .string()
    .describe("Path to the documentation file that needs updating"),
  reason: z
    .string()
    .describe(
      "Why this documentation needs to be updated based on the code changes"
    ),
  suggestedChanges: z
    .string()
    .describe("Specific suggestions for what to update in the documentation"),
});

const AnalysisResultSchema = z.object({
  suggestions: z
    .array(SuggestionSchema)
    .describe("List of documentation files that need updating"),
  summary: z.string().describe("Brief summary of the analysis results"),
});

const ANALYSIS_PROMPT = `You are a documentation expert. Your task is to analyze code changes and determine which of the provided documentation files need to be updated.

## Style Guide
The project follows this documentation style guide:

{styleguide}

## Relevant Documentation Files
These documentation files were identified as potentially relevant to the code changes:

{docs}

## Code Changes (Git Diff)
{diff}

## Changed Files Summary
{changedFiles}

## Instructions
1. Analyze the code changes carefully
2. For each provided documentation file, determine if it needs updating based on the code changes
3. Consider: API changes, configuration changes, behavior changes, new features that modify existing functionality
4. For each affected doc, explain WHY it needs updating and WHAT should be changed
5. Only suggest updates for docs that are genuinely affected - don't suggest updates just because a file is listed
6. If no documentation needs updating, return an empty suggestions array

Be specific and actionable in your suggestions.`;

/**
 * Analyze code changes and determine which docs need updating
 * Note: docs should be pre-filtered to only include relevant docs (via semantic search)
 */
export async function analyzeChanges(
  diff: string,
  changedFiles: ChangedFile[],
  docs: DocFile[],
  styleguide: string
): Promise<AnalysisResult> {
  if (changedFiles.length === 0) {
    return {
      suggestions: [],
      summary: "No code changes detected.",
    };
  }

  if (docs.length === 0) {
    return {
      suggestions: [],
      summary: "No relevant documentation files found to analyze.",
    };
  }

  // Format docs for the prompt (higher limit since docs are pre-filtered)
  const docsFormatted = docs
    .map(
      (doc) =>
        `### ${doc.path}\n\`\`\`\n${truncateContent(doc.content, 4000)}\n\`\`\``
    )
    .join("\n\n");

  // Format changed files summary
  const changedFilesFormatted = changedFiles
    .map((f) => `- ${f.path} (+${f.additions}, -${f.deletions})`)
    .join("\n");

  // Build the prompt
  const prompt = ANALYSIS_PROMPT.replace(
    "{styleguide}",
    truncateContent(styleguide, 1000)
  )
    .replace("{docs}", docsFormatted)
    .replace("{diff}", truncateContent(diff, 10000))
    .replace("{changedFiles}", changedFilesFormatted);

  const { object } = await generateObject({
    model: openai("gpt-4o-mini"),
    schema: AnalysisResultSchema,
    prompt,
  });

  return {
    suggestions: object.suggestions as DocUpdateSuggestion[],
    summary: object.summary,
  };
}

/**
 * Truncate content to a maximum length (safety measure)
 */
function truncateContent(content: string, maxLength: number): string {
  if (content.length <= maxLength) {
    return content;
  }
  return content.slice(0, maxLength) + "\n\n[... truncated ...]";
}
