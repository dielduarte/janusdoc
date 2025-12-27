import fs from "node:fs/promises";
import { embed, embedMany } from "ai";
import { openai } from "@ai-sdk/openai";
import { getEmbeddingsPath, getConfigDirPath } from "./config.js";
import type { DocFile } from "../types.js";

const EMBEDDING_MODEL = "text-embedding-3-small";
const CHUNK_SIZE = 500; // ~500 tokens per chunk
const CHUNK_OVERLAP = 50; // Overlap between chunks
const DEFAULT_TOP_N = 5;
const DEFAULT_SIMILARITY_THRESHOLD = 0.5;

/**
 * A chunk of a document with its embedding
 */
export interface DocChunk {
  content: string;
  embedding: number[];
}

/**
 * A document with its chunks and embeddings
 */
export interface EmbeddedDoc {
  path: string;
  chunks: DocChunk[];
}

/**
 * The embeddings storage format
 */
export interface EmbeddingsStore {
  model: string;
  generatedAt: string;
  documents: EmbeddedDoc[];
}

/**
 * A search result with similarity score
 */
export interface SearchResult {
  path: string;
  content: string;
  similarity: number;
}

/**
 * Split text into chunks with overlap
 */
export function chunkText(text: string, chunkSize = CHUNK_SIZE, overlap = CHUNK_OVERLAP): string[] {
  const words = text.split(/\s+/);
  const chunks: string[] = [];
  
  if (words.length <= chunkSize) {
    return [text];
  }
  
  let start = 0;
  while (start < words.length) {
    const end = Math.min(start + chunkSize, words.length);
    const chunk = words.slice(start, end).join(" ");
    chunks.push(chunk);
    
    if (end >= words.length) break;
    start = end - overlap;
  }
  
  return chunks;
}

/**
 * Generate embedding for a single text
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const { embedding } = await embed({
    model: openai.embedding(EMBEDDING_MODEL),
    value: text,
  });
  
  return embedding;
}

/**
 * Generate embeddings for multiple texts
 */
export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  
  const { embeddings } = await embedMany({
    model: openai.embedding(EMBEDDING_MODEL),
    values: texts,
  });
  
  return embeddings;
}

/**
 * Generate embeddings for all documentation files
 */
export async function generateDocEmbeddings(docs: DocFile[]): Promise<EmbeddedDoc[]> {
  const embeddedDocs: EmbeddedDoc[] = [];
  
  for (const doc of docs) {
    const chunks = chunkText(doc.content);
    const embeddings = await generateEmbeddings(chunks);
    
    embeddedDocs.push({
      path: doc.path,
      chunks: chunks.map((content, i) => ({
        content,
        embedding: embeddings[i],
      })),
    });
  }
  
  return embeddedDocs;
}

/**
 * Calculate cosine similarity between two vectors
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error("Vectors must have the same length");
  }
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  
  const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
  
  if (magnitude === 0) return 0;
  
  return dotProduct / magnitude;
}

/**
 * Search for similar documents given a query embedding
 */
export function searchSimilarDocs(
  queryEmbedding: number[],
  embeddedDocs: EmbeddedDoc[],
  topN = DEFAULT_TOP_N,
  threshold = DEFAULT_SIMILARITY_THRESHOLD
): SearchResult[] {
  const results: SearchResult[] = [];
  
  // Calculate similarity for each chunk
  for (const doc of embeddedDocs) {
    for (const chunk of doc.chunks) {
      const similarity = cosineSimilarity(queryEmbedding, chunk.embedding);
      
      if (similarity >= threshold) {
        results.push({
          path: doc.path,
          content: chunk.content,
          similarity,
        });
      }
    }
  }
  
  // Sort by similarity descending
  results.sort((a, b) => b.similarity - a.similarity);
  
  // Deduplicate by path, keeping highest similarity
  const seen = new Set<string>();
  const deduped: SearchResult[] = [];
  
  for (const result of results) {
    if (!seen.has(result.path)) {
      seen.add(result.path);
      deduped.push(result);
    }
  }
  
  return deduped.slice(0, topN);
}

/**
 * Save embeddings to disk
 */
export async function saveEmbeddings(
  embeddedDocs: EmbeddedDoc[],
  cwd: string = process.cwd()
): Promise<void> {
  const configDir = getConfigDirPath(cwd);
  const embeddingsPath = getEmbeddingsPath(cwd);
  
  // Ensure .janusdoc directory exists
  await fs.mkdir(configDir, { recursive: true });
  
  const store: EmbeddingsStore = {
    model: EMBEDDING_MODEL,
    generatedAt: new Date().toISOString(),
    documents: embeddedDocs,
  };
  
  await fs.writeFile(embeddingsPath, JSON.stringify(store), "utf-8");
}

/**
 * Load embeddings from disk
 */
export async function loadEmbeddings(cwd: string = process.cwd()): Promise<EmbeddingsStore> {
  const embeddingsPath = getEmbeddingsPath(cwd);
  
  try {
    const content = await fs.readFile(embeddingsPath, "utf-8");
    return JSON.parse(content) as EmbeddingsStore;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new Error("Embeddings not found. Run 'janusdoc init' first.");
    }
    throw error;
  }
}

/**
 * Check if embeddings exist
 */
export async function embeddingsExist(cwd: string = process.cwd()): Promise<boolean> {
  try {
    await fs.access(getEmbeddingsPath(cwd));
    return true;
  } catch {
    return false;
  }
}

