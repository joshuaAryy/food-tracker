# Technical Decisions

This file records locked technical decisions established during initial
planning. Changes to these decisions require explicit architecture review.

See [data-model-decisions.md](data-model-decisions.md) for locked MVP units, precision, rounding, food-log fields, meal types, and tracking-day representation. See [api-contracts.md](api-contracts.md) for locked MVP API conventions and contracts. See [prisma-schema-decisions.md](prisma-schema-decisions.md) for locked Prisma/PostgreSQL schema decisions.

## TD-001: Package Manager And Monorepo

Status: Locked

- Use `pnpm` as the package manager.
- Use `pnpm` workspaces for the monorepo.
- Do not introduce Nx.
- Add Turborepo only later if demonstrated build or task orchestration needs justify it.

Expected structure:

```text
food-tracker/
├── apps/
│   ├── mobile/
│   └── api/
├── packages/
│   └── shared/
├── docs/
├── AGENTS.md
├── README.md
├── package.json
└── pnpm-workspace.yaml
```

Reason: `pnpm` workspaces are sufficient for the current phase. Additional monorepo tooling would be premature.

## TD-002: Authentication

Status: Locked

- Supabase Auth is the intended authentication provider.
- The current development implementation uses a fixed mock user through mock auth context.
- Authenticated endpoints operate on the current user.
- Clients do not send `userId` in requests.
- User identity should eventually come from Supabase Auth.
- User-owned records reference the local `User.id`; long-term, that ID aligns with the Supabase Auth user ID.
- Do not build custom password authentication or a custom auth system.

## TD-003: Phase 2 Food Logging

Status: Locked

The implemented MVP supports manual structured nutrition entry only.

Required fields:
- `userId`
- `foodName`
- `mealType`
- `calories`
- `protein`
- `loggedAt`

Optional fields:
- `carbs`
- `fat`
- `fiber`
- `sugar`
- `sodium`
- `notes`
- `servingQuantity`
- `servingUnit`

`userId` is required in persisted records but is derived from auth context and never supplied by the client.

Each food log is one food item, not a full meal. Multiple logs may share a `mealType`. Meal grouping is not required for the MVP; an optional `mealGroupId` may be considered later.

The MVP `mealType` enum is `breakfast`, `lunch`, `dinner`, `snack`, or `other`.

Implemented manual logging flow:

```text
Manual entry
→ validation
→ database
→ analytics
→ dashboard/history
```

The current manual logging flow excludes AI parsing, nutrition matching,
automated food lookup, Open Food Facts integration, barcode scanning, and photo
recognition.

## TD-004: Future Intelligent Food Logging

Status: Locked

Automated food input belongs to a later phase and should be retrieval-assisted:

```text
User describes food or provides an image
→ AI parses intent / identifies possible foods
→ retrieval searches trusted food sources
→ backend returns structured candidates
→ user reviews and edits
→ backend saves confirmed FoodLog
```

AI parsing proposes structured entries. The user confirms them before
persistence. AI must not be the nutrition source of truth, bypass user
confirmation, invent nutrient data when trusted data is available, or replace
backend validation.

## TD-005: Timezone And Tracking Days

Status: Locked

- Store database timestamps in UTC.
- Store an IANA timezone for each user.
- Use `America/Toronto` as the default for now.
- Do not permanently hardcode the default timezone.
- Define tracking days using the user's timezone.
- Group logs by the local date produced after converting `loggedAt` into the user's timezone, not by UTC calendar date.
- Analytics must convert UTC timestamps into the user's local tracking day for daily totals, streaks, daily summaries, and weekly reports.

For a user in `America/Toronto`, a tracking day runs from local `12:00 AM` through `11:59:59 PM`.

## TD-006: Daily Summaries

Status: Locked

- Calculate MVP daily summaries on demand from `FoodLog` records.
- The frontend requests dashboard summaries from analytics endpoints.
- Do not store `DailySummary` without a demonstrated performance reason and an
  approved architecture change.
- A future `DailySummary` table may be introduced as a cache, not as the source of truth.

Reason: stored summaries can become stale when food logs are edited or deleted.

## TD-007: Analytics, Recommendations, And AI

Status: Locked

- Analytics computes deterministic facts.
- Recommendations converts facts into structured recommendation objects.
- AI is an optional future wording layer only.
- Recommendations must work without AI.

Analytics facts include calorie differences from target, protein differences from target, weight trends, seven-day averages, and goal adherence percentages.

Recommendation objects include:
- `type`
- `severity`
- `title`
- `message`
- `sourceFacts`

