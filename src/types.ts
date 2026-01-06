import type { Octokit } from "@octokit/rest";

export interface JanusDocConfig {
  docsPath: string;
  search?: {
    topN?: number;
    threshold?: number;
  };
}

export interface PRInfo {
  number: number;
  title: string;
  baseBranch: string;
  headBranch: string;
  owner: string;
  repo: string;
}

export interface ChangedFile {
  path: string;
  additions: number;
  deletions: number;
  patch?: string;
}

export interface DocFile {
  path: string;
  content: string;
}

export interface DocUpdateSuggestion {
  docPath: string;
  reason: string;
  updatedContent: string;
}

export interface AnalysisResult {
  suggestions: DocUpdateSuggestion[];
  summary: string;
}

export interface RunCommandOptions {
  pr: number;
  repo: string;
  token?: string;
  dryRun?: boolean;
}

export interface InitCommandOptions {
  docsPath?: string;
}

export interface RunContext {
  cwd: string;
  config: JanusDocConfig;
  styleguide: string;
  docMap: string;
}

export interface GitHubContext extends RunContext {
  octokit: Octokit;
  owner: string;
  repo: string;
  prInfo: PRInfo;
}

export interface ChangesContext extends GitHubContext {
  codeFiles: ChangedFile[];
  diff: string;
}

export interface DocsContext extends ChangesContext {
  allDocs: DocFile[];
  absoluteDocsPath: string;
}

export interface RelevantDocsContext extends DocsContext {
  relevantDocs: DocFile[];
}

export interface AnalysisContext extends RelevantDocsContext {
  result: AnalysisResult;
}
