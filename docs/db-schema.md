# Database Schema

This document summarizes the intended MVP data model. Units and normalization rules are locked in [data-model-decisions.md](data-model-decisions.md). Exact Prisma/PostgreSQL types, constraints, indexes, relations, and cascade behavior are locked in [prisma-schema-decisions.md](prisma-schema-decisions.md).

All timestamps are stored in UTC. Analytics converts timestamps into the user's stored IANA timezone when assigning records to tracking days.

Normalized values are rounded before storage. Analytics sums stored values.

## MVP Tables

### User
- id (UUID; currently mock-generated and aligned with Supabase Auth user ID later)
- email (optional)
- createdAt
- updatedAt

The current development implementation uses mocked auth and a local `User`
record. Supabase Auth is the intended later identity provider. Do not store
custom password credentials.

---

### UserProfile
- id
- userId
- name
- age
- birthDate
- sex (`male` or `female`)
- heightInches (optional total integer inches; entered as feet/inches)
- startingWeightLb (optional decimal pounds, one decimal place)
- timezone (IANA timezone; defaults to `America/Toronto` for now)
- activityLevel (`sedentary`, `lightly_active`, `moderately_active`, `very_active`, or `athlete`)
- trainingStyle (`none`, `cardio`, `weight_training`, `mixed`, or `athlete`)

---

### UserGoal
- id
- userId
- goalType (`lose`, `maintain`, or `gain`)
- goalPace (nullable; must match the goal type)
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

Future schema work should support the MVP direction documented in
[food-data-and-ai-strategy.md](food-data-and-ai-strategy.md): faster logging,
accurate food data, full Complex mode nutrition, barcode scanning, and
RAG-assisted AI logging.

### RawFoodLog
Future record for original AI-assisted or external input. Not currently
implemented.

### ParsedFoodLog
Future record for parser and nutrition matcher output after user confirmation.
Not currently implemented.

### DailySummary
Future cached summary only. It is not an MVP table or source of truth. MVP analytics calculates daily totals on demand from `FoodLog` records to avoid stale summaries after edits or deletions.

### SavedMeal
Future reusable meal definition. Its data model is not yet decided.

### Food Data Foundation

Future food data models should support:

- cached app foods
- user-created foods
- corrected foods
- recent foods
- saved foods
- saved meals
- barcode-linked foods
- external source identifiers
- serving sizes and units
- source attribution and freshness metadata where useful

Food search should eventually prefer user recent foods, saved foods/meals,
custom foods, cached app foods, and then external generic/branded sources.
Barcode lookup should eventually prefer local cached barcodes, Open Food Facts,
USDA/branded fallback where useful, and custom food creation when not found.

### Full Nutrition Model

Complex mode should eventually support full nutrient tracking. Future nutrient
values must include units, and missing nutrient values must be nullable/unknown
rather than treated as zero.

Future nutrient coverage should include:

- calories, protein, carbohydrates, fat, fiber, sugar, added sugar where
  available, saturated fat, trans fat, monounsaturated fat where available,
  polyunsaturated fat where available, cholesterol, sodium, potassium, and
  caffeine
- vitamin A, vitamin B1 / thiamine, vitamin B2 / riboflavin, vitamin B3 /
  niacin, vitamin B5 / pantothenic acid, vitamin B6, vitamin B7 / biotin,
  vitamin B9 / folate, vitamin B12, vitamin C, vitamin D, vitamin E, and
  vitamin K
- calcium, iron, magnesium, zinc, phosphorus, selenium, copper, manganese,
  iodine, chromium, molybdenum, and chloride

Backend summaries should eventually support daily nutrient totals. Progress
and Insights must only display nutrients that backend summaries actually
provide.

### Other Future Models
`CustomFood`, `WaterLog`, `SupplementLog`, and `MicronutrientLog` are not part of the MVP schema.
