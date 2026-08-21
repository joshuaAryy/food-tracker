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

Status: Superseded on 2026-07-18 by TD-023; retained as historical context

- Supabase Auth is the intended authentication provider.
- The current development implementation uses a fixed mock user through mock auth context.
- Authenticated endpoints operate on the current user.
- Clients do not send `userId` in requests.
- User identity should eventually come from Supabase Auth.
- User-owned records reference the local `User.id`; long-term, that ID aligns with the Supabase Auth user ID.
- Do not build custom password authentication or a custom auth system.

The provider-specific selection above is historical. The current provider-
neutral direction is defined by TD-023; the stable local-user ownership
boundary and no-client-`userId` rule remain active.

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

Status: Locked; original mock-auth wording superseded by TD-025

- Use REST-style endpoints under `/api/v1`.
- Use only the standard success and error envelopes defined in [api-contracts.md](api-contracts.md).
- The original foundation used mock user context; the active implementation
  derives identity from verified Firebase tokens as documented in TD-025.
- Client requests never include `userId`.
- Date filters are local dates in `YYYY-MM-DD` interpreted in the current user's timezone.
- MVP endpoints and request/response contracts are defined in [api-contracts.md](api-contracts.md).

## TD-009: Prisma And PostgreSQL Schema

Status: Locked

- Use UUID primary keys for all models.
- Use a local `User` model. The original mock boundary generated its ID; the
  active Firebase mapping preserves that UUID primary key and stores a nullable
  unique provider UID separately.
- Include only approved models. Phase 8 explicitly adds `FoodItem`,
  `FoodBarcode`, and `SavedFoodItem`, plus optional `FoodLog.foodItemId`, as the
  local food database foundation. Phase 9 adds `FoodItemNutrient` and
  `FoodLogNutrient` for normalized extended nutrients.
- Use the field types, enums, constraints, indexes, relations, and cascade-delete rules defined in [prisma-schema-decisions.md](prisma-schema-decisions.md).
- Do not include `DailySummary`, raw/parsed food logs, or other future models
  without explicit approval.

The provider-specific long-term identity-alignment clause above is historical
and superseded by TD-023. The local UUID ownership boundary and all other
schema decisions remain current.

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

Status: Implemented and merged through PR #1 in Phase 14

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
  optional normalized region metadata plus bounded representation-group
  metadata. Estimated quantities use only the
  constrained photo vocabulary and count labels are provisional observed
  evidence. `no_responsible_estimate` is valid when quantity cannot be
  defended. Invalid optional regions are discarded by the provider adapter;
  any region that survives remains strictly validated. Generic counts,
  nutrition fields, database references, and automatic actions are rejected.
  The Gemini-only response schema intentionally omits an array `maxItems`
  keyword because Gemini rejected the nested representation schema as too
  stateful; the raw provider Zod contract still caps the response at ten
  items, and the deterministic adapter rejects more than eight active rows.
- Representation groups prefer defensible non-overlapping components, retain
  at most one inactive composite/decomposed alternative, and flatten only the
  active representation into photo review rows. Coverage and exclusions are
  qualitative overlap safeguards, not nutrition or candidate authority.
- When a provider marks a composite active but also supplies a complete
  high-confidence decomposed alternative whose distinct component coverage
  exactly matches the composite, the deterministic adapter promotes the
  components. Missing or discarded optional regions do not prevent that
  semantic choice. Lower-confidence, incomplete, overlapping, or mismatched
  decomposition remains inactive so blended dishes stay composite.
- One image may produce up to eight active rows. Duplicate active coverage,
  active composite/component overlap, and invalid alternatives are rejected;
  no segmentation or alternative-selection editor is implied. Across
  different groups, matching coverage without reliable regions is retained as
  `uncertain` with a safe `potential_cross_group_overlap` diagnostic rather
  than being rejected. Valid regions use a conservative 25% intersection over
  the smaller region threshold; containment rejects, while edge-touching and
  below-threshold intersections do not.
- Backend representation IDs, active-row state, normalized coverage, and
  overlap state are derived after provider validation. Invalid optional
  coverage alternatives and optional visible metadata are discarded with safe
  diagnostics. An invalid optional region is discarded by itself and does not
  discard an otherwise valid component or alternative. Independently invalid
  groups may be discarded when they do not overlap valid groups; active-group
  contradictions and all-invalid responses remain strict failures.
