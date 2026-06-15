# Prisma Schema Decisions

This file records the locked Prisma/PostgreSQL schema decisions for the MVP. It is the canonical database-specific planning document for Phase 1 scaffolding. Do not add other models to the Phase 1 schema without explicit approval.

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

Phase 1:
- Authentication is mocked.
- `User.id` may be generated with `uuid()` for the fixed mock user.
- Do not implement Supabase Auth.

Long-term:
- `User.id` should align with the Supabase Auth user ID.
- Do not build custom password authentication.
- Do not store password credentials in the application database.

## MVP Models

The Phase 1 Prisma schema includes only:

- `User`
- `UserProfile`
- `UserGoal`
- `TrackingPreference`
- `FoodLog`
- `WeightLog`
- `Recommendation`

`FoodLog` is the Phase 2 manual logging source of truth. Do not create `RawFoodLog`, `ParsedFoodLog`, or `DailySummary` for the MVP.

## Enums

```text
GoalType:
  lose
  maintain
  gain

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
```

## Model Fields

The declarations below are conceptual Prisma field definitions. The actual Phase 1 Prisma schema must preserve these types, nullability rules, defaults, relations, and database-native types.

### User

| Field | Prisma/PostgreSQL Decision |
| --- | --- |
| `id` | `String`, UUID primary key, `@default(uuid())`, `@db.Uuid` |
| `email` | nullable `String` for the Phase 1 mock user |
| `createdAt` | `DateTime`, `@default(now())`, timestamp with timezone |
| `updatedAt` | `DateTime`, `@updatedAt`, timestamp with timezone |

Relations:
- optional one-to-one `UserProfile`
- optional one-to-one `UserGoal`
- optional one-to-one `TrackingPreference`
- many `FoodLog`
- many `WeightLog`
- many `Recommendation`

### UserProfile

| Field | Prisma/PostgreSQL Decision |
| --- | --- |
| `id` | `String`, UUID primary key |
| `userId` | `String`, UUID foreign key, unique |
| `age` | nullable `Int` |
| `sex` | nullable `String` |
| `heightInches` | nullable `Int` |
| `timezone` | `String`, default `"America/Toronto"` |
| `startingWeightLb` | nullable `Decimal`, precision `5`, scale `1` |

Relation:
- belongs to `User`; delete cascades from `User`

### UserGoal

| Field | Prisma/PostgreSQL Decision |
| --- | --- |
| `id` | `String`, UUID primary key |
| `userId` | `String`, UUID foreign key, unique |
| `goalType` | `GoalType` enum |
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

Indexes:
- index on `userId`
- index on `loggedAt`
- compound index on `userId`, `loggedAt`
- compound index on `userId`, `mealType`

There is no unique constraint on `FoodLog`. Users may log multiple foods at the same timestamp.

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
- `WeightLog.userId` is required.
- `Recommendation.userId` is required.
- Do not add a unique constraint to `FoodLog`.
- Do not add a unique constraint to `WeightLog`.
- All user-owned relations use database-level cascade delete.
- Deleting a `User` deletes its `UserProfile`, `UserGoal`, `TrackingPreference`, `FoodLog`, `WeightLog`, and `Recommendation` records.
- No orphaned user-owned records are allowed.

## Daily Summary

- `DailySummary` is not part of the MVP schema.
- Dashboard summaries are calculated on demand from `FoodLog` and `WeightLog`.
- `DailySummary` may be introduced later only as a cached analytics optimization.

## Future Models

The following models are future-only and must not be included in the Phase 1 schema unless explicitly requested later:

- `RawFoodLog`
- `ParsedFoodLog`
- `CustomFood`
- `SavedMeal`
- `WaterLog`
- `SupplementLog`
- `MicronutrientLog`
- `DailySummary`
