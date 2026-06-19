# MVP API Contracts

This document locks the REST API conventions and MVP request/response contracts used by the mobile app and API. It is the canonical API contract for Phase 1 scaffolding and Phase 2 MVP implementation.

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

Phase 1 uses mocked auth only.

- The backend may assume a fixed mock user ID through mock user context.
- Authenticated endpoints operate on the current user.
- The client never sends `userId`.
- The backend applies the current user ID when reading or writing user-owned records.
- Real authentication will later replace mock context with Supabase Auth identity.
- Do not implement Supabase Auth during Phase 1.
- Do not implement custom password authentication or a custom auth system.

## Shared Validation Rules

- `calories` must be an integer kcal greater than or equal to `0`.
- `protein`, `carbs`, `fat`, `fiber`, and `sugar` must be decimal grams greater than or equal to `0`.
- `sodium` must be an integer mg greater than or equal to `0`.
- `weightLb` must be decimal pounds greater than `0`.
- `heightInches` must be an integer greater than `0`.
- `timezone` must be a valid IANA timezone string.
- `mealType` must be `breakfast`, `lunch`, `dinner`, `snack`, or `other`.
- `loggedAt` must be a valid ISO 8601 timestamp.
- `foodName` must be a non-empty string.
- `servingQuantity`, when supplied, must be a decimal number greater than `0`.
- `servingUnit`, when supplied, must be a non-empty string.
- `date`, `startDate`, and `endDate` filters must be local dates in `YYYY-MM-DD` format.
- Date filters are interpreted in the current user's timezone.
- When both are supplied, `startDate` must not be after `endDate`.
- Unknown request fields must be rejected.
- Inputs are normalized and rounded before storage according to [data-model-decisions.md](data-model-decisions.md).

## Profile

### `GET /api/v1/profile`

Returns the current user's profile.

Success `data`:

```json
{
  "age": 30,
  "sex": "male",
  "heightInches": 70,
  "timezone": "America/Toronto",
  "startingWeightLb": 185.5
}
```

### `PUT /api/v1/profile`

Creates or replaces the current user's editable profile. All fields are required.

Request:

```json
{
  "age": 30,
  "sex": "male",
  "heightInches": 70,
  "timezone": "America/Toronto",
  "startingWeightLb": 185.5
}
```

Success `data` uses the profile shape above.

## Goals

### `GET /api/v1/goals`

Returns the current user's goals.

Success `data`:

```json
{
  "goalType": "lose",
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
  "targetWeightLb": 170.0,
  "targetCalories": 2200,
  "targetProteinGrams": 150.0
}
```

`goalType` must be `lose`, `maintain`, or `gain`. Success `data` uses the goals shape above.

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

## Food Logs

Phase 2 supports manual structured nutrition entry only. There are no MVP AI parser, nutrition matcher, automated food lookup, barcode, or photo endpoints.

Food-log response object:

```json
{
  "id": "food-log-id",
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

`date` cannot be combined with `startDate` or `endDate`.

Success `data`:

```json
{
  "foodLogs": []
}
```

### `POST /api/v1/food-logs`

Request:

```json
{
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
  "servingUnit": "breast"
}
```

Required fields:
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

The backend derives `userId` from mock or real auth context. Success `data` is the created food-log response object.

### `PUT /api/v1/food-logs/:id`

Replaces the editable fields of a current-user food log. The request uses the same required and optional editable fields as `POST /api/v1/food-logs`. The client cannot edit `id`, `userId`, `createdAt`, or `updatedAt`.

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

`latestWeightLb` is `null` when no weight log exists. Targets and remaining values are `null` when the corresponding goal does not exist. Remaining values may be negative when consumption exceeds a target.

### `GET /api/v1/analytics/advanced`

Optional query parameters:
- `date`: inclusive local end date in `YYYY-MM-DD`; defaults to the current local date
- `timezone`: valid IANA timezone; defaults to the profile timezone
- `rangeDays`: integer from `1` through `365`; defaults to `30`

The response contains:
- 7-day and 30-day calorie and protein averages, including zero-log days
- nutrient totals and per-logged-day averages for the selected range
- protein/carbohydrate/fat calorie percentages using `4/4/9` calorie math
- distinct logged-day counts for the trailing 7 and 30 local days
- latest and previous weights in the selected range
- deterministic least-squares weekly weight slope when sufficient data exists

The endpoint is available in both simple and complex tracking modes. Missing
optional nutrient values contribute `0` to macro totals. Weight change and
slope values are `null` when insufficient data exists.

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

Success `data`:

```json
{
  "recommendations": []
}
```

### `PATCH /api/v1/recommendations/:id/dismiss`

Marks a current-user recommendation as dismissed. The request has no body.

Success `data` is the updated recommendation response object with `status` set to `dismissed`.
