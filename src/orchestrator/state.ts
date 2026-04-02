import { ok, err } from '../utils/result.js';
import type { Result } from '../utils/result.js';

export type HarnessState =
  | 'idle'
  | 'planning'
  | 'contracting'
  | 'generating'
  | 'evaluating'
  | 'sprint-passed'
  | 'sprint-failed'
  | 'completed'
  | 'error';

export interface StateTransition {
  from: HarnessState;
  to: HarnessState;
  timestamp: string;
}

export interface HarnessProgress {
  currentSprint: number;
  totalSprints: number;
  sprintAttempt: number;
  state: HarnessState;
  history: StateTransition[];
}

const VALID_TRANSITIONS: ReadonlyMap<HarnessState, ReadonlySet<HarnessState>> = new Map([
  ['idle', new Set<HarnessState>(['planning', 'error'])],
  ['planning', new Set<HarnessState>(['contracting', 'error'])],
  ['contracting', new Set<HarnessState>(['generating', 'error'])],
  ['generating', new Set<HarnessState>(['evaluating', 'error'])],
  ['evaluating', new Set<HarnessState>(['sprint-passed', 'sprint-failed', 'error'])],
  ['sprint-passed', new Set<HarnessState>(['contracting', 'completed', 'error'])],
  ['sprint-failed', new Set<HarnessState>(['generating', 'error'])],
  ['completed', new Set<HarnessState>([])],
  ['error', new Set<HarnessState>([])],
]);

export interface StateMachine {
  transition(from: HarnessState, to: HarnessState): Result<HarnessState, string>;
}

export function createStateMachine(): StateMachine {
  return {
    transition(from: HarnessState, to: HarnessState): Result<HarnessState, string> {
      const allowed = VALID_TRANSITIONS.get(from);
      if (!allowed || !allowed.has(to)) {
        return err(`Invalid transition: ${from} → ${to}`);
      }
      return ok(to);
    },
  };
}
