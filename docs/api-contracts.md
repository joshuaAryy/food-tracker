# MVP API Contracts

This document locks the REST API conventions and MVP request/response contracts
used by the implemented mobile app and API. It remains the canonical API
contract as later phases extend the product.

Persisted model types, relations, indexes, and constraints are locked in [prisma-schema-decisions.md](prisma-schema-decisions.md).

## API Conventions

- Use REST-style endpoints.
- Use `/api/v1` as the base path.
- Use JSON request and response bodies, except the raw JPEG body documented for
  `POST /api/v1/ai/photo-analysis`.
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

Phase 16 uses Firebase Authentication for identity and the existing application
database for application ownership. The mobile client sends one Firebase ID
token in the `Authorization` header for protected requests. The API verifies
issuer, audience, expiry, project, revocation/disabled-user status, and the
email-verification policy before synchronizing the Firebase UID to the local
UUID `User.id`.

- The client never sends authoritative `userId`.
- The API derives the current local user from verified Firebase identity.
- Existing foreign keys and application UUID ownership remain unchanged.
- Email/password accounts require verified email before protected access.
- Google and Apple provider claims do not use an unnecessary email-verification
  screen; Apple remains disabled in the current free-development build.
- Authentication identifies the current user; authorization controls access to
  that user's resources.
- Runtime mock authentication has been removed from production-capable code.
- Stable auth error codes include `AUTHORIZATION_REQUIRED`,
  `INVALID_AUTHORIZATION`, `INVALID_AUTH_TOKEN`, `AUTH_TOKEN_EXPIRED`,
  `AUTH_TOKEN_REVOKED`, `EMAIL_VERIFICATION_REQUIRED`, and
  `AUTH_CONFIGURATION_ERROR`. Account deletion also uses
  `RECENT_AUTH_REQUIRED` and `ACCOUNT_DELETION_IN_PROGRESS`.

### Immediate Account Deletion

`DELETE /api/v1/account` permanently deletes the authenticated Firebase account
and all application data owned by its verified Firebase UID. The request has no
body and accepts no account identifier. It requires a recently reauthenticated
Firebase token (`auth_time` no older than five minutes). Successful responses
use `{ "deleted": true }`. A minimal idempotent coordination record blocks
normal identity provisioning while PostgreSQL deletion and trusted Firebase
Admin deletion complete across their non-atomic boundary. Failures use the
existing safe envelope and never expose provider or database details.

The `/health` route is unauthenticated and is a minimal process-liveness check;
it is not an authenticated API contract and does not reveal database, provider,
deployment, or environment details.

### Hosted Phase 16 contract status

