import { describe, it, expect } from 'vitest';
import { parseSpec } from './parser.js';

const VALID_SPEC = `# Product Specification: Collaborative Markdown Editor

## Overview
A real-time collaborative markdown editor with live preview.

## Design Language
- Primary color: #2563EB
- Font: Inter
- Spacing: 8px grid

## User Stories

### P0 — Must Have
- As a user, I can create and edit markdown documents
- As a user, I can see a live preview of my markdown

### P1 — Should Have
- As a user, I can collaborate in real-time
- As a user, I can use AI to generate content

### P2 — Nice to Have
- As a user, I can export to PDF

## Sprint Decomposition

### Sprint 1: Project Setup
**Priority:** P0
**Complexity:** low
Set up the project with React, Vite, and Express. Initialize the database schema and create the basic app shell.

### Sprint 2: Markdown Editor Core
**Priority:** P0
**Complexity:** medium
Implement the core markdown editing experience with syntax highlighting and basic editing operations.

### Sprint 3: Live Preview
**Priority:** P0
**Complexity:** medium
Add real-time markdown preview panel with synchronized scrolling between editor and preview.

### Sprint 4: Real-Time Collaboration
**Priority:** P1
**Complexity:** high
Implement WebSocket-based real-time collaboration using operational transforms.

### Sprint 5: AI Content Generation
**Priority:** P1
**Complexity:** medium
Add AI-powered content generation features including autocomplete and summarization.

### Sprint 6: PDF Export
**Priority:** P2
**Complexity:** low
Add the ability to export markdown documents to PDF format.
`;

const MINIMAL_SPEC = `# Spec

## Sprint Decomposition

### Sprint 1: Setup
**Priority:** P0
**Complexity:** low
Basic setup.
`;

const ALT_HEADING_SPEC = `# Spec

## Sprints

### Sprint 1: Setup
**Priority:** P0
**Complexity:** low
Basic project setup.

### Sprint 2: Core Feature
**Priority:** P1
**Complexity:** medium
Build the main feature.
`;

const NO_SPRINTS_SPEC = `# Product Spec

## Overview
Just an overview with no sprint section at all.

## Features
Some features listed here.
`;

const MALFORMED_SPRINT_SPEC = `# Spec

## Sprint Decomposition

### Sprint 1: Setup
No priority or complexity metadata here, just description text.

### Sprint 2: Core
**Priority:** P0
Missing complexity field.
Description of core work.
`;

const MISSING_FIELDS_SPEC = `# Spec

## Sprint Decomposition

### Sprint 1: Setup
**Priority:** P0
**Complexity:** low
Basic setup.

### Sprint 2: Feature
Description only, no priority or complexity.
`;

describe('parseSpec', () => {
  it('should parse a valid spec with all sprints', () => {
    const result = parseSpec(VALID_SPEC);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.spec).toBe(VALID_SPEC);
    expect(result.value.sprintCount).toBe(6);
    expect(result.value.sprints).toHaveLength(6);
  });

  it('should extract sprint details correctly', () => {
    const result = parseSpec(VALID_SPEC);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const sprint1 = result.value.sprints[0];
    expect(sprint1.number).toBe(1);
    expect(sprint1.title).toBe('Project Setup');
    expect(sprint1.priority).toBe('P0');
    expect(sprint1.estimatedComplexity).toBe('low');
    expect(sprint1.description).toContain('React, Vite, and Express');

    const sprint4 = result.value.sprints[3];
    expect(sprint4.number).toBe(4);
    expect(sprint4.title).toBe('Real-Time Collaboration');
    expect(sprint4.priority).toBe('P1');
    expect(sprint4.estimatedComplexity).toBe('high');
  });

  it('should handle minimal spec with one sprint', () => {
    const result = parseSpec(MINIMAL_SPEC);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.sprintCount).toBe(1);
    expect(result.value.sprints[0].title).toBe('Setup');
    expect(result.value.sprints[0].priority).toBe('P0');
    expect(result.value.sprints[0].estimatedComplexity).toBe('low');
  });

  it('should handle alternative "Sprints" heading', () => {
    const result = parseSpec(ALT_HEADING_SPEC);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.sprintCount).toBe(2);
    expect(result.value.sprints[0].title).toBe('Setup');
    expect(result.value.sprints[1].title).toBe('Core Feature');
  });

  it('should return error when no sprint section found', () => {
    const result = parseSpec(NO_SPRINTS_SPEC);
    expect(result.ok).toBe(false);
    if (result.ok) return;

    expect(result.error.code).toBe('NO_SPRINTS');
    expect(result.error.message).toContain('sprint');
  });

  it('should return error for empty input', () => {
    const result = parseSpec('');
    expect(result.ok).toBe(false);
    if (result.ok) return;

    expect(result.error.code).toBe('EMPTY_INPUT');
  });

  it('should handle sprints with missing priority/complexity gracefully', () => {
    const result = parseSpec(MISSING_FIELDS_SPEC);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.sprintCount).toBe(2);
    // First sprint has full metadata
    expect(result.value.sprints[0].priority).toBe('P0');
    expect(result.value.sprints[0].estimatedComplexity).toBe('low');
    // Second sprint has defaults for missing metadata
    expect(result.value.sprints[1].priority).toBe('P1');
    expect(result.value.sprints[1].estimatedComplexity).toBe('medium');
  });

  it('should handle malformed sprint entries with defaults', () => {
    const result = parseSpec(MALFORMED_SPRINT_SPEC);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.sprintCount).toBe(2);
    // Sprint 1: no metadata at all
    expect(result.value.sprints[0].priority).toBe('P1');
    expect(result.value.sprints[0].estimatedComplexity).toBe('medium');
    // Sprint 2: has priority but no complexity
    expect(result.value.sprints[1].priority).toBe('P0');
    expect(result.value.sprints[1].estimatedComplexity).toBe('medium');
  });

  it('should cap sprint count at 15', () => {
    let bigSpec = '# Spec\n\n## Sprint Decomposition\n\n';
    for (let i = 1; i <= 20; i++) {
      bigSpec += `### Sprint ${i}: Task ${i}\n**Priority:** P0\n**Complexity:** low\nDo task ${i}.\n\n`;
    }

    const result = parseSpec(bigSpec);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.sprintCount).toBe(15);
    expect(result.value.sprints).toHaveLength(15);
  });
});
