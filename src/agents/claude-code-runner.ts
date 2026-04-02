import { readFile } from 'node:fs/promises';
import type { Result } from '../utils/result.js';
import { ok, err } from '../utils/result.js';
import { spawnAgent, waitForAgent, getAgentOutput } from './process-manager.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('claude-code-runner');

const DEFAULT_TIMEOUT = 1_800_000; // 30 min

export interface ClaudeCodeRunnerOptions {
  cwd: string;
  timeout?: number;
}

export interface AgentError {
  code: string;
  message: string;
}

export interface ClaudeCodeRunner {
  run(prompt: string): Promise<Result<string, AgentError>>;
  runWithFile(promptFile: string): Promise<Result<string, AgentError>>;
}

let idCounter = 0;

function escapeShellSingleQuote(str: string): string {
  return str.replace(/'/g, "'\\''");
}

export function createClaudeCodeRunner(options: ClaudeCodeRunnerOptions): ClaudeCodeRunner {
  const timeout = options.timeout ?? DEFAULT_TIMEOUT;

  async function run(prompt: string): Promise<Result<string, AgentError>> {
    const id = `cc-${++idCounter}`;
    const escapedPrompt = escapeShellSingleQuote(prompt);
    const suCommand = `cd ${options.cwd} && claude --permission-mode bypassPermissions --print '${escapedPrompt}'`;

    const spawnResult = spawnAgent(
      {
        id,
        type: 'claude-code',
        command: 'su',
        args: ['-', 'claudeuser', '-c', suCommand],
        cwd: options.cwd,
      },
      { timeout },
    );

    if (!spawnResult.ok) {
      return err({ code: spawnResult.error.code, message: spawnResult.error.message });
    }

    const agent = spawnResult.value;
    const waitResult = await waitForAgent(agent);

    if (!waitResult.ok) {
      return err({ code: waitResult.error.code, message: waitResult.error.message });
    }

    const output = getAgentOutput(agent);
    logger.info(`Claude Code agent ${id} completed, output length: ${output.stdout.length}`);
    return ok(output.stdout);
  }

  async function runWithFile(promptFile: string): Promise<Result<string, AgentError>> {
    try {
      const prompt = await readFile(promptFile, 'utf-8');
      return run(prompt);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      logger.error(`Failed to read prompt file ${promptFile}: ${message}`);
      return err({ code: 'FILE_ERROR', message });
    }
  }

  return { run, runWithFile };
}
