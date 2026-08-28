# Database Schema

This document summarizes the intended MVP data model. Units and normalization rules are locked in [data-model-decisions.md](data-model-decisions.md). Exact Prisma/PostgreSQL types, constraints, indexes, relations, and cascade behavior are locked in [prisma-schema-decisions.md](prisma-schema-decisions.md).

All timestamps are stored in UTC. Analytics converts timestamps into the user's stored IANA timezone when assigning records to tracking days.

Normalized values are rounded before storage. Analytics sums stored values.

## Phase 18/19 reference-food provenance

`FoodItem` retains provider identity (`sourceProvider`/`sourceId`), official
authoritative aliases, source region, ranking class, dataset release, and a
deterministic source-record hash. CNF, Ciqual, and CoFID use the neutral
`reference` ranking class even when stored as `app_owned`; genuinely curated
app foods remain `app_curated`. A partial provider/source identity index prevents
duplicate ingestion while allowing records without provider identity to coexist.

`FoodDatasetRelease` records source URI/checksum, release status, and import
counts. Nutrient values remain canonical PostgreSQL values; unknown provider
values are omitted rather than converted to zero. A reviewed `pg_trgm`
extension/index supports bounded KNN candidate generation. `FoodItemNutrient`
also retains nullable provider/source-record/release provenance; historical
`FoodLogNutrient` snapshots remain unchanged. `FoodSearchIndexVersion` records
the derived Pinecone document/model namespace lifecycle independently of
nutrition data.

## MVP Tables

### User
- id (UUID; application-owned; Firebase identity mapping is implemented; future
  account-lifecycle work remains in Phase 20)
- email (optional)
- createdAt
- updatedAt

The current implementation uses Firebase Authentication at the identity
boundary and maps the verified Firebase UID to the application-owned `User`
record. Do not store custom password credentials. Remaining account lifecycle
and isolation work is tracked in Phase 20.

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
- targetCarbsGrams (nullable decimal grams, one decimal place)
- targetFatGrams (nullable decimal grams, one decimal place)
- targetFiberGrams (nullable decimal grams, one decimal place)
- limitSugarGrams (nullable decimal grams, one decimal place)
- limitSodiumMg (nullable integer milligrams)

The five new fields are nullable for backward-compatible migration and
legacy setup-incomplete rows. The reporting goal resolver uses explicit stored
values first, derives missing values deterministically from the existing
calorie/protein targets next, and applies the documented product default for
sodium when no explicit value exists. New onboarding persists all derived
values. Existing rows are repaired lazily when goals or reports are read; no
destructive one-time backfill is required.

The supported reporting directions are target (calories), minimum (protein,
carbohydrates, fat, fiber), and limit (sugar, sodium). Period percentages use
the existing report eligible-day count as the applicable day count. Weight
continues to use `targetWeightLb` and is not duplicated in the nutrient goal
model.

---

### TrackingPreference
- id
- userId
- mode (simple/complex)
- waterTrackingEnabled (defaults to false)

Phase 17.5 adds an additive server-owned initial hydration goal of
`2000 mL/day` through the approved persistence design. The legacy
`waterTrackingEnabled` field remains for compatibility and does not gate
hydration visibility. Target editing is outside Phase 17.5.

---

### FoodLog
Stores one manually entered structured food item.

Fields:
- id
- userId
- foodItemId (optional reference to a reusable `FoodItem`; set to `null` if
  the food item is deleted)
- recipeId (optional reference to a reusable `Recipe`; set to `null` if the
  recipe is deleted)
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
- normalized extended nutrients are stored in `FoodLogNutrient`
- servingQuantity (optional decimal)
- servingUnit (optional)
- recipeSnapshot (optional immutable recipe provenance JSONB)
- notes (optional)
- createdAt
- updatedAt

Each record is an individual food entry, not a full meal. Multiple entries may share a `mealType`. An optional `mealGroupId` may be added later, but meal grouping is not required for the MVP.

`FoodLog` remains snapshot-based. Existing manual create/update APIs do not
require or expose `foodItemId`; the optional relation is groundwork for future
log-from-food flows and must not make old logs depend on mutable food item
records.

