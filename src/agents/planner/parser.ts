import type { Result } from '../../utils/result.js';
import { ok, err } from '../../utils/result.js';

const MAX_SPRINTS = 15;

export interface SprintPlan {
  number: number;
  title: string;
  description: string;
  priority: 'P0' | 'P1' | 'P2';
  estimatedComplexity: 'low' | 'medium' | 'high';
}

export interface PlannerResult {
  spec: string;
  sprintCount: number;
  sprints: SprintPlan[];
}

export interface ParseError {
  code: string;
  message: string;
}

const SPRINT_SECTION_RE = /^##\s+(?:Sprint Decomposition|Sprints)\s*$/im;
const SPRINT_HEADING_RE = /^###\s+Sprint\s+(\d+):\s*(.+)$/im;
const PRIORITY_RE = /\*\*Priority:\*\*\s*(P[012])/i;
const COMPLEXITY_RE = /\*\*Complexity:\*\*\s*(low|medium|high)/i;

export function parseSpec(markdown: string): Result<PlannerResult, ParseError> {
  if (!markdown.trim()) {
    return err({ code: 'EMPTY_INPUT', message: 'Spec markdown is empty' });
  }

  const sectionMatch = SPRINT_SECTION_RE.exec(markdown);
  if (!sectionMatch) {
    return err({ code: 'NO_SPRINTS', message: 'No sprint decomposition section found in spec' });
  }

  const sprintSection = markdown.slice(sectionMatch.index + sectionMatch[0].length);

  // Split into individual sprint blocks by ### Sprint N: headings
  const sprintBlocks: { number: number; title: string; body: string }[] = [];
  const lines = sprintSection.split('\n');
  let current: { number: number; title: string; bodyLines: string[] } | null = null;

  for (const line of lines) {
    const headingMatch = SPRINT_HEADING_RE.exec(line);
    if (headingMatch) {
      if (current) {
        sprintBlocks.push({
          number: current.number,
          title: current.title,
          body: current.bodyLines.join('\n').trim(),
        });
      }
      current = {
        number: parseInt(headingMatch[1], 10),
        title: headingMatch[2].trim(),
        bodyLines: [],
      };
    } else if (current) {
      // Stop if we hit a ## heading (next major section)
      if (/^##\s+/.test(line) && !/^###/.test(line)) {
        break;
      }
      current.bodyLines.push(line);
    }
  }

  if (current) {
    sprintBlocks.push({
      number: current.number,
      title: current.title,
      body: current.bodyLines.join('\n').trim(),
    });
  }

  if (sprintBlocks.length === 0) {
    return err({ code: 'NO_SPRINTS', message: 'No sprint entries found in sprint decomposition section' });
  }

  const sprints: SprintPlan[] = sprintBlocks.slice(0, MAX_SPRINTS).map((block) => {
    const priorityMatch = PRIORITY_RE.exec(block.body);
    const complexityMatch = COMPLEXITY_RE.exec(block.body);

    // Extract description: lines that aren't metadata
    const descriptionLines = block.body
      .split('\n')
      .filter((l) => !PRIORITY_RE.test(l) && !COMPLEXITY_RE.test(l))
      .join('\n')
      .trim();

    return {
      number: block.number,
      title: block.title,
      description: descriptionLines,
      priority: (priorityMatch?.[1] as 'P0' | 'P1' | 'P2') ?? 'P1',
      estimatedComplexity: (complexityMatch?.[1] as 'low' | 'medium' | 'high') ?? 'medium',
    };
  });

  return ok({
    spec: markdown,
    sprintCount: sprints.length,
    sprints,
  });
}
