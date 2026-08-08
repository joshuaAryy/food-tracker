# Prisma Schema Decisions

This file records the locked Prisma/PostgreSQL schema decisions established
during foundation planning. It remains the canonical database-specific decision
document. Do not add models or change locked schema behavior without explicit
approval.

## Common Field Strategy

- Use UUID primary keys for all models.
- Represent IDs in Prisma as `String` values backed by PostgreSQL UUID columns.
- Use `@id @default(uuid()) @db.Uuid` for model IDs.
- Use `DateTime @default(now()) @db.Timestamptz` for `createdAt`.
- Use `DateTime @updatedAt @db.Timestamptz` for `updatedAt` where useful.
- Use PostgreSQL timestamp-with-time-zone columns for all timestamps.
- Store all timestamps in UTC.
- Use UUID foreign-key columns for all user ownership relations.

## User Identity

Use a local `User` model in the application database.

The original foundation used a fixed mock user. The current implementation uses
Firebase Authentication for identity, maps the verified Firebase UID to the
application-owned `User.id`, and keeps the ownership boundary server-side.
Remaining account-lifecycle work is tracked in Phase 20.

Long-term:
- The remaining account-lifecycle and isolation work follows Phase 19 semantic
  retrieval in Phase 20; `User.id` is not assumed to equal an external identity.
- Do not build custom password authentication.
- Do not store password credentials in the application database.

The earlier Supabase-specific alignment was a historical decision and is
superseded by TD-023 and the implemented Firebase boundary recorded in TD-025.
The local User ownership model remains unchanged.

## MVP Models

The locked MVP Prisma schema includes:

- `User`
- `UserProfile`
- `UserGoal`
- `TrackingPreference`
- `FoodLog`
- `Recipe`
- `RecipeIngredient`
- `FoodItem`
- `FoodBarcode`
- `SavedFoodItem`
- `FoodItemNutrient`
- `FoodLogNutrient`
- `WeightLog`
- `Recommendation`

`FoodLog` is the Phase 2 manual logging source of truth. Phase 8 adds
`FoodItem`, `FoodBarcode`, and `SavedFoodItem` as the local food database
foundation. Do not create `RawFoodLog`, `ParsedFoodLog`, `SavedMeal`, or
`DailySummary` without separate approval.

## Enums

```text
GoalType:
  lose
  maintain
  gain

ActivityLevel:
  sedentary
  lightly_active
  moderately_active
  very_active
  athlete

TrainingStyle:
  none
  cardio
  weight_training
  mixed
  athlete

GoalPace:
  slow
  moderate
  aggressive
  lean_bulk
  moderate_bulk
  aggressive_bulk

TrackingMode:
  simple
  complex

MealType:
  breakfast
  lunch
  dinner
  snack
  other

RecommendationSeverity:
  low
  medium
  high

RecommendationStatus:
  active
  dismissed
  archived

FoodItemSourceType:
  user_custom
  cached_external
  app_owned

FoodItemType:
  generic
  branded

FoodSourceProvider:
  open_food_facts
  usda_fdc
  manual
  other

NutrientUnit:
  kcal
  g
  mg
  mcg

NutrientKey:
  calories
  protein
  carbs
  fat
  fiber
  sugar
  sodium
  addedSugar
  starch
  solubleFiber
  insolubleFiber
  sugarAlcohol
  saturatedFat
  transFat
  monounsaturatedFat
  polyunsaturatedFat
  omega3
  omega6
  cholesterol
  histidine
  isoleucine
  leucine
  lysine
  methionine
  phenylalanine
  threonine
  tryptophan
  valine
  alanine
  arginine
  asparticAcid
  cystine
  glutamicAcid
  glycine
  proline
  serine
  tyrosine
  potassium
  caffeine
  alcohol
  water
  oxalate
  phytate
  vitaminA
  thiamine
  riboflavin
  niacin
  pantothenicAcid
  vitaminB6
  biotin
  folate
  vitaminB12
  vitaminC
  vitaminD
  vitaminE
  vitaminK
  calcium
  iron
  magnesium
  zinc
  phosphorus
  selenium
  copper
  manganese
  iodine
  chromium
  molybdenum
  chloride
```

## Model Fields

The declarations below are conceptual Prisma field definitions. The
implemented Prisma schema must preserve these types, nullability rules,
defaults, relations, and database-native types unless an approved migration
changes the decision.

### User