Phase 9 adds `FoodLogNutrient` rows for extended Complex-mode nutrient
snapshots. These rows preserve historical nutrient values independently of
later `FoodItem` edits or archives.

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
- additionalNutrients (optional JSON for raw/unmapped unit-bearing compatibility
  metadata)
- normalized extended nutrients are stored in `FoodItemNutrient`
- sourceProvider (optional `open_food_facts`, `usda_fdc`, `manual`, or `other`)
- sourceId (optional)
- sourceUpdatedAt (optional)
- archivedAt (optional)
- createdAt
- updatedAt

Missing nutrient values are stored as `null` or absent keys, never as
synthetic zeroes. `additionalNutrients` is reserved for raw or unmapped
unit-bearing compatibility metadata, for example:

```json
{
  "caffeine": { "amount": 95, "unit": "mg" },
  "vitaminC": { "amount": 60, "unit": "mg" }
}
```

Phase 9 does not add full micronutrient reporting UI.

---

### Recipe

User-owned reusable recipe definition. It stores `name`, optional
`description`, integer `portionCount`, optional decimal `finalCookedWeightGrams`,
archive and timestamp fields. Recipe nutrition is derived from frozen
`RecipeIngredient.ingredientSnapshot` JSON rather than mutable FoodItem rows.

### RecipeIngredient

An ordered frozen ingredient for one Recipe. It stores `recipeId`, optional
`foodItemId` (set to `null` if its source food is deleted), integer `position`,
and a versioned `ingredientSnapshot` JSONB. `[recipeId, position]` is unique;
the schema deliberately does not add a normalized recipe-ingredient nutrient
table.

---

### FoodItemNutrient
Normalized extended nutrient values for reusable food items.

Fields:
- id
- foodItemId
- nutrientKey (`NutrientKey`)
- amount (decimal)
- unit (`kcal`, `g`, `mg`, or `mcg`)
- createdAt
- updatedAt

`FoodItemNutrient` is unique by `[foodItemId, nutrientKey]`. Deleting a
`FoodItem` cascades its nutrient rows.

---

### FoodLogNutrient
Normalized extended nutrient snapshots for food logs.

Fields:
- id
- foodLogId
- nutrientKey (`NutrientKey`)
- amount (decimal)
- unit (`kcal`, `g`, `mg`, or `mcg`)
- createdAt
- updatedAt

`FoodLogNutrient` is unique by `[foodLogId, nutrientKey]`. Deleting a
`FoodLog` cascades its nutrient rows. These rows are snapshots and do not
change when a related `FoodItem` changes.

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
- `FoodItemNutrient` requires `foodItemId`, `nutrientKey`, `amount`, and
  `unit`.
- `FoodLogNutrient` requires `foodLogId`, `nutrientKey`, `amount`, and `unit`.
- `Recipe` requires `userId`, `name`, and `portionCount`; `RecipeIngredient`
  requires `recipeId`, `position`, and `ingredientSnapshot`.
- `FoodLog` and `WeightLog` have no unique timestamp constraints.
- `FoodBarcode` is unique by `[barcode, regionCode]`.
- `SavedFoodItem` is unique by `[userId, foodItemId]`.
- `FoodItemNutrient` is unique by `[foodItemId, nutrientKey]`.
- `FoodLogNutrient` is unique by `[foodLogId, nutrientKey]`.
- Deleting a `User` cascades to every user-owned MVP record.
- Deleting a `FoodItem` cascades barcode and saved-food relationships and sets
  related `FoodLog.foodItemId` and `RecipeIngredient.foodItemId` values to
  `null`.
- Deleting a `Recipe` sets related `FoodLog.recipeId` values to `null` and
  cascades its ingredients.
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

Phase 9 implements the backend/data foundation for full Complex-mode nutrient
tracking. Existing `FoodLog` and `FoodItem` columns remain the source for
`calories`, `protein`, `carbs`, `fat`, `fiber`, `sugar`, and `sodium`.
Extended nutrients are stored in normalized nutrient rows. `additionalNutrients`
JSON remains only for raw/unmapped metadata.

Every catalog nutrient has a default unit. Phase 9 accepts only the default
unit for normalized nutrient input; unit conversion and source mapping are
deferred. Missing nutrient values remain nullable/unknown rather than treated
as zero.