- Existing deterministic retrieval/ranking and serving resolution remain the
  only trusted candidate and portion authorities. Vision portions are
  provisional and never infer density or universal household weights.
- Analysis creates no FoodLogs, image records, or review sessions. Validated
  external candidates may be materialized into canonical FoodItems before
  review; final mixed saving remains transactional and server-authoritative.
- Phase 14 Slice 14.2B1 adds optional bounded candidate adjudication after
  deterministic retrieval. Only active ambiguous rows enter one text-only
  batch, capped at three eligible candidates per row and eight rows per
  request. Strong deterministic selections bypass the provider. Gemini sees
  backend-controlled candidate summaries and request-scoped references only;
  it cannot query data, create candidates, alter nutrition, or select inactive
  alternatives. Only high-confidence valid references are applied; reject-all,
  no-decision, medium/low confidence, invalid output, and provider failures
  preserve deterministic review. The feature is disabled by default and adds
  no persistence or AI nutrition estimation; fallback estimation remains Slice
  14.2B2.

## TD-019: Phase 14.2B2 Photo Nutrition Estimate Fallback

Status: Implemented in the read-only analysis response

Photo nutrition fallback extended the existing Phase 14 bounded text-only
adjudication batch; it never adds a second provider call or resends the image.
Only unresolved active rows may receive an estimate after deterministic
retrieval and candidate decisions. Strong deterministic and high-confidence
adjudicated trusted selections remain authoritative and suppress estimates.

The photo estimate reuses Phase 12.6's low-trust, unlinked, editable safety
model, but is stricter and photo-specific: Gemini returns only calories,
protein grams, carbohydrate grams, fat grams, and low/medium confidence. The
backend validates finite bounded values and conservative macro-energy
consistency, rounds them, derives a structured-quantity or portion-shown
basis, and adds low-trust provenance metadata. Micronutrients, serving
weights, density, conversions, rewritten identities, and database references
are rejected. Estimates remain unlinked and low-trust; reviewed estimates use
the secure mixed-confirmation route described in TD-020 and TD-021 and never
become canonical FoodItems.
The shared assistance sub-budget is 2.5 seconds by default, capped below the
overall photo-analysis timeout; the increase from 1.5 seconds was justified by
measured three-row mixed-batch latency and remains within the mobile budget.

## TD-020: Phase 14.2C1 Mixed Photo Confirmation

Status: Implemented as an authenticated backend transaction

`POST /api/v1/food-logs/from-photo-analysis` accepts trusted, estimated, and
excluded photo-row dispositions. Trusted candidates are fetched again under
the current user and their serving/nutrition snapshot is recomputed; client
nutrition is never authoritative. Estimated rows require a short-lived,
request-scoped HMAC-SHA-256 proof issued by B2 when
`PHOTO_ESTIMATE_CONFIRMATION_ENABLED` is enabled. The proof is signed, not
encrypted, and binds the user, row, recognized identity, quantity/basis, and
original core macros. User corrections remain low-trust and unlinked.

All persisted rows are prevalidated and created in one Prisma transaction;
excluded rows create nothing. No FoodItems, provider calls, image records, or
review-session records are created. The existing trusted-only confirmation
route remains unchanged. Durable cross-request idempotency is not introduced;
stateless proof replay remains possible until the proof expires and is tracked
as a later schema-backed decision.

## TD-021: Phase 14.2C2 Mobile Mixed Photo Review

Status: Implemented and user-confirmed on the paired iPhone; Codex did not
operate the device

The mobile photo review keeps four explicit local dispositions: trusted,
estimated, excluded, and unresolved. Strong deterministic or high-confidence
adjudicated saved FoodItem matches default to trusted. Rows with a usable
server-issued estimate proof default to estimated; rows without a compatible
saved candidate or usable proof remain unresolved and block saving. Inactive
representation alternatives never enter review state.

Estimated rows are visibly low-trust and may edit only the confirmed food name,
calories, protein, carbohydrates, and fat. The proof, estimate basis, source,
trust level, row reference, and recognition metadata remain opaque or immutable
mobile state. Proofs live only in the ephemeral Zustand session and are never
persisted, logged, placed in navigation parameters, or sent to the old trusted
confirmation endpoint. The mobile client builds one shared-schema-validated
request containing trusted, estimated, and excluded entries in original row
order; unresolved rows and all-excluded reviews cannot save.

