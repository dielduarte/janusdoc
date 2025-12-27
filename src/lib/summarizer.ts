import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";

const SUMMARIZE_PROMPT = `You are a technical writer. Summarize the following code changes in 2-3 sentences of natural language.

Focus on:
- What functionality was added, modified, or removed
- What user-facing features or behaviors changed
- What APIs, configurations, or integrations were affected

Be concise and focus on the conceptual meaning, not the implementation details.

Code changes:
`;

/**
 * Generate a natural language summary of code changes
 * This summary will be used for semantic search against documentation embeddings
 */
export async function summarizeCodeChanges(diff: string): Promise<string> {
  // Truncate very large diffs to avoid token limits
  const truncatedDiff = diff.length > 8000 
    ? diff.slice(0, 8000) + "\n\n[... diff truncated ...]"
    : diff;

  const { text } = await generateText({
    model: openai("gpt-4o-mini"),
    prompt: SUMMARIZE_PROMPT + truncatedDiff,
    maxTokens: 200,
  });

  return text.trim();
}