The static shared catalog covers:

- column-backed nutrients: calories, protein, carbs, fat, fiber, sugar, sodium
- carbohydrate detail: added sugar, starch, soluble fiber, insoluble fiber,
  sugar alcohol
- fat and lipid detail: saturated fat, trans fat, monounsaturated fat,
  polyunsaturated fat, omega-3, omega-6, cholesterol
- amino acids: histidine, isoleucine, leucine, lysine, methionine,
  phenylalanine, threonine, tryptophan, valine, alanine, arginine, aspartic
  acid, cystine, glutamic acid, glycine, proline, serine, tyrosine
- common/other tracked compounds: potassium, caffeine, alcohol, water, oxalate,
  phytate
- vitamin A, vitamin B1 / thiamine, vitamin B2 / riboflavin, vitamin B3 /
  niacin, vitamin B5 / pantothenic acid, vitamin B6, vitamin B7 / biotin,
  vitamin B9 / folate, vitamin B12, vitamin C, vitamin D, vitamin E, and
  vitamin K
- calcium, iron, magnesium, zinc, phosphorus, selenium, copper, manganese,
  iodine, chromium, molybdenum, and chloride

Daily nutrient totals combine column-backed totals with normalized nutrient
rows without double-counting column-backed nutrients. Missing nutrients are
absent from totals rather than fabricated as zero. Simple mode UI remains
unchanged, and Phase 9 does not implement barcode scanning, external food data
integrations, AI/RAG logging, photo logging, saved meals, or full Complex-mode
micronutrient UI.

### Other Future Models

`CustomFood`, `SupplementLog`, and `MicronutrientLog` remain outside the MVP
schema. Phase 17.5 uses an additive user-owned `WaterLog` model rather than
representing water as a FoodLog. It stores an amount in millilitres and the
authoritative logged timestamp, supports edit/delete and quick-add through the
same persistence path, and is the only source for hydration totals; water
contained in food is excluded.

Phase 17.5 also uses user-owned saved-view persistence for Complex analytics,
including relative period configuration, metric/comparison selection,
aggregation, visualization, target visibility, coverage filter, editable name,
ordering, and one nullable primary pinned-view reference. The models and
additive migrations are implemented; lifecycle and UI validation remain part
of the active phase work.

### Phase 12.9B Slice 1 Mixed Meals

The additive mixed-meal migration adds nullable `FoodLog.mixedMealSnapshot`
JSONB. A mixed-meal log remains one FoodLog with normalized FoodLogNutrient
rows; the snapshot stores versioned frozen ingredient snapshots, full-precision
totals, rounded logged nutrition, and ingredient contributions. There is no
mixed-meal table. Historical mixed-meal logs are independent of later recipe,
FoodItem, or source changes.

## Phase 12.8 Serving Fields

The additive serving-intelligence migration adds nullable FoodItem.servingOptions
and nullable FoodLog.servingSnapshot JSONB fields, with no backfill or
destructive changes. Serving options contain only validated trusted alternate
relationships. A FoodLog snapshot preserves the original unscaled nutrition
basis, requested serving, resolution, provenance, and effective override; final
scaled values remain in FoodLog columns and FoodLogNutrient rows. Legacy rows
remain NULL and retain their legacy behavior, and malformed stored JSON is
treated safely rather than fabricated into a basis.

## Phase 12.9A Recipe Foundation

The additive recipe migration creates `Recipe` and `RecipeIngredient` and adds
nullable `FoodLog.recipeId` and `FoodLog.recipeSnapshot` JSONB columns without
a backfill. Recipe and recipe-log snapshot decimals are canonical strings;
their frozen ingredient values remain authoritative when source FoodItems later
change, archive, or are deleted.

Slice 2 also adds nullable `FoodItem.description` for user-owned manual foods.
Manual foods continue to use the existing FoodItem row, normalized nutrient
rows, serving basis, serving options, ownership, and archive lifecycle.
# Food library additions

`FoodItemServingPreference` stores a user-owned requested serving prefill,
unique by user and FoodItem. `FoodItem.derivedFromFoodLogId` is nullable and
unique so a source log can yield at most one derived manual FoodItem. Both are
additive; SavedFoodItem remains the saved/favorite relation.
