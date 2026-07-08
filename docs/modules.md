# Modules

## users
Handles:
- profile
- user data
- user timezone preference
- references to Supabase Auth user IDs

The current development implementation uses mock user context. Clients do not
send `userId`. This module does not handle custom password authentication.

---

## goals
Handles:
- calorie targets
- protein targets
- weight targets
- goal direction and pace

---

## trackingPreferences
Handles:
- simple mode
- complex mode

---

## setup
Handles:
- first-run completeness checks
- deterministic onboarding target calculation
- atomic onboarding saves across profile, goals, and tracking preferences

This module uses the existing tables and validation contracts. It does not own
a separate setup model.

---

## foodLogs
Handles:
- implemented manual structured food log CRUD
- individual food entries
- the `breakfast`, `lunch`, `dinner`, `snack`, and `other` meal types
- UTC logged timestamps
- normalization and rounding before persistence
- food history
- FoodLog snapshots from trusted FoodItem and USDA-backed candidate references
- explicit user-confirmed FoodLog-level nutrition overrides
- unlinked low-trust AI-estimate snapshots after user review

This module does not handle AI parsing, candidate retrieval, barcode scanning,
or photo input. It owns persistence of confirmed logs only, including
reviewed AI-estimate snapshots that remain unlinked from `FoodItem`. User
nutrient edits made during item review are saved on the FoodLog snapshot and
must not mutate trusted FoodItem records.

The API accepts optional serving quantity and serving unit metadata. `userId` comes from auth context, not request bodies.

---

## foodItems
Handles:
- visible local food search
- saved and reusable FoodItem records
- current-user custom foods
- global/app-owned cached foods
- barcode cache lookup and Open Food Facts packaged-food caching
- USDA FoodData Central generic-food lookup and candidate search enrichment

Food search can return local FoodItems and backend-owned external USDA
candidate references. Local visible FoodItems rank before USDA/generic
candidates. API keys stay backend-only. Missing nutrients remain unknown/null
or absent, never zero. AI-estimated fallback must not create FoodItems or
trusted cache rows.

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

## aiParser
Handles:
- text parsing
- proposed food extraction
- provider abstraction with Gemini as the first hosted provider
- structured parse validation before retrieval
- user-triggered basic AI nutrition estimates for unresolved text-logging rows

Requires user confirmation. Gemini does not create FoodLogs or become the
nutrition source of truth. Phase 12.6 estimate output is limited to basic
calories/macros/common fields, is low-trust, and is saved only through the
foodLogs module after review.

---

## nutritionMatcher
Handles:
- nutrition lookup
- deterministic nutrient resolution for confirmed foods
- local/recent/saved/custom/global/cached FoodItem retrieval
- USDA generic-food fallback after local trusted sources
- candidate ranking and review status
- trusted-candidate rechecks before AI estimates

Gemini can parse and rank intent, but trusted nutrition comes from FoodItems,
cached Open Food Facts foods, USDA generic foods, or explicit user-confirmed
FoodLog overrides. AI-estimated nutrition fallback is allowed only after
trusted sources fail and must not be treated as a future trusted candidate.
Weak generic token-only matches such as `bowl` or `meal` do not count as
trusted enough to block fallback; common foods should resolve through trusted
local/cached/USDA candidates where available.

---

## aiWording (Future, Optional)
Handles:
- rewriting already-computed recommendation wording
- explaining already-computed facts in natural language

Does not compute facts, decide recommendations, or query the database directly.