| Field | Prisma/PostgreSQL Decision |
| --- | --- |
| `id` | `String`, UUID primary key, `@default(uuid())`, `@db.Uuid` |
| `email` | nullable `String`; Firebase is the identity provider and the API maps its verified UID to this application-owned User |
| `createdAt` | `DateTime`, `@default(now())`, timestamp with timezone |
| `updatedAt` | `DateTime`, `@updatedAt`, timestamp with timezone |

Relations:
- optional one-to-one `UserProfile`
- optional one-to-one `UserGoal`
- optional one-to-one `TrackingPreference`
- many `FoodLog`
- many `FoodItem`
- many `SavedFoodItem`
- many `WeightLog`
- many `Recommendation`

### UserProfile

| Field | Prisma/PostgreSQL Decision |
| --- | --- |
| `id` | `String`, UUID primary key |
| `userId` | `String`, UUID foreign key, unique |
| `name` | nullable `String` |
| `age` | nullable `Int` |
| `birthDate` | nullable `DateTime`, date column |
| `sex` | nullable `String`; API validation accepts only `male` or `female` |
| `heightInches` | nullable `Int` |
| `timezone` | `String`, default `"America/Toronto"` |
| `startingWeightLb` | nullable `Decimal`, precision `5`, scale `1` |
| `activityLevel` | nullable `ActivityLevel` enum |
| `trainingStyle` | nullable `TrainingStyle` enum |

Relation:
- belongs to `User`; delete cascades from `User`

### UserGoal

| Field | Prisma/PostgreSQL Decision |
| --- | --- |
| `id` | `String`, UUID primary key |
| `userId` | `String`, UUID foreign key, unique |
| `goalType` | `GoalType` enum |
| `goalPace` | nullable `GoalPace` enum |
| `targetWeightLb` | nullable `Decimal`, precision `5`, scale `1` |
| `targetCalories` | nullable `Int` |
| `targetProteinGrams` | nullable `Decimal`, precision `5`, scale `1` |

Relation:
- belongs to `User`; delete cascades from `User`

### TrackingPreference

| Field | Prisma/PostgreSQL Decision |
| --- | --- |
| `id` | `String`, UUID primary key |
| `userId` | `String`, UUID foreign key, unique |
| `mode` | `TrackingMode` enum |
| `waterTrackingEnabled` | `Boolean`, default `false` |
| `dailyWaterGoalMl` | Planned additive integer with server-owned default `2000` for Phase 17.5 hydration; not yet migrated |

Relation:
- belongs to `User`; delete cascades from `User`

### FoodLog

| Field | Prisma/PostgreSQL Decision |
| --- | --- |
| `id` | `String`, UUID primary key |
| `userId` | required `String`, UUID foreign key |
| `foodItemId` | nullable `String`, UUID foreign key |
| `recipeId` | nullable `String`, UUID foreign key |
| `foodName` | `String` |
| `mealType` | `MealType` enum |
| `calories` | `Int` |
| `protein` | `Decimal`, precision `6`, scale `1` |
| `carbs` | nullable `Decimal`, precision `6`, scale `1` |
| `fat` | nullable `Decimal`, precision `6`, scale `1` |
| `fiber` | nullable `Decimal`, precision `6`, scale `1` |
| `sugar` | nullable `Decimal`, precision `6`, scale `1` |
| `sodium` | nullable `Int` |
| `servingQuantity` | nullable `Decimal`, precision `8`, scale `2` |
| `servingUnit` | nullable `String` |
| `servingSnapshot` | nullable `Json`, immutable authoritative serving snapshot |
| `recipeSnapshot` | nullable `Json`, immutable recipe provenance snapshot |
| `notes` | nullable `String` |
| `loggedAt` | `DateTime`, timestamp with timezone |
| `createdAt` | `DateTime`, `@default(now())`, timestamp with timezone |
| `updatedAt` | `DateTime`, `@updatedAt`, timestamp with timezone |

Relation:
- belongs to `User`; delete cascades from `User`
- optionally belongs to `FoodItem`; deleting the `FoodItem` sets
  `FoodLog.foodItemId` to `null`
- optionally belongs to `Recipe`; deleting the `Recipe` sets
  `FoodLog.recipeId` to `null`
- many `FoodLogNutrient`; delete cascades from `FoodLog`

Indexes:
- index on `userId`
- index on `foodItemId`
- index on `recipeId`
- index on `loggedAt`
- compound index on `userId`, `loggedAt`
- compound index on `userId`, `mealType`

