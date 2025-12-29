import { describe, it, expect } from "vitest";
import { filterCodeFiles, filterDocFiles } from "./git.js";
import type { ChangedFile } from "../types.js";

describe("git utilities", () => {
  describe("filterCodeFiles", () => {
    it("filters to only code files", () => {
      const files: ChangedFile[] = [
        { path: "src/index.ts", additions: 10, deletions: 5 },
        { path: "README.md", additions: 3, deletions: 1 },
        { path: "src/utils.js", additions: 20, deletions: 0 },
        { path: "docs/guide.md", additions: 50, deletions: 10 },
        { path: "config.json", additions: 1, deletions: 1 },
      ];

      const result = filterCodeFiles(files);

      expect(result).toHaveLength(3);
      expect(result.map((f) => f.path)).toEqual(["src/index.ts", "src/utils.js", "config.json"]);
    });

    it("handles various code extensions", () => {
      const files: ChangedFile[] = [
        { path: "app.tsx", additions: 1, deletions: 0 },
        { path: "server.py", additions: 1, deletions: 0 },
        { path: "main.go", additions: 1, deletions: 0 },
        { path: "lib.rs", additions: 1, deletions: 0 },
      ];

      const result = filterCodeFiles(files);
      expect(result).toHaveLength(4);
    });

    it("returns empty array when no code files", () => {
      const files: ChangedFile[] = [
        { path: "README.md", additions: 1, deletions: 0 },
        { path: "CHANGELOG.md", additions: 1, deletions: 0 },
      ];

      const result = filterCodeFiles(files);
      expect(result).toHaveLength(0);
    });
  });

  describe("filterDocFiles", () => {
    it("filters to only documentation files", () => {
      const files: ChangedFile[] = [
        { path: "src/index.ts", additions: 10, deletions: 5 },
        { path: "README.md", additions: 3, deletions: 1 },
        { path: "docs/guide.mdx", additions: 50, deletions: 10 },
        { path: "notes.txt", additions: 5, deletions: 0 },
      ];

      const result = filterDocFiles(files);

      expect(result).toHaveLength(3);
      expect(result.map((f) => f.path)).toEqual(["README.md", "docs/guide.mdx", "notes.txt"]);
    });
  });
});
