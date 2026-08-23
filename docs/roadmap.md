# Roadmap

This roadmap records implemented state and intended sequencing. It does not
override the engineering rules in `AGENTS.md` or locked architecture and schema
decisions.

Historical remote phase labels are retained only where they explain prior
planning or implementation history. The current remaining roadmap is listed
explicitly below and takes precedence over those historical labels.

## Current Roadmap Status

```text
Phase 17 — complete
Phase 17.5 — complete: Custom Analytics, Micronutrients, and Hydration
Phase 18/19 — in progress: Food Data + Intelligent Retrieval
Phase 20 — Real Accounts and User Isolation
Phase 21 — Full Complex-Mode Micronutrient Editing
Phase 22 — Recommendation Engine 2.0
Phase 23 — Water and Supplement Tracking
Phase 24 — Frontend and Food-Logging Flow Redesign
Phase 25 — External MVP Beta
Phase 26 — Offline Logging and Synchronization
Phase 27 — Frequent Foods, Meal Shortcuts, and Lightweight Saved Meals
Phase 28 — Experimental Grocery Recommendations
Phase 29 — Wearable and Health Data Integration
```

Phase 18 and Phase 19 are executed as one combined macro phase named
**Phase 18/19 — Food Data + Intelligent Retrieval**. The historical labels and
later phase numbers remain unchanged.

Phase 17.5 is complete. Its final implementation baseline is
`e70ccb514b0c9bd65cc9ba1c0bdea57d207f6043`; user-operated physical iPhone
visual validation passed on 2026-08-21. Exact 390/393 Simulator evidence
remained unavailable because of the CoreSimulator/runtime environment and was
superseded as a completion blocker by the accepted physical-device review.

The Phase 18/19 implementation branch contains the approved provider,
retrieval, ranking, benchmark, and index-lifecycle work. PostgreSQL migration
and persistence measurement, live benchmark baseline/holdout evidence,
Pinecone validation, and Railway staging remain explicit external gates before
the macro phase can be closed.

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
- fixed development mock-user boundary (historical foundation; replaced by
  Firebase identity mapping in local Phase 16)
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

Phase 15 — Streaks and Better Reporting — and the Phase 15.5 reporting redesign
implementation are merged. Reporting accessibility and small-device/native
validation follow-up remains carryover work.

## Phase 15 — Streaks and Better Reporting

The reporting implementation is merged. Reporting is calculated on demand from
authoritative FoodLogs and WeightLogs; no report snapshots or schema changes
are introduced. Accessibility and small-device/native validation follow-up
remains open before reporting closeout is treated as fully complete.

### Phase 15.5 — Approved Figma Reporting Implementation

Phase 15.5 was an implementation-only visual convergence pass. The approved
Figma masters remain the production visual source of truth. Automated coverage
passed and the implementation was merged; native validation and physical-iPhone
visual follow-up remain carryover work.

- Figma file: `GFLStsF0ADwaizoVKGeLny`
- Product masters: Progress `200:3146`, Insights 390 `200:3228`, Insights
  320 `200:3364`, and Streak `200:3500`
- Shared references: reporting icons `181:1078`, exact grace laurel `79:859`,
  calendar grace `49:46`, calendar laurel `195:928`, shared artwork `204:1354`,
  parity gate `204:2137`, and implementation rules `204:2180`
- Exact implementation colors include white `#FFFFFF`, ink `#0E0E0E`, logged
  progress `#76DBA0`, flame red `#EA1226`, and completion amber `#FFB80D`.
- Missing macro or nutrient information requires a data-path audit and
  precise state handling; it must not be replaced by a visual placeholder.

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
- deterministic data thresholds and omission of unavailable metrics
- Sunday-through-Saturday calendar weeks
- equivalent elapsed current/previous comparison windows
- one grace day per streak without increasing the logged-day headline
- independent Progress and Insights loading/error boundaries
- Simple-mode focused nutrients and deeper Complex-mode available nutrients
- charts, custom ranges, notifications, exports, and historical goal versioning remain deferred

### Phase 15.5.1 — Reporting Goal And Terminology Polish — Implemented; validation follow-up remains

