# Agent Harness — Product Specification

> A multi-agent orchestration system for long-running TypeScript full-stack application development, with a focus on editor-domain projects.

## 1. Overview

Agent Harness implements the Planner → Generator → Evaluator architecture described in Anthropic's "Harness Design for Long-Running Application Development" (2026.03). It orchestrates three specialized agents to collaboratively build complex applications that a single agent session cannot reliably produce.

### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Orchestrator                             │
│  (Node.js process — manages lifecycle, routing, file I/O)       │
├─────────────┬──────────────────┬────────────────────────────────┤
│  Planner    │   Generator      │   Evaluator                    │
│  (Pi agent) │  (Claude Code)   │   (Pi agent)                   │
│  Model: any │  Model: Claude   │   Model: any                   │
│             │                  │   + Playwright MCP              │
└─────────────┴──────────────────┴────────────────────────────────┘
        │               │                │
        └───────────── File System ──────┘
            (specs, contracts, reports, code)
```

### Agent Roles

| Agent | Runtime | Purpose | Model |
|-------|---------|---------|-------|
| **Planner** | Pi CLI | Expand user prompt → full product spec + design language | Configurable (default: Claude Sonnet) |
| **Generator** | Claude Code CLI | Implement code sprint-by-sprint | Claude (fixed) |
| **Evaluator** | Pi CLI | QA via Playwright, score & fail/pass each sprint | Configurable (default: Claude Sonnet) |

## 2. Target Domain

**TypeScript full-stack applications in the editor domain**, including but not limited to:
- Code editors / IDEs
- Visual editors (diagram, canvas, whiteboard)
- Document editors (rich text, markdown, collaborative)
- Game level editors
- Design tools (UI builder, sprite editor)
- Music/audio editors (DAW)

**Tech stack for generated apps:** React + Vite (frontend) + Express/Fastify (backend) + SQLite/PostgreSQL (database)

## 3. Core Features

### 3.1 Orchestrator (`src/orchestrator/`)

The central process that manages the full harness lifecycle:

- **Config loading**: Read `harness.config.ts` for model selection, scoring thresholds, max iterations, tech stack preferences
- **Agent lifecycle**: Spawn, monitor, and terminate Pi/Claude Code processes
- **Phase management**: Planner → (Generator ↔ Evaluator)* → Done
- **File routing**: Manage the `.harness/` working directory for inter-agent communication
- **Progress tracking**: Real-time status, cost tracking, time tracking
- **Git integration**: Auto-commit after each successful sprint
- **Resume**: Ability to resume a failed/interrupted run from the last successful sprint

### 3.2 Planner Agent (`src/agents/planner/`)

- **Input**: 1-4 sentence user prompt
- **Output**: `/.harness/spec.md` — comprehensive product specification
- **Behavior**:
  - Expand scope ambitiously (like a good PM)
  - Define visual design language (colors, typography, spacing, mood)
  - Identify AI-powered feature opportunities
  - Produce user stories grouped by priority
  - Output sprint decomposition with ordering
  - Focus on WHAT, not HOW (avoid implementation details)
- **Runtime**: Pi CLI with configurable model
- **Prompt template**: `src/agents/planner/prompt.md`

### 3.3 Generator Agent (`src/agents/generator/`)

- **Input**: Product spec + sprint contract + evaluator feedback (if retry)
- **Output**: Working code in `/.harness/workspace/`
- **Behavior**:
  - Propose sprint contract before coding
  - Implement one sprint at a time
  - Self-test before handing off to evaluator
  - On evaluator FAIL: read feedback, fix issues, re-submit
  - On evaluator PASS: git commit, move to next sprint
  - Strategic pivot when stuck (revert + try different approach)
- **Runtime**: Claude Code CLI (`--print --permission-mode bypassPermissions`)
- **Working directory**: `/.harness/workspace/` (the actual app being built)

### 3.4 Evaluator Agent (`src/agents/evaluator/`)

- **Input**: Sprint contract + running application
- **Output**: `/.harness/reports/sprint-{n}-eval.md` — structured evaluation report
- **Behavior**:
  - Review sprint contract feasibility BEFORE generator codes
  - After generator completes: launch app, test with Playwright
  - Score on 4 dimensions (configurable thresholds):
    - **Product Depth** (weight: 1.0) — features actually work end-to-end
    - **Functionality** (weight: 1.0) — no broken interactions
    - **Visual Design** (weight: 1.2) — cohesive design, not AI slop
    - **Code Quality** (weight: 0.8) — clean, maintainable code
  - Each dimension scored 1-10, weighted average must exceed threshold (default: 7.0)
  - Any single dimension below floor (default: 5.0) → automatic FAIL
  - Provide actionable feedback with file:line references
- **Runtime**: Pi CLI with configurable model + Playwright MCP
- **Prompt template**: `src/agents/evaluator/prompt.md`

### 3.5 Sprint Contract (`src/contracts/`)

The bridge between high-level spec and testable criteria:

```typescript
interface SprintContract {
  sprintNumber: number;
  title: string;
  description: string;
  acceptanceCriteria: AcceptanceCriterion[];
  estimatedComplexity: 'low' | 'medium' | 'high';
}

