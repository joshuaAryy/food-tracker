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

## Phase 12.6 — AI-Estimated Nutrition Fallback — Complete / Ready To Commit

- only user-triggered from unresolved AI text logging rows
- not available in normal food search yet
- not auto-generated after parsing
- trusted candidates are rechecked before estimating
- clearly labeled low-trust or AI-estimated
- user-reviewed and editable before saving
- saved as an unlinked FoodLog-level snapshot only
- does not create trusted FoodItems
- does not pollute USDA, Open Food Facts, local, or cached trusted-food data
- starts with calories, protein, carbs, fat, and optional main editor fields
- does not hallucinate full micronutrients
- uses no Prisma schema changes

AI-estimated fallback is a last-resort speed feature, not a trusted food-data
source. It must remain visibly different from local/OFF/USDA-backed logging.
The final implementation also tightened trusted-candidate gating so weak
generic token matches such as `bowl` or `meal` do not block fallback, while
common foods such as banana and eggs still resolve through trusted candidates.
USDA lookup now overfetches internally and skips stale or failed detail rows so
common generic foods do not depend on Gemini. Gemini estimate handling accepts
valid JSON from any response text part, rejects invalid or micronutrient-heavy
output, treats upstream 429/503 as temporary unavailability, and reports
`MAX_TOKENS` cutoffs separately after increasing the estimate output budget.

## Phase 12.7 — Food Coverage + Candidate Ranking Improvements — Complete / Commit-ready

- centralized trusted candidate ranking across normal food search, AI parse
  retrieval, and AI-estimate trusted-candidate rechecks
- uses exact/singular/plural matches, lexical identity tokens, complete
  compound-food identity, requested preparation words, source/user signals,
  nutrition completeness, and serving usability
- high-quality generic USDA candidates may outrank weak local/cached/branded
  matches for unbranded common-food queries
- category-aware penalties avoid odd forms such as unrequested dehydrated,
  powdered, baby-food, restaurant, school, commercial-mix, or prepared-meal
  rows while preserving requested forms such as `dried apple`, `protein
  powder`, `raw apple`, and `cooked rice`
- common foods such as banana, eggs, rice, chicken breast, milk, oats, apples,
  salmon, toast, peanut butter, and Greek yogurt now have regression coverage
- USDA enrichment now pre-ranks search metadata before detail fetches, limits
  detail windows, uses bounded concurrency and short per-detail budgets, and
  returns partial usable results when external lookup is slow
- process-local USDA caches cover search metadata, normalized detail rows, 404
  misses, and short-lived timeout misses without adding schema or provider
  changes
- ranking now gates preparation/form matches behind core food identity, scores
  unrequested crackers/candy/chocolate/breaded/lunchmeat/chips and misleading
  food modifiers down, and uses relevant-metadata backfill only within the
  existing USDA time budget
- high confidence now requires default-food suitability in addition to core
  relevance; modifier searches may use a bounded core-food metadata fallback
  before ranking combined results with the original query
- final completion pass adds deterministic edible-default profiles and a
  `visibleRelevant` versus `selectionEligible` distinction: raw/dry/product
  alternatives remain searchable but cannot auto-select or block AI fallback
  for plain cooked-default foods; one safe USDA fallback query covers aliases
  such as `steak -> beef steak` without changing the public API
- complete compound identity is required for default suitability and
  `selectionEligible`; partial matches remain visible but cannot become
  trusted/high-confidence selections. Validated compounds include sweet
  potato/yam, rice noodles, egg sandwich, whole milk, oat milk, steak sauce,
  banana pudding, peanut butter cookies, almond milk, chicken sandwich, and
  turkey sandwich
- final retrieval-quality guardrails preserve USDA metadata relevance before
  local pre-ranking, detect viable cooked/default metadata without requiring
  detail nutrients, use one form-preserving cooked fallback query, and keep
  foreign-head composites out of bounded detail enrichment
- candidate adequacy now distinguishes technically relevant product/composite
  rows from an edible default before using the single focused fallback; empty
  USDA metadata responses are intentionally not retained in the process cache
- one logical enrichment may perform one primary plus one fallback metadata
  query; the configured allowance remains 20 logical enrichments per limiter
  window, so metadata traffic is capped at 40 calls per window
