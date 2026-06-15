# Technical Decisions

This file records locked Phase 0 technical decisions. Changes to these decisions require explicit architecture review.

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
- Phase 1 uses a fixed mock user through mock auth context.
- Authenticated endpoints operate on the current user.
- Clients do not send `userId` in requests.
- User identity should eventually come from Supabase Auth.
- User-owned records reference the local `User.id`; long-term, that ID aligns with the Supabase Auth user ID.
- Do not build custom password authentication or a custom auth system.

## TD-003: Phase 2 Food Logging

Status: Locked

Phase 2 supports manual structured nutrition entry only.

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

Phase 2 flow:

```text
Manual entry
→ validation
→ database
→ analytics
→ dashboard/history
```

Phase 2 excludes AI parsing, nutrition matching, automated food lookup, Open Food Facts integration, barcode scanning, and photo recognition.

## TD-004: Future Intelligent Food Logging

Status: Locked

Automated food input belongs to a later phase:

```text
Raw text input
→ AI parser
→ user confirmation
→ nutrition matcher
→ parsed food log
→ analytics
```

AI parsing proposes structured entries. The user confirms them before persistence and nutrition matching.

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
- Do not store `DailySummary` in Phase 2 without a demonstrated performance reason.
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
- Phase 1 uses mock user context.
- Client requests never include `userId`.
- Date filters are local dates in `YYYY-MM-DD` interpreted in the current user's timezone.
- MVP endpoints and request/response contracts are defined in [api-contracts.md](api-contracts.md).

## TD-009: Prisma And PostgreSQL Schema

Status: Locked

- Use UUID primary keys for all models.
- Use a local `User` model; Phase 1 may mock-generate its ID, and long-term it aligns with Supabase Auth.
- Include only the seven locked MVP models in the Phase 1 schema.
- Use the field types, enums, constraints, indexes, relations, and cascade-delete rules defined in [prisma-schema-decisions.md](prisma-schema-decisions.md).
- Do not include `DailySummary`, raw/parsed food logs, or other future models in Phase 1.
