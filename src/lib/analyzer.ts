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
      "Brief explanation of why this documentation needs to be updated"
    ),
  updatedContent: z
    .string()
    .describe(
      "The complete updated documentation content. Write the full updated section or document, not just a description of changes."
    ),
});

const AnalysisResultSchema = z.object({
  suggestions: z
    .array(SuggestionSchema)
    .describe("List of documentation files that need updating"),
  summary: z.string().describe("Brief summary of the analysis results"),
});

const ANALYSIS_PROMPT = `You are a documentation expert. Your task is to analyze code changes and write updated documentation for any affected files.

## Style Guide
The project follows this documentation style guide:

{styleguide}

## Documentation Map
This describes each documentation file's purpose and when it should be updated:

{docMap}

## Relevant Documentation Files
These documentation files were identified as potentially relevant to the code changes:

{docs}

## Code Changes (Git Diff)
{diff}

## Changed Files Summary
{changedFiles}

## Instructions
1. You may ONLY suggest updates to documentation files listed in "Relevant Documentation Files" above
2. Do NOT invent or suggest files that are not in that list - even if you think they should exist
3. Analyze the code changes - focus ONLY on what USERS will experience differently
4. Ask: "Does this change the PUBLIC API, behavior, or output that users interact with?"
   - If YES → suggest doc updates (only from the provided files)
   - If NO → return EMPTY suggestions array

CRITICAL RULES:
- ONLY suggest files from the "Relevant Documentation Files" section above
- If the public API and behavior remain UNCHANGED, return an EMPTY suggestions array
- Do NOT suggest documenting internal implementation details
- Do NOT invent documentation files that weren't provided to you

5. For changes that DO affect the public API/behavior:
   - IMPORTANT: After identifying files that need updates, you MUST check the Documentation Map for "Related" files
   - For EACH file you suggest, look up its related files in the Documentation Map
   - If a related file is in the "Relevant Documentation Files" list AND would benefit from the same update, you MUST suggest it too
   - Do not stop at just one file - related documentation often needs the same information
6. For each documentation file that needs updating:
   - The docPath MUST match exactly one of the files from "Relevant Documentation Files"
   - Explain briefly WHY it needs updating
   - Write the ACTUAL UPDATED DOCUMENTATION content
7. Follow the style guide when writing the updated content

IMPORTANT: 
- The "updatedContent" field should contain the actual new/updated documentation text that can be directly used, not a description of what to change.
- You MUST always provide a "summary" field with a brief description of your analysis.`;

/**
 * Analyze code changes and determine which docs need updating
 * Note: docs should be pre-filtered to only include relevant docs (via semantic search)
 */
export async function analyzeChanges(
  diff: string,
  changedFiles: ChangedFile[],
  docs: DocFile[],
  styleguide: string,
  docMap: string = ""
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
    .replace(
      "{docMap}",
      docMap ? truncateContent(docMap, 2000) : "No documentation map available."
    )
    .replace("{docs}", docsFormatted)
    .replace("{diff}", truncateContent(diff, 10000))
    .replace("{changedFiles}", changedFilesFormatted);

  // Get valid doc paths for filtering
  const validDocPaths = new Set(docs.map((d) => d.path));

  try {
    const { object } = await generateObject({
      model: openai("gpt-4o-mini"),
      schema: AnalysisResultSchema,
      prompt,
    });

    // Filter out suggestions for files that weren't in the input docs
    const filteredSuggestions = (
      object.suggestions as DocUpdateSuggestion[]
    ).filter((s) => validDocPaths.has(s.docPath));

    return {
      suggestions: filteredSuggestions,
      summary: object.summary || "Analysis completed.",
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    // If validation fails, try to extract partial results
    if (error.value && error.value.suggestions) {
      // Filter out suggestions for files that weren't in the input docs
      const filteredSuggestions = (
        error.value.suggestions as DocUpdateSuggestion[]
      ).filter((s) => validDocPaths.has(s.docPath));

      return {
        suggestions: filteredSuggestions,
        summary: error.value.summary || "Analysis completed.",
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