There is no unique constraint on `FoodLog`. Users may log multiple foods at the same timestamp.

### FoodItem

| Field | Prisma/PostgreSQL Decision |
| --- | --- |
| `id` | `String`, UUID primary key |
| `userId` | nullable `String`, UUID foreign key |
| `name` | `String` |
| `brandName` | nullable `String` |
| `sourceType` | `FoodItemSourceType` enum |
| `foodType` | `FoodItemType` enum |
| `normalizedName` | `String` |
| `normalizedBrandName` | nullable `String` |
| `searchText` | `String` |
| `servingQuantity` | nullable `Decimal`, precision `8`, scale `2` |
| `servingUnit` | nullable `String` |
| `servingWeightGrams` | nullable `Decimal`, precision `8`, scale `2` |
| `servingOptions` | nullable `Json`, validated trusted alternate serving options |
| `calories` | nullable `Int` |
| `protein` | nullable `Decimal`, precision `6`, scale `1` |
| `carbs` | nullable `Decimal`, precision `6`, scale `1` |
| `fat` | nullable `Decimal`, precision `6`, scale `1` |
| `fiber` | nullable `Decimal`, precision `6`, scale `1` |
| `sugar` | nullable `Decimal`, precision `6`, scale `1` |
| `sodium` | nullable `Int` |
| `additionalNutrients` | nullable `Json` |
| `sourceProvider` | nullable `FoodSourceProvider` enum |
| `sourceId` | nullable `String` |
| `sourceUpdatedAt` | nullable `DateTime`, timestamp with timezone |
| `archivedAt` | nullable `DateTime`, timestamp with timezone |
| `createdAt` | `DateTime`, `@default(now())`, timestamp with timezone |
| `updatedAt` | `DateTime`, `@updatedAt`, timestamp with timezone |

Relations:
- optionally belongs to `User`; delete cascades from `User`
- many `FoodBarcode`
- many `SavedFoodItem`
- many `FoodLog`
- many `FoodItemNutrient`
- many `RecipeIngredient`; deleting a FoodItem sets the optional ingredient
  source reference to `null`

Indexes:
- index on `userId`
- index on `sourceType`
- index on `foodType`
- index on `archivedAt`
- index on `normalizedName`
- index on `normalizedBrandName`

Nullable column nutrients represent unknown values and must not be backfilled
with synthetic zeroes. `additionalNutrients` is reserved for raw or unmapped
unit-bearing compatibility metadata. Phase 9 extended nutrients belong in
`FoodItemNutrient`. The `NutrientKey` enum includes column-backed keys for the
shared catalog and daily totals contract, but API validation rejects those keys
inside normalized food item nutrient input to prevent duplicate storage.

### Recipe

| Field | Prisma/PostgreSQL Decision |
| --- | --- |
| `id` | `String`, UUID primary key |
| `userId` | required `String`, UUID foreign key |
| `name` | `String` |
| `description` | nullable `String` |
| `portionCount` | `Int` |
| `finalCookedWeightGrams` | nullable `Decimal`, precision `8`, scale `2` |
| `archivedAt` | nullable `DateTime`, timestamp with timezone |
| `createdAt` | `DateTime`, `@default(now())`, timestamp with timezone |
| `updatedAt` | `DateTime`, `@updatedAt`, timestamp with timezone |

Relations and indexes:
- belongs to `User`; delete cascades from User
- has many `RecipeIngredient`; delete cascades to ingredients
- has many `FoodLog`; deleting a Recipe sets `FoodLog.recipeId` to `null`
- indexes on `userId`, `archivedAt`, and `[userId, archivedAt]`

### RecipeIngredient

| Field | Prisma/PostgreSQL Decision |
| --- | --- |
| `id` | `String`, UUID primary key |
| `recipeId` | required `String`, UUID foreign key |
| `foodItemId` | nullable `String`, UUID foreign key |
| `position` | `Int` |
| `ingredientSnapshot` | required `Json`, versioned frozen provenance |
| `createdAt` | `DateTime`, `@default(now())`, timestamp with timezone |
| `updatedAt` | `DateTime`, `@updatedAt`, timestamp with timezone |

Relations and constraints:
- belongs to `Recipe`; delete cascades from Recipe
- optionally belongs to `FoodItem`; delete sets `foodItemId` to `null`
- unique compound constraint on `[recipeId, position]`
- indexes on `recipeId` and `foodItemId`

