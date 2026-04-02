import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  initHarnessDir,
  readProgress,
  writeProgress,
  getSprintDir,
  writeSpec,
  readSpec,
} from './harness-dir.js';
import type { HarnessProgress } from './state.js';
import { isOk, isErr } from '../utils/result.js';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

describe('Harness Directory', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-dir-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('initHarnessDir()', () => {
    it('creates the .harness directory structure', () => {
      const result = initHarnessDir(tmpDir);
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        const harnessPath = path.join(tmpDir, '.harness');
        expect(fs.existsSync(harnessPath)).toBe(true);
        expect(fs.existsSync(path.join(harnessPath, 'sprints'))).toBe(true);
        expect(fs.existsSync(path.join(harnessPath, 'reports'))).toBe(true);
        expect(fs.existsSync(path.join(harnessPath, 'workspace'))).toBe(true);
      }
    });

    it('returns a HarnessDir handle', () => {
      const result = initHarnessDir(tmpDir);
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.basePath).toBe(path.join(tmpDir, '.harness'));
      }
    });

    it('is idempotent — can be called again on existing dir', () => {
      initHarnessDir(tmpDir);
      const result = initHarnessDir(tmpDir);
      expect(isOk(result)).toBe(true);
    });
  });

  describe('readProgress() / writeProgress()', () => {
    it('writes and reads back progress', () => {
      const dirResult = initHarnessDir(tmpDir);
      expect(isOk(dirResult)).toBe(true);
      if (!isOk(dirResult)) return;
      const dir = dirResult.value;

      const progress: HarnessProgress = {
        currentSprint: 2,
        totalSprints: 8,
        sprintAttempt: 1,
        state: 'generating',
        history: [
          { from: 'idle', to: 'planning', timestamp: '2026-01-01T00:00:00Z' },
          { from: 'planning', to: 'contracting', timestamp: '2026-01-01T00:01:00Z' },
        ],
      };

      const writeResult = writeProgress(dir, progress);
      expect(isOk(writeResult)).toBe(true);

      const readResult = readProgress(dir);
      expect(isOk(readResult)).toBe(true);
      if (isOk(readResult)) {
        expect(readResult.value.currentSprint).toBe(2);
        expect(readResult.value.state).toBe('generating');
        expect(readResult.value.history).toHaveLength(2);
      }
    });

    it('returns error when no progress file exists', () => {
      const dirResult = initHarnessDir(tmpDir);
      expect(isOk(dirResult)).toBe(true);
      if (!isOk(dirResult)) return;

      const result = readProgress(dirResult.value);
      expect(isErr(result)).toBe(true);
    });
  });

  describe('getSprintDir()', () => {
    it('returns the correct sprint directory path', () => {
      const dirResult = initHarnessDir(tmpDir);
      expect(isOk(dirResult)).toBe(true);
      if (!isOk(dirResult)) return;

      const sprintPath = getSprintDir(dirResult.value, 3);
      expect(sprintPath).toBe(path.join(tmpDir, '.harness', 'sprints', 'sprint-3'));
    });
  });

  describe('writeSpec() / readSpec()', () => {
    it('writes and reads spec content', () => {
      const dirResult = initHarnessDir(tmpDir);
      expect(isOk(dirResult)).toBe(true);
      if (!isOk(dirResult)) return;
      const dir = dirResult.value;

      const specContent = '# My App\n\nA cool editor app.';
      const writeResult = writeSpec(dir, specContent);
      expect(isOk(writeResult)).toBe(true);

      const readResult = readSpec(dir);
      expect(isOk(readResult)).toBe(true);
      if (isOk(readResult)) {
        expect(readResult.value).toBe(specContent);
      }
    });

    it('returns error when no spec file exists', () => {
      const dirResult = initHarnessDir(tmpDir);
      expect(isOk(dirResult)).toBe(true);
      if (!isOk(dirResult)) return;

      const result = readSpec(dirResult.value);
      expect(isErr(result)).toBe(true);
    });
  });
});