This tightly scoped follow-up preserves the approved Progress, Insights, and
Streak layouts while closing the reporting data and copy gaps. The existing
`UserGoal` model is extended with nullable daily carbs, fat, fiber, sugar-limit,
and sodium-limit values. Onboarding writes deterministic derived values for new
users; reports lazily derive missing values for legacy rows so existing users
are not stranded without goals. Explicit values supplied through the goals API
remain authoritative.

Reporting exposes typed daily goals, direction, source, period-adjusted goals,
and truthful percentages. Target/minimum metrics are protein, carbohydrates,
fat, fiber, and calories; sugar and sodium are limit metrics and may exceed
100% without being presented as positive achievement. The existing report
eligible-day definition remains the period denominator rule. Missing setup,
unrecorded nutrients, recorded zeroes, and invalid denominators remain distinct.

The only user-facing tracking mode names are `Simple` and `Complex`. The stored
`simple`/`complex` enum remains unchanged to avoid an unnecessary migration.
No new visual design work is included. The implementation and automated
validation are complete; native simulator parity and final physical-device
visual approval remain follow-up validation.

## Local Phase 16 — Firebase Authentication And Railway Readiness

Status: complete. Local, hosted Railway staging, automated, and physical
validation are complete; production resources and paid external distribution
remain deferred. The free standalone installation delivered by Phase 17 is
recorded in the local Phase 17 entry below.

- Firebase Authentication is the active identity boundary for email/password
  and Google. The API verifies Firebase bearer tokens, maps a Firebase UID to
  the application-owned UUID, and scopes user-owned data from that server-side
  identity.
- AuthBootstrap has one application-lifetime owner above route groups. It owns
  one Firebase token listener and idempotent route selection; navigating between
  loading, signed-out, onboarding, and authenticated screens must not restart
  initialization.
- A verified Firebase session whose setup status cannot be loaded enters a
  stable recovery route. It keeps the session, never retries automatically,
  and exposes explicit Retry and Sign Out actions.
- Apple Sign In code remains preserved but disabled pending Apple capability
  and provider approval. It is intentionally absent from the current UI and
  is not physically validated in this phase.
- Railway staging uses one explicitly named staging environment containing the
  API and private PostgreSQL service. The API build/start/Prisma migration
  lifecycle, health route, CORS, server-only variables, hosted migrations, and
  public HTTPS health were validated. Production resources remain separate and
  were not changed.
- Physical hosted validation covered setup-status, onboarding, persistence,
  restoration, sign-out, ownership, provider flows, and disposable deletion.
  Photo candidate adjudication and the optional API-unavailable check remain
  `Not tested`; no unperformed item is inferred as passing.
- Immediate permanent account deletion uses recent provider reauthentication,
  idempotent cross-system coordination, ownership cascades, and safe retryable
  errors. A deleted Google identity may register again, but it receives a new
  empty application account and no prior data returns.

### Phase 16 validation record

- Automated API, mobile, ownership, security, lint, typecheck, build, Prisma,
  formatting, and diff checks passed under Node 22 and pnpm 10.34.3.
- Railway staging physical validation passed for Firebase authentication,
  setup-status, onboarding, food/weight persistence, USDA search, Open Food
  Facts barcode lookup, Gemini parsing, photo analysis, nutrition estimation,
  session restoration, sign-out, ownership isolation, and account deletion.
- Apple Sign In remains preserved but disabled pending external capability and
  provider approval. The local Phase 17 standalone Release installation is
  complete; paid external distribution remains deferred.

## Historical remote roadmap label — Phase 16 Custom Graphs and Complex Analytics

This old remote label is retained for historical context only. The same product
scope is now owned by completed Phase 17.5 immediately after completed Phase 17;
it is not orphaned or unassigned.

- customizable graphs
- metric selection
- standard and custom date ranges
- metric comparisons
- saved graph preferences
- calorie, protein, macro, weight, and goal trends
- micronutrient patterns
- caffeine, sodium, fiber, and sugar analysis
- future compatibility with water, supplement, and wearable data

## Local Phase 17 — Free Xcode Standalone iOS Installation — Complete

Status: Complete. The free local standalone iOS staging installation passed
automated validation and user-operated physical-device validation.

