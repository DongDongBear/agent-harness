import { describe, it, expect } from 'vitest';
import { ok, err, isOk, isErr } from './result.js';
import type { Result } from './result.js';

describe('Result<T, E>', () => {
  describe('ok()', () => {
    it('creates an Ok result with the given value', () => {
      const result = ok(42);
      expect(result.ok).toBe(true);
      expect(result.value).toBe(42);
    });

    it('works with complex types', () => {
      const result = ok({ name: 'test', count: 3 });
      expect(result.ok).toBe(true);
      expect(result.value).toEqual({ name: 'test', count: 3 });
    });
  });

  describe('err()', () => {
    it('creates an Err result with the given error', () => {
      const result = err('something went wrong');
      expect(result.ok).toBe(false);
      expect(result.error).toBe('something went wrong');
    });

    it('works with Error objects', () => {
      const error = new Error('fail');
      const result = err(error);
      expect(result.ok).toBe(false);
      expect(result.error).toBe(error);
    });
  });

  describe('isOk()', () => {
    it('returns true for Ok results', () => {
      const result: Result<number, string> = ok(42);
      expect(isOk(result)).toBe(true);
    });

    it('returns false for Err results', () => {
      const result: Result<number, string> = err('fail');
      expect(isOk(result)).toBe(false);
    });

    it('narrows the type so value is accessible', () => {
      const result: Result<number, string> = ok(42);
      if (isOk(result)) {
        // TypeScript should allow accessing .value here
        expect(result.value).toBe(42);
      }
    });
  });

  describe('isErr()', () => {
    it('returns true for Err results', () => {
      const result: Result<number, string> = err('fail');
      expect(isErr(result)).toBe(true);
    });

    it('returns false for Ok results', () => {
      const result: Result<number, string> = ok(42);
      expect(isErr(result)).toBe(false);
    });

    it('narrows the type so error is accessible', () => {
      const result: Result<number, string> = err('fail');
      if (isErr(result)) {
        expect(result.error).toBe('fail');
      }
    });
  });
});