The C1 endpoint accepts trusted entries only when a candidate is a compatible
visible FoodItem UUID. An available external candidate remains non-loggable
until the shared backend materializer refetches and validates its provider
record, creates or reuses a canonical `FoodItem`, and returns that UUID. A
clear high-confidence winner may be materialized before estimate fallback;
manual `Use this match` selection uses the same materializer. Photo quantities
resolve through the existing deterministic serving engine: observed quantity,
normalized grams, and selected serving remain separate; compatible provider
servings and validated mass/count conversions are exposed as selectable options,
while unsupported mappings remain amount-review states. A trusted canonical row
may therefore have a blank or low-confidence amount without becoming unresolved
or requiring a second trust confirmation. The canonical 100 g basis is an
explicit user choice only, never a substitute for a missing photo observation.
Provider-only references never enter the mixed confirmation payload, and losing
or unavailable candidates are not inserted. Save is single-flight with no
automatic retry.
Confirmed success clears review state and proofs, removes app-owned temporary
images without touching library originals, marks the existing History,
Dashboard, and Insights refresh signal, and returns the existing post-save
destination. An ambiguous timeout or connection loss warns the user to check
History before deliberately trying again; durable cross-request idempotency is
not guaranteed. User-confirmed paired-iPhone validation also covered
decomposition, external materialization, estimate fallback, mixed review/save,
History persistence, canonical local reuse, flexible serving controls, and safe
Back/Close navigation without the GO_BACK warning. No photos are persisted.

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

## TD-022: Skeleton Loading

Status: Planned; identifier corrected on 2026-07-18 because the historical
document contained a duplicate TD-015 identifier

Phase 7 should add skeleton loading where appropriate. Skeletons should match
the page layout, preserve layout shape, reduce perceived loading time, avoid
jarring layout jumps, follow the Phase 6 white/charcoal visual standard, use
subtle neutral placeholder shapes, and avoid heavy animation.

## TD-023: Authentication Provider Selection Deferred

Status: Superseded on 2026-07-26 by TD-025; retained as historical context

The Phase 19 references in this historical decision describe the earlier
roadmap numbering. The current roadmap assigns remaining account-lifecycle work
to Phase 20 after Phase 19 semantic retrieval.

This decision supersedes the provider-specific portions of TD-002 and TD-009;
those decisions remain in this document as historical context.

- The authentication provider will be researched and selected during Phase 19
  planning. The current documentation does not select Supabase or any other
  provider.
- The local `User` model and current-user ownership boundary remain stable.
- Future external identity mapping is a Phase 19 design decision and is not
  assumed to equal the local `User.id`.
- Clients never send `userId`; the backend derives identity from its auth
  boundary.
- Authentication determines who the user is. Authorization determines which
  resources that user may access. Both checks remain required.
- Do not add custom password authentication or a provider integration through
  this documentation decision.

## TD-026: Immediate Permanent Account Deletion

Status: Current and validated for Phase 16 local and Railway staging flows.

Deletion is immediate and irreversible. The API requires a recently
reauthenticated Firebase token with a five-minute `auth_time` window, deletes
only rows owned by the verified Firebase UID, and coordinates PostgreSQL
cleanup with trusted Firebase Admin deletion through the minimal
`AccountDeletion` record. Pending deletion blocks normal identity provisioning;
failures are categorical and retryable. The mobile flow requires an
explanatory warning, exact `DELETE` confirmation, provider reauthentication,
and direct routing to Sign In after confirmed success.

## TD-025: Firebase Authentication And Railway Readiness

Status: Current and validated for Phase 16 local and Railway staging flows;
production provider resources remain outside scope.

- Firebase Authentication owns identity. Firebase Admin verifies tokens on the
  API; Prisma/PostgreSQL remains the source of application data and ownership.
- The existing UUID `User.id` remains the primary key. A nullable unique
  `firebaseUid` mapping and provider metadata are additive; existing mock data
  remains unmapped.
- Email/password and Google are the active free-development providers. Apple
  implementation is preserved, but `EXPO_PUBLIC_APPLE_SIGN_IN_ENABLED=false`
  disables its UI and native capability/config-plugin effects. App Store and
  TestFlight distribution are not part of this checkpoint.
