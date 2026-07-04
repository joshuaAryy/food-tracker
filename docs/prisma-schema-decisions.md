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

Foundation decision, still active until real authentication is implemented:
- Authentication is mocked.
- `User.id` may be generated with `uuid()` for the fixed mock user.
- Do not implement Supabase Auth.

Long-term:
- `User.id` should align with the Supabase Auth user ID.
- Do not build custom password authentication.
- Do not store password credentials in the application database.

## MVP Models

The locked MVP Prisma schema includes:

- `User`
- `UserProfile`
- `UserGoal`
- `TrackingPreference`
- `FoodLog`
- `FoodItem`
- `FoodBarcode`
- `SavedFoodItem`
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
| `email` | nullable `String` for the current mock user boundary |
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

Relation:
- belongs to `User`; delete cascades from `User`

### FoodLog

| Field | Prisma/PostgreSQL Decision |
| --- | --- |
| `id` | `String`, UUID primary key |
| `userId` | required `String`, UUID foreign key |
| `foodItemId` | nullable `String`, UUID foreign key |
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
| `notes` | nullable `String` |
| `loggedAt` | `DateTime`, timestamp with timezone |
| `createdAt` | `DateTime`, `@default(now())`, timestamp with timezone |
| `updatedAt` | `DateTime`, `@updatedAt`, timestamp with timezone |

Relation:
- belongs to `User`; delete cascades from `User`
- optionally belongs to `FoodItem`; deleting the `FoodItem` sets
  `FoodLog.foodItemId` to `null`

Indexes:
- index on `userId`
- index on `foodItemId`
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

Indexes:
- index on `userId`
- index on `sourceType`
- index on `foodType`
- index on `archivedAt`
- index on `normalizedName`
- index on `normalizedBrandName`

Nullable nutrients represent unknown values and must not be backfilled with
synthetic zeroes. `additionalNutrients` is reserved for future unit-bearing
nutrient values.

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
- `WeightLog.userId` is required.
- `Recommendation.userId` is required.
- Do not add a unique constraint to `FoodLog`.
- Do not add a unique constraint to `WeightLog`.
- `FoodBarcode` is unique by `[barcode, regionCode]`.
- `SavedFoodItem` is unique by `[userId, foodItemId]`.
- All user-owned relations use database-level cascade delete.
- Deleting a `User` deletes its `UserProfile`, `UserGoal`,
  `TrackingPreference`, `FoodLog`, `FoodItem`, `SavedFoodItem`, `WeightLog`,
  and `Recommendation` records.
- Deleting a `FoodItem` deletes its `FoodBarcode` and `SavedFoodItem` records
  and sets related `FoodLog.foodItemId` values to `null`.
- No orphaned user-owned records are allowed.

## Daily Summary

- `DailySummary` is not part of the MVP schema.
- Dashboard summaries are calculated on demand from `FoodLog` and `WeightLog`.
- `DailySummary` may be introduced later only as a cached analytics optimization.

## Future Models

The following models are future-only and must not be added unless explicitly
approved:

- `RawFoodLog`
- `ParsedFoodLog`
- `SavedMeal`
- `WaterLog`
- `SupplementLog`
- `MicronutrientLog`
- `DailySummary`