The API contract was validated through the Railway staging API and private
PostgreSQL service. Firebase verification, revocation, server-derived
identity, setup-status, ownership isolation, USDA/Open Food Facts retrieval,
Gemini parsing, photo analysis, safe unavailable responses, and immediate
account deletion were exercised. Account deletion requires recent provider
reauthentication and never accepts a client identifier. Production deployment
and standalone mobile distribution remain outside this contract closeout.

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
    "targetProteinGrams": 150.0,
    "targetCarbsGrams": 200.0,
    "targetFatGrams": 67.8,
    "targetFiberGrams": 30.8,
    "limitSugarGrams": 55.0,
    "limitSodiumMg": 2300
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
  "targetProteinGrams": 150.0,
  "targetCarbsGrams": 200.0,
  "targetFatGrams": 67.8,
  "targetFiberGrams": 30.8,
  "limitSugarGrams": 55.0,
  "limitSodiumMg": 2300
}
```

The five new nutrient fields may be `null` on legacy or incomplete goal rows.
The reporting endpoints still return a resolved goal or an explicit missing
state; clients must not manufacture a target from a null goals field.

### `PUT /api/v1/goals`

Creates or replaces the current user's goals. Existing goal fields remain
required. The five nutrient override fields are optional and nullable; omitting
or sending `null` selects the deterministic reporting derivation.

Request:

```json
{
  "goalType": "lose",
  "goalPace": "moderate",
  "targetWeightLb": 170.0,
  "targetCalories": 2200,
  "targetProteinGrams": 150.0,
  "targetCarbsGrams": 200.0,
  "targetFatGrams": 67.8,
  "targetFiberGrams": 30.8,
  "limitSugarGrams": 55.0,
  "limitSodiumMg": 2300
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
Phase 12.5 keeps `GET /food-items` local-only for compatibility and adds a
candidate-search endpoint for mixed local plus USDA generic search results.
The food item API still does not implement AI/RAG parsing, photo logging, saved
meals, or trusted source-food mutation from user review edits.

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

### `POST /api/v1/food-items/search-candidates`

Searches visible local FoodItems first, then enriches with USDA generic food
candidates when configured. This route is used by the normal mobile food search
flow when it needs mixed candidates. It does not save FoodLogs and does not
expose USDA API keys or raw USDA internals.

Request:

```json
{
  "query": "banana",
  "limit": 8
}
```

### `POST /api/v1/food-items/from-external-candidate`

Persists a selectable USDA candidate through the same authoritative
normalization and cache path used by `POST /api/v1/food-logs/from-candidates`.
It creates no FoodLog. Repeated requests for the same USDA identity reuse the
cached global FoodItem when available.

Request contains provider identity only; clients must not submit nutrition,
serving multipliers, or serving calculations:

```json
{
  "sourceProvider": "usda_fdc",
  "sourceId": "2708402"
}
```

Success `data` is the authoritative persisted `FoodItem`, including its
normalized nutrients and serving options. Recipe builders use this response as
the sole source for a newly selected ingredient's initial serving controls.

Rules:

- unknown fields are rejected
- candidates are ordered by deterministic quality signals across trusted local
  and USDA sources; high-quality generic USDA rows may outrank weak local,
  cached, or branded rows for unbranded common-food queries
- candidates use lexical identity matching, a small deterministic edible-
  default intent profile, candidate adequacy checks, and bounded USDA metadata
  and detail enrichment
- meaningful non-state query terms form the complete food identity. Compound
  identities such as `sweet potato`, `rice noodles`, `egg sandwich`, `whole
  milk`, `oat milk`, `steak sauce`, `banana pudding`, and `peanut butter
  cookies` must match completely for default suitability and trusted
  selection; partial matches may remain visible but cannot become trusted or
  high-confidence selections
- preparation/state terms such as `cooked`, `boiled`, `grilled`, `baked`,
  `roasted`, `raw`, `plain`, and `reduced sodium` are modifiers after identity
  matching; explicit requested forms override edible-default preferences
- high confidence additionally requires a strong phrase or food-name-head
  match and default-food suitability; a relevant product-form alternative may
  be medium or low confidence for a plain generic query
- `visibleRelevant` means sufficiently related to appear as a manual search
  option. `selectionEligible` means safe enough to auto-select during AI
  parsing or block the low-trust AI-estimate fallback. High confidence implies
  `selectionEligible`; medium confidence alone does not. Raw, dry, frozen,
  unprepared, composite, or conflicting forms may remain visible but are not
  automatically trusted unless explicitly requested
- AI parsing and trusted-candidate gating require `selectionEligible`; an
  inadequate candidate must not block the low-trust AI-estimate fallback
- other users' custom foods are never returned
- USDA failures return the local candidate set instead of failing food search
- USDA enrichment is bounded; when USDA search or detail lookup is slow, the
  endpoint may return the best available local/cached/USDA candidates instead of
  waiting for every possible external detail row
- USDA enrichment uses process-local metadata/detail caches, bounded
  concurrency, timeouts, detail windows, partial-result backfill, and one
  focused internal fallback metadata query. A logical enrichment may make at
  most two metadata calls; the configured allowance remains 20 logical
  enrichments per limiter window, capping metadata traffic at 40 calls per
  window. Transient empty metadata responses are not cached
- the backend may make one internal, budget-bound USDA metadata fallback query
  for a recognized food intent, after preserving provider relevance and
  applying deterministic edible-default and candidate-adequacy metadata checks;
  this does not change request or response shape or add a public `searchDepth`
  or show-more mode. Expanded search remains deferred until a mobile caller
  and product workflow require it
- the endpoint may return fewer than `limit` candidates rather than pad results
  with low-relevance external matches
- USDA candidates include source refs and preview nutrition with explicit basis
  copy such as `per 100 g`

The public request and response schema for this route is unchanged in Phase
12.7. No `searchDepth` field or show-more mode was added.

Success `data`:

```json
{
  "candidates": []
}
```

Candidate objects use the same `candidateType: "food_item"` or
`candidateType: "external_food"` union documented in
`POST /api/v1/ai/food-parse`.

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
  },
  "reportingGoals": {
    "caffeine": {
      "value": 400,
      "unit": "mg",
      "direction": "limit",
      "source": "default"
    },
    "vitaminC": {
      "value": 90,
      "unit": "mg",
      "direction": "minimum",
      "source": "default"
    }
  },
  "percentages": {
    "calories": null,
    "protein": null,
    "caffeine": 35.0,
    "vitaminC": 66.7
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

## Recipes

Phase 12.9A adds reusable, current-user recipe definitions. Recipes are not
FoodLogs: this slice does not create recipe logging endpoints. A recipe has at
least one visible persisted FoodItem ingredient. Every accepted ingredient is
resolved by the authoritative serving system and frozen as a versioned snapshot;
all totals are derived from those frozen snapshots, never from mutable FoodItem
rows. Archived recipes are hidden and return `NOT_FOUND` for every detail or
mutation endpoint.

Recipe create and ingredient mutation requests use:

```json
{
  "foodItemId": "food-item-id",
  "serving": { "quantity": 100, "unit": "g" }
}
```

`servingOptionId` is optional inside `serving`. Invalid requests return
`INVALID_SERVING_REQUEST`; unresolved household/ambiguous requests return
`SERVING_NEEDS_REVIEW`. FoodItems must be visible to the current user and have
a valid authoritative serving basis. External candidates, manual ingredients,
and AI nutrition are not recipe ingredients.

A recipe response includes ordered ingredients (`position` ascending), each
ingredient's immutable `snapshot`, `total`, `perPortion`, and `perGram` (only
when `finalCookedWeightGrams` exists). Nutrition summaries provide canonical
decimal-string `fullPrecision` values and intentionally rounded `materialized`
values. `gramLoggingAvailable` is true exactly when a final cooked weight is
present.

