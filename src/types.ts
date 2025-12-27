/**
 * Main configuration stored in .janusdoc.json
 */
export interface JanusDocConfig {
  docsPath: string;
}

/**
 * PR information fetched from GitHub API
 */
export interface PRInfo {
  number: number;
  title: string;
  baseBranch: string;
  headBranch: string;
  owner: string;
  repo: string;
}

/**
 * A changed file from the git diff
 */
export interface ChangedFile {
  path: string;
  additions: number;
  deletions: number;
  patch?: string;
}

/**
 * A documentation file with its content
 */
export interface DocFile {
  path: string;
  content: string;
}

/**
 * A suggestion for a doc that needs updating
 */
export interface DocUpdateSuggestion {
  docPath: string;
  reason: string;
  suggestedChanges: string;
}

/**
 * Result from the AI analyzer
 */
export interface AnalysisResult {
  suggestions: DocUpdateSuggestion[];
  summary: string;
}

/**
 * CLI run command options
 */
export interface RunCommandOptions {
  pr: number;
  repo: string;
  token?: string;
}

/**
 * CLI init command options
 */
export interface InitCommandOptions {
  docsPath?: string;
}
