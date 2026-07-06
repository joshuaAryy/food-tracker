# Food Data And AI Strategy

This document records the post-Phase 6 MVP direction for faster logging,
trusted food data, full nutrition depth, barcode scanning, and AI-assisted
logging.

The MVP is not just a polished manual tracker. The product direction is:

```text
Fast logging + accurate food data + useful progress/reporting + Simple/Complex
modes that actually feel different.
```

## Product Priorities

Faster logging is the core product value. Future work should prioritize making
food entry faster and making tracking data more useful, not continuing broad
screen redesigns.

MVP logging should grow toward:

- fast food search
- recent foods
- frequent foods
- saved foods
- saved meals
- custom foods
- one-tap log again
- copy previous day or previous meal where useful
- serving amount picker
- serving unit picker
- smart defaults based on last used amount
- meal shortcuts
- barcode scanning
- text AI logging
- photo AI logging after food database and RAG foundations
- quick Simple mode calorie/protein entry
- full Complex mode nutrition entry/editing

## Hybrid Food Data Strategy

Food Tracker should not depend on one external food source forever. The backend
should cache external food data into the app database where appropriate and
preserve user corrections.

The recommended strategy is:

1. App-owned database

   - cached foods
   - user-created foods
   - corrected foods
   - recent foods
   - saved foods
   - saved meals
   - barcode-linked foods

2. Open Food Facts

   - best initial source for barcode scanning
   - useful for international and regional packaged foods
   - useful for different barcode regions

3. USDA FoodData Central

   - useful for generic foods
   - useful for detailed nutrients
   - useful for standardized nutrition data

Food search priority should eventually be:

```text
user recent foods
↓
user saved foods / meals
↓
user custom foods
↓
cached app food database
↓
external generic/branded sources
```

Barcode lookup priority should eventually be:

```text
local cached barcode
↓
Open Food Facts barcode lookup
↓
USDA/branded fallback where useful
↓
custom food creation when not found
```

### Phase 8 Local Foundation

Phase 8 implements the local app-owned foundation only:

- `FoodItem` for globally visible cached/app foods and current-user custom foods
- `SavedFoodItem` for current-user saved foods
- `FoodBarcode` for local barcode records with exact region lookup and
  `GLOBAL` fallback
- simple name/brand search over visible non-archived food items
- nullable MVP nutrient columns and unit-bearing `additionalNutrients` JSON

Phase 8 does not implement external Open Food Facts integration, USDA
integration, barcode camera scanning, public barcode creation, AI/RAG logging,
photo logging, saved meals, or full Complex mode micronutrient UI. Barcode
records are local database groundwork for future barcode/custom-food flows.

## Full Nutrition Model

Phase 9 implements the backend/data foundation for full nutrition tracking,
not only calories, protein, carbs, and fat. Simple mode should hide this
complexity.

The model keeps `calories`, `protein`, `carbs`, `fat`, `fiber`, `sugar`, and
`sodium` in existing columns. Extended Complex-mode nutrients use a static
shared catalog and normalized unit-bearing `FoodItemNutrient` and
`FoodLogNutrient` rows. Food-log nutrient rows are snapshots.

Catalog categories include:

### Core Macros And Common Nutrition

- calories
- protein
- carbohydrates
- fat
- fiber
- sugar
- added sugar where available
- saturated fat
- trans fat
- monounsaturated fat where available
- polyunsaturated fat where available
- cholesterol
- sodium
- potassium
- caffeine
- alcohol
- water
- oxalate
- phytate

### Carbohydrate Detail

- added sugar
- starch
- soluble fiber
- insoluble fiber
- sugar alcohol

### Fat And Lipid Detail

- saturated fat
- trans fat
- monounsaturated fat
- polyunsaturated fat
- omega-3
- omega-6
- cholesterol

### Amino Acids

- histidine
- isoleucine
- leucine
- lysine
- methionine
- phenylalanine
- threonine
- tryptophan
- valine
- alanine
- arginine
- aspartic acid
- cystine
- glutamic acid
- glycine
- proline
- serine
- tyrosine

