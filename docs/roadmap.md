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
- complete mobile food and weight create/edit/delete lifecycle
- timezone-aware timestamp correction
- History date navigation and meal grouping
- Log Again and Recent Foods fast logging

## Current Phase — Mode And Analytics Correctness

Goal:

- expose existing optional nutrient fields in Complex mode
- keep Simple mode focused
- distinguish missing nutrient data from measured zero
- prevent misleading analytics presentation
- gate intake recommendations when food logging is insufficient

Avoid micronutrient schema expansion, supplements, and chart-library adoption.

## Next 1 — Authentication And Beta Reliability

Prepare for limited multi-user use:

- explicit onboarding/setup flow
- Supabase Auth integration at the existing current-user boundary
- user-isolation regression coverage
- CI pinned to Node 22
- repeatable development-build and environment guidance

Do not build custom password authentication or production-scale infrastructure.

## Next 2 — Insights Presentation Refinement

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