### FoodItemNutrient

| Field | Prisma/PostgreSQL Decision |
| --- | --- |
| `id` | `String`, UUID primary key |
| `foodItemId` | required `String`, UUID foreign key |
| `nutrientKey` | `NutrientKey` enum |
| `amount` | `Decimal`, precision `12`, scale `4` |
| `unit` | `NutrientUnit` enum |
| `createdAt` | `DateTime`, `@default(now())`, timestamp with timezone |
| `updatedAt` | `DateTime`, `@updatedAt`, timestamp with timezone |

Relation:
- belongs to `FoodItem`; delete cascades from `FoodItem`

Indexes and constraints:
- unique compound constraint on `foodItemId`, `nutrientKey`
- index on `foodItemId`
- index on `nutrientKey`

### FoodLogNutrient

| Field | Prisma/PostgreSQL Decision |
| --- | --- |
| `id` | `String`, UUID primary key |
| `foodLogId` | required `String`, UUID foreign key |
| `nutrientKey` | `NutrientKey` enum |
| `amount` | `Decimal`, precision `12`, scale `4` |
| `unit` | `NutrientUnit` enum |
| `createdAt` | `DateTime`, `@default(now())`, timestamp with timezone |
| `updatedAt` | `DateTime`, `@updatedAt`, timestamp with timezone |

Relation:
- belongs to `FoodLog`; delete cascades from `FoodLog`

Indexes and constraints:
- unique compound constraint on `foodLogId`, `nutrientKey`
- index on `foodLogId`
- index on `nutrientKey`

Food-log nutrient rows are historical snapshots. Changing or archiving a
related `FoodItem` must not mutate old `FoodLogNutrient` values. The
`NutrientKey` enum includes column-backed keys for shared catalog and totals
contracts, but API validation rejects those keys inside normalized food-log
nutrient input to prevent duplicate storage.

### FoodBarcode

| Field | Prisma/PostgreSQL Decision |
| --- | --- |
| `id` | `String`, UUID primary key |
| `foodItemId` | required `String`, UUID foreign key |
| `barcode` | `String` |
| `barcodeFormat` | nullable `String` |
| `regionCode` | `String`, default `"GLOBAL"` |
| `createdAt` | `DateTime`, `@default(now())`, timestamp with timezone |
| `updatedAt` | `DateTime`, `@updatedAt`, timestamp with timezone |

Relation:
- belongs to `FoodItem`; delete cascades from `FoodItem`

Indexes and constraints:
- unique compound constraint on `barcode`, `regionCode`
- index on `barcode`
- index on `foodItemId`

### SavedFoodItem

| Field | Prisma/PostgreSQL Decision |
| --- | --- |
| `id` | `String`, UUID primary key |
| `userId` | required `String`, UUID foreign key |
| `foodItemId` | required `String`, UUID foreign key |
| `createdAt` | `DateTime`, `@default(now())`, timestamp with timezone |

Relations:
- belongs to `User`; delete cascades from `User`
- belongs to `FoodItem`; delete cascades from `FoodItem`

Indexes and constraints:
- unique compound constraint on `userId`, `foodItemId`
- index on `userId`
- index on `foodItemId`

### WeightLog

| Field | Prisma/PostgreSQL Decision |
| --- | --- |
| `id` | `String`, UUID primary key |
| `userId` | required `String`, UUID foreign key |
| `weightLb` | `Decimal`, precision `5`, scale `1` |
| `loggedAt` | `DateTime`, timestamp with timezone |
| `createdAt` | `DateTime`, `@default(now())`, timestamp with timezone |
| `updatedAt` | `DateTime`, `@updatedAt`, timestamp with timezone |

Relation:
- belongs to `User`; delete cascades from `User`

Indexes:
- index on `userId`
- index on `loggedAt`
- compound index on `userId`, `loggedAt`

There is no unique constraint on `WeightLog`. Users may log multiple weights at the same timestamp.

### Recommendation

| Field | Prisma/PostgreSQL Decision |
| --- | --- |
| `id` | `String`, UUID primary key |
| `userId` | required `String`, UUID foreign key |
| `type` | `String` |
| `severity` | `RecommendationSeverity` enum |
| `title` | `String` |
| `message` | `String` |
| `sourceFacts` | `Json` |
| `status` | `RecommendationStatus` enum |
| `createdAt` | `DateTime`, `@default(now())`, timestamp with timezone |
| `updatedAt` | `DateTime`, `@updatedAt`, timestamp with timezone |