### `GET /api/v1/recipes`

Lists non-archived recipes owned by the current user. Success `data` is:

```json
{ "recipes": [] }
```

### `POST /api/v1/recipes`

Creates one recipe and one or more ordered frozen ingredients atomically.

```json
{
  "name": "Turkey chili",
  "description": "Weeknight batch",
  "portionCount": 4,
  "finalCookedWeightGrams": 1200,
  "ingredients": [
    {
      "foodItemId": "food-item-id",
      "serving": { "quantity": 500, "unit": "g" }
    }
  ]
}
```

If any ingredient is invalid or unavailable, the recipe and every ingredient
write roll back. Success `data` is the recipe response object.

### `GET /api/v1/recipes/:id`

Returns one non-archived recipe owned by the current user, including frozen
ingredients and derived totals. Source FoodItem edits, archival, or deletion do
not change this response's snapshots or nutrition.

### `PUT /api/v1/recipes/:id`

Updates one or more metadata fields: `name`, `description`, `portionCount`, or
`finalCookedWeightGrams`. Metadata updates do not recalculate or replace any
ingredient snapshot. The response contains the recipe with totals recalculated
only from the retained frozen snapshots; changing portions or cooked weight
therefore changes only the corresponding derived views.

### `DELETE /api/v1/recipes/:id`

Archives a current-user recipe. Success `data` is `{ "id": "recipe-id",
"archived": true }`.

### `POST /api/v1/recipes/:id/log`

Materializes exactly one current-user FoodLog from the recipe's frozen
ingredient snapshots. It never reads current FoodItem nutrition. The complete
read, calculation, FoodLog write, normalized `FoodLogNutrient` writes, and
recipe snapshot write occur in one transaction; a failure leaves no writes.

```json
{
  "amount": 1.5,
  "unit": "portion",
  "mealType": "dinner",
  "loggedAt": "2026-07-12T18:00:00.000Z",
  "notes": "Leftovers"
}
```

`unit` is `portion` or `g`. Portion scale is `amount / portionCount`; gram
scale is `amount / finalCookedWeightGrams`. Gram logging without a final cooked
weight returns `422 RECIPE_FINAL_WEIGHT_REQUIRED`. Archived, unowned, and
missing recipes return `NOT_FOUND`.

The created FoodLog has `recipeId`, no `foodItemId`, aggregated normalized
nutrient rows, and a strict `recipeSnapshot` version 2. Its snapshot captures
the recipe metadata at log time, every frozen ingredient snapshot,
full-precision recipe totals, canonical-string rounded logged nutrition, each
ingredient's full-precision contribution, the logged amount/unit, and
`calculationSchemaVersion: 1`. FoodLog columns and normalized nutrient rows are
rounded only once from the full-precision calculation. Later recipe/FoodItem
edits, archival, or deletion do not alter the historical FoodLog snapshot.

### `POST /api/v1/recipes/:id/ingredients`

Adds one frozen ingredient transactionally. Its position is after all existing
ingredients, and the response is the full updated recipe.

### `PUT /api/v1/recipes/:id/ingredients/:ingredientId`

Replaces only the identified ingredient's source reference and frozen snapshot
using a new authoritative serving resolution. It retains the ingredient's
position and every other ingredient snapshot. The response is the full updated
recipe.

### `DELETE /api/v1/recipes/:id/ingredients/:ingredientId`

Deletes one ingredient transactionally and returns the full updated recipe. A
request to delete the sole remaining ingredient returns `409`
`RECIPE_LAST_INGREDIENT`.

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
- `nutritionOverride`, an explicit user-confirmed FoodLog-level override

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

When `nutritionOverride` is present, the backend applies it only to the created
FoodLog snapshot. It must not mutate the trusted FoodItem. Simple-mode
overrides may include only calories, protein, carbs, fat, fiber, sugar, and
sodium. Complex-mode overrides may also include supported normalized nutrient
catalog entries. Missing values remain null/absent, never zero.

Success `data` is the created food-log response object.

### `POST /api/v1/food-logs/from-food-items`

