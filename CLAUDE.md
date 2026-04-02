# CLAUDE.md — Agent Harness Development Guide

## Project Overview
Multi-agent harness: Planner(Pi) → Generator(Claude Code) → Evaluator(Pi)
See SPEC.md for full product specification.

## Tech Stack
- TypeScript (strict mode)
- Node.js 20+
- ESM modules only (`"type": "module"`)
- Vitest for testing
- Zod for schema validation
- Commander for CLI
- tsup for bundling

## Development Workflow
- **Test-driven**: Write tests FIRST, then implement
- Run tests: `pnpm test`
- Type check: `pnpm typecheck`
- Build: `pnpm build`

## Code Style
- Use `import type` for type-only imports
- Prefer `interface` over `type` for object shapes
- Error handling: use typed Result<T, E> pattern, avoid throwing
- File naming: kebab-case (e.g., `process-manager.ts`, `process-manager.test.ts`)
- One module per file, co-locate tests (`foo.ts` + `foo.test.ts`)

## Architecture
```
src/
├── cli.ts                    # CLI entry point (commander)
├── index.ts                  # Library exports
├── orchestrator/
│   ├── orchestrator.ts       # Main orchestration loop
│   ├── config.ts             # Config schema (zod) + loading
│   ├── state.ts              # Progress state machine
│   └── harness-dir.ts        # .harness/ directory management
├── agents/
│   ├── process-manager.ts    # Spawn/monitor/kill agent processes
│   ├── planner/
│   │   ├── planner.ts        # Planner agent logic
│   │   └── prompt.md         # Planner prompt template
│   ├── generator/
│   │   ├── generator.ts      # Generator agent logic
│   │   └── prompt.md         # Generator prompt template
│   └── evaluator/
│       ├── evaluator.ts      # Evaluator agent logic
│       ├── scoring.ts        # 4-dimension scoring system
│       └── prompt.md         # Evaluator prompt template
├── contracts/
│   └── sprint-contract.ts    # Contract schema + negotiation
└── utils/
    ├── result.ts             # Result<T, E> type
    ├── logger.ts             # Structured logging
    └── git.ts                # Git operations
```

## Key Design Decisions
1. Agent communication is FILE-BASED (via .harness/ directory)
2. Generator is always Claude Code CLI (not configurable)
3. Planner and Evaluator use Pi CLI (model IS configurable)
4. Sequential sprints (no parallelism in V1)
5. Each sprint: contract negotiation → implementation → evaluation
6. Git auto-commit on sprint pass

## Current Sprint
Check .harness/progress.json for current state. Read SPEC.md Sprint section for the plan.
