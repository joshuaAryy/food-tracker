# Architecture

## High-Level System

```text
Mobile App
  ↓
API Layer
  ↓
Validation Layer
  ↓
Business Modules
  ↓
Database
  ↓
Analytics Engine
  ↓
Recommendation Engine
  ↓
Dashboard
```

The backend owns validation, business logic, analytics, and recommendation decisions. The frontend owns UI and local state.

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
matching, food database lookup, Open Food Facts, barcode scanning, or photo
recognition.

## Future Intelligent Food Logging

```text
Raw text input
→ AI parser
→ user confirmation
→ nutrition matcher
→ parsed food log
→ analytics
```

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
