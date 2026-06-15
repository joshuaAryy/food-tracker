# Modules

## users
Handles:
- profile
- user data
- user timezone preference
- references to Supabase Auth user IDs

During Phase 1, authenticated requests use mock user context. Clients do not send `userId`. This module does not handle custom password authentication.

---

## goals
Handles:
- calorie targets
- protein targets
- weight targets

---

## trackingPreferences
Handles:
- simple mode
- complex mode

---

## foodLogs
Handles:
- Phase 2 manual structured food log CRUD
- individual food entries
- the `breakfast`, `lunch`, `dinner`, `snack`, and `other` meal types
- UTC logged timestamps
- normalization and rounding before persistence
- food history

Phase 2 does not handle AI parsing, automated matching, barcode input, or photo input.

The API accepts optional serving quantity and serving unit metadata. `userId` comes from auth context, not request bodies.

---

## weightLogs
Handles:
- weight tracking

Weight trend calculations belong to analytics.

---

## analytics
Handles:
- deterministic calculations
- sums of stored normalized values
- on-demand daily summaries from food logs
- tracking days grouped by the user's local date, not UTC date
- weekly averages
- trend analysis
- goal adherence
- source facts for recommendations

Does not use AI.

---

## recommendations
Handles:
- conversion of analytics facts into structured recommendation objects
- recommendation history
- recommendation type, severity, title, message, and source facts

Must work without AI. It does not calculate analytics facts.

---

## aiParser (Future)
Handles:
- text parsing
- proposed food extraction

Requires user confirmation. It does not calculate nutrition values or query the database directly.

---

## nutritionMatcher (Future)
Handles:
- nutrition lookup
- deterministic nutrient resolution for confirmed foods

Not required in Phase 2.

---

## aiWording (Future, Optional)
Handles:
- rewriting already-computed recommendation wording
- explaining already-computed facts in natural language

Does not compute facts, decide recommendations, or query the database directly.
