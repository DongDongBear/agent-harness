import { describe, it, expect } from 'vitest';
import {
  createStateMachine,
  type HarnessState,
  type HarnessProgress,
} from './state.js';

describe('State Machine', () => {
  describe('createStateMachine()', () => {
    it('creates a state machine', () => {
      const sm = createStateMachine();
      expect(sm).toBeDefined();
      expect(typeof sm.transition).toBe('function');
    });
  });

  describe('valid transitions', () => {
    const validTransitions: [HarnessState, HarnessState][] = [
      ['idle', 'planning'],
      ['planning', 'contracting'],
      ['contracting', 'generating'],
      ['generating', 'evaluating'],
      ['evaluating', 'sprint-passed'],
      ['evaluating', 'sprint-failed'],
      ['sprint-passed', 'contracting'],
      ['sprint-passed', 'completed'],
      ['sprint-failed', 'generating'],
      ['sprint-failed', 'error'],
    ];

    for (const [from, to] of validTransitions) {
      it(`allows ${from} → ${to}`, () => {
        const sm = createStateMachine();
        const result = sm.transition(from, to);
        expect(result.ok).toBe(true);
      });
    }
  });

  describe('invalid transitions', () => {
    const invalidTransitions: [HarnessState, HarnessState][] = [
      ['idle', 'generating'],
      ['planning', 'evaluating'],
      ['generating', 'completed'],
      ['completed', 'idle'],
      ['evaluating', 'planning'],
    ];

    for (const [from, to] of invalidTransitions) {
      it(`rejects ${from} → ${to}`, () => {
        const sm = createStateMachine();
        const result = sm.transition(from, to);
        expect(result.ok).toBe(false);
      });
    }
  });

  describe('any state can transition to error', () => {
    const states: HarnessState[] = [
      'idle', 'planning', 'contracting', 'generating', 'evaluating',
      'sprint-passed', 'sprint-failed',
    ];

    for (const state of states) {
      it(`${state} → error`, () => {
        const sm = createStateMachine();
        const result = sm.transition(state, 'error');
        expect(result.ok).toBe(true);
      });
    }
  });

  describe('HarnessProgress serialization', () => {
    it('can serialize and deserialize progress', () => {
      const progress: HarnessProgress = {
        currentSprint: 1,
        totalSprints: 5,
        sprintAttempt: 1,
        state: 'planning',
        history: [
          { from: 'idle', to: 'planning', timestamp: new Date().toISOString() },
        ],
      };

      const json = JSON.stringify(progress);
      const parsed: HarnessProgress = JSON.parse(json);

      expect(parsed.currentSprint).toBe(1);
      expect(parsed.totalSprints).toBe(5);
      expect(parsed.state).toBe('planning');
      expect(parsed.history).toHaveLength(1);
      expect(parsed.history[0].from).toBe('idle');
      expect(parsed.history[0].to).toBe('planning');
    });
  });
});
