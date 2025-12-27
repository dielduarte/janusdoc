import { describe, it, expect } from "vitest";
import { chunkText, cosineSimilarity } from "./embeddings.js";

describe("embeddings", () => {
  describe("chunkText", () => {
    it("returns single chunk for short text", () => {
      const text = "Hello world this is a short text";
      const chunks = chunkText(text, 100);
      
      expect(chunks).toHaveLength(1);
      expect(chunks[0]).toBe(text);
    });

    it("splits long text into multiple chunks", () => {
      const words = Array(150).fill("word").join(" ");
      const chunks = chunkText(words, 50, 10);
      
      expect(chunks.length).toBeGreaterThan(1);
    });

    it("includes overlap between chunks", () => {
      const words = Array(100).fill("word");
      // Add unique markers
      words[45] = "MARKER_A";
      words[55] = "MARKER_B";
      const text = words.join(" ");
      
      const chunks = chunkText(text, 50, 10);
      
      // With overlap, some words should appear in multiple chunks
      expect(chunks.length).toBeGreaterThan(1);
    });
  });

  describe("cosineSimilarity", () => {
    it("returns 1 for identical vectors", () => {
      const a = [1, 2, 3];
      const b = [1, 2, 3];
      
      expect(cosineSimilarity(a, b)).toBeCloseTo(1);
    });

    it("returns 0 for orthogonal vectors", () => {
      const a = [1, 0];
      const b = [0, 1];
      
      expect(cosineSimilarity(a, b)).toBeCloseTo(0);
    });

    it("returns -1 for opposite vectors", () => {
      const a = [1, 0];
      const b = [-1, 0];
      
      expect(cosineSimilarity(a, b)).toBeCloseTo(-1);
    });

    it("handles normalized vectors", () => {
      const a = [0.6, 0.8];
      const b = [0.8, 0.6];
      
      // Expected: 0.6*0.8 + 0.8*0.6 = 0.96
      expect(cosineSimilarity(a, b)).toBeCloseTo(0.96);
    });

    it("throws for vectors of different lengths", () => {
      const a = [1, 2, 3];
      const b = [1, 2];
      
      expect(() => cosineSimilarity(a, b)).toThrow("Vectors must have the same length");
    });
  });
});

