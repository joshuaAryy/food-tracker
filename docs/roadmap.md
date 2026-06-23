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
- mode-aware food forms and Insights
- analytics completeness and recommendation confidence gating
- first-run setup detection and atomic setup saves
- dedicated onboarding with deterministic calorie/protein target personalization
- clearer physical-device API diagnostics

## Current Phase — Beta Readiness

Goal:

- provide a dedicated first-run onboarding path
- collect enough personalization inputs for deterministic target calculation
- preserve unrelated preference values during profile edits
- improve API connection diagnostics for devices
- keep local development and limited-beta setup repeatable

Deferred within this phase: onboarding visual design polish should be handled in
a later dedicated UI pass after the data model and first-run flow are stable.

Authentication remains the next major boundary; development still uses the
fixed mock user.

## Next 1 — Authentication

Prepare for limited multi-user use:

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