Creates multiple FoodLogs from explicitly selected, visible, loggable FoodItem
rows. This endpoint is used by Phase 12 AI text logging confirmation, but it
does not accept raw AI nutrition and does not parse text.

Request:

```json
{
  "mealType": "breakfast",
  "loggedAt": "2026-06-14T12:30:00.000Z",
  "items": [
    { "foodItemId": "egg-food-item-id", "servingMultiplier": 2 },
    { "foodItemId": "toast-food-item-id", "servingMultiplier": 1 }
  ]
}
```

Rules:

- unknown fields are rejected
- `items` must contain at least one selected row
- each selected FoodItem must be visible, non-archived, and accessible to the
  current user
- each selected FoodItem must have calories and protein
- each selected row may include an explicit FoodLog-level `nutritionOverride`
- missing optional nutrients remain `null` or absent, never zero
- selected rows in one request are saved in a transaction

Success `data`:

```json
{
  "foodLogs": []
}
```

Each returned FoodLog uses the normal FoodLog response shape. If any selected
row is invalid or unloggable, no selected rows from that request are saved.

### `POST /api/v1/food-logs/from-candidates`

Creates multiple FoodLogs from explicitly selected review candidates. This is
used by AI text logging when a review list may contain persisted FoodItems and
USDA generic-food references.

Request:

```json
{
  "mealType": "breakfast",
  "loggedAt": "2026-06-14T12:30:00.000Z",
  "items": [
    {
      "candidateType": "food_item",
      "foodItemId": "egg-food-item-id",
      "servingMultiplier": 2
    },
    {
      "candidateType": "external_food",
      "sourceProvider": "usda_fdc",
      "sourceId": "173944",
      "servingMultiplier": 1
    }
  ]
}
```

Rules:

- unknown fields are rejected
- mobile clients send candidate references only, not nutrition values
- mobile clients may send explicit user-confirmed `nutritionOverride` values
  for the created FoodLog snapshot, but not as trusted source-food data
- `food_item` rows must reference visible, non-archived, loggable FoodItems
- `external_food` rows currently support only `sourceProvider: "usda_fdc"`
- USDA rows are refetched server-side, normalized, cached as global
  `FoodItem` rows, and then logged from the cached FoodItem
- selected rows in one request are saved in a transaction
- if any selected row is invalid or unloggable, no selected rows from that
  request are saved
- missing optional nutrients remain `null` or absent, never zero

Success `data`:

```json
{
  "foodLogs": []
}
```

Each returned FoodLog uses the normal FoodLog response shape.

### `POST /api/v1/food-logs/from-ai-estimate`

Creates one FoodLog from a user-reviewed low-trust AI nutrition estimate. This
endpoint is separate from trusted candidate logging and must not create or
mutate FoodItems.

Request:

```json
{
  "source": "ai_estimate",
  "trustLevel": "low",
  "reviewed": true,
  "edited": true,
  "foodName": "homemade ghanaian stew with rice",
  "mealType": "dinner",
  "calories": 520,
  "protein": 18.4,
  "carbs": 72.2,
  "fat": 16.5,
  "fiber": 8.1,
  "sugar": null,
  "sodium": null,
  "loggedAt": "2026-06-14T23:30:00.000Z",
  "notes": "Estimated serving: 1 bowl"
}
```

Rules:

- unknown fields are rejected
- `source` must be `ai_estimate`, `trustLevel` must be `low`, and `reviewed`
  must be `true`
- the created FoodLog has `foodItemId: null`
- notes are prefixed with an AI-estimated low-trust marker
- normalized micronutrients are not accepted from AI estimates in Phase 12.6
- this route does not create trusted FoodItems or external food cache rows

Success `data` is the normal FoodLog response shape.

### `POST /api/v1/food-logs/from-photo-analysis`

Confirms a bounded set of reviewed photo rows as trusted candidates, low-trust
AI estimates, or exclusions. The request is authenticated and validated in
full before one transaction creates the persisted trusted and estimated logs.

Trusted entries contain only a current candidate ID and serving selection; the
server re-fetches the candidate and recomputes authoritative nutrition.
For this no-FoodItem-write endpoint, the candidate ID must reference a current
visible FoodItem; external USDA candidates continue through the existing
trusted-only candidate route, which owns its cache behavior.
Estimated entries require a server-issued `estimateProof` from photo analysis.
Proofs are versioned HMAC-SHA-256 signatures (signed, not encrypted), bound to
the authenticated user, row reference, estimate basis, quantity, identity, and
original core nutrition, and expire after the configured short TTL. Optional
user nutrition or food-name corrections remain low-trust and unlinked.

Excluded entries create no FoodLog. All persisted entries are written
atomically; no FoodItem, provider, image, or review-session writes occur.
Estimated confirmation is disabled by default with
`PHOTO_ESTIMATE_CONFIRMATION_ENABLED=false`; enabling it requires a dedicated
`PHOTO_ESTIMATE_PROOF_SECRET` of at least 32 bytes. Durable cross-request
idempotency is not added in this slice, so stateless proof replay remains
possible until expiry.

