import type { HarnessConfig } from './config.js';
import type { Result } from '../utils/result.js';
import type { HarnessProgress } from './state.js';
import { ok, err, isErr } from '../utils/result.js';
import { initHarnessDir, writeProgress, writeSpec } from './harness-dir.js';
import { createStateMachine } from './state.js';

export interface Harness {
  run(prompt: string): Promise<Result<void, Error>>;
}

export function createHarness(config: HarnessConfig, basePath: string): Harness {
  return {
    async run(prompt: string): Promise<Result<void, Error>> {
      const dirResult = initHarnessDir(basePath);
      if (isErr(dirResult)) return err(dirResult.error);
      const dir = dirResult.value;

      const sm = createStateMachine();
      const transResult = sm.transition('idle', 'planning');
      if (isErr(transResult)) return err(new Error(transResult.error));

      const progress: HarnessProgress = {
        currentSprint: 0,
        totalSprints: config.orchestrator.maxSprints,
        sprintAttempt: 0,
        state: 'planning',
        history: [
          { from: 'idle', to: 'planning', timestamp: new Date().toISOString() },
        ],
      };

      const writeProgressResult = writeProgress(dir, progress);
      if (isErr(writeProgressResult)) return err(writeProgressResult.error);

      const writeSpecResult = writeSpec(dir, prompt);
      if (isErr(writeSpecResult)) return err(writeSpecResult.error);

      return ok(undefined);
    },
  };
}
