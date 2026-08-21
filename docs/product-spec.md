# Product Specification

## Problem

Existing food trackers are difficult to use.

Problems:
- Too many clicks
- Large friction for logging
- Slow food search
- Overwhelming interfaces

As a result, users quit.

---

## Solution

Build a tracker that offers:

- Low friction logging
- Accurate food data
- Useful progress and reporting
- Optional deep tracking
- AI assistance
- Personalized recommendations

The real MVP direction is:

```text
Fast logging + accurate food data + useful progress/reporting + Simple/Complex
modes that actually feel different.
```

Future phases should prioritize faster logging and more useful tracking data
over broad visual redesigns.

---

## User Personas

### Casual Tracker
Goals:
- weight loss
- maintenance
- bulking

Needs:
- calories
- protein
- weight

---

### Advanced Tracker
Needs:
- micronutrients
- macros
- timing
- detailed analytics

---

## Core Features

### MVP
- profile setup
- goal setup
- tracking mode selection
- manual structured food logging
- weight tracking
- dashboard
- history
- deterministic analytics
- deterministic recommendations

The current MVP baseline is manually entered food data. The next MVP direction
requires food database support, barcode scanning, and faster reuse flows so the
app becomes meaningfully faster than ordinary manual trackers.

### MVP Food Logging

Each food log represents one manually entered food item, not a full meal.

Required fields:
- food name
- meal type
- calories
- protein
- logged date/time

Optional fields:
- carbs
- fat
- fiber
- sugar
- sodium
- notes

Multiple food logs may share the same meal type. Meal grouping is not part of the MVP.

MVP meal types are:
- breakfast
- lunch
- dinner
- snack
- other

Food and body measurements follow the locked units, precision, and rounding rules in [data-model-decisions.md](data-model-decisions.md).

MVP flow:

```text
Manual entry
→ validation
→ database
→ analytics
→ dashboard/history
```

### Recommendations

The analytics module computes facts. The recommendations module converts those facts into recommendation objects. AI is not required and may later rewrite already-computed wording.

---

## Future MVP Direction

Detailed food-data, nutrition, barcode, RAG, photo logging, and reporting
direction is documented in
[food-data-and-ai-strategy.md](food-data-and-ai-strategy.md).

### Faster Logging

Faster logging is the core product value. Future MVP logging features should
include fast food search, recent foods, frequent foods, saved foods, saved
meals, custom foods, one-tap log again, copy previous day or previous meal
where useful, serving amount and unit pickers, smart defaults based on last
used amount, meal shortcuts, barcode scanning, text AI logging, later photo AI
logging, quick Simple mode calorie/protein entry, and full Complex mode
nutrition entry/editing.

### Food Data

Food Tracker should use a hybrid food data strategy:

- app-owned cached, user-created, corrected, recent, saved, meal, and
  barcode-linked foods
- Open Food Facts as the best initial source for barcode scanning and regional
  packaged foods
- USDA FoodData Central for generic foods, detailed nutrients, and
  standardized nutrition data

The backend should cache external food data into the app database where
appropriate. The app should not depend on one external source forever.

### Simple And Complex Modes

Simple mode should keep tracking fast and focused on calories, protein, weight,
and direct summaries.

Complex mode should eventually support full nutrition tracking, including
macros, fiber, sugar, fats, cholesterol, sodium, potassium, caffeine, vitamins,
and minerals. Missing nutrient values must remain unknown/null rather than
being treated as zero. Progress and Insights should only display nutrients that
backend summaries actually provide.

### AI And Photo Logging

AI logging should be retrieval-assisted and confirmed by the user before
saving. AI can parse messy descriptions, split meals into likely items, rank
candidate matches, and explain choices, but it must not be the source of truth
for nutrition values or bypass backend validation.

Photo food logging is implemented after the food database and retrieval
foundations. It supports recognition, portion estimation, trusted data
matching, confidence/review state, user edits, flexible serving selection, and
server-authoritative mixed saving without persisting photos.

### Reporting

Phase 15 reporting keeps Progress focused on current state and uses Insights
for deeper week/month reports. It includes actual-logged-day streaks with one
non-inflating grace day, logging consistency, explicit goal-direction calorie
adherence, independent protein adherence, deterministic weight facts, full
previous periods, equivalent elapsed comparisons, and recorded-nutrient
summaries. Missing or threshold-unavailable metrics are omitted rather than
described with backend confidence language. Current targets are used for
historical reports until reliable goal history exists.

Phase 17.5 — Custom Analytics, Micronutrients, and Hydration — is complete
after Phase 17. Its accepted scope includes custom nutrition and weight graphs,
metric selection, approved periods and custom ranges, up to two compatible
comparisons, Complex saved and pinned views, deterministic forecasts, full
Complex micronutrient patterns, and hydration. Phase 18 — Additional Food
Providers — is next.

Simple remains focused on Calories, Protein, Carbohydrates, Fat, Macro
Composition, Weight, Hydration, and Logging Consistency across 7D/30D/90D,
curated Explore Trends, a preferred metric, and focused detail Trends. Simple
does not expose arbitrary micronutrients, advanced comparisons, Configure
Trend, Custom ranges, advanced coverage filters, or saved-view management.
Complex adds the approved nutrient catalog, nutrient search and drill-down,
contributors, custom ranges, coverage filters, comparisons, saved/pinned views,
and deterministic forecasts.

Phase 17.5 hydration uses a separate WaterLog model and the canonical
amount/time Water logger. Only explicitly logged water entries count; water
contained in food does not. The initial server-owned goal is `2000 mL/day`,
available in both modes, and `waterTrackingEnabled` remains a compatibility
field rather than a visibility gate. Supplements remain deferred.

Analytics preserves unknown ≠ zero, unlogged ≠ zero, partial ≠ complete,
recorded zero as real zero, and missing historical values as gaps. FoodLog
nutrient snapshots and WeightLogs remain authoritative. Logging-day behavior
(`complete`, `partial`, `unlogged`, with current local day `in_progress`) is
separate from selected metric availability (`recorded`, `partial`, `unknown`).
The initial core-meal completeness rule is centralized/versioned
implementation policy, not an immutable nutritional rule. Weekly/monthly
aggregation retains independent logging and metric counts.

Recommendations generated from report comparisons, reminders, notifications,
exports, and persisted report snapshots remain deferred unless explicitly
owned by a later phase.

## Later Ideas
- wearable integration
- grocery recommendations
- smart meal planning