Photo review keeps observed quantity, normalized grams, and selected serving
separate. The client may submit a validated serving request, but never
conversion factors or trusted nutrition. Canonical local and externally
materialized FoodItems use the same serving-resolution path; provider-only
references cannot enter this request. User-confirmed paired-iPhone validation
covered mixed trusted/estimated review, atomic save, History persistence, and
flexible serving selection. No photo bytes are persisted.

### `PUT /api/v1/food-logs/:id`

Replaces the editable fields of a current-user food log. The request uses the same required and optional editable fields as `POST /api/v1/food-logs`. The client cannot edit `id`, `userId`, `createdAt`, or `updatedAt`.

A recipe-origin FoodLog (identified by its immutable `recipeSnapshot`) is the
exception: it accepts omitted immutable fields and may update only `mealType`,
`loggedAt`, and `notes`. Explicit attempts to update food identity, recipe
identity/snapshot, serving fields/snapshot, nutrition columns, normalized
nutrients, or provenance return `409 RECIPE_LOG_IMMUTABLE`. Ordinary manual and
FoodItem-backed FoodLogs retain their existing update behavior.

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

### `GET /api/v1/analytics/progress`

Optional query parameter:
- `date`: local tracking date in `YYYY-MM-DD`; defaults to today in the user's
  timezone

This focused response supports the current Progress experience. It contains
the current and longest actual-logged-day streak, grace-day state, rolling
7-day and 30-day consistency, current-week calorie/protein adherence, and
weight facts. Unavailable metrics use `{ "available": false, "reason": ... }`
for client branching; mobile omits them and never displays the reason.

Streak headlines count actual FoodLog days only. A single grace day can bridge
one missed local day and contributes to span metadata, not the headline count.
Weight availability is latest with one WeightLog, change with two, and trend
rate with three or more.

### `GET /api/v1/analytics/reports?period=week|month`

Required query parameter:
- `period`: `week` or `month`

Optional query parameter:
- `date`: local elapsed-through date in `YYYY-MM-DD`; defaults to today in the
  user's timezone

Reports return the current in-progress period, the full immediately previous
completed period, and an equivalent elapsed comparison object. Calendar weeks
are Sunday through Saturday. For example, a Wednesday weekly comparison is
Sunday–Wednesday against the preceding Sunday–Wednesday. Monthly comparisons
use the same local ordinal day and cap the previous window at the previous
month's final day. `comparison.currentBoundary` and
`comparison.previousEquivalentBoundary` are authoritative and must not be
inferred by mobile.

The report includes logged-day counts, consistency, current-target calorie and
protein adherence, averages, weight facts, daily logged-day rows, and
mode-scoped nutrients. The full previous report remains separate from the
equivalent comparison. Comparisons are omitted per metric unless both windows
meet that metric's threshold. All values are deterministic and based on
recorded FoodLogs; the API does not claim that a logged day contains every
food consumed.

Current calorie targets use `UserGoal.goalType`: gain 95–115%, maintain
90–110%, and lose 85–105%. Protein is adherent at 90% or higher, independently
of calorie adherence. Reports use current goals for historical periods; they do
not recreate prior target versions.

Each `current` and `previousCompleted` report also includes:

```json
{
  "reportingGoals": {
    "protein": {
      "value": 150.0,
      "unit": "g",
      "direction": "minimum",
      "source": "derived"
    }
  },
  "nutrientDetails": {
    "protein": {
      "displayName": "Protein",
      "category": "macro",
      "total": 630.0,
      "averagePerLoggedDay": 157.5,
      "unit": "g",
      "recordedDayCount": 4,
      "goal": {
        "value": 150.0,
        "unit": "g",
        "direction": "minimum",
        "source": "derived"
      },
      "periodGoal": 600.0,
      "percentage": 105.0
    }
  }
}
```

`periodGoal` is the daily goal multiplied by the existing applicable eligible
day count for that report window. Percentages are recorded period amount divided
by `periodGoal`; they are omitted/null when the nutrient was not recorded, setup
is incomplete, or the denominator is invalid. `limit` metrics such as sugar and
sodium may exceed 100%. `source` is one of `user`, `derived`, `default`, or
`missing`, and `unit` is the stored nutrient unit. The daily nutrient response
uses the same resolved goal metadata for the approved Progress nutrient rows.

The only user-facing tracking mode labels are `Simple` and `Complex`; the
stored API enum remains `simple`/`complex`.

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

## AI Food Parsing

AI food parsing is backend-owned. Mobile clients never receive provider API
keys or prompt internals. Phase 12 uses Gemini as the first hosted provider
behind a provider abstraction, with `disabled` and `mock` modes for safe local
development and tests.

### `POST /api/v1/ai/food-parse`