- no public `searchDepth` or show-more mode was added; expanded search remains
  deferred until a mobile caller and product workflow require it

Phase 12.7 is complete and commit-ready. It passed automated validation, API
terminal smoke testing, mixed regression/out-of-sample testing,
compound-identity holdout testing, and physical-phone smoke testing. Final
validation used Node `v22.23.0`, pnpm `10.34.3`, PostgreSQL database
`food_tracker_test`, and 13 test files with 326 passing tests. Phase 12.8
serving intelligence / household-unit conversion followed this foundation;
no new roadmap phase is introduced here.

Known non-blocking limitations remain targeted follow-up work: USDA secondary
ordering and naming can be imperfect; generic banana can still show dessert
products below raw banana; generic eggs can prefer prepared scrambled/omelet
variants; generic sweet potato can include processed products; breaded chicken
can still rank meatless breaded products too highly; unknown foods outside the
small deterministic profile set primarily use lexical ranking; and semantic
typo handling, embeddings, vector search, recipes, and additional providers
remain out of scope.

## Phase 12.8 — Serving Intelligence / Household Unit Conversion — Complete

12.8A through 12.8F are complete. The shared engine resolves exact, standard,
or trusted food-specific relationships; the backend authoritatively persists
trusted creates and snapshot-backed updates; and Food Log and AI rows provide
provisional amount/unit previews that are replaced by authoritative API results
on save. Serving quantities obey the existing two-decimal persistence contract,
including safe refusal of conversions that would round to zero.

Trusted USDA serving options are normalized conservatively from `amount`,
`gramWeight`, `measureUnit.name`, `modifier`, and `portionDescription`.
Validated egg, slice, bar, serving/container, and whole-item options preserve
stable IDs and provider weights. Missing or invalid portions are discarded;
ambiguous provider options do not become defaults. Foods with a physical basis
remain usable through g/kg/oz/lb or mL/L even when no alternate serving exists.

AI quantity-only counts use candidate-specific trusted metadata internally to
convert into grams or millilitres. The editable row exposes physical units and
hides the internal whole-item source option. Candidate changes preserve the
parsed count, clear old provenance, and recalculate from the replacement
candidate. Raw parser status remains separate from the resolved preview and
save gate. No universal apple, egg, banana, or other food weight is inferred.

The backend remains authoritative for serving resolution, nutrient scaling,
rounding, and immutable FoodLog snapshots. Legacy NULL serving snapshots retain
their compatibility edit path, snapshot-backed edits recalculate from the
stored basis, and Simple and Complex totals use the same authoritative stored
values. Automated validation and final physical-device smoke testing passed.

## Phase 12.9 — Recipes And Mixed Meals

- homemade meals
- ingredient-based logging
- reusable recipes
- mixed-meal review and reuse without making AI nutrition authoritative

### Phase 12.9A Slice 4 — Mobile Recipe Experience Implemented

Slices 1–3 establish recipe persistence, frozen authoritative ingredients,
recipe CRUD, and immutable recipe-to-FoodLog materialization. Slice 4 adds the
mobile list, builder, detail, logging, archive, and recipe-origin History edit
surfaces using the existing Food Log modal stack and trusted serving controls.

Automated validation and the documented physical-device recipe smoke test are
complete. Phase 12.9A is complete.

### Phase 12.9B Slice 3 — Mobile Mixed Meals And Manual Foods Implemented

Slices 1–2 establish mixed-meal persistence and reusable manual FoodItems.
Slice 3 adds the Food Log mixed-meal builder, shared serving-details navigation,
USDA/manual ingredient selection, backend preview/logging, optional atomic
save-as-recipe, and manual-food management UI. Automated validation and all 18
physical-device checks are complete.

### Phase 12.9B — One-Off Mixed Meals And Manual Ingredients Complete

Phase 12.9B combines one-off mixed meals and manual ingredients. It must not
blur the reusable-recipe boundary, make AI nutrition authoritative, or weaken
the trusted FoodItem/serving workflow established by Phase 12.9A.

Phase 12.9B is complete. The next roadmap phase is Phase 13 — Custom Food
Library And Saved Foods.

Phase 12.9 is fully complete: 12.9A reusable recipes and 12.9B mixed meals
and manual ingredients both passed automated and physical-device validation.

## Phase 13 — Custom Food Library And Saved Foods

