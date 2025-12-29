import fs from "node:fs/promises";
import path from "node:path";
import type { DocFile } from "../types.js";

const DOC_EXTENSIONS = [".md", ".mdx", ".rst", ".txt"];

/**
 * Check if a file is a documentation file based on its extension
 */
function isDocFile(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  return DOC_EXTENSIONS.includes(ext);
}

/**
 * Recursively scan a directory for documentation files
 */
export async function scanDocsDirectory(docsPath: string): Promise<DocFile[]> {
  const docs: DocFile[] = [];

  async function scan(dir: string): Promise<void> {
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        // Skip hidden directories and node_modules
        if (!entry.name.startsWith(".") && entry.name !== "node_modules") {
          await scan(fullPath);
        }
      } else if (entry.isFile() && isDocFile(entry.name)) {
        const content = await fs.readFile(fullPath, "utf-8");
        docs.push({
          path: path.relative(docsPath, fullPath),
          content,
        });
      }
    }
  }

  try {
    await scan(docsPath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new Error(`Documentation directory not found: ${docsPath}`);
    }
    throw error;
  }

  return docs;
}

/**
 * Get a summary of doc files (for large docs, truncate content)
 */
export function summarizeDocs(docs: DocFile[], maxContentLength = 2000): DocFile[] {
  return docs.map((doc) => ({
    path: doc.path,
    content:
      doc.content.length > maxContentLength
        ? doc.content.slice(0, maxContentLength) + "\n\n[... truncated ...]"
        : doc.content,
  }));
}