- The client never sends authoritative `userId`. Verification, authorization,
  ownership isolation, and response DTO minimization remain server concerns.
- Public errors use stable codes and allowlisted metadata. Internal exception,
  provider body, request body, token, address, path, and stack data are not
  collected for user-facing copy or unrestricted diagnostics.
- AuthBootstrap is the long-lived owner of one token listener and route guard.
  Setup-status failure after a verified session is a stable authenticated
  recovery state with explicit Retry and Sign Out, not a silent sign-out,
  automatic retry, or duplicate loading-route presentation.
- Rate-limit keys use a server-owned keyed derivation rather than a raw
  network address. Hosted environments require `RATE_LIMIT_KEY_SECRET`.
- `GET /health` is a minimal unauthenticated liveness route. Railway config
  declares workspace build, Prisma migration deployment, API start, health
  checking, and restart behavior without creating a Railway resource.
- Real plist files and Firebase Admin credentials remain environment-injected
  and untracked. Development, staging, and production use separate Firebase
  projects and server configuration.

### Phase 16 retrospective and handoff

Hosted validation showed that Firebase sign-in alone is not proof of API
connectivity: setup-status and a real database write must be observed through
Railway. Staging begins with an independent empty database, and local `.env`
files are never copied into Railway. Missing provider variables can otherwise
look like successful empty results, so enabled integrations require conditional
runtime validation and sanitized unavailable errors. Expo Router default-export
warnings were treated as possible cascades from the primary runtime-target
failure. Railway private networking and SSH assertions remain operational
tools, not public database exposure; Docker is unrelated to the Railway
runtime.

The Phase 16 physical record includes hosted authentication, onboarding,
persistence, ownership isolation, USDA/Open Food Facts, Gemini, photo
analysis, nutrition fallback, session restoration, sign-out, and disposable
Google-account deletion. Photo candidate adjudication and the optional
API-unavailable check are `Not tested`; Apple Sign In is preserved but disabled.
Phase 17 subsequently completed the free-Xcode standalone Release checkpoint;
paid external distribution remains deferred.

## TD-024: Phase 15 Deterministic Reporting

Status: Implemented on the Phase 15 branch; physical validation pending

- Reporting facts are calculated on demand from authoritative FoodLogs and
  WeightLogs. No report snapshots, daily-summary source of truth, or new
  persistence model is introduced.
- Logging streak, logging consistency, calorie adherence, protein adherence,
  and weight progress remain separate metrics.
- A logging streak counts actual logged FoodLog days. One missed local day may
  bridge a streak, but the grace day contributes only to the elapsed span and
  never increases the headline or wins a longest-streak comparison.
- Weeks are Sunday through Saturday. Current in-progress period comparisons
  use equivalent elapsed local windows; the API returns explicit boundaries for
  both windows and caps a prior-month comparison at that month's final day.
- Calorie adherence uses the explicit `UserGoal.goalType` ranges (gain
  95–115%, maintain 90–110%, lose 85–105%); protein adherence is at least 90%
  of the current target. Reports use current targets and do not claim to
  reconstruct historical goal versions.
- Threshold-unavailable metrics carry internal availability metadata and are
  omitted by mobile presentation. Technical reason strings are not user copy.
- Simple mode exposes calories, protein, primary macros, fiber, sugar, and
  sodium when recorded. Complex mode exposes the same foundation plus
  available normalized nutrients; water is not a Phase 15 tracked nutrient.

## TD-025: Phase 15.5 Approved Figma Production Implementation

Status: Locked for implementation on 2026-07-23; validation pending

- The approved `Food Tracker — Phase 15.5 Reporting Redesign` Figma is the
  visual source of truth. Codex implementation is limited to matching the
  approved nodes and must not reopen visual exploration or reinterpret them.
- The authoritative product masters are Progress `200:3146`, Insights 390
  `200:3228`, Insights 320 `200:3364`, and Streak `200:3500` in file
  `GFLStsF0ADwaizoVKGeLny`. Supporting references are reporting icons
  `181:1078`, exact grace laurel `79:859`, calendar grace `49:46`, calendar
  laurel `195:928`, shared artwork `204:1354`, parity gate `204:2137`, and
  implementation rules `204:2180`.
