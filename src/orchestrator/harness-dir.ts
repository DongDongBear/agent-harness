import * as fs from 'node:fs';
import * as path from 'node:path';
import { ok, err } from '../utils/result.js';
import type { Result } from '../utils/result.js';
import type { HarnessProgress } from './state.js';

export interface HarnessDir {
  basePath: string;
}

export function initHarnessDir(projectPath: string): Result<HarnessDir, Error> {
  const basePath = path.join(projectPath, '.harness');

  try {
    fs.mkdirSync(basePath, { recursive: true });
    fs.mkdirSync(path.join(basePath, 'sprints'), { recursive: true });
    fs.mkdirSync(path.join(basePath, 'reports'), { recursive: true });
    fs.mkdirSync(path.join(basePath, 'workspace'), { recursive: true });
  } catch (e) {
    return err(e instanceof Error ? e : new Error(String(e)));
  }

  return ok({ basePath });
}

export function readProgress(dir: HarnessDir): Result<HarnessProgress, Error> {
  const filePath = path.join(dir.basePath, 'progress.json');
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    return ok(JSON.parse(raw) as HarnessProgress);
  } catch (e) {
    return err(e instanceof Error ? e : new Error(String(e)));
  }
}

export function writeProgress(dir: HarnessDir, progress: HarnessProgress): Result<void, Error> {
  const filePath = path.join(dir.basePath, 'progress.json');
  try {
    fs.writeFileSync(filePath, JSON.stringify(progress, null, 2));
    return ok(undefined);
  } catch (e) {
    return err(e instanceof Error ? e : new Error(String(e)));
  }
}

export function getSprintDir(dir: HarnessDir, sprintNumber: number): string {
  return path.join(dir.basePath, 'sprints', `sprint-${sprintNumber}`);
}

export function writeSpec(dir: HarnessDir, spec: string): Result<void, Error> {
  const filePath = path.join(dir.basePath, 'spec.md');
  try {
    fs.writeFileSync(filePath, spec);
    return ok(undefined);
  } catch (e) {
    return err(e instanceof Error ? e : new Error(String(e)));
  }
}

export function readSpec(dir: HarnessDir): Result<string, Error> {
  const filePath = path.join(dir.basePath, 'spec.md');
  try {
    return ok(fs.readFileSync(filePath, 'utf-8'));
  } catch (e) {
    return err(e instanceof Error ? e : new Error(String(e)));
  }
}
