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
- foodItemId (optional reference to a reusable `FoodItem`; set to `null` if
  the food item is deleted)
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

`FoodLog` remains snapshot-based. Existing manual create/update APIs do not
require or expose `foodItemId`; the optional relation is groundwork for future
log-from-food flows and must not make old logs depend on mutable food item
records.

---

### FoodItem
Reusable app-owned food record for Phase 8 local food database foundation.

Fields:
- id
- userId (nullable; `null` means globally visible app/cached food, non-null
  means current-user custom food)
- name
- brandName (optional)
- sourceType (`user_custom`, `cached_external`, or `app_owned`)
- foodType (`generic` or `branded`)
- normalizedName
- normalizedBrandName (optional)
- searchText
- servingQuantity (optional decimal)
- servingUnit (optional)
- servingWeightGrams (optional decimal grams)
- calories (optional integer kcal)
- protein (optional decimal grams, one decimal place)
- carbs (optional decimal grams, one decimal place)
- fat (optional decimal grams, one decimal place)
- fiber (optional decimal grams, one decimal place)
- sugar (optional decimal grams, one decimal place)
- sodium (optional integer mg)
- additionalNutrients (optional JSON for future unit-bearing nutrients)
- sourceProvider (optional `open_food_facts`, `usda_fdc`, `manual`, or `other`)
- sourceId (optional)
- sourceUpdatedAt (optional)
- archivedAt (optional)
- createdAt
- updatedAt

Missing nutrient values are stored as `null` or absent JSON keys, never as
synthetic zeroes. `additionalNutrients` is reserved for future nutrient values
with units, for example:

```json
{
  "caffeine": { "amount": 95, "unit": "mg" },
  "vitaminC": { "amount": 60, "unit": "mg" }
}
```

Phase 8 does not add full micronutrient reporting or UI.

---

### FoodBarcode
Local barcode mapping groundwork for future barcode scanning.

Fields:
- id
- foodItemId
- barcode
- barcodeFormat (optional)
- regionCode (defaults to `GLOBAL`)
- createdAt
- updatedAt

`FoodBarcode` enforces uniqueness on `[barcode, regionCode]`. Phase 8 supports
local lookup with exact region first and `GLOBAL` fallback. It does not create
barcode records through the public API, call external barcode services, add
camera scanning, or add native dependencies.

---

### SavedFoodItem
Current-user saved-food relationship.

Fields:
- id
- userId
- foodItemId
- createdAt

`SavedFoodItem` enforces one saved relationship per `[userId, foodItemId]`.
Saved foods are a relationship to visible food items; saved meals remain
future-only.

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
- `FoodItem.userId` is nullable for globally visible app/cached foods and
  required for custom user foods.
- `SavedFoodItem` requires `userId` and `foodItemId`.
- `FoodBarcode` requires `foodItemId`, `barcode`, and `regionCode`.
- `FoodLog` and `WeightLog` have no unique timestamp constraints.
- `FoodBarcode` is unique by `[barcode, regionCode]`.
- `SavedFoodItem` is unique by `[userId, foodItemId]`.
- Deleting a `User` cascades to every user-owned MVP record.
- Deleting a `FoodItem` cascades barcode and saved-food relationships and sets
  related `FoodLog.foodItemId` values to `null`.
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

Phase 8 implements the first local app-owned food database foundation:

- cached/app-owned foods through globally visible `FoodItem` rows
- user-created custom foods through user-owned `FoodItem` rows
- saved foods through `SavedFoodItem`
- barcode-linked foods through `FoodBarcode`
- external source/provider metadata for later Open Food Facts and USDA caching
- serving metadata and nullable MVP nutrients
- `additionalNutrients` JSON for future unit-bearing nutrient expansion

Food search should eventually prefer user recent foods, saved foods/meals,
custom foods, cached app foods, and then external generic/branded sources.
Barcode lookup should eventually prefer local cached barcodes, Open Food Facts,
USDA/branded fallback where useful, and custom food creation when not found.

Phase 8 does not implement external Open Food Facts/USDA integrations, barcode
camera scanning, RAG-assisted AI logging, photo logging, saved meals, or full
Complex mode micronutrient UI.

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