- Affected surfaces use exact solid sRGB values: white `#FFFFFF`, primary ink
  `#0E0E0E`, logged-progress mint `#76DBA0`, flame red `#EA1226`, and
  completion amber `#FFB80D`. Semantic colors must not be dimmed by wrapper or
  pressable opacity, translucent substitutes, tinting, or material effects.
- Shared flame, laurel, reporting-icon, ring, and metallic completion artwork
  must remain shared components. Approved vector geometry is implemented with
  `react-native-svg`; temporary raster screenshots, emoji, Unicode pictographs,
  remote images, and platform symbols are not substitutes.
- Missing macro and nutrient information is a product-data-path issue. The
  implementation must distinguish valid targets, missing goals, unrecorded
  nutrients, setup incompleteness, genuine zeroes, invalid denominators, and
  unavailable API fields without manufacturing percentages or hiding defects.
- Phase 15.5 remains open until implementation, focused tests, full
  database-backed tests, native parity checks, and physical-iPhone visual
  approval are complete. Nothing is pushed or merged as part of this decision.

## TD-027: Phase 17 Free Xcode Standalone iOS Installation

Status: Complete. Automated validation, user-operated signed physical-device
validation, artifact verification, and guarded generated-native cleanup passed.

- Phase 17 uses a local Xcode Release build signed by the user's free Apple
  Personal Team. EAS Build, EAS Submit, TestFlight, App Store Connect, paid
  distribution, production Railway resources, and Apple Sign In remain outside
  this phase.
- `apps/mobile/app.config.ts` is the tracked Expo authority. `ios/` is Expo
  Continuous Native Generation output and remains ignored, untracked, and
  disposable. Canonical behavior belongs in Expo config, tracked scripts,
  tests, and documentation; signing choices remain in Xcode.
- `corepack pnpm ios:staging-release` reads only the ignored staging Release
  environment file, requires Node 22 and pnpm 10.34.3, validates the public
  Railway staging API target, Firebase plist, Google scheme, toolchain, device,
  and generated state, then runs clean prebuild and CocoaPods before opening the
  workspace. It preserves the pre-existing dirty Git state and prints only
  sanitized categories.
- After generation, the workflow writes only the approved staging public/native
  keys to ignored `apps/mobile/ios/.xcode.env.local`, sets `EXPO_NO_DOTENV=1`,
  and unsets `EXPO_NO_CLIENT_ENV_VARS`. This is the durable handoff consumed by
  both Expo Constants and the Release `export:embed` phase when Xcode is opened
  separately; it does not modify `.env.local` or change Debug Metro behavior.
- The canonical iOS minimum remains `16.4`. Expo's built-in
  `ios.deploymentTarget` property sets the app target, while the tracked CNG
  Podfile plugin normalizes every generated Pods project configuration during
  `post_install`, including privacy and resource bundles.
- `corepack pnpm ios:staging-release -- --verify-release-artifact` is the guarded
  post-build proof. It requires canonical app metadata, a non-empty
  `main.jsbundle`, and the validated staging API target, rejecting local or
  private targets without printing values.
- The installed Release app must embed JavaScript and use Firebase plus Railway
  staging directly without Metro, Docker, the local API, or a Mac connection.
  The guarded cleanup removes only generated `apps/mobile/ios/` after evidence.
- The free-signing seven-day expiration is accepted. Reinstallation is a
  repeat of the guarded preparation and user-only Xcode signing checkpoint.
- Xcode 27 compatibility required three tracked boundaries: Podfile
  post-install normalization of every generated Pods configuration to iOS 16.4;
  a minimal pnpm patch for the Xcode 27-incompatible callback expression in
  transitive `expo-modules-jsi@56.0.10`; and single-scene UIScene adoption with
  SceneDelegate-owned React Native startup. Expo remains SDK 56 and React
  Native remains 0.85.3.
- The original UIScene failure was a UIKit launch-policy termination before
  React Native startup. It was not caused by JavaScript, Railway, Firebase, or
  authentication. The user confirmed the corrected signed Release app
  installed and remained open on the physical iPhone; Codex did not operate
  the device.

## TD-026: Phase 15.5.1 Complete Reporting Goals And Mode Terminology

Status: Locked for implementation on 2026-07-23; validation pending