- **Complete**
- Slice 1 backend library and safe reuse — **Complete**
- Slice 2 mobile library, consumer integration, and physical-device validation — **Complete**
- Saved Foods, My Foods, Recent Foods, Archived Foods, default-serving
  preferences, safe FoodLog conversion, archive/restore, and consumer
  prefills are implemented.
- Automated validation passed.
- Physical-device validation passed.
- The deferred multi-method Food Log selector redesign remains future work.

## Phase 14 — Photo Food Logging — Complete

Phase 14 was completed and merged to `main` through PR #1 at merge commit
`e47287c`. C2 represents the completed Phase 14 photo food logging scope.
Automated validation passed with 44 test files and 899 passing tests. The
paired-iPhone validation was performed and confirmed by the user; Codex did not
operate the device. No photos are persisted.

Completed scope includes image capture and upload, food recognition,
independent component/composite review, portion estimation, trusted retrieval,
canonical external materialization, AI-estimate fallback, quantity
normalization, flexible compatible servings, trusted/estimated mixed review,
server-authoritative atomic save, History persistence, canonical local reuse,
and safe Back/Close navigation.

The next feature phase is Phase 15 — Streaks and Better Reporting.

## Phase 15 — Streaks and Better Reporting

- current and longest logging streaks
- weekly logging consistency
- calorie adherence
- protein adherence
- weight trends
- goal progress
- weekly reports
- monthly reports
- Simple-mode summaries
- deeper Complex-mode reporting
- data-coverage and incomplete-data handling

## Phase 16 — Custom Graphs and Complex Analytics

- customizable graphs
- metric selection
- standard and custom date ranges
- metric comparisons
- saved graph preferences
- calorie, protein, macro, weight, and goal trends
- micronutrient patterns
- caffeine, sodium, fiber, and sugar analysis
- future compatibility with water, supplement, and wearable data

## Phase 17 — Deployment and Security Foundations

This phase remains provider-neutral. The provider decision will be researched
during Phase 17 planning.

- hosted backend
- managed production-style database
- development, test, staging, and production environment separation
- secure secret management
- deployment workflow and automation
- production database migration workflow
- backups and recovery
- health checks
- monitoring and sanitized diagnostics
- dependency and vulnerability checks
- least-privilege access
- request validation
- authentication-ready security boundaries
- rate limiting
- abuse prevention
- AI guardrails
- image and upload guardrails
- secure headers, HTTPS, and network security
- production engineering documentation
- internal TestFlight engineering build

This phase has two explicit goals: product and infrastructure readiness, and
learning production engineering, security, guardrails, and sound
infrastructure decision-making. The internal TestFlight build is an
engineering smoke build, not the external MVP beta.

## Phase 18 — Additional Food Providers

- evaluate provider options
- improve Canadian food coverage
- improve branded-food coverage
- investigate restaurant-food coverage
- improve serving and nutrient completeness
- provider-neutral normalization
- deduplication
- source attribution
- caching
- failure handling
- legal terms, cost, quotas, and rate-limit review

## Phase 19 — Real Accounts and User Isolation

The authentication provider remains undecided and will be selected during Phase
19 planning.

- account registration
- sign-in and sign-out
- persistent sessions
- server-side authentication verification
- recovery behaviour
- account deletion behaviour
- authentication and authorization boundaries
- strict resource ownership
- user-isolation regression coverage
- replacement of fixed mock-user runtime behaviour
- secure staging and production configuration

Authentication determines who the user is. Authorization determines which
resources the user may access.

## Phase 20 — Semantic Search, Typo Handling and Expanded Retrieval

- typo tolerance
- spelling correction
- aliases
- semantic similarity
- embeddings
- vector-assisted candidate retrieval
- compound-food understanding
- unusual phrase handling
- expanded result retrieval
- pagination or cursor-based loading
- incremental result chunks
- source-aware search
- deterministic ranking and trust gates

Semantic systems retrieve candidates; they do not independently decide that a
candidate is trusted. Backend retrieval and pagination belong in this phase.
The dedicated search page and final visual interaction belong in Phase 24.

## Phase 21 — Water and Supplement Tracking

Water and supplements remain separate domain models.

Water:

- quick-add amounts
- reusable container sizes
- daily goal and progress
- History
- edit and delete
- reporting and graph integration

