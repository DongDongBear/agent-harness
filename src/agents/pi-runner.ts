import { readFile } from 'node:fs/promises';
import type { Result } from '../utils/result.js';
import { ok, err } from '../utils/result.js';
import { spawnAgent, waitForAgent, getAgentOutput } from './process-manager.js';
import type { ProcessError } from './process-manager.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('pi-runner');

const DEFAULT_TIMEOUT = 600_000;

export interface PiRunnerOptions {
  provider: string;
  model: string;
  cwd: string;
  timeout?: number;
}

export interface AgentError {
  code: string;
  message: string;
}

export interface PiRunner {
  run(prompt: string): Promise<Result<string, AgentError>>;
  runWithFile(promptFile: string): Promise<Result<string, AgentError>>;
}

let idCounter = 0;

export function createPiRunner(options: PiRunnerOptions): PiRunner {
  const timeout = options.timeout ?? DEFAULT_TIMEOUT;

  async function run(prompt: string): Promise<Result<string, AgentError>> {
    const id = `pi-${++idCounter}`;
    const args = ['--provider', options.provider, '--model', options.model, '-p', prompt];

    const spawnResult = spawnAgent(
      { id, type: 'pi', command: 'pi', args, cwd: options.cwd },
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
    logger.info(`Pi agent ${id} completed, output length: ${output.stdout.length}`);
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