Phase 17 delivered a repeatable local Release installation using Expo
Continuous Native Generation, Xcode, the free Apple Personal Team, the existing
iOS bundle identifier, Firebase iOS configuration, and the existing Railway
staging API. The same command remains the documented reinstall workflow. The
generated `apps/mobile/ios/` directory remains ignored and is removed only
after standalone evidence is recorded.

- `corepack pnpm ios:staging-release` validates Node/pnpm, staging selectors,
  the public/server variable boundary, Railway staging API safety, Firebase
  plist, Google URL scheme, toolchain, device visibility, disk space, and
  generated native state before clean prebuild and CocoaPods preparation.
- The workflow persists the validated Release handoff only in ignored generated
  `apps/mobile/ios/.xcode.env.local`, disabling dotenv fallback for the separate
  Xcode bundle process. After a Release build,
  `corepack pnpm ios:staging-release -- --verify-release-artifact` proves the
  non-empty JavaScript bundle and validated staging API target before a device
  reinstall.
- The generated project adopts one default UIScene application for the iOS 27
  SDK. SceneDelegate owns the window and one React Native factory startup while
  AppDelegate preserves Firebase and URL/deep-link forwarding; the preparation
  guard rejects incomplete scene adoption before Xcode opens.
- Xcode remains responsible for Personal Team selection, automatic signing,
  device registration/trust, Release installation, and physical validation.
- Release acceptance requires JavaScript bundling, Firebase/Google auth,
  Railway staging reads and writes, barcode and photo/AI flows, session
  restoration, and operation after disconnecting from the Mac with Metro,
  Docker, and the local API stopped.
- The free seven-day signing expiration is accepted and documented. EAS,
  TestFlight, and App Store Connect remain deferred to the paid-distribution
  work in Phase 25; production Railway, Apple Sign In, Android standalone
  distribution, and unrelated native refactors are also deferred.

### Phase 17 completion record

- Automated repository validation passed under Node 22 and pnpm 10.34.3,
  including focused staging workflow/configuration, deployment-target,
  ExpoModulesJSI compatibility, and UIScene regression suites; mobile Vitest,
  mobile Jest/RNTL, mobile lint/typecheck, root lint/typecheck/build, and
  generated-native safety checks passed.
- The safe local `food_tracker_test` PostgreSQL database was unavailable for
  the database-dependent API suite; Docker was not started. Repository-wide
  formatting still reports only unrelated protected or untracked tool files;
  all changed Phase 17 owner documents pass the focused Prettier check.
- Codex performed the unsigned/native compiler validation and resolved the
  Xcode 27 CocoaPods, ExpoModulesJSI, and UIScene compatibility boundaries.
- The user performed Personal Team signing, Release compilation, physical
  iPhone installation, launch, and standalone operation with Metro, Docker,
  the local API, and the Mac unavailable. The user reported the application
  worked completely; Codex did not operate the phone.
- The post-build verifier passed for a non-empty JavaScript bundle, canonical
  metadata, staging environment, and the validated Railway staging target.
- The guarded cleanup removed only the ignored generated `apps/mobile/ios/`
  directory after evidence capture.

## Phase 17.5 — Custom Analytics, Micronutrients, and Hydration — Complete

Phase 17.5 is complete after the automated/staging gate and user-operated
physical iPhone visual acceptance on 2026-08-21. The accepted implementation
baseline is `e70ccb514b0c9bd65cc9ba1c0bdea57d207f6043`. The current Calories
reference-band treatment, Logging Consistency overview layout, chart system,
nutrient palette, and Overview composition were explicitly accepted with no
further requested visual changes.

- Customizable nutrition and weight graphs, metric selection, and 7-day,
  30-day, 90-day, and custom date ranges
- Comparisons of up to two compatible metrics, saved graph preferences, and
  one primary pinned Complex view
- Long-term calorie, protein, carbohydrate, fat, weight, micronutrient,
  caffeine, sodium, fiber, and sugar patterns
- Hydration analytics and canonical amount/time Water logging in Simple and
  Complex mode; the initial server-owned hydration goal is `2000 mL/day`
- Simple focused analytics versus Complex full-catalog exploration,
  comparisons, custom ranges, coverage filters, contributors, and saved views
