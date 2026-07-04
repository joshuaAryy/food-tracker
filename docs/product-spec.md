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

Photo food logging should come after food database and RAG foundations. It
should support recognition, portion estimation, trusted data matching,
confidence/review state, and user edits before saving.

### Reporting

Progress and Insights should improve as backend data gets richer. Future
reporting should include streaks, consistency, calorie/protein adherence,
micronutrient patterns, caffeine trends, sodium/fiber/sugar patterns, weight
trend, goal progress, weekly/monthly reports, customizable graphs, metric
selection, ranges, comparisons, and saved graph preferences.

## Later Ideas
- wearable integration
- grocery recommendations
- smart meal planning
