import { describe, it, expect } from "vitest";
import { parseRepo, formatComment } from "./github.js";
import type { AnalysisResult } from "../types.js";

describe("github utilities", () => {
  describe("parseRepo", () => {
    it("parses owner/repo format correctly", () => {
      const result = parseRepo("owner/repo");
      expect(result).toEqual({ owner: "owner", repo: "repo" });
    });

    it("handles complex repo names", () => {
      const result = parseRepo("my-org/my-complex-repo-name");
      expect(result).toEqual({ owner: "my-org", repo: "my-complex-repo-name" });
    });

    it("throws on invalid format", () => {
      expect(() => parseRepo("invalid")).toThrow("Invalid repository format");
      expect(() => parseRepo("")).toThrow("Invalid repository format");
    });
  });

  describe("formatComment", () => {
    it("returns empty string when no suggestions", () => {
      const result: AnalysisResult = {
        suggestions: [],
        summary: "No updates needed",
      };

      expect(formatComment(result)).toBe("");
    });

    it("formats suggestions correctly", () => {
      const result: AnalysisResult = {
        summary: "Found 1 document that may need updating.",
        suggestions: [
          {
            docPath: "docs/api.md",
            reason: "The API function signature changed",
            updatedContent:
              "# API Reference\n\nThe `getUser` function now accepts an `options` object.",
          },
        ],
      };

      const comment = formatComment(result);

      expect(comment).toContain("## 📚 JanusDoc");
      expect(comment).toContain("docs/api.md");
      expect(comment).toContain("The API function signature changed");
      expect(comment).toContain("# API Reference");
      expect(comment).toContain("<details>");
    });

    it("handles multiple suggestions", () => {
      const result: AnalysisResult = {
        summary: "Found 2 documents that may need updating.",
        suggestions: [
          {
            docPath: "docs/api.md",
            reason: "API changed",
            updatedContent: "# API\n\nUpdated API documentation.",
          },
          {
            docPath: "docs/config.md",
            reason: "Config options changed",
            updatedContent: "# Config\n\nUpdated config documentation.",
          },
        ],
      };

      const comment = formatComment(result);

      expect(comment).toContain("docs/api.md");
      expect(comment).toContain("docs/config.md");
    });
  });
});
