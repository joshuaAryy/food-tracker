# Data Model Decisions

This file records locked MVP data representation decisions. Changes require explicit architecture review.

See [prisma-schema-decisions.md](prisma-schema-decisions.md) for locked Prisma/PostgreSQL types, constraints, relations, indexes, and cascade behavior.

## Units

| Value | User Input And Display | Stored Representation |
| --- | --- | --- |
| Body weight | Pounds | Decimal pounds |
| Height | Feet and inches | Total integer inches |
| Calories | Kilocalories | Integer kcal |
| Protein | Grams | Decimal grams |
| Carbs | Grams | Decimal grams |
| Fat | Grams | Decimal grams |
| Fiber | Grams | Decimal grams |
| Sugar | Grams | Decimal grams |
| Sodium | Milligrams | Integer mg |
| Timezone | IANA timezone string | IANA timezone string |

The default timezone is `America/Toronto`. The timezone remains a stored user preference and must not be permanently hardcoded.

## Precision And Rounding

- Store protein, carbs, fat, fiber, and sugar to one decimal place.
- Store body weight in pounds to one decimal place.
- Round calories to the nearest whole kcal before storage.
- Round sodium to the nearest whole mg before storage.
- Store normalized rounded values.
- Analytics sums stored normalized values without reinterpreting source precision.
- The frontend displays calories as whole numbers and macros to one decimal place.

## MVP FoodLog

Each `FoodLog` represents one manually entered food item.

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

Nutrient fields use the units, precision, and rounding rules defined above.

`userId` is required in persisted records but is supplied by backend auth context, not by client request bodies. Serving quantity and serving unit remain optional for raw manual logs; trusted create and snapshot-backed update paths resolve them authoritatively through the shared serving engine.

## Serving Intelligence Persistence

FoodItem has nullable `servingOptions` JSON for alternate trusted provider or
manual relationships only; its canonical nutrition basis remains the existing
serving and nutrient fields. FoodLog has nullable `servingSnapshot` JSON for the
immutable basis, requested serving, resolution, provenance, and override state
used by authoritative trusted creates and snapshot-backed updates. Legacy rows
remain NULL; no existing records were backfilled or given fabricated
provenance. Malformed JSON is ignored safely at serialization/read boundaries.

## Reusable Recipe Persistence

`Recipe` is user-owned and has a name, optional description, positive integer
portion count, optional final cooked weight, archive state, and ordered
`RecipeIngredient` records. Every ingredient holds a versioned JSON snapshot;
there is intentionally no normalized recipe-ingredient nutrient table.

Recipe snapshots retain FoodItem identity/name, basis, requested serving,
resolution, provenance, and resolved nutrition. Every decimal in a recipe
ingredient or recipe-log snapshot is a canonical decimal string, never a JSON
number. Recipe totals are summed from frozen ingredient snapshots with
server-side decimal arithmetic, then materialized as whole calories/sodium,
one-decimal column macros, and four-decimal normalized nutrients. Per-portion
values divide totals by portion count; per-gram values exist only when final
cooked weight exists.

Changing recipe metadata must not recalculate ingredient snapshots. A future
ingredient mutation may replace only that ingredient snapshot. Nullable source
FoodItem and Recipe links on historical records preserve snapshots if either
source is deleted.

## Recipe-to-FoodLog Snapshot Materialization

Recipe logging writes exactly one FoodLog with nullable `foodItemId`, nullable
`servingSnapshot`, a live `recipeId` relation when available, and a strict
version-2 `recipeSnapshot`. The snapshot includes frozen recipe metadata,
ordered ingredient snapshots, full-precision aggregate totals, the logged
amount/unit, canonical-string rounded stored nutrition, and full-precision
per-ingredient contributions. It is calculated solely from recipe snapshots;
no live FoodItem nutrition is consulted.

Recipe amount scaling is `amount / portionCount` for portions or `amount /
finalCookedWeightGrams` for grams. Decimal arithmetic remains full precision
until the one FoodLog persistence round: calories/sodium whole, macro columns
one decimal, normalized nutrients four decimals. All values stored inside
recipe JSON snapshots remain canonical decimal strings. A recipe-origin FoodLog
may later change only meal metadata (`mealType`, `loggedAt`, and `notes`);
nutrition, source, servings, and provenance are immutable.

## Phase 12.9B Mixed Meals And Manual Foods

Mixed meals are represented by one FoodLog plus nullable versioned
`mixedMealSnapshot` JSONB; no mixed-meal table is a source of truth. The
snapshot freezes ordered ingredient snapshots, full-precision totals, rounded
logged nutrition, and contributions. Optional save-as-recipe creation is
atomic with FoodLog creation.

Manual foods reuse FoodItem with current-user ownership, `user_custom` source
type, and `manual` provider. Their nutrition basis is per 100 g or a supported
per-serving unit, with physical conversion only from explicitly declared gram
or millilitre equivalence. Archive-only deletion hides future selection while
preserving historical snapshots. Missing optional nutrients remain unknown;
explicit all-zero nutrition is valid.

## MealType Enum

The MVP `mealType` values are:

- `breakfast`
- `lunch`
- `dinner`
- `snack`
- `other`

## Tracking Days

- Store all timestamps in UTC.
- Group food logs into tracking days by converting `loggedAt` into the user's stored IANA timezone and using the resulting local date.
- Use `America/Toronto` as the default timezone for now.
- Tracking-day analytics must not group records by UTC calendar date.
