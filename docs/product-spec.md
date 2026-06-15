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
- Optional deep tracking
- AI assistance
- Personalized recommendations

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

## Future Features
- AI-assisted text food parsing with user confirmation
- nutrition matching and automated food lookup
- Open Food Facts integration
- barcode scanning
- meal photo recognition
- wearable integration
- grocery recommendations
- smart meal planning
