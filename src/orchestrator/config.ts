import { z } from 'zod/v4';
import * as fs from 'node:fs';
import { ok, err } from '../utils/result.js';
import type { Result } from '../utils/result.js';

export interface HarnessConfig {
  planner: {
    provider: string;
    model: string;
  };
  generator: Record<string, never>;
  evaluator: {
    provider: string;
    model: string;
    scoringThresholds: {
      passThreshold: number;
      dimensionFloor: number;
    };
    maxRetries: number;
  };
  orchestrator: {
    maxSprints: number;
    autoCommit: boolean;
    resumable: boolean;
  };
}

const HarnessConfigSchema = z.object({
  planner: z.object({
    provider: z.string(),
    model: z.string(),
  }),
  generator: z.object({}).strict(),
  evaluator: z.object({
    provider: z.string(),
    model: z.string(),
    scoringThresholds: z.object({
      passThreshold: z.number(),
      dimensionFloor: z.number(),
    }),
    maxRetries: z.number().int().min(0),
  }),
  orchestrator: z.object({
    maxSprints: z.number().int().min(1),
    autoCommit: z.boolean(),
    resumable: z.boolean(),
  }),
});

export interface ConfigError {
  message: string;
}

export function getDefaultConfig(): HarnessConfig {
  return {
    planner: {
      provider: 'anthropic',
      model: 'claude-sonnet-4-6',
    },
    generator: {},
    evaluator: {
      provider: 'anthropic',
      model: 'claude-sonnet-4-6',
      scoringThresholds: {
        passThreshold: 7.0,
        dimensionFloor: 5.0,
      },
      maxRetries: 3,
    },
    orchestrator: {
      maxSprints: 15,
      autoCommit: true,
      resumable: true,
    },
  };
}

export function loadConfig(path?: string): Result<HarnessConfig, ConfigError> {
  if (!path) {
    return ok(getDefaultConfig());
  }

  let raw: string;
  try {
    raw = fs.readFileSync(path, 'utf-8');
  } catch {
    return err({ message: `Failed to read config file: ${path}` });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return err({ message: `Invalid JSON in config file: ${path}` });
  }

  const result = HarnessConfigSchema.safeParse(parsed);
  if (!result.success) {
    return err({ message: `Invalid config: ${result.error.message}` });
  }

  return ok(result.data as HarnessConfig);
}
