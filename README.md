<p align="center">
  <img src="./assets/janusdoc-logo.png" alt="Janusdoc Logo" width="250" />
</p>

# Janusdoc

<p align="center">
  <a href="#installation">Installation</a> •
  <a href="#quick-start">Quick Start</a> •
  <a href="#commands">Commands</a> •
  <a href="#cicd-integration">CI/CD</a> •
  <a href="https://github.com/dielduarte/janusdoc-evals">Evaluation Suite</a>
</p>

AI-powered documentation update suggester for pull requests. JanusDoc analyzes code changes in your PRs and automatically suggests documentation updates based on your project's existing docs and style guide.

## Installation

```bash
npm install -g janusdoc
```

Or use with npx:

```bash
npx janusdoc [command]
```

## Quick Start

1. Initialize JanusDoc in your project:

   ```bash
   janusdoc init
   ```

2. Analyze a pull request:
   ```bash
   janusdoc run --pr 123 --repo owner/repo
   ```

## Commands

### `janusdoc init`

Initialize JanusDoc in your current project. This command will:

- Detect or create your documentation directory
- Generate a `.janusdoc.json` configuration file
- Scan your existing documentation
- Generate an AI-powered style guide based on your docs
- Create embeddings for semantic search

**Options:**

- `-d, --docs-path <path>` - Path to documentation directory (default: auto-detected or "docs")

**Example:**

```bash
janusdoc init
janusdoc init --docs-path documentation
```

**Environment Variables:**

- `OPENAI_API_KEY` - Required for AI-powered features (style guide generation and semantic search)

### `janusdoc run`

Analyze a pull request and suggest documentation updates. Posts a comment on the PR with suggestions if documentation updates are needed.

**Required Options:**

- `-p, --pr <number>` - Pull request number
- `-r, --repo <owner/repo>` - Repository in owner/repo format

**Optional:**

- `-t, --token <token>` - GitHub token (defaults to `GITHUB_TOKEN` environment variable)

**Example:**

```bash
# Using GITHUB_TOKEN from environment
janusdoc run --pr 42 --repo myorg/myproject

# Providing token explicitly
janusdoc run --pr 42 --repo myorg/myproject --token ghp_xxxxx
```

**Environment Variables:**

- `GITHUB_TOKEN` - GitHub personal access token with repo access
- `OPENAI_API_KEY` - Required for AI-powered analysis

## Configuration

After running `janusdoc init`, a `.janusdoc.json` file is created:

```json
{
  "docsPath": "docs"
}
```

JanusDoc also creates a `.janusdoc/` directory containing:

- `auto_styleguide.md` - Auto-generated documentation style guide (can be customized)
- `embeddings.json` - Vector embeddings for semantic search

## How It Works

1. **Initialization**: JanusDoc scans your documentation, learns your style, and creates embeddings for efficient searching
2. **PR Analysis**: When analyzing a PR, JanusDoc:
   - Fetches the code changes from GitHub
   - Summarizes the changes using AI
   - Uses semantic search to find relevant documentation
   - Analyzes whether documentation updates are needed
   - Posts suggestions as a PR comment

## CI/CD Integration

Add JanusDoc to your GitHub Actions workflow:

```yaml
name: Documentation Check
on: [pull_request]

jobs:
  docs-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - uses: actions/setup-node@v4
        with:
          node-version: "20"

      - name: Run JanusDoc
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
        run: |
          npx janusdoc run --pr ${{ github.event.pull_request.number }} --repo ${{ github.repository }}
```

## Requirements

- Node.js 18 or higher
- GitHub personal access token with `repo` scope
- OpenAI API key for AI-powered features

## License

https://osaasy.dev/
