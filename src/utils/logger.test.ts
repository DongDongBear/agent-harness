import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createLogger, type LogLevel } from './logger.js';

describe('Logger', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('createLogger()', () => {
    it('creates a logger with a prefix', () => {
      const logger = createLogger('Planner');
      expect(logger).toBeDefined();
      expect(typeof logger.info).toBe('function');
      expect(typeof logger.debug).toBe('function');
      expect(typeof logger.warn).toBe('function');
      expect(typeof logger.error).toBe('function');
    });
  });

  describe('log levels', () => {
    it('logs info messages with prefix', () => {
      const spy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
      const logger = createLogger('Planner', 'info');
      logger.info('starting plan');
      expect(spy).toHaveBeenCalledTimes(1);
      const output = spy.mock.calls[0][0] as string;
      expect(output).toContain('[Planner]');
      expect(output).toContain('starting plan');
    });

    it('logs error messages', () => {
      const spy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
      const logger = createLogger('Generator', 'debug');
      logger.error('something broke');
      const output = spy.mock.calls[0][0] as string;
      expect(output).toContain('[Generator]');
      expect(output).toContain('something broke');
    });

    it('logs warn messages', () => {
      const spy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
      const logger = createLogger('Evaluator', 'debug');
      logger.warn('low score');
      const output = spy.mock.calls[0][0] as string;
      expect(output).toContain('[Evaluator]');
      expect(output).toContain('low score');
    });

    it('respects log level filtering — debug not shown at info level', () => {
      const spy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
      const logger = createLogger('Test', 'info');
      logger.debug('this should not appear');
      expect(spy).not.toHaveBeenCalled();
    });

    it('shows debug messages when level is debug', () => {
      const spy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
      const logger = createLogger('Test', 'debug');
      logger.debug('debugging');
      expect(spy).toHaveBeenCalledTimes(1);
      const output = spy.mock.calls[0][0] as string;
      expect(output).toContain('debugging');
    });

    it('error level only shows errors', () => {
      const spy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
      const logger = createLogger('Test', 'error');
      logger.debug('no');
      logger.info('no');
      logger.warn('no');
      logger.error('yes');
      expect(spy).toHaveBeenCalledTimes(1);
    });

    it('defaults to info level', () => {
      const spy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
      const logger = createLogger('Test');
      logger.debug('hidden');
      logger.info('shown');
      expect(spy).toHaveBeenCalledTimes(1);
    });
  });

  describe('ANSI colors', () => {
    it('uses different colors for different levels', () => {
      const spy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
      const logger = createLogger('Test', 'debug');

      logger.debug('d');
      logger.info('i');
      logger.warn('w');
      logger.error('e');

      const outputs = spy.mock.calls.map(c => c[0] as string);
      // Each should have ANSI escape codes
      for (const out of outputs) {
        expect(out).toMatch(/\x1b\[/);
      }
      // They should be different colors
      const unique = new Set(outputs.map(o => o.slice(0, 10)));
      expect(unique.size).toBeGreaterThan(1);
    });
  });
});