### Vitamins

- vitamin A
- vitamin B1 / thiamine
- vitamin B2 / riboflavin
- vitamin B3 / niacin
- vitamin B5 / pantothenic acid
- vitamin B6
- vitamin B7 / biotin
- vitamin B9 / folate
- vitamin B12
- vitamin C
- vitamin D
- vitamin E
- vitamin K

### Minerals

- calcium
- iron
- magnesium
- zinc
- phosphorus
- selenium
- copper
- manganese
- iodine
- chromium
- molybdenum
- chloride

Handling rules:

- Nutrients must have units.
- Phase 9 accepts only each catalog nutrient's default unit. Unit conversion
  and source mapping are deferred.
- Missing nutrient values must be nullable/unknown, not treated as zero.
- Calories, protein, carbs, fat, fiber, sugar, and sodium remain column-backed.
- Extended nutrients are stored in normalized nutrient tables.
- `additionalNutrients` remains raw/unmapped compatibility metadata only.
- FoodLog nutrient rows are snapshots; FoodItem nutrient changes must not
  mutate old logs.
- Daily nutrient totals combine column-backed totals plus normalized nutrient
  rows without double-counting, and they must not fabricate zero values for
  missing nutrients.
- Simple mode should hide nutrient complexity.
- Complex mode should expose deeper nutrient detail.
- Backend summaries include daily nutrient totals for nutrients the backend
  actually has.
- Progress and Insights should only display nutrients that the backend actually
  provides.
- Do not build fake micronutrient charts before the data exists.
- Phase 9 does not implement external Open Food Facts or USDA integration,
  barcode camera scanning, AI/RAG logging, photo logging, saved meals, custom
  graphs, recommendation engine 2.0, or full Complex-mode nutrition UI.

## Phase 9 Checkpoint And Retrospective

Phase 9 is complete enough to move into Phase 10. It delivered the full
nutrition model backend/data foundation: shared static nutrient catalog,
column-backed versus normalized nutrient distinction, `FoodItemNutrient`,
`FoodLogNutrient`, daily nutrient totals, strict default-unit validation,
nullable/unknown nutrient handling, historical food-log nutrient snapshots,
shared schema/type support, mobile API client support, backend tests, and docs.

What went well:
- the hybrid model avoided a huge column-only schema
- normalized rows make future Complex mode analytics and graphs possible
- FoodLog snapshots preserve historical accuracy
- the shared catalog gives one source of truth for keys and units
- the daily nutrient totals endpoint creates backend foundation for future
  reporting
- existing manual food logging stayed compatible
- Simple mode remains unaffected
- there were no mobile redesign, package, lockfile, app config, or native
  changes

Risks to manage:
- the nutrient catalog is broad and needs disciplined use
- unit conversion is still deferred
- external food sources will likely need source-key mapping later
- normalized nutrients make queries more powerful but more complex
- UI must not expose too much complexity too soon
- daily nutrient totals are backend foundation only until Phase 10+ UI work
  uses them carefully

Standards to uphold:
- do not fake nutrient values
- do not treat unknown nutrients as zero
- do not duplicate column-backed nutrients in normalized rows
- do not display Complex nutrient charts before data exists
- keep Simple mode simple
- expose deeper nutrient detail only when the flow supports it
- use backend-provided nutrient data only
- keep food logging fast, not overloaded

## Phase 10 Faster Logging UX

Phase 10 connects the local food database and nutrition snapshot foundations
to the user logging flow.

Implemented direction:
- food item search inside food logging
- saved foods as quick-access rows
- recent food logs that can reuse linked `FoodItem` records when available
- backend-owned log-from-food snapshot creation
- serving multipliers for the selected food item with no unit conversion
- small manual “save as reusable food” path for custom user foods

Phase 10 food search uses only the local app-owned `FoodItem` database. Search
can therefore be sparse in native testing until the user saves reusable foods
from manual entries, or until future phases add starter catalogs, barcode
lookup, Open Food Facts, USDA, or other external food data. Empty search
results should guide the user toward manual logging and saving reusable foods,
not imply a broken search.

