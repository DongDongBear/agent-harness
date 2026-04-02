import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Result } from '../../utils/result.js';
import { ok, err } from '../../utils/result.js';
import type { PiRunner, AgentError } from '../pi-runner.js';
import type { HarnessDir } from '../../orchestrator/harness-dir.js';
import { parseSpec } from './parser.js';
import type { PlannerResult } from './parser.js';
import { createLogger } from '../../utils/logger.js';

const logger = createLogger('planner');

const DEFAULT_TECH_STACK = 'React + Vite + Express + SQLite';
const DEFAULT_DOMAIN = 'TypeScript full-stack editor application';

export interface PlannerOptions {
  piRunner: PiRunner;
  cwd: string;
  harnessDir: HarnessDir;
  techStack?: string;
  domain?: string;
}

export interface Planner {
  plan(userPrompt: string): Promise<Result<PlannerResult, AgentError>>;
}

function loadPromptTemplate(): string {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  return fs.readFileSync(path.join(__dirname, 'prompt.md'), 'utf-8');
}

function renderPrompt(template: string, vars: Record<string, string>): string {
  let rendered = template;
  for (const [key, value] of Object.entries(vars)) {
    rendered = rendered.replaceAll(`{{${key}}}`, value);
  }
  return rendered;
}

export function createPlanner(options: PlannerOptions): Planner {
  const techStack = options.techStack ?? DEFAULT_TECH_STACK;
  const domain = options.domain ?? DEFAULT_DOMAIN;

  async function plan(userPrompt: string): Promise<Result<PlannerResult, AgentError>> {
    // 1. Load and render prompt template
    const template = loadPromptTemplate();
    const rendered = renderPrompt(template, {
      USER_PROMPT: userPrompt,
      TECH_STACK: techStack,
      DOMAIN: domain,
    });

    // 2. Write rendered prompt to .harness/planner-prompt.md
    const promptPath = path.join(options.harnessDir.basePath, 'planner-prompt.md');
    fs.writeFileSync(promptPath, rendered);
    logger.info(`Wrote rendered planner prompt to ${promptPath}`);

    // 3. Run Pi CLI with the rendered prompt
    const runResult = await options.piRunner.run(rendered);
    if (!runResult.ok) {
      return err(runResult.error);
    }

    const output = runResult.value;

    // 4. Parse the output to extract spec and sprint decomposition
    const parseResult = parseSpec(output);
    if (!parseResult.ok) {
      return err({ code: parseResult.error.code, message: parseResult.error.message });
    }

    // 5. Write spec to .harness/spec.md
    const specPath = path.join(options.harnessDir.basePath, 'spec.md');
    fs.writeFileSync(specPath, output);
    logger.info(`Wrote spec to ${specPath}`);

    return ok(parseResult.value);
  }

  return { plan };
}
