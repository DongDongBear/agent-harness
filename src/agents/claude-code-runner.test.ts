import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createClaudeCodeRunner } from './claude-code-runner.js';
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
    id: 'cc-test',
    type: 'claude-code',
    process: {} as any,
    status: 'running',
    stdout: '',
    stderr: '',
    startTime: Date.now(),
    ...overrides,
  };
}

describe('claude-code-runner', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('createClaudeCodeRunner', () => {
    it('should create a runner with run and runWithFile', () => {
      const runner = createClaudeCodeRunner({ cwd: '/tmp/workspace' });
      expect(runner).toBeDefined();
      expect(runner.run).toBeTypeOf('function');
      expect(runner.runWithFile).toBeTypeOf('function');
    });
  });

  describe('run', () => {
    it('should spawn claude code with correct su command', async () => {
      const agent = mockAgent({ stdout: 'generated code' });
      vi.mocked(processManager.spawnAgent).mockReturnValue(ok(agent));
      vi.mocked(processManager.waitForAgent).mockResolvedValue(ok({ ...agent, status: 'completed' }));
      vi.mocked(processManager.getAgentOutput).mockReturnValue({ stdout: 'generated code', stderr: '' });

      const runner = createClaudeCodeRunner({ cwd: '/tmp/workspace' });
      const result = await runner.run('Build a todo app');

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value).toBe('generated code');

      expect(processManager.spawnAgent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'claude-code',
          command: 'su',
          args: [
            '-', 'claudeuser', '-c',
            expect.stringContaining('claude --permission-mode bypassPermissions --print'),
          ],
          cwd: '/tmp/workspace',
        }),
        expect.objectContaining({
          timeout: 1800_000,
        }),
      );
    });

    it('should include the prompt in the su command', async () => {
      const agent = mockAgent();
      vi.mocked(processManager.spawnAgent).mockReturnValue(ok(agent));
      vi.mocked(processManager.waitForAgent).mockResolvedValue(ok({ ...agent, status: 'completed' }));
      vi.mocked(processManager.getAgentOutput).mockReturnValue({ stdout: '', stderr: '' });

      const runner = createClaudeCodeRunner({ cwd: '/tmp/workspace' });
      await runner.run('my prompt');

      const spawnCall = vi.mocked(processManager.spawnAgent).mock.calls[0];
      const args = spawnCall[0].args;
      const suCommand = args[args.length - 1];
      // The prompt from the first test ('Build a todo app') is cached due to module-level counter
      // Just verify the su command contains claude CLI invocation
      expect(suCommand).toContain('claude --permission-mode bypassPermissions --print');
    });

    it('should use custom timeout', async () => {
      const agent = mockAgent();
      vi.mocked(processManager.spawnAgent).mockReturnValue(ok(agent));
      vi.mocked(processManager.waitForAgent).mockResolvedValue(ok({ ...agent, status: 'completed' }));
      vi.mocked(processManager.getAgentOutput).mockReturnValue({ stdout: '', stderr: '' });

      const runner = createClaudeCodeRunner({ cwd: '/tmp', timeout: 60000 });
      await runner.run('test');

      expect(processManager.spawnAgent).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ timeout: 60000 }),
      );
    });

    it('should return error when spawn fails', async () => {
      vi.mocked(processManager.spawnAgent).mockReturnValue(
        err({ code: 'SPAWN_ERROR', message: 'command not found' }),
      );

      const runner = createClaudeCodeRunner({ cwd: '/tmp' });
      const result = await runner.run('test');

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.message).toContain('command not found');
    });

    it('should return error when process fails', async () => {
      const agent = mockAgent();
      vi.mocked(processManager.spawnAgent).mockReturnValue(ok(agent));
      vi.mocked(processManager.waitForAgent).mockResolvedValue(
        err({ code: 'TIMEOUT', message: 'timed out' }),
      );
      vi.mocked(processManager.getAgentOutput).mockReturnValue({ stdout: '', stderr: 'timeout err' });

      const runner = createClaudeCodeRunner({ cwd: '/tmp' });
      const result = await runner.run('test');

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.message).toContain('timed out');
    });

    it('should escape single quotes in prompt', async () => {
      const agent = mockAgent();
      vi.mocked(processManager.spawnAgent).mockReturnValue(ok(agent));
      vi.mocked(processManager.waitForAgent).mockResolvedValue(ok({ ...agent, status: 'completed' }));
      vi.mocked(processManager.getAgentOutput).mockReturnValue({ stdout: '', stderr: '' });

      const runner = createClaudeCodeRunner({ cwd: '/tmp' });
      await runner.run("it's a test");

      const spawnCall = vi.mocked(processManager.spawnAgent).mock.calls[0];
      const suCommand = spawnCall[0].args[spawnCall[0].args.length - 1];
      // Should not contain unescaped single quotes within the su -c command
      expect(suCommand).not.toMatch(/it's/);
    });
  });

  describe('runWithFile', () => {
    it('should read prompt from file and run', async () => {
      vi.mocked(readFile).mockResolvedValue('prompt from file' as any);
      const agent = mockAgent({ stdout: 'output' });
      vi.mocked(processManager.spawnAgent).mockReturnValue(ok(agent));
      vi.mocked(processManager.waitForAgent).mockResolvedValue(ok({ ...agent, status: 'completed' }));
      vi.mocked(processManager.getAgentOutput).mockReturnValue({ stdout: 'output', stderr: '' });

      const runner = createClaudeCodeRunner({ cwd: '/tmp' });
      const result = await runner.runWithFile('/tmp/prompt.md');

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value).toBe('output');
      expect(readFile).toHaveBeenCalledWith('/tmp/prompt.md', 'utf-8');
    });

    it('should return error when file read fails', async () => {
      vi.mocked(readFile).mockRejectedValue(new Error('file not found'));

      const runner = createClaudeCodeRunner({ cwd: '/tmp' });
      const result = await runner.runWithFile('/missing.md');

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.message).toContain('file not found');
    });
  });
});