- Accessible, responsive mobile graph behavior, including 320pt support

Analytics uses two orthogonal states: `LoggingDayState` describes FoodLog
behavior (`complete`, `partial`, `unlogged`, with the current local day marked
`in_progress`), while `MetricDataState` describes selected-metric availability
(`recorded`, `partial`, or `unknown`). Unknown is never zero, unlogged is never
zero, missing nutrient/provider data never downgrades logging completeness, and
recorded zero is numeric zero. The initial core-meal classification is a
centralized/versioned implementation policy, not an immutable product rule.
The Complex coverage enum is internally `all_logged_days`,
`complete_and_partial`, or `complete_only`; the first retains the approved
user-facing label “All recorded days.” Weekly and monthly buckets preserve
independent logging and metric counts rather than collapsing mixed states.

Target, minimum, limit, and true lower-plus-upper range references remain
distinct. A true range requires both authoritative bounds; a single target is
never fabricated into a range. Phase 17.5 does not add target-editing UI.

Calories and Weight forecasts are deterministic, backend-owned, statistically
independent, seven-day projections with rolling backtesting and eligibility and
stability gates. Initial thresholds are centralized engineering policy
constants, not immutable product requirements, and unstable or insufficient
data produces an unavailable state.

The approved implementation decomposition is:

- Slice A — Analytics domain foundation
- Slice B — Hydration persistence and canonical logging
- Slice C — Reusable chart system and core trends
- Slice D — Complex micronutrient analytics
- Slice E — Configuration, custom range, and comparison
- Slice F — Saved/pinned views and reporting integration
- Slice G — Forecasts and state/responsive hardening

The production Figma source is file `GFLStsF0ADwaizoVKGeLny`, page `338:21`.
The final implementation contract is `517:73`, and the final production-node
index is `524:21`; hidden or older drafts are historical only.

The canonical Phase 17.5 Water model is separate from FoodLog and excludes
water contained in food. `waterTrackingEnabled` remains for compatibility but
does not gate visibility. Supplements remain deferred.

### Phase 17.5 completion summary — 2026-08-21

- Custom analytics: 7D, 30D, 90D, and custom ranges; backend-owned
  aggregation, comparisons, saved views, pinned analysis, chart axes/grids,
  metric-specific chart families, and missing-data semantics.
- Micronutrients: the Complex nutrient library and detail routes, reference
  contracts, recorded/partial/unknown coverage, contributors, curated Simple
  highlights, and authoritative missingness handling.
- Hydration: Simple and Complex presentation, the default `2000 mL` goal,
  WaterLog persistence, quick add, Other Amount, editable history, and trend
  reporting.
- Forecasting: deterministic/statistical Calories and Weight forecasts with
  no LLM forecasting.
- Logging Consistency: complete, partial, unlogged, and current-day
  `in_progress` meal-behavior semantics independent from calorie adherence.
- Offline/cache: versioned, user-partitioned analytics cache with section-level
  stale/error handling and preservation of valid committed analytics after a
  failed replacement.
- QA/validation: deterministic current-date staging fixtures, broad nutrient
  and state coverage, current-week/current-month coverage, automated validation,
  and accepted physical-device visual review.

Exact 390pt and approximately 393pt Simulator evidence remained unavailable
because of the CoreSimulator/runtime environment. Broader Simulator evidence
was completed, and the unavailable exact viewport was non-blocking after the
user's physical iPhone review passed.

Phase 17.5 also established reusable execution guidance: choose single-threaded
work by default, delegate only independent bounded tasks, cap concurrency and
reasoning cost, separate implementation/automated/runtime/review/physical
gates, use deterministic staging evidence, and record external blockers
without substituting invalid proof. These rules apply to future phases without
requiring agents.

## Phase 17 (historical remote roadmap) — Deployment and Security Foundations — Superseded

The repository-side portion of this infrastructure scope was reprioritized into
local Phase 16. Railway staging creation and hosted validation are complete;
production deployment, operational backups, and paid external distribution
remain future work. This historical scope was superseded by the realigned local
Phase 16 and the completed local Phase 17 free-Xcode standalone checkpoint
above; its provider-neutral planning text is retained as history.