AI must not detect deficits, calculate deficiencies, analyze trends, decide facts, decide recommendations, or query the database directly.

AI may later rewrite recommendation wording or explain already-computed facts in a friendlier way.

## TD-008: MVP API Contracts

Status: Locked

- Use REST-style endpoints under `/api/v1`.
- Use only the standard success and error envelopes defined in [api-contracts.md](api-contracts.md).
- The current development implementation uses mock user context.
- Client requests never include `userId`.
- Date filters are local dates in `YYYY-MM-DD` interpreted in the current user's timezone.
- MVP endpoints and request/response contracts are defined in [api-contracts.md](api-contracts.md).

## TD-009: Prisma And PostgreSQL Schema

Status: Locked

- Use UUID primary keys for all models.
- Use a local `User` model; the current mock boundary may generate its ID, and
  long-term it aligns with Supabase Auth.
- Include only approved models. Phase 8 explicitly adds `FoodItem`,
  `FoodBarcode`, and `SavedFoodItem`, plus optional `FoodLog.foodItemId`, as the
  local food database foundation. Phase 9 adds `FoodItemNutrient` and
  `FoodLogNutrient` for normalized extended nutrients.
- Use the field types, enums, constraints, indexes, relations, and cascade-delete rules defined in [prisma-schema-decisions.md](prisma-schema-decisions.md).
- Do not include `DailySummary`, raw/parsed food logs, or other future models
  without explicit approval.

## TD-010: Hybrid Food Database Direction

Status: Implemented through Phase 11 for local food database and barcode lookup

Food Tracker should use a hybrid food data strategy:

- app-owned database for cached foods, user-created foods, corrected foods,
  recent foods, saved foods, saved meals, and barcode-linked foods
- Open Food Facts as the best initial source for barcode scanning and
  international/regional packaged foods
- USDA FoodData Central for generic foods, detailed nutrients, and
  standardized nutrition data

The app should not depend on one external source forever. The backend should
cache external food data into the app database where appropriate. Search should
eventually prioritize user recent foods, saved foods/meals, custom foods,
cached app foods, and then external generic/branded sources. Barcode lookup
should eventually prioritize local cached barcodes, Open Food Facts,
USDA/branded fallback where useful, and custom food creation when not found.

Phase 8 implements the app-owned local foundation only:

- `FoodItem` for globally visible app/cached foods and current-user custom
  foods
- `SavedFoodItem` for saved-food relationships
- `FoodBarcode` for local barcode records with `[barcode, regionCode]`
  uniqueness
- local barcode lookup with exact region first and `GLOBAL` fallback
- simple normalized name/brand search over visible non-archived foods
- nullable MVP nutrient columns plus unit-bearing `additionalNutrients` JSON

Phase 8 does not implement external Open Food Facts or USDA integrations,
barcode camera scanning, public barcode creation, AI/RAG logging, photo
logging, saved meals, or full Complex mode micronutrient UI.

Phase 11 implements the first barcode scanning slice:

- mobile barcode scanning uses `expo-camera` in the Expo development build
- `expo-camera` and camera permission changes require a rebuilt development
  build; Metro reload is not enough for native dependency/config changes
- generated `apps/mobile/ios/` and `apps/mobile/android/` folders remain
  uncommitted unless explicitly approved
- physical iPhone testing is required for camera/barcode work
- barcode lookup checks local `FoodBarcode` records before external data
- barcode lookup is backend-owned; mobile clients do not call Open Food Facts
  directly
- Open Food Facts is the first external packaged-food source
- usable external products are cached as `FoodItem` rows with
  `sourceType: cached_external`, `sourceProvider: open_food_facts`, and a
  linked `FoodBarcode`
- UPC-A and EAN-13 leading-zero equivalents are normalized as lookup
  candidates because iOS may report UPC-A as EAN-13
- cached Open Food Facts products may store safe `FoodBarcode` aliases for the
  equivalent UPC-A/EAN-13 forms
- normalization stores only reliable fields and preserves missing nutrients as
  unknown/null or absent
- logging still uses the existing selected-food review and
  `POST /api/v1/food-logs/from-food-item` snapshot flow
- missing or uncertain nutrients stay unknown/null or absent and are not
  fabricated

Phase 11 does not add USDA fallback, AI/RAG logging, photo recognition, saved
meals, custom reporting, recommendation changes, real auth, or schema changes.

See [food-data-and-ai-strategy.md](food-data-and-ai-strategy.md).

## TD-011: Full Nutrition For Complex Mode

Status: Implemented as backend/data foundation in Phase 9

