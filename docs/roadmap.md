# Roadmap

This roadmap records implemented state and intended sequencing. It does not
override the engineering rules in `AGENTS.md` or locked architecture and schema
decisions.

The post-Phase 6 MVP direction is:

```text
Fast logging + accurate food data + useful progress/reporting + Simple/Complex
modes that actually feel different.
```

Future work should prioritize faster logging and richer backend-supported
tracking data, not broad redesigns of screens that already follow the Phase 6
visual standard.

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
- dedicated onboarding with deterministic calorie/protein target
  personalization
- clearer physical-device API diagnostics
- Phase 6 mobile visual-system pass across onboarding, Progress, History,
  logging, Insights, Recommendations, Profile/Settings, bottom navigation,
  floating add behavior, mode identity, logo rendering, inputs, and native
  iPhone testing guidance
- Phase 7 product-readiness pass with shared skeleton primitives, first-load
  skeletons for Progress, History, Insights, and Profile, record-load
  skeletons for food and weight editing, and no backend/API/schema/package or
  native changes

## Phase 7 — Product Readiness + Skeleton Loading — Complete

Completed as a short hardening phase before large new features.

- Shared skeleton primitives now support small blocks, lines, pills, and rails.
- Progress, History, Insights, and Profile use layout-matched first-load
  skeletons.
- Food and weight log screens use skeletons only while loading existing records
  for edit or log-again flows.
- Normal blank create forms still render immediately.
- Small action spinners remain for saving, deleting, dismissing, and refreshing
  existing content.
- Phase 7 preserved the Phase 6 visual standard and did not change backend,
  API, schema, package, lockfile, app config, or generated native folders.

## Phase 8 — Food Database Foundation — Complete

- app-owned food database foundation
- cached foods
- user-created and corrected foods
- recent foods
- saved foods
- reusable food foundation
- barcode-ready food items
- external source metadata
- Open Food Facts and USDA FoodData Central integration groundwork
- future RAG-assisted AI retrieval support
- future Complex mode nutrition expansion support

Initial Phase 8 implementation adds local `FoodItem`, `FoodBarcode`, and
`SavedFoodItem` foundations, food item CRUD/archive, saved/unsaved foods,
simple local search, local barcode lookup, shared contracts, mobile API client
methods, and backend tests.

Phase 8 does not implement barcode camera scanning, public barcode creation,
Open Food Facts or USDA sync, RAG-assisted AI logging, full Complex mode
nutrition UI, photo logging, or saved meals.

See [food-data-and-ai-strategy.md](food-data-and-ai-strategy.md).

## Phase 9 — Full Nutrition Model For Complex Mode — Complete

- full macro/common nutrition fields
- vitamins and minerals
- caffeine
- nutrient units
- nullable unknown nutrient values
- daily nutrient totals from backend summaries
- Simple mode hiding complexity
- Complex mode exposing deeper detail

Do not show fake micronutrient charts before backend data exists.

Initial Phase 9 implementation adds a static shared nutrient catalog,
normalized `FoodItemNutrient` and `FoodLogNutrient` tables, extended nutrient
support in food item and food log contracts, historical nutrient snapshots,
daily nutrient totals, mobile API client support, backend tests, and docs.

Phase 9 does not implement Complex-mode nutrient UI, barcode camera scanning,
Open Food Facts or USDA integration, AI/RAG logging, photo logging, saved
meals, custom graphs, or recommendation engine 2.0.

## Phase 10 — Faster Logging UX — Active / Next

- fast food search
- saved foods
- recent foods
- custom food creation flow
- log from food item
- one-tap log again improvements
- serving amount and unit pickers
- quick Simple mode calorie/protein entry
- use food database results without redesigning the whole app

Phase 10 should connect the Phase 8 food database and Phase 9 nutrition
foundations to the actual logging experience while preserving the Phase 6
visual standard. It should not become barcode scanning, AI/RAG logging, photo
logging, custom graphs, recommendation engine 2.0, or a broad redesign.

Initial Phase 10 implementation adds food item search inside the food logging
flow, saved-food quick access, linked recent-food reuse when a prior log has a
`foodItemId`, backend-owned log-from-food snapshot scaling, selected-food
serving multipliers without unit conversion, and a small manual “save as
reusable food” path. Frequent-food ranking, meal shortcuts, barcode scanning,
external food data, AI/RAG, photo logging, saved meals, and full micronutrient
editing remain future work.

Native testing confirmed the Phase 10 search path works but is intentionally
sparse because it searches only the local app-owned `FoodItem` database. Until
users create reusable foods, or later phases add starter catalogs and external
food integrations, empty search results are expected. Barcode, Open Food
Facts, and USDA work remains Phase 11+. Complex mode has the Phase 9 data
foundation, but richer Complex logging UI and reporting are later phases rather
than Phase 10 scope.

## Phase 11 — Barcode Scanning

- local cached barcode lookup
- Open Food Facts barcode lookup
- USDA/branded fallback where useful
- custom food creation when not found
- barcode-linked food caching

## Phase 12 — RAG-Assisted AI Text Logging

- parse messy food descriptions
- split likely meal items
- retrieve candidates from trusted food sources
- rank candidate matches
- user review and edit before saving
- backend validation and confirmed `FoodLog` persistence

AI must not become the nutrition source of truth.

## Phase 13 — Photo Food Logging

- image capture/upload
- food recognition
- portion estimation
- retrieval matching against trusted food data
- confidence/review state
- user edits before saving
- Simple confirmation UI
- Complex nutrient detail review

Photo logging comes after food database and RAG foundations.

## Phase 14 — Streaks + Better Reporting

- logging streaks
- weekly consistency
- calorie adherence
- protein adherence
- weight trend
- goal progress
- weekly reports
- monthly reports
- Simple mode summaries
- Complex mode deeper reporting

## Phase 15 — Custom Graphs + Complex Analytics

- customizable graphs
- graph metric selection
- 7-day, 30-day, 90-day, and custom ranges
- compare metrics
- saved graph preferences
- micronutrient patterns
- caffeine trends
- sodium, fiber, and sugar patterns

Charts should follow the Phase 6 visual standard and avoid generic dashboard
card spam.

## Phase 16 — Recommendation Engine 2.0

- recommendations informed by richer nutrient summaries
- better confidence and evidence display
- better Simple/Complex recommendation density
- optional AI wording over backend-decided facts only

AI must not calculate analytics, identify deficits, decide recommendations, or
query the database directly.

## Phase 17 — Real Auth + User Accounts

- Supabase Auth integration at the existing current-user boundary
- user-isolation regression coverage
- account lifecycle behavior
- CI pinned to Node 22
- repeatable development-build and environment guidance

Do not build custom password authentication or production-scale infrastructure.

## Phase 18 — Deployment / TestFlight Readiness

- deployment hardening
- environment configuration
- TestFlight readiness
- production database and migration workflow
- observability and diagnostics
- limited-beta release checklist

## Deferred

The following remain future work:

- wearable integration
- grocery recommendations
- smart meal planning
- water and note logging
- supplements and custom nutrients beyond the core nutrition model

AI must not calculate analytics, identify deficits, decide recommendations, or
query the database.
