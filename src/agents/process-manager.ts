import { spawn } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import type { Result } from '../utils/result.js';
import { ok, err } from '../utils/result.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('process-manager');

export interface AgentProcess {
  id: string;
  type: 'pi' | 'claude-code';
  process: ChildProcess;
  status: 'running' | 'completed' | 'failed' | 'timeout' | 'killed';
  stdout: string;
  stderr: string;
  startTime: number;
  endTime?: number;
}

export interface ProcessManagerOptions {
  timeout?: number;
  maxOutputSize?: number;
  onStdout?: (data: string) => void;
  onStderr?: (data: string) => void;
  onExit?: (code: number | null, signal: string | null) => void;
}

export interface SpawnAgentOptions {
  id: string;
  type: 'pi' | 'claude-code';
  command: string;
  args: string[];
  cwd: string;
  env?: Record<string, string>;
  timeout?: number;
}

export interface ProcessError {
  code: string;
  message: string;
}

const DEFAULT_TIMEOUT = 600_000;
const DEFAULT_MAX_OUTPUT_SIZE = 10 * 1024 * 1024; // 10MB

export function spawnAgent(
  opts: SpawnAgentOptions,
  managerOpts: ProcessManagerOptions = {},
): Result<AgentProcess, ProcessError> {
  const maxOutputSize = managerOpts.maxOutputSize ?? DEFAULT_MAX_OUTPUT_SIZE;

  try {
    const childProc = spawn(opts.command, opts.args, {
      cwd: opts.cwd,
      env: { ...process.env, ...opts.env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    const agent: AgentProcess = {
      id: opts.id,
      type: opts.type,
      process: childProc,
      status: 'running',
      stdout: '',
      stderr: '',
      startTime: Date.now(),
    };

    // Store timeout and options on the agent for waitForAgent to use
    (agent as any)._timeout = opts.timeout ?? managerOpts.timeout ?? DEFAULT_TIMEOUT;
    (agent as any)._options = managerOpts;

    childProc.stdout!.on('data', (data: Buffer) => {
      const str = data.toString();
      if (agent.stdout.length < maxOutputSize) {
        agent.stdout += str.slice(0, maxOutputSize - agent.stdout.length);
      }
      managerOpts.onStdout?.(str);
    });

    childProc.stderr!.on('data', (data: Buffer) => {
      const str = data.toString();
      if (agent.stderr.length < maxOutputSize) {
        agent.stderr += str.slice(0, maxOutputSize - agent.stderr.length);
      }
      managerOpts.onStderr?.(str);
    });

    logger.info(`Spawned agent ${opts.id} (${opts.type}): ${opts.command} ${opts.args.join(' ')}`);
    return ok(agent);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    logger.error(`Failed to spawn agent ${opts.id}: ${message}`);
    return err({ code: 'SPAWN_ERROR', message });
  }
}

export function killAgent(agent: AgentProcess): Result<void, ProcessError> {
  if (agent.status !== 'running') {
    return err({
      code: 'INVALID_STATE',
      message: `Cannot kill agent ${agent.id}: status is ${agent.status}`,
    });
  }

  agent.process.kill('SIGTERM');
  agent.status = 'killed';
  agent.endTime = Date.now();
  logger.info(`Killed agent ${agent.id}`);
  return ok(undefined);
}

export function waitForAgent(agent: AgentProcess): Promise<Result<AgentProcess, ProcessError>> {
  const timeout = (agent as any)._timeout ?? DEFAULT_TIMEOUT;
  const options: ProcessManagerOptions = (agent as any)._options ?? {};

  return new Promise((resolve) => {
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      agent.status = 'timeout';
      agent.endTime = Date.now();
      agent.process.kill('SIGTERM');
      logger.warn(`Agent ${agent.id} timed out after ${timeout}ms`);
    }, timeout);

    agent.process.on('close', (code: number | null, signal: string | null) => {
      clearTimeout(timer);
      options.onExit?.(code, signal);

      if (timedOut) {
        resolve(err({ code: 'TIMEOUT', message: `Agent ${agent.id} timed out after ${timeout}ms` }));
        return;
      }

      agent.endTime = Date.now();

      if (code === 0) {
        agent.status = 'completed';
        logger.info(`Agent ${agent.id} completed successfully`);
        resolve(ok(agent));
      } else {
        agent.status = 'failed';
        const msg = signal
          ? `Agent ${agent.id} killed by signal ${signal}`
          : `Agent ${agent.id} exited with exit code ${code}`;
        logger.error(msg);
        resolve(err({ code: 'EXIT_ERROR', message: msg }));
      }
    });
  });
}

export function getAgentOutput(agent: AgentProcess): { stdout: string; stderr: string } {
  return { stdout: agent.stdout, stderr: agent.stderr };
}