Data rules:
- `FoodLog.foodItemId` may link a log to a visible reusable food item, but the
  food log still stores historical nutrition snapshots.
- `FoodItem` edits after logging must not mutate old `FoodLog` or
  `FoodLogNutrient` values.
- Normalized `FoodItemNutrient` rows are copied into `FoodLogNutrient`
  snapshots only when logging from a food item.
- Missing nutrients stay nullable/unknown or absent, not zero.
- No column-backed nutrient is duplicated into normalized nutrient input.

Phase 10 does not implement barcode scanning, Open Food Facts or USDA
integration, AI/RAG logging, photo logging, saved meals, frequent-food ranking,
custom graph UI, recommendation engine changes, or a full Complex-mode
micronutrient editor.

Complex mode can use richer nutrient data when a saved or reusable food
contains normalized nutrients, but Phase 10 does not finish the full Complex
mode logging, editing, or reporting experience. The main logging flow should
stay fast and avoid fake micronutrient UI when no extra nutrient data exists.

## Phase 11 Barcode Scanning

Phase 11 adds barcode-powered packaged food lookup to the existing fast logging
flow. The mobile app opens a camera scanner from food logging, sends the
scanned barcode to the backend, and receives a normal `FoodItem` response. The
user still reviews the selected food, serving amount, meal, and notes before
logging.

Barcode scanning is part of fast logging, not a separate logging model. The
backend remains the external food-data gateway; the mobile app must not call
Open Food Facts directly. Scanned foods return into the same selected-food
logging flow used by search, saved foods, recent foods, serving multipliers,
save/unsave, and log-from-food snapshot creation.

Implemented workflow:

```text
Food Log
↓
Scan barcode
↓
Camera permission / scanner
↓
Raw barcode read
↓
Barcode normalization
↓
Local FoodBarcode lookup
↓
Open Food Facts fallback if local miss
↓
Cache usable result as FoodItem/FoodBarcode
↓
Return selected FoodItem to Food Log
↓
User reviews serving/multiplier
↓
Backend creates FoodLog snapshot from FoodItem
```

Lookup priority is:

```text
local cached barcode
↓
Open Food Facts barcode lookup
↓
cache usable result into local FoodItem/FoodBarcode
↓
custom reusable food creation when not found
```

Open Food Facts is the first external packaged-food source. USDA remains later
work. Cached external foods use `sourceType: cached_external`,
`sourceProvider: open_food_facts`, a `FoodBarcode` row for the scanned barcode,
and the existing `FoodItem` response and log-from-food snapshot flow.
Canadian/US retail barcodes are normalized across safe UPC-A/EAN-13
equivalents because iOS may report a UPC-A scan as EAN-13 with a leading zero.
For example, `069000013762` and `0069000013762` are treated as equivalent
lookup/cache candidates. The scanner supports UPC-A, UPC-E, EAN-13, and EAN-8
where Expo Camera exposes those types.

Normalization is intentionally conservative. Product name, brand, barcode,
parseable serving/quantity data, calories, protein, carbs, fat, fiber, sugar,
sodium, and a small set of supported extended nutrients may be stored. Missing
nutrition remains unknown/null or absent. Column-backed nutrients are not
duplicated into normalized nutrient rows. Products without calories or protein
may be cached, but the existing log-from-food validation prevents creating an
invalid `FoodLog` until required values exist.

Barcode route ordering must keep barcode-specific routes before `/:id`.
Known no-match states should guide users back to manual reusable food creation
without technical wording. Scanner guidance should remind users to use good
lighting and move back slightly if a barcode looks blurry.

### Phase 11 Retrospective

What went well:

- barcode scanning now connects packaged food lookup to the existing fast
  logging flow
- backend cache-first lookup reduces dependence on external calls over time
- Open Food Facts gives the app real packaged-food coverage
- scanner results reuse selected-food review, save/unsave, serving multiplier,
  and log-from-food behavior
