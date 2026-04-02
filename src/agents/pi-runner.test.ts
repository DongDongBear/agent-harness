import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createPiRunner } from './pi-runner.js';
import * as processManager from './process-manager.js';
import { ok, err } from '../utils/result.js';
import type { AgentProcess } from './process-manager.js';
import { readFile } from 'node:fs/promises';

vi.mock('./process-manager.js', () => ({
  spawnAgent: vi.fn(),
  waitForAgent: vi.fn(),
  getAgentOutput: vi.fn(),
}));

vi.mock('node:fs/promises', () => ({
  readFile: vi.fn(),
}));

function mockAgent(overrides: Partial<AgentProcess> = {}): AgentProcess {
  return {
    id: 'pi-test',
    type: 'pi',
    process: {} as any,
    status: 'running',
    stdout: '',
    stderr: '',
    startTime: Date.now(),
    ...overrides,
  };
}

describe('pi-runner', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('createPiRunner', () => {
    it('should create a runner with the correct options', () => {
      const runner = createPiRunner({
        provider: 'anthropic',
        model: 'claude-sonnet-4-6',
        cwd: '/tmp/test',
      });
      expect(runner).toBeDefined();
      expect(runner.run).toBeTypeOf('function');
      expect(runner.runWithFile).toBeTypeOf('function');
    });
  });

  describe('run', () => {
    it('should spawn pi with correct arguments', async () => {
      const agent = mockAgent({ stdout: 'output text' });
      vi.mocked(processManager.spawnAgent).mockReturnValue(ok(agent));
      vi.mocked(processManager.waitForAgent).mockResolvedValue(ok({ ...agent, status: 'completed' }));
      vi.mocked(processManager.getAgentOutput).mockReturnValue({ stdout: 'output text', stderr: '' });

      const runner = createPiRunner({
        provider: 'anthropic',
        model: 'claude-sonnet-4-6',
        cwd: '/tmp/test',
        timeout: 30000,
      });

      const result = await runner.run('Hello world');

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value).toBe('output text');

      expect(processManager.spawnAgent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'pi',
          command: 'pi',
          args: ['--provider', 'anthropic', '--model', 'claude-sonnet-4-6', '-p', 'Hello world'],
          cwd: '/tmp/test',
        }),
        expect.objectContaining({
          timeout: 30000,
        }),
      );
    });

    it('should return error when spawn fails', async () => {
      vi.mocked(processManager.spawnAgent).mockReturnValue(
        err({ code: 'SPAWN_ERROR', message: 'not found' }),
      );

      const runner = createPiRunner({
        provider: 'openai',
        model: 'gpt-4',
        cwd: '/tmp',
      });

      const result = await runner.run('test');
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.message).toContain('not found');
    });

    it('should return error when process fails', async () => {
      const agent = mockAgent();
      vi.mocked(processManager.spawnAgent).mockReturnValue(ok(agent));
      vi.mocked(processManager.waitForAgent).mockResolvedValue(
        err({ code: 'EXIT_ERROR', message: 'exit code 1' }),
      );
      vi.mocked(processManager.getAgentOutput).mockReturnValue({ stdout: '', stderr: 'error output' });

      const runner = createPiRunner({
        provider: 'anthropic',
        model: 'claude-sonnet-4-6',
        cwd: '/tmp',
      });

      const result = await runner.run('test');
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.message).toContain('exit code 1');
    });
  });

  describe('runWithFile', () => {
    it('should read file and pass content as prompt', async () => {
      vi.mocked(readFile).mockResolvedValue('prompt from file' as any);
      const agent = mockAgent({ stdout: 'file output' });
      vi.mocked(processManager.spawnAgent).mockReturnValue(ok(agent));
      vi.mocked(processManager.waitForAgent).mockResolvedValue(ok({ ...agent, status: 'completed' }));
      vi.mocked(processManager.getAgentOutput).mockReturnValue({ stdout: 'file output', stderr: '' });

      const runner = createPiRunner({
        provider: 'google',
        model: 'gemini-pro',
        cwd: '/tmp',
      });

      const result = await runner.runWithFile('/tmp/prompt.md');
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value).toBe('file output');
      expect(readFile).toHaveBeenCalledWith('/tmp/prompt.md', 'utf-8');
    });

    it('should return error when file read fails', async () => {
      vi.mocked(readFile).mockRejectedValue(new Error('ENOENT'));

      const runner = createPiRunner({
        provider: 'anthropic',
        model: 'claude-sonnet-4-6',
        cwd: '/tmp',
      });

      const result = await runner.runWithFile('/nonexistent/file.md');
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.message).toContain('ENOENT');
    });
  });
});