interface AcceptanceCriterion {
  id: string;
  description: string;  // Human-readable
  testable: boolean;     // Can Evaluator verify this?
  category: 'functionality' | 'design' | 'performance' | 'integration';
}
```

### 3.6 Inter-Agent Communication

All communication via file system in `/.harness/`:

```
.harness/
├── config.json              # Runtime config snapshot
├── spec.md                  # Planner output
├── sprints/
│   ├── sprint-1/
│   │   ├── contract.md      # Agreed sprint contract
│   │   ├── generator-log.md # Generator's work log
│   │   ├── eval-report.md   # Evaluator's assessment
│   │   └── status.json      # { status: 'pass'|'fail'|'in-progress', attempt: 1 }
│   └── sprint-2/
│       └── ...
├── reports/
│   └── final-summary.md     # Overall build report
├── workspace/               # The actual application code
│   ├── package.json
│   ├── src/
│   └── ...
└── progress.json            # Overall harness state
```

### 3.7 Model Configuration

```typescript
interface HarnessConfig {
  planner: {
    provider: string;    // 'anthropic' | 'openai' | 'google' | 'deepseek'
    model: string;       // e.g. 'claude-sonnet-4-6'
  };
  generator: {
    // Fixed: Claude Code
    // No model config — uses whatever CC is configured with
  };
  evaluator: {
    provider: string;
    model: string;
    scoringThresholds: {
      passThreshold: number;     // default: 7.0
      dimensionFloor: number;    // default: 5.0
    };
    maxRetries: number;          // default: 3
  };
  orchestrator: {
    maxSprints: number;          // default: 15
    autoCommit: boolean;         // default: true
    resumable: boolean;          // default: true
  };
}
```

## 4. CLI Interface

```bash
# Basic usage
agent-harness run "Build a collaborative markdown editor with real-time preview"

# With config
agent-harness run --config harness.config.ts "Build a pixel art editor"

# Resume interrupted run
agent-harness resume .harness/

# Check status of running harness
agent-harness status

# View sprint reports
agent-harness report [sprint-number]
```

## 5. Sprint Decomposition (for building this project itself)

### Sprint 1: Project Scaffolding + Orchestrator Core
- TypeScript project setup (tsconfig, eslint, vitest)
- CLI entry point with commander
- Config loading and validation (zod schema)
- `.harness/` directory management
- Progress state machine
- **Tests**: Config validation, state transitions, directory creation

### Sprint 2: Agent Process Manager
- Spawn/monitor/kill child processes (Pi CLI, Claude Code CLI)
- Stdout/stderr capture and streaming
- Timeout handling
- Process health checks
- **Tests**: Process spawn/kill, output capture, timeout behavior

### Sprint 3: Planner Agent Integration
- Pi CLI wrapper with model switching
- Planner prompt template
- Spec output parsing and validation
- Sprint decomposition extraction
- **Tests**: Prompt rendering, spec parsing, sprint extraction

### Sprint 4: Generator Agent Integration
- Claude Code CLI wrapper
- Sprint contract → CC prompt construction
- Workspace management (git init, dependencies)
- Generator work log capture
- **Tests**: Prompt construction, workspace setup, log parsing

### Sprint 5: Evaluator Agent Integration
- Pi CLI wrapper for evaluation
- Playwright MCP integration for E2E testing
- Scoring system (4 dimensions, weighted average)
- Pass/fail logic with configurable thresholds
- Structured feedback generation
- **Tests**: Scoring calculation, threshold logic, report generation

### Sprint 6: Sprint Contract Negotiation
- Generator proposes → Evaluator reviews → iterate loop
- Contract schema validation
- Contract file I/O
- **Tests**: Contract negotiation flow, validation, file operations

### Sprint 7: Full Orchestration Loop
- Planner → (Contract → Generator → Evaluator)* → Done
- Retry logic on evaluator FAIL
- Git auto-commit on sprint PASS
- Resume from last successful sprint
- **Tests**: Full loop integration test, retry behavior, resume logic

### Sprint 8: CLI Polish + Documentation
- Commander CLI with all subcommands
- Progress display (spinner, colors, status)
- Cost & time tracking
- README.md with usage examples
- **Tests**: CLI argument parsing, display formatting

## 6. Success Criteria

The harness is successful when it can:
1. Take a 1-sentence prompt like "Build a collaborative markdown editor"
2. Produce a working, deployed application with 10+ features
3. The application has cohesive visual design (not AI slop)
4. Core features actually work end-to-end (verified by Evaluator)
5. Total cost < $150, time < 4 hours for a medium-complexity editor
6. The process is resumable if interrupted

## 7. Non-Goals (V1)

- No web UI dashboard (CLI only)
- No parallel agent execution (sequential sprints)
- No custom MCP server integration beyond Playwright
- No deployment automation (build only)
- No multi-language support (TypeScript only)