Complex mode should eventually support full nutrition tracking. Phase 9 keeps
`calories`, `protein`, `carbs`, `fat`, `fiber`, `sugar`, and `sodium` in the
existing columns and adds a static shared nutrient catalog plus normalized
unit-bearing rows for extended nutrients on `FoodItem` and snapshot rows on
`FoodLog`.

The catalog covers carbohydrate detail, fat subtypes, amino acids, vitamins,
minerals, stimulants, and other tracked compounds. Phase 9 accepts only each
catalog nutrient's default unit; unit conversion and external source mapping
are deferred. Missing nutrient values remain nullable/unknown or absent, not
zero.

Simple mode should hide this complexity. Complex mode should expose deeper
detail later. Backend summaries now include a daily nutrient totals endpoint,
and mobile Progress/Insights must only display nutrients the backend actually
provides. Phase 9 does not implement UI, barcode scanning, external food data
integrations, AI/RAG logging, photo logging, saved meals, custom graphs, or
recommendation engine 2.0.

Standards going forward:
- do not fake nutrient values or treat unknown nutrients as zero
- do not duplicate column-backed nutrients in normalized nutrient rows
- keep `additionalNutrients` as raw/unmapped compatibility metadata only
- keep FoodLog nutrient rows as historical snapshots
- keep Simple mode simple and avoid exposing Complex nutrition detail before
  the user flow supports it
- use backend-provided nutrient data only, and do not display Complex nutrient
  charts before data exists
- keep food logging fast rather than overloading the entry flow

## TD-012: AI Is Not Source Of Truth

Status: Implemented in Phase 12 for text meal descriptions

RAG-assisted AI logging uses Gemini as the first hosted AI provider behind a
backend provider abstraction. Future provider options may include cloud-hosted
self-managed inference with Ollama, vLLM, Llama, Qwen, Gemma, Kimi-style
models, or another hosted API, but Phase 12 does not implement those options.
API keys live only in backend environment variables and are never sent to
mobile clients.

Phase 12 intentionally uses deterministic lexical retrieval only. It does not
add embeddings, a vector database, tool calls, streaming, or self-hosted model
serving.

Retrieval uses trusted sources in priority order: recent linked FoodItems,
saved foods, current-user custom foods, global/app-owned foods, and cached
external/barcode/Open Food Facts foods. Other users' custom foods must never be
returned.

AI may parse messy descriptions, split meals into likely items, estimate
serving descriptions, rank candidate matches, and generate user-friendly
explanations. AI must not silently save uncertain logs, invent nutrition data,
bypass user confirmation, become the only source for calories/macros/micros, or
replace backend validation.

Every AI-assisted log requires a user review/confirmation step before saving.
The UX may partially log selected matched items while leaving unmatched parsed
items unresolved. Phase 12 confirmation accepts selected loggable FoodItem rows
and saves them as normal FoodLog snapshots; Phase 12.5 extends confirmation to
selected backend-owned USDA references that are refetched and cached before
snapshot logging.

## TD-013: USDA Generic Food Lookup

Status: Implemented in Phase 12.5 for AI text logging fallback and normal food
search candidate enrichment

USDA FoodData Central is the first trusted generic food nutrition source. The
backend may search USDA when deterministic local retrieval does not find a
loggable candidate. USDA is a nutrition source; Gemini is not.

USDA/FDC API keys live only in backend environment variables and are never sent
to mobile clients. Diagnostics must not log full key-bearing USDA URLs, query
parameters, raw API keys, or raw error bodies that expose request links with
keys.

USDA candidates must expose the nutrient basis clearly, such as `per 100 g`.
The app must not pretend parsed quantities such as `2 eggs` were perfectly
converted unless the backend has a safe gram/serving conversion. When quantity
conversion is uncertain, USDA candidates may be loggable but should remain
review items until the user selects a supported amount/unit or trusted serving
option; a client multiplier is never the authoritative fallback.

Selected USDA references are refetched server-side, normalized into existing
FoodItem columns and FoodItemNutrient rows, cached as global
`sourceType: cached_external`, `sourceProvider: usda_fdc` FoodItems, and then
logged through normal FoodLog snapshot behavior. Missing nutrients remain
unknown/null or absent, never zero. AI-estimated nutrition remains deferred.

Normal food search keeps the existing local-only `GET /food-items` contract and
uses a candidate-search route for mixed local plus USDA results. Local visible
FoodItems rank before USDA candidates, and USDA outages must degrade to local
results rather than breaking manual/search logging.

User nutrition edits made during review/logging are FoodLog-level overrides.
They must not mutate trusted source FoodItems or cache edited nutrients as
global USDA/Open Food Facts data. Simple mode can override only main nutrients;
Complex mode can override supported normalized nutrient catalog entries.

