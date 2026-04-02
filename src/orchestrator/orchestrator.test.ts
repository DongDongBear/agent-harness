import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createHarness } from './orchestrator.js';
import { getDefaultConfig } from './config.js';
import { isOk } from '../utils/result.js';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

describe('Orchestrator', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-orch-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('createHarness()', () => {
    it('creates a harness instance', () => {
      const config = getDefaultConfig();
      const harness = createHarness(config, tmpDir);
      expect(harness).toBeDefined();
      expect(typeof harness.run).toBe('function');
    });
  });

  describe('harness.run()', () => {
    it('initializes .harness dir and sets state to planning', async () => {
      const config = getDefaultConfig();
      const harness = createHarness(config, tmpDir);
      const result = await harness.run('Build a cool editor');

      expect(isOk(result)).toBe(true);

      // .harness directory should exist
      expect(fs.existsSync(path.join(tmpDir, '.harness'))).toBe(true);

      // progress.json should exist with planning state
      const progressPath = path.join(tmpDir, '.harness', 'progress.json');
      expect(fs.existsSync(progressPath)).toBe(true);
      const progress = JSON.parse(fs.readFileSync(progressPath, 'utf-8'));
      expect(progress.state).toBe('planning');
    });

    it('stores the prompt as spec', async () => {
      const config = getDefaultConfig();
      const harness = createHarness(config, tmpDir);
      await harness.run('Build a markdown editor');

      const specPath = path.join(tmpDir, '.harness', 'spec.md');
      expect(fs.existsSync(specPath)).toBe(true);
      const spec = fs.readFileSync(specPath, 'utf-8');
      expect(spec).toBe('Build a markdown editor');
    });
  });
});