- UPC-A/EAN-13 normalization made Canadian/US barcodes more reliable
- `FoodItem`/`FoodBarcode` caching fits the Phase 8 data model
- FoodLog snapshots and Phase 9 nutrient rules remain intact
- no generated native folders were committed

What did not go well / risks:

- native camera work required a rebuilt development build and was not solvable
  through Metro reload only
- stale iOS native config caused a camera permission crash
- barcode camera testing required physical iPhone validation
- Open Food Facts data can be incomplete or missing for Canadian products
- scanner quality depends on lighting, distance, focus, and barcode condition
- UPC-A may be reported as EAN-13 on iOS, so raw barcode values cannot be
  trusted blindly
- external product data must not be treated as perfectly accurate
- some barcodes will still have no match until users create reusable foods or
  future sources are added

Standards to uphold:

- never commit generated native folders
- rebuild the development app after native dependency or config changes
- always test camera/barcode features on physical iPhone
- normalize barcode equivalents before lookup
- keep backend as the external food-data gateway
- cache external food data into app-owned records
- do not fake nutrients
- preserve user review before saving logs
- keep manual logging as a fallback
- keep the scanner UI simple and Phase 6-aligned

Phase 11 does not implement AI/RAG logging, photo recognition, USDA fallback,
saved meals, custom graphs, recommendation changes, real auth, or full
micronutrient editing UI.

## RAG-Assisted AI Logging

Phase 12 should begin RAG-assisted AI text logging. It should build on the
Phase 8 `FoodItem`/`FoodBarcode`/`SavedFoodItem` foundation, the Phase 9 full
nutrition model and nutrient snapshots, the Phase 10 selected-food logging and
reusable-food flow, and the Phase 11 barcode/Open Food Facts cached foods.

AI should not be the nutrition source of truth. The preferred architecture is:

```text
User describes food or provides an image
↓
AI parses intent / identifies possible foods
↓
retrieval searches trusted food sources
↓
backend returns structured candidates
↓
user reviews and edits
↓
backend saves confirmed FoodLog
```

Retrieval should use:

- user recent foods
- saved foods
- saved meals
- custom foods
- cached app food database
- barcode foods
- generic food database
- branded food database

AI can help with:

- parsing messy user descriptions
- splitting a meal into likely items
- estimating likely serving descriptions
- ranking candidate matches
- generating user-friendly explanations

AI must not:

- silently save uncertain logs
- invent nutrient data when trusted data is available
- bypass user confirmation
- become the only source for calories, macros, or micronutrients
- replace backend validation

Every AI-assisted log must have a review/confirmation step before saving.
Phase 12 should focus on text meal description parsing, retrieval from
existing trusted food data, candidate matching, and user review/confirmation.
It should not become photo logging, custom graphs, recommendation engine 2.0,
a broad redesign, vector database overbuild without clear need, automatic
nutrition invention, or automatic saving without review.

## Photo Food Logging

Photo logging belongs after the food database and RAG foundations. It should
not be placed before trusted food search, barcode lookup, cached food data, and
candidate review exist.

Photo logging should eventually support:

- image capture/upload
- food recognition
- portion estimation
- RAG matching against trusted food data
- confidence/review state
- user edits before saving
- Simple confirmation UI
- Complex nutrient detail review

## Reporting Direction

Progress and Insights should become better as backend data gets richer. They
should not fake advanced data on the client.

Future reporting should include:

- logging streaks
- weekly consistency
- calorie adherence
- protein adherence
- micronutrient patterns
- caffeine trends
- sodium, fiber, and sugar patterns
- weight trend
- goal progress
- weekly reports
- monthly reports
- customizable graphs
- graph metric selection
- 7-day, 30-day, 90-day, and custom ranges
- compare metrics
- saved graph preferences

Reporting should follow the Phase 6 visual standard: calm, useful, readable,
and not a generic dashboard-card stack. Complex mode gets deeper analytics.
Simple mode gets simplified summaries.