- The existing `UserGoal` record remains the single goal system. It gains
  nullable `targetCarbsGrams`, `targetFatGrams`, `targetFiberGrams`,
  `limitSugarGrams`, and `limitSodiumMg` fields. Nullable storage preserves
  legacy rows and makes setup-incomplete states representable without a
  destructive backfill.
- Existing calorie and protein values remain authoritative and stable. New
  onboarding derives all seven supported nutrient values from the existing
  calorie/protein pipeline. Legacy rows with missing new fields use the same
  deterministic resolver at reporting time; explicit values supplied through
  the goals API override derived values. This is the selected lazy-backfill
  strategy.
- The deterministic macro formula reserves 4 kcal per gram of protein, splits
  remaining target calories equally between carbohydrate (4 kcal/g) and fat
  (9 kcal/g), and rounds stored grams to one decimal place. Fiber is a minimum
  of 14 g per 1,000 target kcal. Sugar is a limit of 10% of target calories
  divided by 4 kcal/g. Sodium uses the documented product default of 2,300 mg
  unless explicitly configured. These are product tracking defaults, not
  medical advice.
- Goal direction is `target` for calories, `minimum` for protein,
  carbohydrates, fat, and fiber, and `limit` for sugar and sodium. Percentage
  means recorded period amount divided by `daily goal × applicable eligible
  days`; limit values above 100% remain truthful and are not achievement
  states. Invalid or missing denominators produce an explicit unavailable
  state, never `Infinity`, `NaN`, or a fabricated percentage.
- Extended normalized nutrients that remain visible in Complex mode use the
  shared documented product-default threshold catalog, so every displayed
  nutrient has a goal strategy. Water remains excluded from Phase 15 reports.
- The persisted tracking enum remains `simple`/`complex`. A centralized
  user-facing label mapping renders only `Simple` and `Complex`; `Detailed` is
  not a mode label. Ordinary prose that uses “detailed” as an adjective is not
  part of this terminology decision.
- Reporting responses return goal metadata with value, unit, direction, source,
  period-adjusted goal, and percentage. Mobile renders these facts and does not
  calculate analytics or infer targets.
- Insights presents a valid primary percentage uniformly as `${percentage}%`.
  Target and minimum metrics show a muted period-adjusted `Goal …` line, while
  limit metrics show a muted `Limit …` line; the visible percentage does not
  append `of limit`. Limit percentages above 100% remain truthful. Macro
  summaries alone use per-item mint progress rails; nutrient highlights and the
  Complete nutrient ledger remain compact, bar-free surfaces. The ledger uses
  subtle inset separators between category headers only; expanded nutrient rows
  use consistent spacing without row-level dividers.
# Phase 13 — Custom Food Library and Saved Foods

Default servings are validated prefills, not nutrition calculations. Candidate
personalization may prioritize relevant recent, saved, and custom matches but
must not bypass relevance scoring. FoodLog conversion is transactional and
idempotent by its nullable unique source relation.

The Food Library reuses the existing four-tab application and Food Log modal
stack. The proposed interactive logging-method selector remains future work.

## TD-028: Phase 17.5 Canonical Analytics, Micronutrients, And Hydration

Status: Locked for Phase 17.5 on 2026-08-08; implementation complete and
physically accepted on 2026-08-21 at `e70ccb514b0c9bd65cc9ba1c0bdea57d207f6043`

- Phase 17 and Phase 17.5 are complete. Phase 17.5 is named Custom Analytics,
  Micronutrients, and Hydration. Its approved Figma
  source is file `GFLStsF0ADwaizoVKGeLny`, page `338:21`; final contract
  `517:73` and node index `524:21` outrank hidden or historical drafts.
- The backend remains the single deterministic owner of analytics facts,
  aggregation, completeness, references, comparisons, contributors,
  interpretations, saved-view validation, and forecasting. Mobile renders
  validated contracts and does not calculate analytics or recommendation facts.
- `LoggingDayState` describes only FoodLog behavior: `complete`, `partial`, or
  `unlogged`. The current local day additionally carries `in_progress` and is
  not a closed complete day. `MetricDataState` independently describes a
  selected metric in authoritative FoodLog snapshots: `recorded`, `partial`,
  or `unknown`. An unlogged day has no metric state. Missing provider nutrient
  data never changes logging completeness.
