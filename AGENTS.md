# AGENTS.md

## Project Overview
This project is an AI-assisted food tracking application built for low-friction nutrition tracking.

The application supports two tracking modes:

1. Simple Mode
2. Complex Mode

These are NOT separate applications.

Both modes share:
- Backend
- Database
- Core UI
- Business logic

The difference is only:
- What nutrients are tracked
- What analytics/charts are displayed

---

## Product Goals

Primary goal:
Make food tracking significantly easier than existing apps like Cronometer or MyFitnessPal.

Key problem:
Existing food trackers are powerful but tedious to use.

Core value proposition:
- Fast logging
- Minimal friction
- Deep analytics when desired
- AI-assisted convenience

---

## AI Rules

AI is optional and is only allowed for:

1. Future food parsing
Example:
"I ate 2 wraps and half a pizza"

AI may convert this into proposed structured food entries for user confirmation.

2. Future recommendation wording
AI may rewrite or explain recommendations that were already produced from deterministic facts.

AI MUST NOT be used for:
- calorie calculations
- macro calculations
- trend calculations
- analytics math
- detecting deficits or deficiencies
- deciding recommendation facts
- database querying

All calculations and recommendation decisions must be deterministic backend code. The recommendation system must work without AI.

Phase 2 food logging is manual structured nutrition entry only. It must not require AI parsing, nutrition matching, food database lookup, barcode scanning, or photo recognition.

MVP data units, precision, rounding, meal types, and tracking-day behavior are locked in `/docs/data-model-decisions.md`.

MVP REST conventions, response envelopes, auth boundary, validation, and endpoint contracts are locked in `/docs/api-contracts.md`.

MVP Prisma/PostgreSQL models, field types, constraints, indexes, relations, and cascade behavior are locked in `/docs/prisma-schema-decisions.md`. Do not create additional planning docs unless explicitly requested.

---

## Engineering Rules

### Architecture Rules
- Use monorepo structure
- Use `pnpm` and `pnpm` workspaces
- Do not add Nx
- Add Turborepo only later if there is a demonstrated need
- Shared types must live in `/packages/shared`
- Backend business logic must stay in API
- Frontend should focus on UI/state only
- No microservices
- No unnecessary abstraction
- Use Supabase Auth as the intended authentication provider
- Use fixed mock user context during Phase 1; clients must not send `userId`
- Do not build custom password authentication or a custom auth system

### Code Quality
- TypeScript strict mode
- Avoid `any`
- Strong typing everywhere
- Prefer composition over inheritance
- Reusable components
- Small focused modules

### Frontend UI Rules
- Mobile UI must follow `/docs/design-system.md`.
- Create and reuse shared mobile components before adding screen-specific UI.
- Avoid one-off inline styles when a shared token, component, or NativeWind
  class can represent the design.
- Do not ship generic placeholder layouts for implemented screens.
- Do not introduce random colors; use the documented semantic palette.
- Every backend-connected screen must include loading, error, and relevant
  empty states.
- Keep screens usable on small phones, including form controls, wrapping rows,
  keyboard behavior, and bottom navigation clearance.
- Frontend components display backend facts; they do not calculate nutrition
  or recommendation decisions.

### Backend Rules
Each module must own its responsibility.

Example:
- foodLogs handles food log CRUD
- analytics computes deterministic facts
- recommendations converts facts into recommendation objects
- AI may only rewrite already-computed recommendation wording

Do not mix responsibilities.

---

## Environment and Validation Rules

- Respect the Node.js version pinned by the project.
- If validation runs on a different Node version, explicitly report the expected and actual versions.
- Do not assume `pnpm` is globally installed.
- Use the package-manager commands documented in `README.md`.
- Prefer `corepack pnpm <command>` when available; use `npx pnpm@10.34.3 <command>` as the documented fallback.
- Do not require `corepack enable`; it may fail on restricted systems because it attempts to create a global symlink.
- During Phase 1, do not treat a missing `DATABASE_URL` as an application bug. Report it as an environment prerequisite for Prisma validation.
- Distinguish scaffold placeholder behavior from implementation bugs.
- Do not claim persistence works unless create-then-list behavior has been verified.
- Report the exact commands used during validation.
- Report exact validation errors rather than summarizing them vaguely.

---

## Performance Rules
Optimize for:
1. Simplicity
2. Maintainability
3. Speed of development

Avoid premature optimization.

---

## Forbidden Decisions
Do NOT:
- add payment systems
- add social features
- add microservices
- add Kubernetes
- add event buses
- add complex auth systems
- add AI everywhere
- add Nx

Keep MVP focused.

---
---

## Workflow Rules

Codex must follow this workflow for all non-trivial tasks.

### 1. Summarize Understanding First
Before making meaningful changes, summarize your understanding of the task.

Example:
- what feature is being built
- what modules are affected
- expected output
- constraints

This ensures alignment before implementation.

---

### 2. Propose a Plan Before Coding
For features larger than a small bug fix, propose an implementation plan.

The plan should include:
- files to create or modify
- modules impacted
- database changes (if any)
- API changes (if any)
- frontend changes (if any)

Plan should be concise but explicit.

---

### 3. Wait for Approval Before Major Changes
Codex must NOT proceed immediately if the task involves:

- architecture refactors
- database schema changes
- new dependencies/frameworks
- folder restructuring
- major cross-module rewrites

In these cases:
1. Explain proposed change
2. Explain why it is needed
3. Wait for approval

Do not assume permission.

---

### 4. Preserve Existing Architecture
When implementing new features:

- prefer existing patterns
- reuse existing modules
- avoid introducing parallel systems

If current architecture seems insufficient, explain why before changing it.

---

### 5. Make Small, Reversible Changes
Prefer incremental implementation over massive rewrites.

Good:
- small PR-sized changes
- isolated refactors
- modular additions

Bad:
- rewriting multiple modules at once
- changing architecture during feature work

---

### 6. Explicitly Call Out Tradeoffs
When multiple implementation paths exist, present tradeoffs.

Example:
Option A:
- simpler
- faster
- less scalable

Option B:
- more scalable
- more complex

Do not silently choose major tradeoffs.

---

### 7. Flag Overengineering
Codex should actively avoid unnecessary complexity.

Flag proposals involving:
- microservices
- event buses
- excessive abstraction
- premature optimization

Default to the simplest solution that satisfies requirements.

---

### 8. Separate Assumptions From Facts
Clearly distinguish between:

Facts:
- confirmed project requirements
- existing architecture
- user decisions

Assumptions:
- inferred requirements
- guessed constraints
- speculative future needs

Never treat assumptions as confirmed facts.

---

### 9. Ask Instead of Guessing
If ambiguity affects implementation, ask clarifying questions instead of making silent assumptions.

Especially for:
- business logic
- UX behavior
- schema design
- API contracts

---

### 10. Finish With Validation
After completing work, provide a short validation summary:

- what changed
- why it changed
- risks introduced
- suggested next step

## Build Philosophy
Build in phases.

Phase 1:
Foundation

Phase 2:
Core tracker with manual food logging and deterministic analytics/recommendations

Phase 3:
Intelligence and AI convenience layer

Phase 4:
Advanced analytics

Do not skip phases.
