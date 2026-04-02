import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { spawnAgent, killAgent, waitForAgent, getAgentOutput } from './process-manager.js';
import { EventEmitter } from 'node:events';
import type { ChildProcess } from 'node:child_process';
import * as child_process from 'node:child_process';

vi.mock('node:child_process', () => ({
  spawn: vi.fn(),
}));

function createMockProcess(): ChildProcess {
  const proc = new EventEmitter() as ChildProcess;
  (proc as any).stdout = new EventEmitter();
  (proc as any).stderr = new EventEmitter();
  (proc as any).pid = 12345;
  (proc as any).kill = vi.fn(() => true);
  return proc;
}

describe('process-manager', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('spawnAgent', () => {
    it('should spawn a process and return an AgentProcess', () => {
      const mockProc = createMockProcess();
      vi.mocked(child_process.spawn).mockReturnValue(mockProc);

      const result = spawnAgent({
        id: 'test-1',
        type: 'pi',
        command: 'pi',
        args: ['--provider', 'anthropic'],
        cwd: '/tmp/test',
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.id).toBe('test-1');
      expect(result.value.type).toBe('pi');
      expect(result.value.status).toBe('running');
      expect(result.value.stdout).toBe('');
      expect(result.value.stderr).toBe('');
      expect(child_process.spawn).toHaveBeenCalledWith('pi', ['--provider', 'anthropic'], {
        cwd: '/tmp/test',
        env: expect.any(Object),
        stdio: ['ignore', 'pipe', 'pipe'],
      });
    });

    it('should pass extra env vars merged with process.env', () => {
      const mockProc = createMockProcess();
      vi.mocked(child_process.spawn).mockReturnValue(mockProc);

      spawnAgent({
        id: 'test-2',
        type: 'pi',
        command: 'pi',
        args: [],
        cwd: '/tmp',
        env: { MY_VAR: 'hello' },
      });

      const lastCall = vi.mocked(child_process.spawn).mock.lastCall;
      expect(lastCall?.[2]?.env?.MY_VAR).toBe('hello');
    });

    it('should return error if spawn throws', () => {
      vi.mocked(child_process.spawn).mockImplementation(() => {
        throw new Error('spawn failed');
      });

      const result = spawnAgent({
        id: 'test-3',
        type: 'pi',
        command: 'nonexistent',
        args: [],
        cwd: '/tmp',
      });

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.message).toContain('spawn failed');
    });

    it('should capture stdout data', () => {
      const mockProc = createMockProcess();
      vi.mocked(child_process.spawn).mockReturnValue(mockProc);

      const result = spawnAgent({
        id: 'test-4',
        type: 'claude-code',
        command: 'claude',
        args: [],
        cwd: '/tmp',
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      mockProc.stdout!.emit('data', Buffer.from('hello '));
      mockProc.stdout!.emit('data', Buffer.from('world'));

      const output = getAgentOutput(result.value);
      expect(output.stdout).toBe('hello world');
    });

    it('should capture stderr data', () => {
      const mockProc = createMockProcess();
      vi.mocked(child_process.spawn).mockReturnValue(mockProc);

      const result = spawnAgent({
        id: 'test-5',
        type: 'pi',
        command: 'pi',
        args: [],
        cwd: '/tmp',
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      mockProc.stderr!.emit('data', Buffer.from('warning'));

      const output = getAgentOutput(result.value);
      expect(output.stderr).toBe('warning');
    });

    it('should invoke onStdout and onStderr callbacks', () => {
      const mockProc = createMockProcess();
      vi.mocked(child_process.spawn).mockReturnValue(mockProc);
      const onStdout = vi.fn();
      const onStderr = vi.fn();

      const result = spawnAgent(
        { id: 'test-6', type: 'pi', command: 'pi', args: [], cwd: '/tmp' },
        { onStdout, onStderr },
      );

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      mockProc.stdout!.emit('data', Buffer.from('out'));
      mockProc.stderr!.emit('data', Buffer.from('err'));

      expect(onStdout).toHaveBeenCalledWith('out');
      expect(onStderr).toHaveBeenCalledWith('err');
    });

    it('should truncate output when exceeding maxOutputSize', () => {
      const mockProc = createMockProcess();
      vi.mocked(child_process.spawn).mockReturnValue(mockProc);

      const result = spawnAgent(
        { id: 'test-7', type: 'pi', command: 'pi', args: [], cwd: '/tmp' },
        { maxOutputSize: 10 },
      );

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      mockProc.stdout!.emit('data', Buffer.from('a'.repeat(20)));

      const output = getAgentOutput(result.value);
      expect(output.stdout.length).toBeLessThanOrEqual(10);
    });
  });

  describe('killAgent', () => {
    it('should kill a running process', () => {
      const mockProc = createMockProcess();
      vi.mocked(child_process.spawn).mockReturnValue(mockProc);

      const spawnResult = spawnAgent({
        id: 'kill-1',
        type: 'pi',
        command: 'pi',
        args: [],
        cwd: '/tmp',
      });

      expect(spawnResult.ok).toBe(true);
      if (!spawnResult.ok) return;

      const killResult = killAgent(spawnResult.value);
      expect(killResult.ok).toBe(true);
      expect(mockProc.kill).toHaveBeenCalledWith('SIGTERM');
      expect(spawnResult.value.status).toBe('killed');
    });

    it('should return error when killing a non-running process', () => {
      const mockProc = createMockProcess();
      vi.mocked(child_process.spawn).mockReturnValue(mockProc);

      const spawnResult = spawnAgent({
        id: 'kill-2',
        type: 'pi',
        command: 'pi',
        args: [],
        cwd: '/tmp',
      });

      expect(spawnResult.ok).toBe(true);
      if (!spawnResult.ok) return;

      spawnResult.value.status = 'completed';

      const killResult = killAgent(spawnResult.value);
      expect(killResult.ok).toBe(false);
    });
  });

  describe('waitForAgent', () => {
    it('should resolve when process exits with code 0', async () => {
      const mockProc = createMockProcess();
      vi.mocked(child_process.spawn).mockReturnValue(mockProc);

      const spawnResult = spawnAgent({
        id: 'wait-1',
        type: 'pi',
        command: 'pi',
        args: [],
        cwd: '/tmp',
      });

      expect(spawnResult.ok).toBe(true);
      if (!spawnResult.ok) return;

      const waitPromise = waitForAgent(spawnResult.value);
      mockProc.emit('close', 0, null);

      const result = await waitPromise;
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.status).toBe('completed');
      expect(result.value.endTime).toBeDefined();
    });

    it('should resolve with failed status on non-zero exit', async () => {
      const mockProc = createMockProcess();
      vi.mocked(child_process.spawn).mockReturnValue(mockProc);

      const spawnResult = spawnAgent({
        id: 'wait-2',
        type: 'pi',
        command: 'pi',
        args: [],
        cwd: '/tmp',
      });

      expect(spawnResult.ok).toBe(true);
      if (!spawnResult.ok) return;

      const waitPromise = waitForAgent(spawnResult.value);
      mockProc.emit('close', 1, null);

      const result = await waitPromise;
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.message).toContain('exit code 1');
    });

    it('should resolve with failed status on signal kill', async () => {
      const mockProc = createMockProcess();
      vi.mocked(child_process.spawn).mockReturnValue(mockProc);

      const spawnResult = spawnAgent({
        id: 'wait-3',
        type: 'pi',
        command: 'pi',
        args: [],
        cwd: '/tmp',
      });

      expect(spawnResult.ok).toBe(true);
      if (!spawnResult.ok) return;

      const waitPromise = waitForAgent(spawnResult.value);
      mockProc.emit('close', null, 'SIGKILL');

      const result = await waitPromise;
      expect(result.ok).toBe(false);
    });

    it('should timeout and kill the process', async () => {
      const mockProc = createMockProcess();
      vi.mocked(child_process.spawn).mockReturnValue(mockProc);

      const spawnResult = spawnAgent(
        { id: 'wait-4', type: 'pi', command: 'pi', args: [], cwd: '/tmp' },
        { timeout: 5000 },
      );

      expect(spawnResult.ok).toBe(true);
      if (!spawnResult.ok) return;

      const waitPromise = waitForAgent(spawnResult.value);

      vi.advanceTimersByTime(5001);
      // Simulate the process closing after kill
      mockProc.emit('close', null, 'SIGTERM');

      const result = await waitPromise;
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.code).toBe('TIMEOUT');
      expect(spawnResult.value.status).toBe('timeout');
    });

    it('should invoke onExit callback', async () => {
      const mockProc = createMockProcess();
      vi.mocked(child_process.spawn).mockReturnValue(mockProc);
      const onExit = vi.fn();

      const spawnResult = spawnAgent(
        { id: 'wait-5', type: 'pi', command: 'pi', args: [], cwd: '/tmp' },
        { onExit },
      );

      expect(spawnResult.ok).toBe(true);
      if (!spawnResult.ok) return;

      const waitPromise = waitForAgent(spawnResult.value);
      mockProc.emit('close', 0, null);

      await waitPromise;
      expect(onExit).toHaveBeenCalledWith(0, null);
    });
  });

  describe('getAgentOutput', () => {
    it('should return current stdout and stderr', () => {
      const mockProc = createMockProcess();
      vi.mocked(child_process.spawn).mockReturnValue(mockProc);

      const result = spawnAgent({
        id: 'output-1',
        type: 'pi',
        command: 'pi',
        args: [],
        cwd: '/tmp',
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      mockProc.stdout!.emit('data', Buffer.from('hello'));
      mockProc.stderr!.emit('data', Buffer.from('warn'));

      const output = getAgentOutput(result.value);
      expect(output).toEqual({ stdout: 'hello', stderr: 'warn' });
    });
  });
});
