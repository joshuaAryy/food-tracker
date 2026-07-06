# MVP API Contracts

This document locks the REST API conventions and MVP request/response contracts
used by the implemented mobile app and API. It remains the canonical API
contract as later phases extend the product.

Persisted model types, relations, indexes, and constraints are locked in [prisma-schema-decisions.md](prisma-schema-decisions.md).

## API Conventions

- Use REST-style endpoints.
- Use `/api/v1` as the base path.
- Use JSON request and response bodies.
- Use ISO 8601 UTC timestamps for timestamp fields.
- Use local calendar dates in `YYYY-MM-DD` format for date filters.
- Authenticated endpoints operate only on the current user's records.
- Do not include `userId` in client request bodies or query parameters.
- Optional request fields may be omitted or sent as `null`.
- Optional or unavailable response values are `null` unless the contract describes an array.

All responses must use exactly one of these envelopes.

### Success Envelope

```json
{
  "success": true,
  "data": {}
}
```

### Error Envelope

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Human-readable error message",
    "details": {}
  }
}
```

Do not introduce other response envelope formats. Error codes are stable uppercase strings. Validation failures use `VALIDATION_ERROR`; missing user-owned resources use `NOT_FOUND`.

## Authentication Boundary

The current development implementation uses mocked auth only. This boundary was
introduced during the foundation phase and remains in place until Supabase Auth
is implemented.

- The backend may assume a fixed mock user ID through mock user context.
- Authenticated endpoints operate on the current user.
- The client never sends `userId`.
- The backend applies the current user ID when reading or writing user-owned records.
- Real authentication will later replace mock context with Supabase Auth identity.
- Do not replace this boundary with custom password authentication.
- Do not implement custom password authentication or a custom auth system.

## Shared Validation Rules

- `calories` must be an integer kcal greater than or equal to `0`.
- `protein`, `carbs`, `fat`, `fiber`, and `sugar` must be decimal grams greater than or equal to `0`.
- `sodium` must be an integer mg greater than or equal to `0`.
- `weightLb` must be decimal pounds greater than `0`.
- `heightInches` must be an integer greater than `0`.
- `birthDate` must be a local date in `YYYY-MM-DD` format.
- `sex` must be `male` or `female`; it is a controlled target-calculation input, not free text.
- `timezone` must be a valid IANA timezone string.
- `activityLevel` must be `sedentary`, `lightly_active`, `moderately_active`, `very_active`, or `athlete`.
- `trainingStyle` must be `none`, `cardio`, `weight_training`, `mixed`, or `athlete`.
- `goalPace` must match `goalType`: `lose` uses `slow`, `moderate`, or `aggressive`; `gain` uses `lean_bulk`, `moderate_bulk`, or `aggressive_bulk`; `maintain` uses `null`.
- `mealType` must be `breakfast`, `lunch`, `dinner`, `snack`, or `other`.
- `loggedAt` must be a valid ISO 8601 timestamp.
- `foodName` must be a non-empty string.
- `servingQuantity`, when supplied, must be a decimal number greater than `0`.
- `servingUnit`, when supplied, must be a non-empty string.
- Food item `name` must be non-empty.
- Food item `foodType` must be `generic` or `branded`.
- Food item nutrient values are optional and nullable; missing values remain
  unknown/null and are not converted to zero.
- Food item `additionalNutrients`, when supplied, must use unit-bearing objects
  such as `{ "caffeine": { "amount": 95, "unit": "mg" } }`.
- Phase 9 normalized `nutrients` maps accept only extended nutrient keys from
  the shared catalog, non-negative amounts, and the catalog default unit.
  Column-backed nutrients (`calories`, `protein`, `carbs`, `fat`, `fiber`,
  `sugar`, and `sodium`) must stay in their dedicated fields and are rejected
  inside normalized `nutrients`.
- `date`, `startDate`, and `endDate` filters must be local dates in `YYYY-MM-DD` format.
- Date filters are interpreted in the current user's timezone.
- When both are supplied, `startDate` must not be after `endDate`.
- Unknown request fields must be rejected.
- Inputs are normalized and rounded before storage according to [data-model-decisions.md](data-model-decisions.md).

## Setup

### `GET /api/v1/setup/status`

Returns whether each required first-run resource exists for the current user.
Missing resources are reported as incomplete rather than treated as saved
defaults.

Success `data`:

```json
{
  "profileComplete": true,
  "goalsComplete": true,
  "preferencesComplete": true,
  "isComplete": true
}
```

### `PUT /api/v1/setup`

Validates onboarding inputs, deterministically calculates calorie/protein
targets, and saves profile, goals, and tracking preferences in one database
transaction. If any section is invalid, none of the sections are written.

Request:

```json
{
  "profile": {
    "name": "Taylor",
    "birthDate": "1994-06-15",
    "sex": "female",
    "heightInches": 68,
    "timezone": "America/Toronto",
    "startingWeightLb": 170,
    "activityLevel": "moderately_active",
    "trainingStyle": "weight_training"
  },
  "goals": {
    "goalType": "lose",
    "goalPace": "moderate",
    "targetWeightLb": 160
  },
  "preferences": {
    "mode": "simple",
    "waterTrackingEnabled": false
  }
}
```

Success `data` returns normalized `profile`, calculated `goals`,
`preferences`, `calculatedTargets`, and a complete setup-status object.
Targets are deterministic backend facts derived from birth date, sex, height,
current weight, activity level, training style, goal type, and goal pace.
Clients that edit only the visible tracking mode must preserve existing
unrelated preference values, including `waterTrackingEnabled`.

### `POST /api/v1/setup/preview`

Validates the same onboarding request shape as `PUT /api/v1/setup` and returns
derived age plus calculated targets without writing any data. Mobile uses this
for the final onboarding Review step.

Request uses the same body as `PUT /api/v1/setup`.

Success `data`:

```json
{
  "age": 30,
  "calculatedTargets": {
    "targetCalories": 2200,
    "targetProteinGrams": 150.0
  }
}
```

## Profile

### `GET /api/v1/profile`

Returns the current user's profile.
Missing or legacy-incomplete profile rows return `NOT_FOUND`; clients must not
treat serialized zero values as completed setup.

Success `data`:

```json
{
  "name": "Taylor",
  "age": 30,
  "birthDate": "1994-06-15",
  "sex": "male",
  "heightInches": 70,
  "timezone": "America/Toronto",
  "startingWeightLb": 185.5,
  "activityLevel": "moderately_active",
  "trainingStyle": "mixed"
}
```

### `PUT /api/v1/profile`

Creates or replaces the current user's editable profile. All fields are required.

Request:

```json
{
  "name": "Taylor",
  "age": 30,
  "birthDate": "1994-06-15",
  "sex": "male",
  "heightInches": 70,
  "timezone": "America/Toronto",
  "startingWeightLb": 185.5,
  "activityLevel": "moderately_active",
  "trainingStyle": "mixed"
}
```

Success `data` uses the profile shape above.

## Goals

### `GET /api/v1/goals`

Returns the current user's goals.
Missing or legacy-incomplete goal rows return `NOT_FOUND`.

Success `data`:

```json
{
  "goalType": "lose",
  "goalPace": "moderate",
  "targetWeightLb": 170.0,
  "targetCalories": 2200,
  "targetProteinGrams": 150.0
}
```

### `PUT /api/v1/goals`

Creates or replaces the current user's goals. All fields are required.

Request:

```json
{
  "goalType": "lose",
  "goalPace": "moderate",
  "targetWeightLb": 170.0,
  "targetCalories": 2200,
  "targetProteinGrams": 150.0
}
```

`goalType` must be `lose`, `maintain`, or `gain`; `goalPace` must match the
goal type as described in Shared Validation Rules. Success `data` uses the
goals shape above. Profile editing can preserve or manually override
calculated targets after onboarding.

## Tracking Preferences

### `GET /api/v1/tracking-preferences`

Returns the current user's tracking preferences.

Success `data`:

```json
{
  "mode": "simple",
  "waterTrackingEnabled": false
}
```

### `PUT /api/v1/tracking-preferences`

Creates or replaces the current user's tracking preferences. All fields are required.

Request:

```json
{
  "mode": "simple",
  "waterTrackingEnabled": false
}
```

`mode` must be `simple` or `complex`. Success `data` uses the tracking-preferences shape above.

## Food Items

Phase 8 adds local app-owned food database foundation endpoints. These
endpoints support searchable reusable foods, current-user custom foods, saved
foods, and local barcode lookup groundwork. Phase 11 adds barcode-powered
packaged-food lookup that checks local cached barcodes first, then Open Food
Facts, and caches usable external packaged foods as normal `FoodItem` records.
Barcode lookup is backend-owned; clients send scanned barcode values to the
API and do not call external food-data providers directly. Scanned foods reuse
the existing selected-food review and log-from-food snapshot flow instead of
creating a separate logging model.
The API does not use USDA, AI/RAG, photo logging, saved meals, or full Complex
mode micronutrient editing in this phase.

Visible food items are non-archived rows where `userId` is the current user or
`userId` is `null`. Another user's custom food must never appear in list,
search, get, save, or barcode lookup responses.

Food item response object:

```json
{
  "id": "food-item-id",
  "name": "Greek yogurt",
  "brandName": "Plain Dairy",
  "sourceType": "user_custom",
  "foodType": "branded",
  "sourceProvider": "manual",
  "sourceId": null,
  "sourceUpdatedAt": null,
  "isSaved": false,
  "servingQuantity": 1.0,
  "servingUnit": "cup",
  "servingWeightGrams": 245.0,
  "calories": 130,
  "protein": 22.4,
  "carbs": null,
  "fat": null,
  "fiber": null,
  "sugar": null,
  "sodium": null,
  "additionalNutrients": {
    "caffeine": { "amount": 0, "unit": "mg" }
  },
  "nutrients": {
    "caffeine": { "amount": 95, "unit": "mg" },
    "vitaminC": { "amount": 60, "unit": "mg" }
  },
  "barcodes": [],
  "createdAt": "2026-07-04T15:00:00.000Z",
  "updatedAt": "2026-07-04T15:00:00.000Z"
}
```

### `GET /api/v1/food-items`

Optional query parameters:
- `query`: non-empty search text
- `limit`: integer from `1` through `50`, default `25`
- `savedOnly`: `true` or `false`, default `false`

MVP search uses normalized name/brand text only. It does not use external APIs,
full-text search, trigram search, or new dependencies.

Success `data`:

```json
{
  "foodItems": []
}
```

### `GET /api/v1/food-items/barcode/:barcode`

Looks up local `FoodBarcode` records only. The barcode route is registered
before `GET /api/v1/food-items/:id`.

Optional query parameters:
- `regionCode`: region code such as `US` or `CA`

Lookup uses an exact `regionCode` match first, then `GLOBAL` fallback. Missing
or inaccessible barcode matches return `NOT_FOUND`. Phase 8 does not create
barcode records through the public API; barcode creation is reserved for future
barcode/custom-food flows.

Success `data` is the food item response object.

### `POST /api/v1/food-items/barcode/lookup`

Looks up a packaged-food barcode for the scanner flow. This route is
registered before id-based food item routes.

Request:

```json
{
  "barcode": "3017624010701",
  "barcodeCandidates": ["03017624010701"],
  "regionCode": "CA"
}
```

Required fields:
- `barcode`

Optional fields:
- `barcodeCandidates`: up to 6 non-empty alternate scanned/normalized barcode
  values
- `regionCode`, normalized to uppercase; omitted lookups use `GLOBAL`

The backend normalizes retail barcode candidates by trimming input, keeping
digits, and deriving safe UPC-A/EAN-13 equivalents. A 12-digit UPC-A such as
`069000013762` is also tried as `0069000013762`; a 13-digit EAN-13 value with
a leading zero is also tried as its 12-digit UPC-A equivalent. This handles
iOS/AVFoundation cases where UPC-A barcodes are reported as EAN-13 with a
leading zero. Supported retail candidates are bounded to common UPC-E, EAN-8,
UPC-A, and EAN-13 lengths.

Lookup order:

```text
local FoodBarcode exact region, across normalized candidates
↓
local FoodBarcode GLOBAL fallback, across normalized candidates
↓
Open Food Facts barcode lookup across bounded candidates
↓
cache usable product as FoodItem/FoodBarcode aliases
```

Open Food Facts results are normalized conservatively into the app-owned food
model. Missing nutrient values remain `null` or absent, never zero. The API
stores column-backed nutrients in their dedicated fields and only stores
selected extended nutrients when the unit matches the Phase 9 catalog or a
small explicit conversion is supported. If calories or protein are missing,
the cached `FoodItem` can still be returned, but
`POST /api/v1/food-logs/from-food-item` continues to reject logging until both
required values exist.

Success `data` is the normal food item response object. Missing local and
external matches, products without a usable name, and unusable external
responses return `NOT_FOUND` with the standard error envelope.

### `GET /api/v1/food-items/:id`

Returns one visible non-archived food item. A missing food item, an archived
food item, or another user's custom food returns `NOT_FOUND`.

Success `data` is the food item response object.

### `POST /api/v1/food-items`

Creates a current-user custom food item. The backend derives `userId` from
mock or real auth context and forces `sourceType` to `user_custom` with
`sourceProvider` set to `manual`.

Request:

```json
{
  "name": "Greek yogurt",
  "brandName": "Plain Dairy",
  "foodType": "branded",
  "servingQuantity": 1.0,
  "servingUnit": "cup",
  "servingWeightGrams": 245.0,
  "calories": 130,
  "protein": 22.4,
  "carbs": null,
  "fat": null,
  "fiber": null,
  "sugar": null,
  "sodium": null,
  "additionalNutrients": {
    "caffeine": { "amount": 0, "unit": "mg" }
  },
  "nutrients": {
    "caffeine": { "amount": 95, "unit": "mg" },
    "vitaminC": { "amount": 60, "unit": "mg" }
  }
}
```

Unknown fields, including `userId`, are rejected. Nutrient fields may be
omitted or sent as `null`; omitted and null values are stored as unknown/null.
If `nutrients` is omitted on update, existing normalized nutrients are
preserved. If `nutrients` is `null` or `{}`, normalized nutrients are cleared.
Success `data` is the created food item response object.

### `PUT /api/v1/food-items/:id`

Updates a current-user custom food item using the same request shape as
`POST /api/v1/food-items`. Global, cached, archived, or another user's food
items return `NOT_FOUND`.

Success `data` is the updated food item response object.

### `DELETE /api/v1/food-items/:id`

Archives a current-user custom food item by setting `archivedAt`. It does not
hard-delete the row. Global, cached, archived, or another user's food items
return `NOT_FOUND`.

Success `data`:

```json
{
  "id": "food-item-id",
  "archived": true
}
```

### `POST /api/v1/food-items/:id/save`

Saves a visible food item for the current user. The operation is idempotent.

Success `data`:

```json
{
  "id": "food-item-id",
  "saved": true
}
```

### `DELETE /api/v1/food-items/:id/save`

Unsaves a visible food item for the current user. The operation is idempotent.

Success `data`:

```json
{
  "id": "food-item-id",
  "saved": false
}
```

## Food Logs

The food-log API supports manual structured nutrition entry and Phase 10
log-from-food flows. `FoodLog.foodItemId` may reference a reusable visible
`FoodItem`, but logs remain snapshot-based and continue to store the nutrition
values saved at log time, including Phase 9 extended nutrient snapshots.

Food-log response object:

```json
{
  "id": "food-log-id",
  "foodItemId": "food-item-id",
  "foodName": "Chicken breast",
  "mealType": "dinner",
  "calories": 280,
  "protein": 52.0,
  "carbs": 0.0,
  "fat": 6.0,
  "fiber": null,
  "sugar": null,
  "sodium": 120,
  "notes": null,
  "servingQuantity": 1.0,
  "servingUnit": "breast",
  "nutrients": {
    "caffeine": { "amount": 95, "unit": "mg" }
  },
  "loggedAt": "2026-06-14T22:30:00.000Z",
  "createdAt": "2026-06-14T22:31:00.000Z",
  "updatedAt": "2026-06-14T22:31:00.000Z"
}
```

### `GET /api/v1/food-logs`

Optional query parameters:

- `date`: one local date in `YYYY-MM-DD`
- `startDate`: inclusive local start date in `YYYY-MM-DD`
- `endDate`: inclusive local end date in `YYYY-MM-DD`
- `mealType`: one valid meal type
- `limit`: integer from `1` through `50`

`date` cannot be combined with `startDate` or `endDate`.

Success `data`:

```json
{
  "foodLogs": []
}
```

### `GET /api/v1/food-logs/:id`

Returns one current-user food log. A missing record or a record owned by
another user returns `NOT_FOUND`.

Success `data` is the food-log response object.

### `POST /api/v1/food-logs`

Request:

```json
{
  "foodItemId": "food-item-id",
  "foodName": "Chicken breast",
  "mealType": "dinner",
  "calories": 280,
  "protein": 52.0,
  "loggedAt": "2026-06-14T22:30:00.000Z",
  "carbs": 0.0,
  "fat": 6.0,
  "fiber": null,
  "sugar": null,
  "sodium": 120,
  "notes": null,
  "servingQuantity": 1.0,
  "servingUnit": "breast",
  "nutrients": {
    "caffeine": { "amount": 95, "unit": "mg" }
  }
}
```

Required fields:
- `foodName`
- `mealType`
- `calories`
- `protein`
- `loggedAt`

If `nutrients` is omitted on update, existing food-log nutrient snapshots are
preserved. If `nutrients` is `null` or `{}`, existing food-log nutrient
snapshots are cleared.

Optional fields:
- `foodItemId`
- `carbs`
- `fat`
- `fiber`
- `sugar`
- `sodium`
- `notes`
- `servingQuantity`
- `servingUnit`

The backend derives `userId` from mock or real auth context. If `foodItemId` is
provided, the referenced food item must be visible, non-archived, and
accessible to the current user. Unknown fields including `userId` are rejected.
Success `data` is the created food-log response object.

### `POST /api/v1/food-logs/from-food-item`

Creates a food log from one visible reusable food item. This endpoint is the
Phase 10 fast logging path. It does not perform barcode scanning, external food
data lookup, AI/RAG matching, photo recognition, saved meals, or unit
conversion.

Request:

```json
{
  "foodItemId": "food-item-id",
  "mealType": "breakfast",
  "loggedAt": "2026-06-14T12:30:00.000Z",
  "servingMultiplier": 1.5,
  "notes": "With berries"
}
```

Required fields:
- `foodItemId`
- `mealType`
- `loggedAt`

Optional fields:
- `servingMultiplier` positive number, defaults to `1`
- `notes`

The backend verifies that the food item is visible and non-archived for the
current user. The food item must have calories and protein because those are
required food-log fields.

The backend creates a historical snapshot:
- `foodName` from `FoodItem.name`
- `foodItemId` linked to the selected food item
- column-backed nutrients scaled by `servingMultiplier`
- normalized `FoodItemNutrient` rows copied into `FoodLogNutrient` snapshot
  rows and scaled by `servingMultiplier`
- missing nutrients remain `null` or absent, never zero

Scaling uses no serving-unit conversion. Calories and sodium are rounded to
whole numbers. Protein, carbs, fat, fiber, and sugar are rounded to one
decimal. Serving quantity is rounded to two decimals. Normalized nutrients are
rounded to four decimals. Units are preserved.

Success `data` is the created food-log response object.

### `PUT /api/v1/food-logs/:id`

Replaces the editable fields of a current-user food log. The request uses the same required and optional editable fields as `POST /api/v1/food-logs`. The client cannot edit `id`, `userId`, `createdAt`, or `updatedAt`.

If `foodItemId` is omitted on update, the existing relation is preserved. If
`foodItemId` is explicitly `null`, the relation is cleared. If a new
`foodItemId` is provided, the referenced food item must be visible,
non-archived, and accessible to the current user.

Success `data` is the updated food-log response object.

### `DELETE /api/v1/food-logs/:id`

Deletes a current-user food log. Deleted logs are excluded from all future analytics.

Success `data`:

```json
{
  "id": "food-log-id",
  "deleted": true
}
```

## Weight Logs

Weight-log response object:

```json
{
  "id": "weight-log-id",
  "weightLb": 181.4,
  "loggedAt": "2026-06-14T12:00:00.000Z",
  "createdAt": "2026-06-14T12:01:00.000Z",
  "updatedAt": "2026-06-14T12:01:00.000Z"
}
```

### `GET /api/v1/weight-logs`

Optional query parameters:
- `startDate`: inclusive local start date in `YYYY-MM-DD`
- `endDate`: inclusive local end date in `YYYY-MM-DD`

Success `data`:

```json
{
  "weightLogs": []
}
```

### `GET /api/v1/weight-logs/:id`

Returns one current-user weight log. A missing record or a record owned by
another user returns `NOT_FOUND`.

Success `data` is the weight-log response object.

### `POST /api/v1/weight-logs`

Request:

```json
{
  "weightLb": 181.4,
  "loggedAt": "2026-06-14T12:00:00.000Z"
}
```

Both fields are required. Success `data` is the created weight-log response object.

### `PUT /api/v1/weight-logs/:id`

Replaces the editable fields of a current-user weight log. The request requires `weightLb` and `loggedAt`.

Success `data` is the updated weight-log response object.

### `DELETE /api/v1/weight-logs/:id`

Deletes a current-user weight log. Deleted logs are excluded from all future analytics.

Success `data`:

```json
{
  "id": "weight-log-id",
  "deleted": true
}
```

## Dashboard And Analytics

### `GET /api/v1/dashboard/summary`

Optional query parameters:
- `date`: local date in `YYYY-MM-DD`; defaults to the current local date in the user's timezone

Analytics calculates this response deterministically from stored normalized logs and goals.

Success `data`:

```json
{
  "date": "2026-06-14",
  "foodLogCount": 3,
  "caloriesConsumed": 1750,
  "calorieTarget": 2200,
  "caloriesRemaining": 450,
  "proteinConsumed": 115.5,
  "proteinTarget": 150.0,
  "proteinRemaining": 34.5,
  "latestWeightLb": 181.4,
  "trackingMode": "simple"
}
```

`foodLogCount` is the number of current-user food entries on the selected local
date. `latestWeightLb` is `null` when no weight log exists. Targets and
remaining values are `null` when the corresponding goal does not exist.
Remaining values may be negative when consumption exceeds a target.

### `GET /api/v1/analytics/advanced`

Optional query parameters:
- `date`: inclusive local end date in `YYYY-MM-DD`; defaults to the current local date
- `timezone`: valid IANA timezone; defaults to the profile timezone
- `rangeDays`: integer from `1` through `365`; defaults to `30`

The response contains:
- 7-day and 30-day calorie and protein calendar-day averages, including zero-log days
- per-logged-day averages and interpretation metadata for both trend windows
- nutrient totals and per-logged-day averages for the selected range
- protein/carbohydrate/fat calorie percentages using `4/4/9` calorie math
- distinct logged-day counts for the trailing 7 and 30 local days
- selected-range food-log counts and logging completeness
- per-nutrient completeness counts, percentages, and deterministic warnings
- latest and previous weights in the selected range
- deterministic least-squares weekly weight slope when sufficient data exists

The endpoint is available in both simple and complex tracking modes. Existing
trend fields remain calendar-day averages for compatibility. Their
`averageType` is `calendarDayAverage`, and each trend includes:

- `loggedDayAverage`
- `loggedDays`
- `totalDays`
- `completenessPercent`
- `isLowConfidence`
- a nullable deterministic `warning`

`dataCompleteness.nutrients` reports `loggedCount`, `possibleCount`, `percent`,
and `isCompleteEnough` for calories, protein, carbs, fat, fiber, sugar, and
sodium. Nutrient completeness is considered sufficient at `80%` of food
entries. Missing optional values are not inferred. Numeric totals remain
backward-compatible sums of reported values, while completeness metadata tells
clients when `0` means no value was reported rather than measured zero.

Trend confidence requires food logs on at least half of the calendar days in a
window. Weight change and slope values are `null` when insufficient data
exists.

### `GET /api/v1/analytics/nutrients/daily`

Returns daily nutrient totals for the selected local date. The response
combines column-backed totals with normalized extended nutrient rows and only
includes nutrients the backend actually has for that day.

Optional query parameters:
- `date`: local date in `YYYY-MM-DD`; defaults to today in the current user's
  timezone

Success `data`:

```json
{
  "date": "2026-06-15",
  "nutrients": {
    "calories": { "amount": 205, "unit": "kcal" },
    "protein": { "amount": 20, "unit": "g" },
    "caffeine": { "amount": 140, "unit": "mg" },
    "vitaminC": { "amount": 60, "unit": "mg" }
  }
}
```

Missing nutrients are absent from the response. They are not returned as zero.
Column-backed nutrients are summed from their dedicated `FoodLog` columns, and
extended nutrients are summed from normalized nutrient snapshot rows; clients
must not double-count a nutrient across both shapes.
The endpoint does not implement custom graph UI, recommendations, external food
data integrations, AI/RAG logging, barcode scanning, or photo logging.

## Recommendations

Recommendation response object:

```json
{
  "id": "recommendation-id",
  "type": "protein_low",
  "severity": "medium",
  "title": "Protein is below target",
  "message": "You are averaging 35g below your protein target this week.",
  "sourceFacts": {
    "proteinTarget": 150.0,
    "averageProtein": 115.0,
    "difference": 35.0
  },
  "status": "active",
  "createdAt": "2026-06-14T12:00:00.000Z"
}
```

### `GET /api/v1/recommendations`

Optional query parameters:
- `status`: `active`, `dismissed`, or `archived`

Success `data`:

```json
{
  "recommendations": []
}
```

### `POST /api/v1/recommendations/generate`

Generates recommendation objects from deterministic analytics facts for the current user. AI is not required and does not calculate facts or decide recommendations.

The request has no body.

Calorie and protein intake recommendations require food logs on at least `4`
of the trailing `7` local days. Below that threshold, the engine suppresses
`protein_low`, `calories_under_target`, and `calories_over_target`, and prefers
`inconsistent_food_logging`. Recommendation lifecycle behavior remains
unchanged.

Success `data`:

```json
{
  "recommendations": []
}
```

### `PATCH /api/v1/recommendations/:id/dismiss`

Marks a current-user recommendation as dismissed. The request has no body.

Success `data` is the updated recommendation response object with `status` set to `dismissed`.
