# Database Schema

This document summarizes the intended MVP data model. Units and normalization rules are locked in [data-model-decisions.md](data-model-decisions.md). Exact Prisma/PostgreSQL types, constraints, indexes, relations, and cascade behavior are locked in [prisma-schema-decisions.md](prisma-schema-decisions.md).

All timestamps are stored in UTC. Analytics converts timestamps into the user's stored IANA timezone when assigning records to tracking days.

Normalized values are rounded before storage. Analytics sums stored values.

## MVP Tables

### User
- id (UUID; mock-generated in Phase 1 and aligned with Supabase Auth user ID later)
- email (optional)
- createdAt
- updatedAt

Phase 1 uses mocked auth and a local `User` record. Supabase Auth is the intended later identity provider. Do not store custom password credentials.

---

### UserProfile
- id
- userId
- age
- sex
- heightInches (optional total integer inches; entered as feet/inches)
- startingWeightLb (optional decimal pounds, one decimal place)
- timezone (IANA timezone; defaults to `America/Toronto` for now)

---

### UserGoal
- id
- userId
- goalType (`lose`, `maintain`, or `gain`)
- targetWeightLb (optional decimal pounds, one decimal place)
- targetCalories (integer kcal)
- targetProteinGrams (optional decimal grams, one decimal place)

---

### TrackingPreference
- id
- userId
- mode (simple/complex)
- waterTrackingEnabled (defaults to false)

---

### FoodLog
Stores one manually entered structured food item.

Fields:
- id
- userId
- foodName
- mealType (`breakfast`, `lunch`, `dinner`, `snack`, or `other`)
- calories (integer kcal)
- protein (decimal grams, one decimal place)
- loggedAt
- carbs (optional decimal grams, one decimal place)
- fat (optional decimal grams, one decimal place)
- fiber (optional decimal grams, one decimal place)
- sugar (optional decimal grams, one decimal place)
- sodium (optional integer mg)
- servingQuantity (optional decimal)
- servingUnit (optional)
- notes (optional)
- createdAt
- updatedAt

Each record is an individual food entry, not a full meal. Multiple entries may share a `mealType`. An optional `mealGroupId` may be added later, but meal grouping is not required for the MVP.

---

### WeightLog
- id
- userId
- weightLb (decimal pounds, one decimal place)
- loggedAt
- createdAt
- updatedAt

---

### Recommendation
- id
- userId
- type
- severity
- title
- message
- sourceFacts
- status
- createdAt
- updatedAt

---

## Schema Rules

- All model IDs are UUID primary keys.
- All timestamps use timestamp-with-time-zone columns and are stored in UTC.
- `UserProfile.userId`, `UserGoal.userId`, and `TrackingPreference.userId` are unique.
- `FoodLog`, `WeightLog`, and `Recommendation` require `userId`.
- `FoodLog` and `WeightLog` have no unique timestamp constraints.
- Deleting a `User` cascades to every user-owned MVP record.
- Required indexes are locked in [prisma-schema-decisions.md](prisma-schema-decisions.md).

## Future Tables And Fields

### RawFoodLog
Future record for original AI-assisted or external input. Not part of Phase 2.

### ParsedFoodLog
Future record for parser and nutrition matcher output after user confirmation. Not part of Phase 2.

### DailySummary
Future cached summary only. It is not an MVP table or source of truth. MVP analytics calculates daily totals on demand from `FoodLog` records to avoid stale summaries after edits or deletions.

### SavedMeal
Future reusable meal definition. Its data model is not yet decided.

### Other Future Models
`CustomFood`, `WaterLog`, `SupplementLog`, and `MicronutrientLog` are not part of the MVP schema.
