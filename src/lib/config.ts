import fs from "node:fs/promises";
import path from "node:path";
import type { JanusDocConfig } from "../types.js";

const CONFIG_FILE = ".janusdoc.json";
const CONFIG_DIR = ".janusdoc";
const STYLEGUIDE_FILE = "auto_styleguide.md";
const EMBEDDINGS_FILE = "embeddings.json";

/**
 * Get the path to the config file
 */
export function getConfigPath(cwd: string = process.cwd()): string {
  return path.join(cwd, CONFIG_FILE);
}

/**
 * Get the path to the .janusdoc directory
 */
export function getConfigDirPath(cwd: string = process.cwd()): string {
  return path.join(cwd, CONFIG_DIR);
}

/**
 * Get the path to the auto-generated styleguide
 */
export function getStyleguidePath(cwd: string = process.cwd()): string {
  return path.join(cwd, CONFIG_DIR, STYLEGUIDE_FILE);
}

/**
 * Get the path to the embeddings file
 */
export function getEmbeddingsPath(cwd: string = process.cwd()): string {
  return path.join(cwd, CONFIG_DIR, EMBEDDINGS_FILE);
}

/**
 * Check if config exists
 */
export async function configExists(cwd: string = process.cwd()): Promise<boolean> {
  try {
    await fs.access(getConfigPath(cwd));
    return true;
  } catch {
    return false;
  }
}

/**
 * Load the JanusDoc config from .janusdoc.json
 */
export async function loadConfig(cwd: string = process.cwd()): Promise<JanusDocConfig> {
  const configPath = getConfigPath(cwd);

  try {
    const content = await fs.readFile(configPath, "utf-8");
    const config = JSON.parse(content) as JanusDocConfig;

    if (!config.docsPath) {
      throw new Error("Invalid config: missing docsPath");
    }

    return config;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new Error(`Config file not found. Run 'janusdoc init' first.`);
    }
    throw error;
  }
}

/**
 * Save the JanusDoc config to .janusdoc.json
 */
export async function saveConfig(
  config: JanusDocConfig,
  cwd: string = process.cwd(),
): Promise<void> {
  const configPath = getConfigPath(cwd);
  await fs.writeFile(configPath, JSON.stringify(config, null, 2) + "\n", "utf-8");
}

/**
 * Load the auto-generated styleguide
 */
export async function loadStyleguide(cwd: string = process.cwd()): Promise<string> {
  const styleguidePath = getStyleguidePath(cwd);

  try {
    return await fs.readFile(styleguidePath, "utf-8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new Error(`Styleguide not found. Run 'janusdoc init' first.`);
    }
    throw error;
  }
}

/**
 * Save the auto-generated styleguide
 */
export async function saveStyleguide(content: string, cwd: string = process.cwd()): Promise<void> {
  const configDir = getConfigDirPath(cwd);
  const styleguidePath = getStyleguidePath(cwd);

  // Ensure .janusdoc directory exists
  await fs.mkdir(configDir, { recursive: true });

  await fs.writeFile(styleguidePath, content, "utf-8");
}
