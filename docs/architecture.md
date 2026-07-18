# Architecture

## High-Level System

```text
Expo React Native mobile app
        ↓
Express + TypeScript API
        ↓
Prisma ORM
        ↓
PostgreSQL database
```

## Phase 12.8 Serving Intelligence

Trusted FoodItems and candidates follow one path: canonical nutrition basis ->
requested amount/unit or trusted serving option -> deterministic serving
resolution -> authoritative backend scaling and storage rounding -> immutable
FoodLog serving snapshot. Mobile calculations are provisional previews only;
the API response is authoritative. AI preserves raw serving intent and may not
calculate nutrition, multipliers, density, or household conversions. Bare
household units require food-specific trusted relationships, while regional
unit aliases remain internal.

USDA portions are normalized only when their gram/volume equivalent, quantity,
canonical identity, label, and stable provider ID are validated. Portion
identity may come from the measure name or a safe portion description, which
supports common egg, slice, bar, serving/container, and whole-item records
without inventing food weights. A physical nutrition basis remains usable with
physical units when no alternate portions exist. Candidate responses expose
validated default whole-item metadata when exactly one safe default exists;
ambiguous options remain review-required.

AI count rows retain parsed quantity and trusted provenance internally, convert
to physical grams or millilitres for editing and saving, hide the internal
source option from physical selectors, and recalculate on candidate changes.
The same candidate-specific state feeds preview readiness and the trusted save
request, while raw parser review status remains auditable separately.

The project currently uses PostgreSQL as the SQL database. In local
development, PostgreSQL runs inside Docker; the Docker container is mainly the
local database server. The API itself is normally run locally through pnpm
scripts, not inside Docker. Prisma handles database access and migrations.

The backend owns validation, business logic, analytics, and recommendation
decisions. The frontend owns UI and local state. Current authentication still
uses the fixed mock/dev-user boundary. The authentication provider remains
undecided until Phase 19 planning; authentication and authorization remain
separate boundaries.

## Implemented Manual Food Logging

Each `FoodLog` is one manually entered food item. A meal is represented by food entries sharing a `mealType` and similar `loggedAt` timestamps. An optional `mealGroupId` may be introduced later, but meal grouping is not required for the MVP.

The MVP `mealType` enum is `breakfast`, `lunch`, `dinner`, `snack`, or `other`.

Flow:

```text
Frontend
→ API
→ Validation
→ Database
→ Analytics
→ Dashboard/history
```

The implemented logging flow supports manual entry, reusable foods, saved and
recent foods, barcode scanning with backend-owned Open Food Facts lookup, and
AI-assisted text parsing. Phase 14 adds photo capture, trusted matching,
quantity-aware review, and server-authoritative mixed confirmation through the
existing FoodLog flows.
`FoodLog` now has an optional `foodItemId` relation for future log-from-food
flows, but the current food-log API remains snapshot-based and does not require
or expose that relation.

## Implemented Food Database Foundation

Phase 8 adds a local app-owned food database foundation. `FoodItem` stores
globally visible app/cached foods and current-user custom foods. `SavedFoodItem`
stores the current user's saved food relationships. `FoodBarcode` stores local
barcode mappings for future scanning flows.

Food item APIs are backend-owned and follow the same `/api/v1` envelope and
mock-user boundary as the rest of the app. Search is intentionally simple:
visible, non-archived food items are matched against normalized name and brand
text. Visible means `FoodItem.userId` is the current user or `null`.

Phase 8 local barcode lookup checks cached `FoodBarcode` records only, with an
exact region match first and `GLOBAL` fallback. The app does not call Open Food
Facts or USDA yet, does not open a camera, does not create barcode records
through the public API, and does not add native dependencies.

Food item nutrition uses nullable columns for MVP nutrients. Phase 9 adds
normalized unit-bearing nutrient rows for extended Complex-mode data on both
`FoodItem` and `FoodLog`; food-log nutrient rows are historical snapshots.
`additionalNutrients` JSON remains only for raw or unmapped compatibility
metadata. Missing nutrients remain unknown/null or absent and are not converted
to zero.

## Future Food Data And Intelligent Logging

```text
User describes food or provides an image
→ AI parses intent / identifies possible foods
→ retrieval searches trusted food sources
→ backend returns structured candidates
→ user reviews and edits
→ backend saves confirmed FoodLog
```

The food system continues the hybrid strategy started in Phase 8: app-owned
cached and user food records, Open Food Facts for barcode-first packaged food
lookup, and USDA FoodData Central for generic foods and detailed nutrients.
External food data should be cached into the app database where appropriate.

AI is not the nutrition source of truth. Phase 12 uses Gemini as the first
hosted parser behind a backend provider abstraction. API keys live only in
backend environment variables. The backend validates structured provider output
and performs deterministic lexical retrieval against trusted `FoodItem` data.
AI must not silently save logs, invent nutrient data when trusted data is
available, bypass user confirmation, or replace backend validation. Vector
databases, embeddings, and self-hosted model serving are deferred.

Phase 12.5 adds USDA FoodData Central as a backend-owned generic food fallback
when local trusted `FoodItem` retrieval has no loggable match. USDA/FDC API
keys live only in backend environment variables. Mobile receives structured
review candidates, including explicit nutrient basis copy such as `per 100 g`,
but never receives USDA keys or submits USDA nutrition as truth. Selected USDA
references are refetched and cached by the backend before normal FoodLog
snapshots are created.

Photo logging belongs after the food database and retrieval foundations. See
[food-data-and-ai-strategy.md](food-data-and-ai-strategy.md) for the detailed
direction.

### Phase 14 Photo Food Logging

