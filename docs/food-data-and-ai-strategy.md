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

## RAG-Assisted AI Logging

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
