import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadConfig, getDefaultConfig } from './config.js';
import type { HarnessConfig } from './config.js';
import { isOk, isErr } from '../utils/result.js';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

describe('Config', () => {
  describe('getDefaultConfig()', () => {
    it('returns a valid default config', () => {
      const config = getDefaultConfig();
      expect(config.planner.provider).toBe('anthropic');
      expect(config.planner.model).toBe('claude-sonnet-4-6');
      expect(config.evaluator.provider).toBe('anthropic');
      expect(config.evaluator.model).toBe('claude-sonnet-4-6');
      expect(config.evaluator.scoringThresholds.passThreshold).toBe(7.0);
      expect(config.evaluator.scoringThresholds.dimensionFloor).toBe(5.0);
      expect(config.evaluator.maxRetries).toBe(3);
      expect(config.orchestrator.maxSprints).toBe(15);
      expect(config.orchestrator.autoCommit).toBe(true);
      expect(config.orchestrator.resumable).toBe(true);
    });

    it('has an empty generator object', () => {
      const config = getDefaultConfig();
      expect(config.generator).toEqual({});
    });
  });

  describe('loadConfig()', () => {
    let tmpDir: string;

    beforeEach(() => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-config-test-'));
    });

    afterEach(() => {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it('returns default config when no path given', () => {
      const result = loadConfig();
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value).toEqual(getDefaultConfig());
      }
    });

    it('loads a valid config from a JSON file', () => {
      const configPath = path.join(tmpDir, 'config.json');
      const customConfig: HarnessConfig = {
        planner: { provider: 'openai', model: 'gpt-4o' },
        generator: {},
        evaluator: {
          provider: 'anthropic',
          model: 'claude-sonnet-4-6',
          scoringThresholds: { passThreshold: 8.0, dimensionFloor: 6.0 },
          maxRetries: 5,
        },
        orchestrator: {
          maxSprints: 10,
          autoCommit: false,
          resumable: true,
        },
      };
      fs.writeFileSync(configPath, JSON.stringify(customConfig));

      const result = loadConfig(configPath);
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.planner.provider).toBe('openai');
        expect(result.value.evaluator.maxRetries).toBe(5);
        expect(result.value.orchestrator.autoCommit).toBe(false);
      }
    });

    it('returns an error for non-existent file', () => {
      const result = loadConfig('/nonexistent/config.json');
      expect(isErr(result)).toBe(true);
    });

    it('returns an error for invalid JSON', () => {
      const configPath = path.join(tmpDir, 'bad.json');
      fs.writeFileSync(configPath, 'not json!!!');
      const result = loadConfig(configPath);
      expect(isErr(result)).toBe(true);
    });

    it('returns an error for invalid config shape', () => {
      const configPath = path.join(tmpDir, 'invalid.json');
      fs.writeFileSync(configPath, JSON.stringify({ planner: 'not an object' }));
      const result = loadConfig(configPath);
      expect(isErr(result)).toBe(true);
    });
  });
});
