import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createPlanner } from './planner.js';
import type { PiRunner } from '../pi-runner.js';
import type { HarnessDir } from '../../orchestrator/harness-dir.js';
import { ok, err } from '../../utils/result.js';
import * as fs from 'node:fs';

vi.mock('node:fs', () => ({
  writeFileSync: vi.fn(),
  readFileSync: vi.fn(),
  mkdirSync: vi.fn(),
}));

vi.mock('../pi-runner.js', () => ({
  createPiRunner: vi.fn(),
}));

const SAMPLE_OUTPUT = `# Product Specification: Test App

## Overview
A test application.

## Design Language
- Colors: blue
- Font: Inter

## User Stories

### P0
- Basic feature

## Sprint Decomposition

### Sprint 1: Project Setup
**Priority:** P0
**Complexity:** low
Initialize the project.

### Sprint 2: Core Feature
**Priority:** P0
**Complexity:** medium
Build the main feature.

### Sprint 3: Polish
**Priority:** P1
**Complexity:** low
Polish and refine.
`;

function createMockPiRunner(output: string = SAMPLE_OUTPUT): PiRunner {
  return {
    run: vi.fn().mockResolvedValue(ok(output)),
    runWithFile: vi.fn().mockResolvedValue(ok(output)),
  };
}

function createMockHarnessDir(): HarnessDir {
  return { basePath: '/tmp/test-harness/.harness' };
}

describe('planner', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    // Mock readFileSync for prompt template
    vi.mocked(fs.readFileSync).mockReturnValue(
      'You are a product planner.\n\nUser prompt: {{USER_PROMPT}}\nTech stack: {{TECH_STACK}}\nDomain: {{DOMAIN}}\n\nProduce a spec.',
    );
  });

  describe('createPlanner', () => {
    it('should create a planner with plan method', () => {
      const mockRunner = createMockPiRunner();
      const planner = createPlanner({
        piRunner: mockRunner,
        cwd: '/tmp/test',
        harnessDir: createMockHarnessDir(),
      });
      expect(planner).toBeDefined();
      expect(planner.plan).toBeTypeOf('function');
    });
  });

  describe('plan', () => {
    it('should render the prompt template with variables', async () => {
      const mockRunner = createMockPiRunner();
      const planner = createPlanner({
        piRunner: mockRunner,
        cwd: '/tmp/test',
        harnessDir: createMockHarnessDir(),
        techStack: 'Next.js + Prisma',
        domain: 'music production',
      });

      await planner.plan('Build a DAW');

      // Check that the rendered prompt was written
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining('planner-prompt.md'),
        expect.stringContaining('Build a DAW'),
      );
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining('planner-prompt.md'),
        expect.stringContaining('Next.js + Prisma'),
      );
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining('planner-prompt.md'),
        expect.stringContaining('music production'),
      );
    });

    it('should use default tech stack and domain when not provided', async () => {
      const mockRunner = createMockPiRunner();
      const planner = createPlanner({
        piRunner: mockRunner,
        cwd: '/tmp/test',
        harnessDir: createMockHarnessDir(),
      });

      await planner.plan('Build an editor');

      expect(fs.writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining('planner-prompt.md'),
        expect.stringContaining('React + Vite + Express + SQLite'),
      );
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining('planner-prompt.md'),
        expect.stringContaining('TypeScript full-stack editor application'),
      );
    });

    it('should call PiRunner with the rendered prompt', async () => {
      const mockRunner = createMockPiRunner();
      const planner = createPlanner({
        piRunner: mockRunner,
        cwd: '/tmp/test',
        harnessDir: createMockHarnessDir(),
      });

      await planner.plan('Build an editor');

      expect(mockRunner.run).toHaveBeenCalledWith(
        expect.stringContaining('Build an editor'),
      );
    });

    it('should write spec to harness dir', async () => {
      const mockRunner = createMockPiRunner();
      const harnessDir = createMockHarnessDir();
      const planner = createPlanner({
        piRunner: mockRunner,
        cwd: '/tmp/test',
        harnessDir,
      });

      const result = await planner.plan('Build an editor');
      expect(result.ok).toBe(true);

      // spec.md should be written
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        '/tmp/test-harness/.harness/spec.md',
        SAMPLE_OUTPUT,
      );
    });

    it('should return PlannerResult with parsed sprints', async () => {
      const mockRunner = createMockPiRunner();
      const planner = createPlanner({
        piRunner: mockRunner,
        cwd: '/tmp/test',
        harnessDir: createMockHarnessDir(),
      });

      const result = await planner.plan('Build an editor');
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.value.spec).toBe(SAMPLE_OUTPUT);
      expect(result.value.sprintCount).toBe(3);
      expect(result.value.sprints).toHaveLength(3);
      expect(result.value.sprints[0].title).toBe('Project Setup');
      expect(result.value.sprints[1].title).toBe('Core Feature');
      expect(result.value.sprints[2].title).toBe('Polish');
    });

    it('should return error when PiRunner fails', async () => {
      const mockRunner: PiRunner = {
        run: vi.fn().mockResolvedValue(err({ code: 'TIMEOUT', message: 'timed out' })),
        runWithFile: vi.fn(),
      };
      const planner = createPlanner({
        piRunner: mockRunner,
        cwd: '/tmp/test',
        harnessDir: createMockHarnessDir(),
      });

      const result = await planner.plan('Build something');
      expect(result.ok).toBe(false);
      if (result.ok) return;

      expect(result.error.code).toBe('TIMEOUT');
    });

    it('should return error when spec parsing fails', async () => {
      const mockRunner = createMockPiRunner('This is not a valid spec with no sprints.');
      const planner = createPlanner({
        piRunner: mockRunner,
        cwd: '/tmp/test',
        harnessDir: createMockHarnessDir(),
      });

      const result = await planner.plan('Build something');
      expect(result.ok).toBe(false);
      if (result.ok) return;

      expect(result.error.code).toBe('NO_SPRINTS');
    });

    it('should write rendered prompt to .harness/planner-prompt.md', async () => {
      const mockRunner = createMockPiRunner();
      const harnessDir = createMockHarnessDir();
      const planner = createPlanner({
        piRunner: mockRunner,
        cwd: '/tmp/test',
        harnessDir,
      });

      await planner.plan('Build an editor');

      expect(fs.writeFileSync).toHaveBeenCalledWith(
        '/tmp/test-harness/.harness/planner-prompt.md',
        expect.any(String),
      );
    });
  });
});
