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

## Phase 10 — Faster Logging UX — Complete

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

## Phase 11 — Barcode Scanning — Complete

- local cached barcode lookup
- Open Food Facts barcode lookup
- future USDA/branded fallback where useful
- custom food creation when not found
- barcode-linked food caching

Initial Phase 11 implementation adds an Expo camera barcode scanner entry point
inside food logging, backend barcode lookup with local cache first and Open
Food Facts second, conservative Open Food Facts normalization into normal
`FoodItem`/`FoodBarcode` records, and return into the existing selected-food
logging flow. USDA fallback remained later work until Phase 12.5.

Phase 11 is complete enough to move forward. It also includes camera
permission handling, native iPhone scanner testing and fixes, save/unsave and
serving multiplier reuse through the selected-food flow, and UPC-A/EAN-13
normalization for common Canadian/US packaged foods.

Phase 11 does not implement AI/RAG logging, photo recognition, saved meals,
custom graphs, streaks/reporting UI, recommendation engine changes, full
micronutrient editing UI, real auth, deployment, or TestFlight.

## Phase 12 — RAG-Assisted AI Text Logging — Complete

- Describe Meal flow for natural-language meal text
- Gemini-backed text parse provider behind a backend provider abstraction
- backend-only AI provider environment variables
- deterministic lexical retrieval from trusted `FoodItem` data
- user review, edit, remove, and partial selection before saving
- transactional selected-food confirmation through normal `FoodLog` snapshots
- no vector database, embeddings, photo logging, or automatic save

AI must not become the nutrition source of truth. Phase 12 uses AI only to
parse and structure meal intent; nutrition comes from matched trusted food data.

## Phase 12.5 — Generic Food Nutrition Lookup — Complete / Ready To Commit

- USDA FoodData Central as the first generic food nutrition source
- backend-only USDA/FDC API key handling
- USDA/generic candidates available in AI text logging and normal food search
- local FoodItems rank before USDA/generic candidates
- USDA fallback after local recent, saved, custom, app-owned, cached barcode,
  and Open Food Facts food matches
- nutrient normalization into existing FoodItem columns and normalized
  nutrient rows
- explicit serving basis on USDA candidates, such as `per 100 g`
- candidate selection/change in AI review rows
- serving multiplier changes recalculate visible nutrition previews for
  item-based logging flows
- explicit FoodLog-level nutrition overrides
- Simple mode edits only main nutrients
- Complex mode can edit supported normalized nutrient catalog entries
- user review remains required before saving

Phase 12.5 makes generic foods such as eggs, banana, rice, chicken, and toast
available as nutrient-backed candidates without letting Gemini invent
nutrition. USDA failures degrade safely to local-only results. User nutrient
edits are saved as FoodLog snapshot overrides only and must not mutate trusted
USDA, Open Food Facts, global, or cached FoodItem records. AI-estimated
nutrition remains deferred.

## Phase 12.6 — AI-Estimated Nutrition Fallback — Active / Next Candidate

- only used after local, custom, saved, recent, cached barcode, Open Food
  Facts, and USDA trusted sources fail
- clearly labeled low-trust or AI-estimated
- user-reviewed before saving
- saved as a FoodLog-level estimate/override only
- does not create trusted FoodItems
- starts with basic calories and macros only
- does not hallucinate full micronutrients

AI-estimated fallback is a last-resort speed feature, not a trusted food-data
source. It must remain visibly different from local/OFF/USDA-backed logging.

## Phase 12.7 — Food Coverage + Candidate Ranking Improvements

- improve USDA ranking quality first
- prefer common generic foods over odd or irrelevant matches
- examples:
  - plain banana should prefer raw banana over banana powder
  - eggs should prefer common egg variants such as raw, boiled, fried,
    scrambled, or egg white depending on user wording
  - salmon should avoid irrelevant branded or unusual results when a generic
    match is expected
- evaluate Canadian Nutrient File, improved Open Food Facts text search, and
  commercial APIs later

## Phase 12.8 — Serving Intelligence / Household Unit Conversion

- safer conversions for `1 egg`, `2 eggs`, `1 slice`, `1 cup`, `100 g`, and
  similar serving language
- preserve honest `needs_review` state when conversion is uncertain
- do not imply precise gram conversion unless the backend has a safe basis

## Phase 12.9 — Recipes And Mixed Meals

- homemade meals
- ingredient-based logging
- reusable recipes
- mixed-meal review and reuse without making AI nutrition authoritative

## Phase 13 — Custom Food Library And Saved Foods

- save adjusted logs as reusable custom foods when safe
- improve saved and recent food reuse
- default serving preferences
- personal food library behavior
- clearer distinction between trusted global foods and user-custom foods

## Phase 14 — Photo Food Logging

- image capture/upload
- food recognition
- portion estimation
- retrieval matching against trusted food data
- confidence/review state
- user edits before saving
- Simple confirmation UI
- Complex nutrient detail review

Photo logging comes after food database and RAG foundations.

## Phase 15 — Streaks + Better Reporting

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

## Phase 16 — Custom Graphs + Complex Analytics

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

## Phase 17 — Recommendation Engine 2.0

- recommendations informed by richer nutrient summaries
- better confidence and evidence display
- better Simple/Complex recommendation density
- optional AI wording over backend-decided facts only

AI must not calculate analytics, identify deficits, decide recommendations, or
query the database directly.

## Phase 18 — Real Auth + User Accounts

- Supabase Auth integration at the existing current-user boundary
- user-isolation regression coverage
- account lifecycle behavior
- CI pinned to Node 22
- repeatable development-build and environment guidance

Do not build custom password authentication or production-scale infrastructure.

## Phase 19 — Deployment / TestFlight Readiness

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
