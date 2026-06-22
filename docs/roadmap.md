# Roadmap

This roadmap records implemented state and intended sequencing. It does not
override the engineering rules in `AGENTS.md` or locked architecture and schema
decisions.

## Completed Baseline

Implemented:

- pnpm workspace foundation
- Expo Router mobile application and shared mobile design system
- Express API with shared Zod and TypeScript contracts
- Prisma/PostgreSQL persistence
- fixed development mock-user boundary
- profile, goals, and tracking preferences
- food-log and weight-log backend CRUD
- mobile food and weight creation
- dashboard and history integration
- deterministic recommendation engine and lifecycle
- backend regression test infrastructure
- advanced deterministic analytics
- mobile Insights integration

## Current Phase — Documentation And Workflow Hardening

Goal:

- enforce Node 22 validation
- document PostgreSQL and test-database setup
- establish one authoritative branch and validation workflow
- remove stale implementation claims
- reduce onboarding and merge-state confusion

This phase changes documentation and workflow rules only.

## Next 1 — Mobile Log Lifecycle

Complete mobile food and weight record management:

- view record details
- edit existing entries
- delete with confirmation
- correct logged timestamps
- add mobile regression tests

Avoid schema redesign, AI, external food databases, and visual redesign.

## Next 2 — Complex Mode Correctness

Make tracking modes behaviorally meaningful:

- expose existing optional nutrient fields in Complex mode
- keep Simple mode focused
- distinguish missing nutrient data from measured zero
- prevent misleading analytics presentation

Avoid micronutrient schema expansion, supplements, and chart-library adoption.

## Next 3 — Faster Manual Logging

Reduce repeated entry friction:

- date navigation and meal grouping
- timestamp selection
- recent-food reuse or “log again”
- clearer history filtering

Keep the workflow deterministic and manual-first.

## Next 4 — Authentication And Beta Reliability

Prepare for limited multi-user use:

- explicit onboarding/setup flow
- Supabase Auth integration at the existing current-user boundary
- user-isolation regression coverage
- CI pinned to Node 22
- repeatable development-build and environment guidance

Do not build custom password authentication or production-scale infrastructure.

## Next 5 — Insights Presentation Refinement

Improve interpretation after data semantics are trustworthy:

- clearer completeness and time-window labels
- better recommendation evidence presentation
- compact native trend visuals where useful
- improved weight-change interval wording

Do not add a chart library without demonstrated need.

## Deferred

The following remain future work:

- natural-language AI food parsing with confirmation
- deterministic nutrition matching and food database lookup
- barcode and photo-assisted input
- optional AI rewriting of already-decided recommendation wording
- water and note logging
- vitamins, minerals, supplements, and custom nutrients
- advanced charting

AI must not calculate analytics, identify deficits, decide recommendations, or
query the database.