- Unknown is not zero, unlogged is not zero, partial is not complete, and an
  explicit numeric zero is recorded zero. Historical nutrient snapshots and
  WeightLogs remain authoritative; missing values remain gaps.
- The initial Breakfast/Lunch/Dinner completeness rule, with optional
  Snack/Other, is a centralized, versioned implementation policy supported by
  the approved meal-coverage design. It is not an immutable nutritional rule;
  any change requires product evidence and policy-test updates.
- Complex coverage filters operate on logging completeness only:
  `all_logged_days` (user-facing “All recorded days”),
  `complete_and_partial`, and `complete_only`. Metric unknown/partial behavior
  remains independent after the logging filter. Weekly and monthly buckets
  retain independent logging and metric counts rather than collapsing mixed
  days into one state.
- Target, minimum, limit, and true lower-plus-upper range references are
  distinct. A true range requires both authoritative bounds; a single target
  never becomes a fabricated range. Phase 17.5 does not add target-editing UI.
- Water is a separate Phase 17.5 domain model. The canonical amount/time logger
  creates Water entries only; hydration uses WaterLogs only and excludes water
  contained in food. Hydration is visible in both modes with a server-owned
  `2000 mL/day` initial goal. `waterTrackingEnabled` remains compatible but does
  not gate visibility. Supplements remain deferred.
- Saved Complex views support save, open, temporary modify, update, save as new,
  rename, duplicate, pin, unpin, reorder, and delete. At most one view is
  pinned; unpin clears `pinnedSavedViewId` and restores the Calories fallback.
  Relative periods are rolling periods, not frozen historic snapshots.
- Calories and Weight forecasts are deterministic, independent, backend-owned
  seven-day projections with solid-history/Today/dotted-projection continuity,
  rolling-origin backtesting, and eligibility/stability gates. Initial values
  such as elapsed-day, usable-day, improvement, error, and interval-width
  thresholds are centralized engineering policy constants, validated by tests
  and diagnostics, and may change when backtesting justifies it. No LLM
  generates predictions.
- Every Phase 17.5 Insights and Trends number/chart must consume canonical
  missingness and aggregation semantics; legacy zero-filled report behavior
  must not reach a Phase 17.5 surface even while old endpoints remain
  temporarily compatible.
- The implementation order is Slice A analytics foundation, Slice B hydration
  and canonical logging, Slice C chart system and core trends, Slice D Complex
  micronutrient analytics, Slice E configuration/custom range/comparison, Slice
  F saved/pinned views and reporting integration, and Slice G forecasts,
  state/responsive hardening, and documentation closeout.

## TD-029: Bounded Execution And Evidence-Based Visual Validation

Status: Adopted from the Phase 17.5 closeout on 2026-08-21

- The repository supports single-threaded, agent-assisted, and selectively
  parallel execution. Agents are optional tools, not a required architecture.
  Single-threaded work is preferred for small, sequential, coupled, or
  documentation-only changes.
- Delegation is appropriate only for bounded, independent, reviewable work
  that materially reduces wall-clock time. Default active delegation is about
  2–3 workers, with a soft maximum of 4; duplicate investigations and
  one-agent-per-file decomposition are discouraged.
- Reasoning intensity starts at the lowest capable level. Higher-cost tiers are
  exceptions for a named unresolved blocker, with Terra Max reserved for a
  narrow, genuinely difficult question after lower-cost investigation.
- Visual-fidelity work uses separate implementation, automated validation,
  real-runtime capture, independent-review, and user-owned physical-acceptance
  gates. A test, source inspection, old screenshot, nearby viewport, or
  unproven runtime state cannot stand in for a missing gate.
- Deterministic, current-date staging fixtures and an explicitly verified
  Firebase-linked account are preferred for analytics UI checks. Screenshots
  must come from the real app with the backend target, authentication state,
  seed state, and viewport recorded.
- Simulator evidence is useful for repeatable navigation and broad comparison,
  but physical signing, installation, connectivity, and device acceptance
  remain external user-owned checkpoints. Missing external prerequisites are
  recorded as blocked or pending; documentation must not convert them into
  implied completion.
- Closeout records truth over optimism: state what was proven, what remains
  unavailable, what caused waste, and which next action belongs to the user or
  another external system.