This historical scope remains provider-neutral. Its provider-research sentence
is retained as history only; the completed local Phase 17 did not reopen that
decision.

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

This is the historical decomposition of the current combined Phase 18/19
macro phase. Execution is tracked in the committed Phase 18/19 plan and
execution ledger; the combined phase must close before Phase 20 begins.

- evaluate provider options
- improve Canadian food coverage
- improve branded-food coverage
- investigate restaurant-food coverage
- improve serving and nutrient completeness
- provider-neutral normalization
- deduplication
- source attribution
- source-quality review
- caching
- fallback behavior
- failure handling
- legal terms, cost, quotas, and rate-limit review

## Phase 19 — Semantic Search, Typo Handling, and Expanded Retrieval

This is the historical decomposition of the current combined Phase 18/19
macro phase. It remains listed separately to preserve roadmap numbering.

- typo tolerance
- synonyms
- word-order differences
- preparation and food-form understanding
- expanded candidate retrieval
- semantic similarity
- deterministic post-retrieval ranking
- safeguards against irrelevant semantic matches
- embeddings
- vector-assisted candidate retrieval

Semantic systems retrieve candidates; they do not independently decide that a
candidate is trusted. AI must not directly query the database, become the
nutrition authority, or bypass trusted candidate review. The dedicated search
page and final visual interaction belong in Phase 24.

## Phase 20 — Real Accounts and User Isolation

- Firebase authentication, identity mapping, protected routing, and hosted
  staging foundations already exist from Phase 16; this phase is the remaining
  product account lifecycle and isolation work.
- account deletion
- identity-provider linking and conflict handling
- account recovery
- durable consent and legal readiness
- provider and session management
- expanded user-isolation regression coverage
- remaining pre-beta account requirements

Authentication determines who the user is. Authorization determines which
resources that user may access. Both boundaries remain required.

Apple Sign In remains deferred or disabled until its provider and native
capability requirements are deliberately reopened.

## Phase 21 — Full Complex-Mode Micronutrient Editing

- full supported vitamin and mineral editing
- caffeine, sodium, fiber, sugars, and other normalized nutrient fields
- explicit unknown-versus-zero behaviour
- FoodLog snapshot corrections
- protection of trusted source FoodItems
- uncluttered Simple mode

## Phase 22 — Recommendation Engine 2.0

- stronger evidence and confidence
- richer nutrient-aware recommendation facts
- prioritization and repetition control
- different Simple and Complex presentation density
- optional AI wording over backend-decided facts only

AI must not calculate trends, identify deficits independently, query the
database, or decide recommendation facts.

## Phase 23 — Water and Supplement Tracking

Phase 17.5 owns the first canonical Water logger and hydration analytics. This
later phase retains the deferred supplement product scope and any future
water/supplement integration that is not duplicated by Phase 17.5.

Water:

- historical roadmap intent only; do not reimplement the Phase 17.5 Water
  logger or hydration analytics here

Supplements:

- reusable supplement entries
- dosage amount and unit
- serving, schedule, or quantity behavior
- logged time
- optional nutrient contribution
- History
- edit and delete
- protection against nutrient double counting
- reporting and History integration
- Simple and Complex presentation decisions

Water must not be represented as a fake FoodLog. Supplements must not be
treated as normal meals or expanded into medication management. The old
assumption that all Water work waits for Phase 23 is superseded by Phase 17.5;
this phase remains numbered to preserve the earlier roadmap record.

## Phase 24 — Frontend and Food-Logging Flow Redesign

This phase is the broader frontend and food-logging flow redesign. It is not an
authentication login-screen redesign and is not automatically a full rewrite of
every screen.

- interactive food-logging method selection
- improved curved or floating add control
- sequential logging flows
- stronger information hierarchy
- clearer Simple and Complex identities
- reduction of crowded temporary method-list screens
- navigation and product polish

The redesign is placed after the required MVP features so it can account for
the actual product instead of being repeatedly redone after each feature.

## Phase 25 — External MVP Beta

This is the official MVP completion milestone. The MVP is complete once the
external beta, including the paid TestFlight/App Store distribution path, is
prepared and distributed.

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
