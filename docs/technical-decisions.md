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

Status: Planned

RAG-assisted AI logging should use retrieval over trusted sources: user recent
foods, saved foods, saved meals, custom foods, cached app foods, barcode foods,
generic food data, and branded food data.

AI may parse messy descriptions, split meals into likely items, estimate
serving descriptions, rank candidate matches, and generate user-friendly
explanations. AI must not silently save uncertain logs, invent nutrition data,
bypass user confirmation, become the only source for calories/macros/micros, or
replace backend validation.

Every AI-assisted log requires a user review/confirmation step before saving.

## TD-013: Photo Logging Sequencing

Status: Planned

Photo food logging should come after food database and RAG foundations. It
should eventually support image capture/upload, food recognition, portion
estimation, retrieval matching against trusted food data, confidence/review
state, user edits before saving, Simple confirmation UI, and Complex nutrient
detail review.

Do not prioritize photo logging before trusted food search, barcode lookup,
cached food data, and candidate review exist.

## TD-014: Skeleton Loading

Status: Planned

Phase 7 should add skeleton loading where appropriate. Skeletons should match
the page layout, preserve layout shape, reduce perceived loading time, avoid
jarring layout jumps, follow the Phase 6 white/charcoal visual standard, use
subtle neutral placeholder shapes, and avoid heavy animation.