## TD-014: AI-Estimated Nutrition Fallback

Status: Implemented in Phase 12.6

AI-estimated nutrition is available only as a user-triggered fallback for
unresolved AI text logging rows after local/custom/saved/recent, cached
barcode/Open Food Facts, and USDA sources fail. The backend rechecks trusted
candidates before estimating and returns `TRUSTED_NUTRITION_AVAILABLE` rather
than estimating if a loggable trusted source exists.

Estimates are visibly low-trust, user-reviewed before saving, and persisted
only as unlinked FoodLog snapshots. They must not create trusted FoodItems,
pollute external caches, appear in normal food search, or invent full
micronutrients. Phase 12.6 uses existing FoodLog fields and prefixes `notes`
with low-trust AI-estimated source text instead of adding Prisma schema
metadata; structured provenance should be reconsidered only if later analytics
or filtering require it.

The backend owns estimate metadata. Gemini returns only the basic estimate
object: food name, serving text, calories, protein, carbs, fat, and optional
fiber, sugar, and sodium. The backend adds `source: "ai_estimate"`,
`trustLevel: "low"`, and `nutrients: {}` after strict validation. This avoids
asking the model for provenance or empty micronutrient objects and keeps
Phase 12.6 compatible with the existing Prisma schema.

The trusted-candidate gate blocks estimates only for genuinely relevant,
loggable trusted candidates. Low-confidence or generic token-only matches do
not block fallback, and generic words such as `bowl`, `plate`, `serving`,
`homemade`, `custom`, and `meal` are ignored for meaningful overlap. Common
foods must be resolved through trusted local/cached/USDA data before AI is
offered.

USDA lookup may overfetch internally and skip stale or failed detail records.
A USDA candidate is trusted/loggable only after detail nutrition is fetched and
required nutrients exist. USDA failures remain non-fatal.

Gemini structured-output handling must remain defensive. The estimate provider
collects all candidate text parts, handles fenced JSON and prose around JSON,
extracts balanced JSON objects, validates strictly, and rejects unknown or
micronutrient fields. Upstream 429/503 responses are temporary AI unavailable
errors. HTTP 200 invalid model output is not treated as an upstream outage.
`MAX_TOKENS` with no text has explicit cut-off handling; the Phase 12.6
estimate request uses a simplified schema, shorter prompt, and
`maxOutputTokens: 768` after live testing showed `256` could return an empty
candidate with `finishReason: "MAX_TOKENS"`.

## TD-016: Phase 12.7 Trusted Candidate Ranking And Bounded Enrichment

Status: Implemented and validated in Phase 12.7

Trusted food search uses one deterministic ranking and intent layer across
normal food search, AI parse retrieval, and trusted-candidate checks before an
AI estimate. Lexical identity matching is complete for meaningful non-state
terms, including compound foods; preparation/state terms remain modifiers.
Partial identities may remain visible, but complete identity is required for
default suitability and `selectionEligible`. The narrow `sweet potato`/`yam`
equivalence is explicit and does not introduce a broad food ontology.

Candidate semantics are intentionally split: `visibleRelevant` means related
enough to show as a manual option, while `selectionEligible` means safe for AI
auto-selection or for blocking a low-trust estimate. High confidence implies
selection eligibility; medium confidence alone does not. Raw, dry, frozen,
unprepared, composite, and conflicting forms remain visible only as review
options unless explicitly requested. Inadequate candidates do not block the
AI-estimate fallback.

The backend owns edible-default profiles: fruit prefers raw/fresh; rice, oats,
pasta-like starches, and potato prefer cooked/ready-to-eat; proteins and eggs
prefer cooked/prepared; milk prefers ordinary fluid milk; Greek yogurt prefers
plain Greek yogurt; and peanut butter prefers spread forms. Explicit products
and preparation states override those defaults. This is a small deterministic
intent layer, not AI ranking or a general food ontology.

USDA enrichment remains bounded. A logical lookup can make one primary and at
most one fallback metadata query, so the configured allowance of 20 logical
enrichments per limiter window caps metadata traffic at 40 calls per window.
Detail windows, concurrency, timeouts, backfill, and total budgets remain
bounded. Process-local metadata/detail caches are used, but transient empty
metadata responses are not cached. No public `searchDepth` or show-more mode
was added; that remains deferred until a mobile caller and product workflow
exist. The public candidate-search API contract is unchanged.