Parses a natural-language meal description and retrieves candidate FoodItem
matches. This route creates no FoodLogs.

Request body:

```json
{
  "description": "2 eggs, toast with butter, and a banana"
}
```

Rules:

- unknown fields are rejected
- description length is bounded by backend config
- AI parse rate limiting is enforced before provider calls
- disabled or misconfigured providers return `AI_UNAVAILABLE`
- rate limits return `RATE_LIMITED`
- provider output is schema-validated before retrieval
- retrieval and candidate ranking use the same deterministic lexical identity,
  adequacy, edible-default, compound-identity, visibility, and selection rules
  as normal food search; AI does not simply accept the first lexical match
- if no local loggable match exists, USDA FoodData Central may be searched as
  a generic food fallback
- AI parsing can return `needs_review` when several plausible trusted
  candidates remain, and does not select foreign-head composites such as
  `Bread, egg, toasted` for eggs. `2 eggs, toast, banana` produces separate
  candidate groups
- other users' custom foods are never returned
- USDA candidates include an explicit nutrient basis such as `per 100 g`
- USDA candidates expose `defaultWholeItemServing` only when exactly one safe,
  validated whole-item option exists. The metadata includes the stable option
  ID, label, quantity, canonical unit, and trusted physical equivalent; raw
  provider payloads are never exposed.
- each parsed item includes a deterministic `servingSuggestion` derived from
  the raw quantity and serving fields; it contains no multiplier or nutrition
  calculation
- AI/Gemini never supplies calories, macros, or micronutrients

Success `data`:

```json
{
  "description": "2 eggs",
  "items": [
    {
      "id": "item-1",
      "parsedName": "eggs",
      "quantityText": "2",
      "servingText": "2 eggs",
      "servingSuggestion": {
        "status": "parsed",
        "quantity": 2,
        "unit": "egg",
        "rawQuantityText": "2",
        "rawServingText": "2 eggs"
      },
      "reviewStatus": "matched",
      "loggable": true,
      "selectedCandidateId": "food-item-id",
      "candidates": [
        {
          "candidateType": "food_item",
          "foodItem": {
            "id": "food-item-id",
            "name": "Eggs"
          },
          "externalFood": null,
          "rank": 1,
          "matchReason": "recent",
          "confidence": "high",
          "defaultServingMultiplier": 1
        },
        {
          "candidateType": "external_food",
          "foodItem": null,
          "externalFood": {
            "sourceProvider": "usda_fdc",
            "sourceId": "173944",
            "name": "Bananas, raw",
            "brandName": null,
            "foodType": "generic",
            "servingBasisText": "per 100 g",
            "servingQuantity": 100,
            "servingUnit": "g",
            "servingWeightGrams": 100,
            "servingOptions": null,
            "calories": 89,
            "protein": 1.1,
            "carbs": 22.8,
            "fat": 0.3,
            "fiber": 2.6,
            "sugar": 12.2,
            "sodium": null,
            "nutrients": {
              "potassium": { "amount": 358, "unit": "mg" }
            }
          },
          "rank": 2,
          "matchReason": "usda_fdc",
          "confidence": "medium",
          "defaultServingMultiplier": 1
        }
      ]
    }
  ]
}
```

For `candidateType: "food_item"`, `foodItem` uses the normal FoodItem response
shape. For `candidateType: "external_food"`, `externalFood` is a backend-owned
external reference and nutrition preview; clients must confirm the reference
through `POST /api/v1/food-logs/from-candidates` rather than submitting raw
nutrition. Unmatched items return `reviewStatus: "unmatched"`,
`loggable: false`, no selected candidate, and an empty candidate list.

`servingSuggestion` has four statuses: `parsed`, `missing`, `needs_review`, and
`invalid`. It always preserves `rawQuantityText` and `rawServingText`. A
`missing` suggestion means the AI supplied no explicit serving; mobile may show
the selected candidate's basis as a clearly labelled UI default. `needs_review`
and `invalid` suggestions never authorize a trusted save. Parsed units use the
canonical shared serving vocabulary; household units such as `cup` and `bowl`
remain subject to candidate-specific trusted-option resolution. External USDA
candidates expose validated `servingOptions` when normalization produced them;
clients must never construct options from raw provider metadata. Missing
alternate options do not make a physical `g`/`kg`/`oz`/`lb` or `mL`/`L` basis
unusable. A quantity-only AI count may use the candidate's one safe
`defaultWholeItemServing` internally, but the editable serving request uses
the resulting physical amount and unit.

### `POST /api/v1/ai/photo-analysis` (Phase 14, complete)

This is a read-only backend analysis route. It accepts a normalized JPEG as
raw request bytes, not JSON, multipart form data, a URL, or a file-system path.

Request requirements:

- `Content-Type` must be exactly `image/jpeg`.
- The body must be non-empty and begin with JPEG magic bytes.
- The maximum body size is exactly `5 MiB` (`5 * 1024 * 1024` bytes).
- A route-local raw-body parser handles this media type; the global JSON parser
  does not consume `image/jpeg` requests.