Supplements:

- reusable supplement entries
- dosage amount and unit
- logged time
- optional nutrient contribution
- History
- edit and delete
- protection against nutrient double counting

Water must not be represented as a fake FoodLog. Supplements must not be
treated as normal meals or expanded into medication management.

## Phase 22 — Full Complex-Mode Micronutrient Editing

- fuller vitamin and mineral control
- caffeine
- sodium
- fiber
- sugar
- nutrient search
- FoodLog-level overrides
- richer user-created food authoring
- explicit unknown-versus-zero behaviour
- protection against accidental mutation of trusted provider records

## Phase 23 — Recommendation Engine 2.0

This is the last item in the original top-priority feature group, not the final
phase in the roadmap. It follows water, supplements, and complete Complex-mode
nutrient editing so recommendations can use the fuller MVP data foundation.

- richer evidence
- confidence based on data coverage
- prioritization
- deduplication
- recommendation lifecycle
- improving and resolved states
- positive reinforcement
- Simple-mode restraint
- Complex-mode evidence
- optional AI wording only after deterministic backend decisions

AI must not independently calculate analytics, identify deficiencies, query the
database, or decide recommendations.

## Phase 24 — Frontend and Logging-Flow Redesign

This phase reviews the application areas affected by the completed MVP feature
set. It is broader than search and food logging, but it is not automatically a
full rewrite of every screen.

- logging-method navigation
- Food Log entry structure
- dedicated food search page
- expanded-search interaction
- result loading and source presentation
- reports and graphs
- water and supplement logging
- Complex micronutrient editing
- recommendation presentation
- information hierarchy
- navigation and floating actions where needed
- Simple and Complex mode consistency
- accessibility fundamentals
- loading, empty, and error states
- physical-device usability

The redesign is placed after the required MVP features so it can account for
the actual product instead of being repeatedly redone after each feature.

## Phase 25 — External TestFlight Beta

This is the official MVP completion milestone. The MVP is complete once the
external TestFlight beta is prepared and distributed.

- App Store Connect readiness
- external tester configuration
- privacy and beta disclosures
- release configuration
- tester instructions
- feedback process
- crash and error monitoring
- account and data-isolation validation
- staged tester rollout
- upgrade testing
- beta iteration
- MVP release retrospective

## Post-MVP Roadmap

### Phase 26 — Offline Logging and Synchronization

- offline food logging
- local pending records
- reconnect synchronization
- retry behaviour
- conflict handling
- duplicate prevention
- visible sync state
- safe account-change handling
- explicit offline limitations for AI, provider, barcode, and photo workflows

### Phase 27 — Frequent Foods, Meal Shortcuts and Lightweight Saved Meals

- frequency-aware ranking
- recency and meal-time ranking
- common repeated combinations
- usual breakfast or lunch shortcuts
- same-as-yesterday actions
- lightweight saved meals
- clear distinction between saved meals and recipes

### Phase 28 — Experimental Grocery Recommendations

- suggestions based on tracked patterns
- foods already used by the user
- nutrient-oriented shopping ideas
- optional relation to saved meals
- user-controlled output
- no medical claims

This phase is experimental and non-MVP.

### Phase 29 — Wearable and Health Data Integration

- steps
- workouts
- active energy
- weight
- permission management
- source attribution
- duplicate handling
- imported-versus-manual distinction
- reporting and graph integration

This is the final numbered post-MVP phase currently planned. It does not commit
the roadmap to every wearable ecosystem.

## Deferred Without Phase Numbers

- contextual tracking
- smart meal planning
- nutrient-score concept
- meal and logging reminders
- push notifications
- broader accessibility improvements beyond required fundamentals
- account data download
- broader data export

Contextual tracking must not be implemented as a basic notes box. It should
only be reconsidered when the captured context produces a meaningful
user-facing insight. Smart meal planning remains deferred rather than numbered.

## Eventual Release Milestone

A public App Store launch is the eventual release milestone after TestFlight.
It is intentionally not assigned a phase. Timing and requirements depend on
beta feedback, critical fixes, legal/privacy readiness, and product quality.

## Not Currently Planned

- dietary preference and restriction systems
- allergy handling
- tablet-specific support
- Android beta or release
- meal-photo galleries
- progress-photo storage
- social sharing
