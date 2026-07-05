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

The project currently uses PostgreSQL as the SQL database. In local
development, PostgreSQL runs inside Docker; the Docker container is mainly the
local database server. The API itself is normally run locally through pnpm
scripts, not inside Docker. Prisma handles database access and migrations.

The backend owns validation, business logic, analytics, and recommendation
decisions. The frontend owns UI and local state. Current authentication still
uses the fixed mock/dev-user boundary. Real authentication is planned for
later, likely through Supabase Auth.

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

The implemented manual logging flow does not use AI parsing, nutrition
matching, Open Food Facts, barcode camera scanning, or photo recognition.
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

The future food system should continue the hybrid strategy started in Phase 8:
app-owned cached and user food records, Open Food Facts for barcode-first
packaged food lookup, and USDA FoodData Central for generic foods and detailed
nutrients. External food data should be cached into the app database where
appropriate.

AI is not the nutrition source of truth. It can parse messy input, split meals
into likely items, estimate serving descriptions, rank candidate matches, and
generate user-friendly explanations. It must not silently save uncertain logs,
invent nutrient data when trusted data is available, bypass user confirmation,
or replace backend validation.

Photo logging belongs after the food database and retrieval foundations. See
[food-data-and-ai-strategy.md](food-data-and-ai-strategy.md) for the detailed
direction.

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
send `userId`. Supabase Auth is the intended later authentication provider. Do
not implement custom password authentication or a custom auth system.

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