- The image remains in request memory only and is never persisted.

Stable upload errors are `UNSUPPORTED_IMAGE_TYPE` (415), `IMAGE_TOO_LARGE`
(413), and `INVALID_IMAGE` (400). Provider failures use `AI_UNAVAILABLE`, and
application/provider throttling uses `RATE_LIMITED`.

Success `data` is either `recognized` with zero to eight ordered rows or
`no_food_detected` with an empty array. Each row contains a request-scoped ID,
recognized name, optional preparation form, separate identity and portion
confidence, optional normalized region metadata, a provisional quantity,
existing ranked `AiFoodParseCandidate[]`, a review status, and an explicit
`loggable`/unresolved state. The provisional quantity is either an estimated
positive amount using `count`, `slice`, `piece`, `tablespoon`, `teaspoon`,
`cup`, `millilitre`, `gram`, or `ounce`, or `no_responsible_estimate`. Count
quantities carry provisional observed count evidence such as `egg` or
`sandwich`; they do not authorize a trusted serving conversion until a later
candidate-serving check. Generic counts such as `item`, `food`, `serving`,
`pasta`, or `sauce` are rejected. Provisional portions are checked against the
selected candidate's existing serving basis and trusted options; density and
unsupported household conversions are never inferred. Invalid optional region
metadata is discarded at the provider adapter boundary without invalidating
the identity or quantity row; surviving regions remain strictly validated.
Rows also carry representation-group metadata: active component or composite
kind, normalized visible-coverage claims, and a request-scoped group ID. The
response retains at most one inactive alternative per group for future
adjudication, but `data.items` contains only active rows. Active rows are
validated so composite coverage cannot overlap its active components or a
duplicate active topping. Matching coverage across groups is only a potential
overlap when valid spatial/provider-link evidence is unavailable; those rows
remain active with an `uncertain` group overlap status and a safe diagnostic.
Substantial region intersection, or a strong composite/component duplicate,
still rejects the representation response. Edge-touching regions and
intersections below the conservative 25% intersection-to-smaller-region
threshold are treated as separate. Invalid optional alternatives and
nonessential representation metadata are discarded without invalidating a
valid active group. An independently invalid group may be discarded when it
does not overlap or provide a required reference for a valid group; if all
groups are invalid, the response remains an AI-unavailable semantic error.

The route never returns raw provider payloads, prompts, internal reasoning,
credentials, or provider nutrition. It creates no FoodLogs, image records, or
review sessions. A validated high-confidence external candidate may be
materialized into a canonical FoodItem before review; this uses the same
provider-neutral materialization service as manual selection. AI-estimated
rows remain unlinked and proof-bound. Mixed confirmation uses
`POST /api/v1/food-logs/from-photo-analysis` and re-fetches canonical FoodItems
before one atomic save.

When `PHOTO_CANDIDATE_ADJUDICATION_ENABLED=true`, deterministic retrieval
completes before an optional bounded text-only adjudication step. Only active
rows without a strong deterministic selection and with up to three
selection-eligible candidates are included. At most one batch containing at
most eight rows is sent; no image, user ID, permanent database ID, nutrition,
or inactive alternative is sent. Candidates use request-scoped opaque
references. Only validated high-confidence selections are applied
automatically; trusted candidate nutrition and servings remain authoritative.
Medium/low selections, `reject_all`, `no_decision`, invalid output, timeout,
429, 503, cancellation, or malformed output preserve deterministic review
rows and require user review. Strong deterministic matches make zero
adjudication calls. Optional row `adjudication` metadata reports source,
status, confidence, and a safe review reason. The bounded adjudication step
adds no image retry or provider-side persistence. The same bounded assistance
batch may also supply the completed Phase 14 estimate fallback described below.

When `PHOTO_NUTRITION_ESTIMATION_ENABLED=true`, the same single bounded
text-only batch may also return a low-trust core-macro estimate for unresolved
active rows. No second estimate call or image resend is allowed. Estimates
contain calories, protein, carbohydrates, and fat only, with low or medium
confidence. The backend derives either a `structured_quantity` or
`portion_shown` basis and user-facing label; the provider cannot invent
serving weights, density, conversions, micronutrients, or food identities.
Trusted selections always suppress estimates. Valid estimates are unlinked,
editable, low-trust metadata and never enter trusted FoodItems or search
results. Invalid or unavailable estimates leave the recognition row and
candidates unresolved. Mixed trusted/estimated review and save use the
completed `/food-logs/from-photo-analysis` contract above.
The expanded assistance timeout defaults to 2.5 seconds (and remains capped
below the overall photo-analysis timeout); this was measured against the
three-row mixed estimate batch while preserving the mobile budget.

### `POST /api/v1/ai/nutrition-estimate`

