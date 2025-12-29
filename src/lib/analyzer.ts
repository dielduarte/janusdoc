import { generateObject } from "ai";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";
import type { DocFile, ChangedFile, AnalysisResult, DocUpdateSuggestion } from "../types.js";

const SuggestionSchema = z.object({
  docPath: z.string().describe("Path to the documentation file that needs updating"),
  reason: z.string().describe("Brief explanation of why this documentation needs to be updated"),
  updatedContent: z
    .string()
    .describe(
      "The complete updated documentation content. Write the full updated section or document, not just a description of changes.",
    ),
});

const AnalysisResultSchema = z.object({
  suggestions: z.array(SuggestionSchema).describe("List of documentation files that need updating"),
  summary: z.string().describe("Brief summary of the analysis results"),
});

const ANALYSIS_PROMPT = `You are a documentation expert. Your task is to analyze code changes and write updated documentation for any affected files.

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
2. For each documentation file that needs updating based on the code changes:
   - Explain briefly WHY it needs updating
   - Write the ACTUAL UPDATED DOCUMENTATION content (not just a description of what to change)
3. Consider: API changes, configuration changes, behavior changes, new features
4. Follow the style guide when writing the updated content
5. Only suggest updates for docs that are genuinely affected
6. If no documentation needs updating, return an empty suggestions array

IMPORTANT: The "updatedContent" field should contain the actual new/updated documentation text that can be directly used, not a description of what to change.`;

/**
 * Analyze code changes and determine which docs need updating
 * Note: docs should be pre-filtered to only include relevant docs (via semantic search)
 */
export async function analyzeChanges(
  diff: string,
  changedFiles: ChangedFile[],
  docs: DocFile[],
  styleguide: string,
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
    .map((doc) => `### ${doc.path}\n\`\`\`\n${truncateContent(doc.content, 4000)}\n\`\`\``)
    .join("\n\n");

  // Format changed files summary
  const changedFilesFormatted = changedFiles
    .map((f) => `- ${f.path} (+${f.additions}, -${f.deletions})`)
    .join("\n");

  // Build the prompt
  const prompt = ANALYSIS_PROMPT.replace("{styleguide}", truncateContent(styleguide, 1000))
    .replace("{docs}", docsFormatted)
    .replace("{diff}", truncateContent(diff, 10000))
    .replace("{changedFiles}", changedFilesFormatted);

  try {
    const { object } = await generateObject({
      model: openai("gpt-4o-mini"),
      schema: AnalysisResultSchema,
      prompt,
    });

    return {
      suggestions: object.suggestions as DocUpdateSuggestion[],
      summary: object.summary || "Analysis completed.",
    };
  } catch (error: any) {
    // If validation fails, try to extract partial results
    if (error.value && error.value.suggestions) {
      return {
        suggestions: error.value.suggestions as DocUpdateSuggestion[],
        summary: error.value.summary || "Analysis completed with validation errors.",
      };
    }
    throw error;
  }
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
