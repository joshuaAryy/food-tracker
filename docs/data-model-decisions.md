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
