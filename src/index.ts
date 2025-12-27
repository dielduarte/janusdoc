#!/usr/bin/env node

import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { initCommand } from './commands/init.js';
import { runCommand } from './commands/run.js';

yargs(hideBin(process.argv))
  .scriptName('janusdoc')
  .usage('$0 <command> [options]')
  .command(
    'init',
    'Initialize JanusDoc in the current project',
    (yargs) => {
      return yargs.option('docs-path', {
        alias: 'd',
        type: 'string',
        description: 'Path to documentation directory',
      });
    },
    async (argv) => {
      try {
        await initCommand({
          docsPath: argv.docsPath,
        });
      } catch (error) {
        console.error('\n❌ Error:', (error as Error).message);
        process.exit(1);
      }
    }
  )
  .command(
    'run',
    'Analyze a PR and suggest documentation updates',
    (yargs) => {
      return yargs
        .option('pr', {
          alias: 'p',
          type: 'number',
          description: 'Pull request number',
          demandOption: true,
        })
        .option('repo', {
          alias: 'r',
          type: 'string',
          description: 'Repository in owner/repo format',
          demandOption: true,
        })
        .option('token', {
          alias: 't',
          type: 'string',
          description: 'GitHub token (defaults to GITHUB_TOKEN env var)',
        });
    },
    async (argv) => {
      try {
        await runCommand({
          pr: argv.pr,
          repo: argv.repo,
          token: argv.token,
        });
      } catch (error) {
        console.error('\n❌ Error:', (error as Error).message);
        process.exit(1);
      }
    }
  )
  .demandCommand(1, 'You need to specify a command')
  .strict()
  .help()
  .alias('h', 'help')
  .version()
  .alias('v', 'version')
  .parse();

