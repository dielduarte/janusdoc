import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import {
  loadConfig,
  saveConfig,
  loadStyleguide,
  saveStyleguide,
  configExists,
  getConfigPath,
} from "./config.js";

describe("config", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "janusdoc-test-"));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe("configExists", () => {
    it("returns false when config does not exist", async () => {
      expect(await configExists(tempDir)).toBe(false);
    });

    it("returns true when config exists", async () => {
      await fs.writeFile(getConfigPath(tempDir), "{}");
      expect(await configExists(tempDir)).toBe(true);
    });
  });

  describe("saveConfig / loadConfig", () => {
    it("saves and loads config correctly", async () => {
      const config = { docsPath: "./docs" };

      await saveConfig(config, tempDir);
      const loaded = await loadConfig(tempDir);

      expect(loaded).toEqual(config);
    });

    it("throws when config file is missing", async () => {
      await expect(loadConfig(tempDir)).rejects.toThrow("Run 'janusdoc init' first");
    });

    it("throws when docsPath is missing", async () => {
      await fs.writeFile(getConfigPath(tempDir), "{}");
      await expect(loadConfig(tempDir)).rejects.toThrow("Invalid config: missing docsPath");
    });
  });

  describe("saveStyleguide / loadStyleguide", () => {
    it("saves and loads styleguide correctly", async () => {
      const content = "# Style Guide\n\nUse clear language.";

      await saveStyleguide(content, tempDir);
      const loaded = await loadStyleguide(tempDir);

      expect(loaded).toBe(content);
    });

    it("creates .janusdoc directory if it does not exist", async () => {
      await saveStyleguide("test", tempDir);

      const dirExists = await fs
        .access(path.join(tempDir, ".janusdoc"))
        .then(() => true)
        .catch(() => false);

      expect(dirExists).toBe(true);
    });

    it("throws when styleguide is missing", async () => {
      await expect(loadStyleguide(tempDir)).rejects.toThrow("Run 'janusdoc init' first");
    });
  });
});