Returns a low-trust AI nutrition estimate for one unresolved AI text logging
row. This endpoint is user-triggered only and is not used by normal food
search.

Request body:

```json
{
  "parsedName": "homemade ghanaian stew with rice",
  "quantityText": null,
  "servingText": "1 bowl",
  "description": "homemade Ghanaian stew with rice"
}
```

Rules:

- unknown fields are rejected
- backend rechecks trusted candidates before calling the AI provider
- if a genuinely relevant, loggable trusted candidate exists, the endpoint
  returns `TRUSTED_NUTRITION_AVAILABLE`
- only a `selectionEligible` trusted candidate blocks the low-trust estimate;
  inadequate, weak, or medium-confidence-only candidates do not
- weak or generic token-only matches do not block fallback; terms such as
  `bowl`, `plate`, `serving`, `homemade`, `custom`, and `meal` do not count as
  meaningful overlap by themselves
- disabled, misconfigured, unavailable, or invalid providers return
  `AI_UNAVAILABLE`
- upstream AI 429/503 responses return temporary AI unavailable copy
- HTTP 200 invalid JSON/unparseable model output is handled separately from
  upstream non-OK responses
- HTTP 200 `finishReason: "MAX_TOKENS"` with no text returns
  `AI_UNAVAILABLE` with cut-off copy
- response nutrients are limited to calories, protein, carbs, fat, and optional
  nullable fiber, sugar, and sodium
- Gemini returns only the basic estimate fields; the backend adds
  `source: "ai_estimate"`, `trustLevel: "low"`, and `nutrients: {}`
- full micronutrients are rejected and never generated in Phase 12.6
- the endpoint creates no FoodLogs and no FoodItems
- estimates remain unlinked FoodLog snapshots and do not populate trusted
  FoodItem or USDA caches

Success `data`:

```json
{
  "source": "ai_estimate",
  "trustLevel": "low",
  "foodName": "homemade ghanaian stew with rice",
  "servingText": "1 bowl",
  "calories": 400,
  "protein": 20,
  "carbs": 40,
  "fat": 15,
  "fiber": null,
  "sugar": null,
  "sodium": null,
  "nutrients": {}
}
```

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

## Mixed meals (Phase 12.9B Slice 1)

`POST /api/v1/food-logs/mixed-meals/preview` accepts a name, optional
description, and ordered persisted FoodItem serving requests. It performs no
writes and returns authoritative frozen ingredient snapshots and nutrition
summaries.

`POST /api/v1/food-logs/mixed-meals` accepts the same ingredients plus
`mealType`, `loggedAt`, optional notes, and optional `saveAsRecipe` metadata.
It resolves inputs again and atomically creates one FoodLog, normalized
nutrient rows, and (when requested) a Recipe. The FoodLog contains a strict
version-1 `mixedMealSnapshot` whose Decimal values are canonical strings.
Mixed-meal logs allow only meal type, logged time, and notes updates;
nutrition/provenance edits return `MIXED_MEAL_LOG_IMMUTABLE`.

## Manual FoodItems (Phase 12.9B Slice 2)

`POST /api/v1/food-items/manual` creates a current-user `user_custom` FoodItem
with `sourceProvider: manual`. Its strict request contains a nutrition basis
(`per_100g` or `per_serving`) and explicit required calories, protein,
carbohydrates, and fat. Optional normalized nutrients remain absent when not
provided. `PUT /api/v1/food-items/:id/manual` updates only an owned, active
manual FoodItem. Manual foods are searchable but are not automatically saved.

Per-serving bases accept only catalog serving units. Gram or millilitre
conversion is available only when the request declares that exact trusted
equivalence; count/household servings without one remain non-convertible.
Archive-only deletion continues through the existing FoodItem delete route.

The mobile mixed-meal client uses the preview and creation contracts directly;
it sends ordered `foodItemId` plus requested `serving` fields only. Nutrition,
serving multipliers, and aggregate totals are never client-submitted.
# Phase 13 food library (complete)

`GET /food-items/library` accepts `section` (`saved`, `my_foods`, `recent`, or
`archived`), optional normalized `query`, and deterministic `sort` (`recent`
or `name`). Library items include saved state and any current-user default
serving. `PUT`/`DELETE /food-items/:id/default-serving` manage a validated
prefill only; they never change historical nutrition or imply a saved food.

`POST /food-logs/:id/save-as-manual-food` accepts only optional `name` and
`description`, copies frozen persisted FoodLog nutrition and normalized rows,
and is idempotent by FoodLog. Ineligible provenance returns
`FOOD_LOG_NOT_REUSABLE`. `POST /food-items/:id/restore` restores only an owned
archived manual food.

Mobile consumers use default servings only as requested-serving prefills; they
do not send nutrition, multipliers, or totals when saving the preference or
using it to create a FoodLog, recipe ingredient, or mixed-meal ingredient.