Relation:
- belongs to `User`; delete cascades from `User`

Indexes:
- index on `userId`
- compound index on `userId`, `status`
- compound index on `userId`, `createdAt`

## Constraints And Ownership

- `UserProfile.userId` is unique.
- `UserGoal.userId` is unique.
- `TrackingPreference.userId` is unique.
- `FoodLog.userId` is required.
- `FoodLog.foodItemId` is nullable and uses `ON DELETE SET NULL`.
- `FoodItem.userId` is nullable for globally visible app/cached food records.
- Current-user custom foods use `FoodItem.userId` with `sourceType`
  `user_custom`.
- `FoodBarcode.foodItemId` is required.
- `SavedFoodItem.userId` and `SavedFoodItem.foodItemId` are required.
- `FoodItemNutrient.foodItemId`, `nutrientKey`, `amount`, and `unit` are
  required.
- `FoodLogNutrient.foodLogId`, `nutrientKey`, `amount`, and `unit` are
  required.
- `WeightLog.userId` is required.
- `Recommendation.userId` is required.
- Do not add a unique constraint to `FoodLog`.
- Do not add a unique constraint to `WeightLog`.
- `FoodBarcode` is unique by `[barcode, regionCode]`.
- `SavedFoodItem` is unique by `[userId, foodItemId]`.
- `FoodItemNutrient` is unique by `[foodItemId, nutrientKey]`.
- `FoodLogNutrient` is unique by `[foodLogId, nutrientKey]`.
- All user-owned relations use database-level cascade delete.
- Deleting a `User` deletes its `UserProfile`, `UserGoal`,
  `TrackingPreference`, `FoodLog`, `FoodItem`, `SavedFoodItem`, `WeightLog`,
  and `Recommendation` records.
- Deleting a `FoodItem` deletes its `FoodBarcode` and `SavedFoodItem` records
  and its `FoodItemNutrient` records, and sets related `FoodLog.foodItemId`
  values to `null`.
- Deleting a `FoodLog` deletes its `FoodLogNutrient` snapshot rows.
- No orphaned user-owned records are allowed.

## Daily Summary

## Phase 12.8 Serving Fields

- `FoodItem.servingOptions` is nullable PostgreSQL JSONB for validated
  alternate trusted serving options.
- `FoodLog.servingSnapshot` is nullable PostgreSQL JSONB for immutable
  authoritative serving-resolution snapshots. It stores original unscaled
  basis nutrition and provenance, never final scaled totals as a duplicate.
- The additive migration contains no backfill. Database NULL means absent;
  application reads use safe parsing and ignore malformed legacy JSON.
- Snapshot-backed updates recalculate from the stored basis and replace final
  FoodLog and FoodLogNutrient values atomically. Legacy NULL snapshots retain
  their prior manual update behavior.

## Phase 12.9B Additive Fields

`FoodLog.mixedMealSnapshot` and `FoodItem.description` are nullable additive
JSON/text fields. Mixed-meal history does not require a mixed-meal table.
FoodItem archive behavior remains non-destructive, and nullable FoodLog/Recipe
relations cannot invalidate frozen recipe or mixed-meal snapshots.

- `DailySummary` is not part of the MVP schema.
- Dashboard summaries are calculated on demand from `FoodLog` and `WeightLog`.
- `DailySummary` may be introduced later only as a cached analytics optimization.

## Future Models

The following models remain future-only unless the approved Phase 17.5 or later
implementation explicitly authorizes their migration:

- `RawFoodLog`
- `ParsedFoodLog`
- `SavedMeal`
- `WaterLog` — Phase 17.5 planned separate amount/time water record; never a
  FoodLog substitute
- `SupplementLog`
- `MicronutrientLog`
- `AnalyticsSavedView` — Phase 17.5 planned user-owned Complex configuration
  with relative period, metric selection, ordering, and nullable pinned state
- `AnalyticsPreference` — Phase 17.5 planned one-per-user preference for the
  Simple preferred metric and nullable `pinnedSavedViewId`
- `DailySummary`
# Phase 13 additive migration

The food-library migration adds FoodItemServingPreference with cascading user
and FoodItem deletion and a nullable unique FoodItem-derived FoodLog relation
using `ON DELETE SET NULL`. It does not change SavedFoodItem or add recents.