AI parsing uses the same identity, adequacy, visibility, and selection rules;
it does not accept the first lexical match and does not select foreign-head
composites. `2 eggs, toast, banana` produces separate candidate groups.
Low-trust AI estimates remain user-reviewed, unlinked FoodLog snapshots and
never populate trusted FoodItem or USDA caches.

Phase 12.7 is commit-ready after automated validation, API terminal smoke,
mixed regression/out-of-sample testing, compound-identity holdout testing,
and physical-phone smoke testing. The next defined project step is Phase 12.8
serving intelligence / household-unit conversion is implemented; final
interactive smoke remains the next validation step. Remaining USDA secondary
ordering, dessert/omelet/meatless-product polish, typo semantics, embeddings,
vector search, recipes, and additional providers are future targeted work.

## TD-015: Photo Logging Sequencing

Status: Implemented for backend Slice 1; mobile Slice 2 pending

Photo food logging should come after food database and RAG foundations. It
should eventually support image capture/upload, food recognition, portion
estimation, retrieval matching against trusted food data, confidence/review
state, user edits before saving, Simple confirmation UI, and Complex nutrient
detail review.

Do not prioritize photo logging before trusted food search, barcode lookup,
cached food data, and candidate review exist.

Slice 1 locks the following implementation details:

- Photo analysis uses a separate provider abstraction; text parsing is not
  widened to accept image input.
- The endpoint accepts only an in-memory raw JPEG body up to exactly 5 MiB and
  never stores image bytes or provider payloads.
- Gemini, mock, and disabled provider modes share `AI_PROVIDER` and
  `GEMINI_API_KEY`; photo model, item, timeout, and rate limits are separate
  backend environment settings.
- Provider output is strict JSON containing identity, optional preparation,
  structured provisional quantity state, separate confidence values, and
  optional normalized region metadata. Estimated quantities use only the
  constrained photo vocabulary and count labels are provisional observed
  evidence. `no_responsible_estimate` is valid when quantity cannot be
  defended. Invalid optional regions are discarded by the provider adapter;
  any region that survives remains strictly validated. Generic counts,
  nutrition fields, database references, and automatic actions are rejected.
- One image may produce up to eight independent rows. Duplicate or ambiguous
  recognition remains review-required; no segmentation editor is implied.
- Existing deterministic retrieval/ranking and serving resolution remain the
  only trusted candidate and portion authorities. Vision portions are
  provisional and never infer density or universal household weights.
- Analysis is no-write. Final saving remains the existing transactional
  `/food-logs/from-candidates` contract.

## TD-017: Phase 12.8 Serving Intelligence

Status: Implemented and validated in Phase 12.8

Serving resolution is deterministic and backend-authoritative. Trusted USDA
portions require validated quantity, canonical identity, stable ID, and a
positive physical equivalent; ambiguous or incomplete portions remain
review-required. Physical nutrition bases remain usable without alternate
portions. AI count rows use candidate-specific whole-item metadata internally,
edit and save as grams or millilitres, hide the internal source option from
physical selectors, and recalculate on candidate changes. Simple and Complex
totals share the same stored authoritative values, and legacy snapshot-null
FoodLogs retain their compatibility behavior.

## TD-018: Phase 12.9 Recipes, Mixed Meals, And Manual Foods

Status: Implemented and physically validated

Reusable recipes and one-off mixed meals share frozen ingredient snapshots and
backend-authoritative serving resolution. A mixed meal logs as exactly one
FoodLog and may atomically create a Recipe only when explicitly enabled.
Manual foods are user-owned reusable FoodItems, not SavedFoodItems; explicit
nutrition bases and declared physical equivalences are required, and future
edits never rewrite historical snapshots. Recipe-origin and mixed-meal-origin
History entries expose metadata-only editing.

The Food Log's current one-page logging-method list remains intentionally
temporary. A future interactive multi-screen or curved-control selector is
deferred and is not part of Phase 12.9.

## TD-015: Skeleton Loading

Status: Planned

Phase 7 should add skeleton loading where appropriate. Skeletons should match
the page layout, preserve layout shape, reduce perceived loading time, avoid
jarring layout jumps, follow the Phase 6 white/charcoal visual standard, use
subtle neutral placeholder shapes, and avoid heavy animation.
# Phase 13 — Custom Food Library and Saved Foods

Default servings are validated prefills, not nutrition calculations. Candidate
personalization may prioritize relevant recent, saved, and custom matches but
must not bypass relevance scoring. FoodLog conversion is transactional and
idempotent by its nullable unique source relation.

The Food Library reuses the existing four-tab application and Food Log modal
stack. The proposed interactive logging-method selector remains future work.
