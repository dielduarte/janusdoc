import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";

const SUMMARIZE_PROMPT = `You are a technical writer. Summarize the following code changes, then identify what types of documentation might need updates.

Part 1 - Summary (2-3 sentences):
- What functionality was added, modified, or removed
- What user-facing features or behaviors changed

Part 2 - Documentation Impact:
Based on the nature of the changes, list what KINDS of documentation might need updates. Think broadly about:
- Reference documentation (APIs, types, interfaces, commands, components)
- Examples and tutorials
- Configuration and setup
- Conceptual guides
- Any other documentation categories relevant to these specific changes

Be concise but comprehensive about documentation impact.

Code changes:
`;

/**
 * Generate a natural language summary of code changes
 * This summary will be used for semantic search against documentation embeddings
 */
export async function summarizeCodeChanges(diff: string): Promise<string> {
  // Truncate very large diffs to avoid token limits
  const truncatedDiff =
    diff.length > 8000 ? diff.slice(0, 8000) + "\n\n[... diff truncated ...]" : diff;

  const { text } = await generateText({
    model: openai("gpt-4o-mini"),
    prompt: SUMMARIZE_PROMPT + truncatedDiff,
    maxTokens: 400,
  });

  return text.trim();
}