Photo analysis accepts only a route-local raw `image/jpeg` body up to exactly
5 MiB. The image is validated in memory, passed through a separate
`PhotoAnalysisProvider`, and never written to a file, database, cloud object,
or retained review session. The provider can be disabled, mocked, or Gemini;
credentials remain backend-only. Gemini receives inline image bytes internally
and is instructed to return only food identity, optional preparation, and
provisional portion wording. Nutrition, density, candidate IDs, and saving are
explicitly prohibited.

One photo may produce up to eight independent recognition rows. Each row is
matched through the existing deterministic retrieval and candidate-ranking
system, then its provisional serving is checked with the existing serving
resolution system. Vision identity confidence, vision portion confidence, and
trusted candidate confidence remain separate. Observed quantity, normalized
grams or millilitres, and selected serving remain separate. Low-confidence,
ambiguous, or unsupported results retain the appropriate review or estimate
state. Validated external records may become canonical FoodItems; analysis
does not create FoodLogs, image records, or review sessions. Mixed confirmation
re-fetches canonical FoodItems and writes trusted and estimated FoodLogs
atomically.

---

## Core Components

### Frontend
Responsibilities:
- UI rendering
- local state
- forms
- charts

---

### API Layer
Responsibilities:
- request handling
- validation
- orchestration
- authentication boundary

The API uses REST-style endpoints under `/api/v1` and the standard success/error envelopes defined in [api-contracts.md](api-contracts.md).

The current development implementation uses a fixed mock user through mock auth
context. Authenticated endpoints operate on the current user, and clients never
send `userId`. The authentication provider is undecided until Phase 19 planning.
Authentication establishes identity; authorization controls resource access. Do
not implement custom password authentication or a provider integration through
this documentation update.

---

### Parser Layer (Future)
Responsibilities:
- parse messy input
- return proposed structured food entries
- require user confirmation before persistence

---

### Nutrition Matcher (Future)
Responsibilities:
- look up nutrition data for confirmed foods
- produce structured nutrient values deterministically
- prefer user/recent/saved/custom/cached data before external sources
- preserve nullable unknown nutrient values instead of treating missing data as
  zero

---

### Analytics Engine
Responsibilities:
- daily totals
- weekly averages
- trends
- goal adherence
- recommendation source facts

Analytics computes facts only. It queries food and weight records and performs all calculations deterministically.

Inputs are normalized and rounded before storage. Analytics sums stored normalized values. Calories and sodium use whole stored values; macros and body weight use one decimal place.

As the backend food and nutrition model becomes richer, analytics should expose
daily nutrient totals and reporting facts for Progress, Insights, and
Recommendations. The mobile app should only display nutrients and charts that
the backend actually provides.

---

### Recommendation Engine
Responsibilities:
- convert analytics facts into structured recommendation objects
- assign recommendation type, severity, title, message, and source facts
- operate without AI

AI may later rewrite or explain recommendation wording, but it must not calculate facts, detect deficits, analyze trends, decide recommendations, or query the database.

Example:

```json
{
  "type": "protein_low",
  "severity": "medium",
  "title": "Protein is below target",
  "message": "You are averaging 35g below your protein target this week.",
  "sourceFacts": {
    "proteinTarget": 150,
    "averageProtein": 115,
    "difference": 35
  }
}
```

### Phase 12.9B Slice 1 Mixed Meals

Mixed-meal preview is read-only and uses the same authoritative serving
resolution and frozen ingredient aggregation as creation. Creation resolves
all FoodItems again in one serializable transaction, writes one FoodLog and
normalized nutrient rows, and may create a Recipe in that same transaction.
`FoodLog.mixedMealSnapshot` is immutable provenance; only meal metadata can be
edited after logging.

Mixed meals use no permanent mixed-meal table. Creation writes one FoodLog and
normalized nutrient rows, with optional atomic Recipe creation. Manual foods
are user-owned `user_custom` FoodItems with `sourceProvider: manual`; they are
searchable and reusable without automatic SavedFoodItem creation. Manual-food
edits affect future uses only, while recipe, mixed-meal, and historical
FoodLog snapshots remain frozen. Recipe-origin and mixed-meal-origin logs are
metadata-only editable in History.

## Timezone And Tracking Days

- Store timestamps in UTC.
- Store each user's IANA timezone as a user preference.
- Default to `America/Toronto` for now.
- Convert timestamps into the user's timezone when calculating daily totals, streaks, summaries, and weekly reports.
- Group logs by the local date produced after converting `loggedAt` into the user's timezone, not by UTC calendar date.
- A tracking day runs from local midnight through the end of that local calendar day.
- Do not permanently hardcode the default timezone.

## Daily Summaries

Analytics calculates daily summaries on demand from `FoodLog` records. The
frontend requests summaries from analytics endpoints. A stored `DailySummary`
is a possible future cache only and must not become the source of truth without
an explicitly approved architecture change.

See [data-model-decisions.md](data-model-decisions.md) for locked units, precision, rounding, and food-log representations.

See [prisma-schema-decisions.md](prisma-schema-decisions.md) for locked MVP models, database types, relations, indexes, and cascade behavior.

## Repository And Tooling

Use `pnpm` as the package manager and `pnpm` workspaces for the monorepo. Do not introduce Nx. Add Turborepo only if later build complexity demonstrates a need.

```bash
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
# Food library boundary (Phase 13 complete)

The library is a query view over `SavedFoodItem`, current-user manual
`FoodItem`s, and FoodLog-derived recency; it has no recent-food table.
Default servings are per-user preferences validated by the existing serving
resolver. FoodLog conversion copies frozen persisted values and never reads a
live source FoodItem, preserving snapshot history.

The mobile library uses the existing Food Log modal stack and shared serving
session. It renders backend library sections and nutrition rather than storing
or calculating recent-food or serving facts locally.
