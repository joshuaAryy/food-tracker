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

Phase 12 begins RAG-assisted AI text logging. It builds on the
Phase 8 `FoodItem`/`FoodBarcode`/`SavedFoodItem` foundation, the Phase 9 full
nutrition model and nutrient snapshots, the Phase 10 selected-food logging and
reusable-food flow, and the Phase 11 barcode/Open Food Facts cached foods.

Phase 12 uses Gemini as the first real hosted AI provider behind a backend
provider abstraction. API keys live only in backend environment variables.
Mobile clients never receive provider keys. Future provider options may include
cloud-hosted self-managed inference with Ollama, vLLM, Llama, Qwen, Gemma,
Kimi-style models, or another hosted API, but self-hosted inference is
deferred.

Phase 12 intentionally does not add a vector database or embeddings.
Deterministic lexical retrieval is the MVP retrieval layer.

AI should not be the nutrition source of truth. The preferred architecture is:

```text
User describes food
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
- custom foods
- cached app food database
- cached barcode/Open Food Facts foods
- generic USDA FoodData Central foods when local trusted sources do not have a
  loggable match

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

Partial logging is allowed at the review-selection level: a user can log the
matched/loggable foods and leave unmatched items unresolved. Persistence
remains transactional for the selected confirmed rows in a single confirm
request.

### Phase 12.5 Generic Food Nutrition Lookup

Phase 12.5 adds USDA FoodData Central as the first trusted generic food
nutrition lookup layer for AI-assisted text logging and normal food search.
Gemini still parses meal intent only. USDA/local/custom/Open Food Facts/cached
data provide nutrition. There is no AI-estimated nutrition fallback in this
phase.

The Phase 12.5 pipeline is:

```text
User describes food
↓
Gemini parses food intent
↓
backend searches local trusted FoodItems
↓
if no local loggable match exists, backend searches USDA FoodData Central
↓
backend returns nutrient-backed candidates with explicit serving basis
↓
user reviews/edits/selects
↓
backend refetches/caches selected USDA foods and saves FoodLog snapshots
```

Normal food search also uses the same local-first candidate model:

```text
User searches food
↓
backend searches visible local FoodItems
↓
backend may add USDA generic candidates after local matches
↓
user selects a candidate, reviews amount/nutrition, and saves
↓
backend refetches/caches selected USDA foods and saves FoodLog snapshots
```

USDA candidates must make their nutrient basis explicit, for example
`per 100 g`. The app must not pretend parsed quantities such as `2 eggs` were
perfectly converted unless the backend has a safe serving/gram conversion. If
quantity conversion is uncertain, the candidate can be loggable but should
remain a review item with an adjustable multiplier.

USDA/FDC API keys live only in backend environment variables. Mobile clients
never receive USDA keys, and backend diagnostics must not log full key-bearing
URLs or raw error bodies that expose request links or API keys.

Serving changes in item-based logging flows must update the visible nutrition
preview immediately. The backend still refetches trusted source data and saves
the final FoodLog snapshot server-side. User nutrient edits in review/logging
flows are explicit FoodLog-level overrides only; they must not mutate trusted
USDA, Open Food Facts, app-owned, or global cached FoodItem rows. Simple mode
only exposes calories, protein, carbs, fat, fiber, sugar, and sodium editing.
Complex mode can expose supported normalized nutrient catalog entries.

Phase 12.5 does not add a vector database, embeddings, photo logging,
automatic logging, or AI-estimated calories/macros/micros. Missing nutrients
remain null/absent, not zero.

### Phase 12.6 AI-Estimated Nutrition Fallback

Phase 12.6 adds a last-resort AI-estimated nutrition fallback only when
trusted local/custom/saved/recent, cached barcode/Open Food Facts, and USDA
sources fail. Estimates are only user-triggered from unresolved AI text logging
rows; normal food search does not offer AI estimates yet.

Rules:

- clearly label rows as low-trust or AI-estimated
- require user review and editing opportunity before saving
- save estimates as unlinked FoodLog-level snapshots only
- do not create trusted FoodItems from AI estimates
- start with calories, protein, carbs, fat, and optional main editor fields
- do not hallucinate full micronutrients
- do not add Prisma schema or migration changes in this phase

The estimate flow is:

```text
AI text logging row remains unresolved
↓
user taps Use AI estimate
↓
backend rechecks trusted candidates
↓
if a genuinely relevant trusted candidate exists, return
TRUSTED_NUTRITION_AVAILABLE
↓
otherwise Gemini returns only a basic estimate object
↓
backend validates it and adds source/trust/nutrients metadata
↓
user edits/reviews
↓
backend saves an unlinked FoodLog snapshot
```

Trusted-candidate gating must use the same idea of real loggability as the
parse/review flow. A candidate blocks AI estimation only when it is genuinely
relevant and nutrient-backed. Low-confidence, weak, or generic token-only
matches do not block fallback. Generic words such as `bowl`, `plate`,
`serving`, `homemade`, `custom`, and `meal` are not meaningful overlap by
themselves.

Common foods must resolve through trusted data before AI is offered. Phase 12.6
therefore broadened trusted retrieval beyond the visible eggs regression:
simple singular/plural token normalization supports forms such as `egg` and
`eggs`; query variants support local, cached, and USDA matching; generic
stopwords are ignored for relevance; and USDA lookup internally overfetches at
least 8 results so stale 404/timeout detail records do not exhaust the search.
USDA detail failures remain non-fatal and are skipped. A USDA candidate is not
trusted/loggable until detail nutrition is successfully fetched and required
nutrients exist.

Gemini estimate output is deliberately narrow. The model is asked only for:

- `foodName`
- `servingText`
- `calories`
- `protein`
- `carbs`
- `fat`
- optional `fiber`
- optional `sugar`
- optional `sodium`

The backend, not Gemini, adds `source: "ai_estimate"`, `trustLevel: "low"`,
and `nutrients: {}`. Strict validation rejects missing calories/protein/carbs/
fat, negative values, non-integer calories/sodium, unknown fields, and any
micronutrient-like output. Simple mode exposes only the main nutrient editor.
Complex mode does not show AI-generated micronutrients; detailed nutrients
remain trusted/manual only.

Gemini failure handling is separate by failure class. The provider collects
all text parts from all candidates, handles fenced JSON and prose around JSON,
extracts balanced JSON objects, and returns the first object that validates.
Upstream 429/503 responses are temporary AI unavailable errors, not invalid
JSON. HTTP 200 invalid or unparseable model output is handled separately.
HTTP 200 responses with `finishReason: "MAX_TOKENS"` and no text are reported
as cut off; Phase 12.6 increased nutrition estimate `maxOutputTokens` from
256 to 768 and shortened the prompt to reduce that failure mode.

Manual validation for the final branch confirmed:

- `banana` returns `TRUSTED_NUTRITION_AVAILABLE`
- `eggs` returns `TRUSTED_NUTRITION_AVAILABLE`
- `homemade Ghanaian palm nut soup` returns a low-trust AI estimate
- on iPhone, `2 eggs, toast, banana` resolves through trusted review
  candidates
- on iPhone, homemade/custom unresolved food can use an editable low-trust AI
  estimate
- saving an AI estimate creates a FoodLog snapshot, not a reusable FoodItem

### Phase 12.7 Food Coverage And Candidate Ranking

Phase 12.7 improves trusted food coverage and candidate ranking before adding
more AI authority. Normal search, AI parse retrieval, and AI-estimate trusted
candidate rechecks share deterministic lexical scoring. Ranking uses exact and
singular/plural phrase matches, meaningful-token coverage, requested preparation
terms such as `boiled`, `scrambled`, `cooked`, `grilled`, `raw`, and `plain`,
nutrition completeness, serving usability, and source/user intent signals.
High-quality generic USDA rows may outrank weak local, cached, or branded rows
for unbranded common-food queries.

Lexical relevance is identity-first. Query tokens are separated into core food
tokens, preparation/form modifiers, generic stopwords, negative descriptors,
and applicable brand terms. A candidate must match a core food token to be
relevant; modifiers such as `boiled` and `cooked` are only bonuses after that
gate. High confidence requires the full core-food identity, including both
`peanut` and `butter` for peanut butter. Meaningful non-state terms in compound
foods are identity-bearing: `sweet potato`, `rice noodles`, `egg sandwich`,
`whole milk`, `oat milk`, `steak sauce`, and `banana pudding` must match their
complete requested identity before they are selection-eligible. A partial head
match can remain visible at low or medium confidence, but cannot auto-select or
block AI estimate fallback. The lexical `sweet potato`/`yam` equivalence is
handled without introducing a broader food ontology. These rules also prevent
modifier-only rows such as cooked kale from being returned for cooked rice or
boiled egg.

Core relevance alone is not high confidence. High confidence also requires a
strong phrase or food-name-head match, requested-form agreement, and default
food suitability. A small deterministic food-intent profile distinguishes
`visibleRelevant` from `selectionEligible`: raw, dry, and other imperfect
forms can remain visible, but cannot be auto-selected by AI parse or block AI
estimate fallback unless the user requested that form. A plain `rice` query
therefore prefers cooked/plain rice while keeping dry rice, snacks, cakes,
crackers, or flour lower. The same default preference applies to fluid milk,
plain Greek yogurt, cooked/plain chicken breast, whole cooked egg, cooked
protein/fish, and plain peanut butter. Raw/fresh fruit is already an edible
default.

Negative descriptor handling is category-aware rather than a universal word
ban. Unrequested terms such as `dehydrated`, `dried`, `powder`, `powdered`,
`flour`, `baby`, `infant`, `toddler`, `restaurant`, `fast food`, `school`,
`commercial mix`, and `prepared meal` are scored down, but requested terms
override the penalty. Queries such as `dried apple`, `protein powder`, `raw
apple`, and `cooked rice` should prefer the requested form. Milk can match
fluid/beverage-style generic USDA rows. Rice and oats prefer cooked/plain rows
when the query implies ready-to-eat food while keeping dry/raw candidates
visible. Chicken breast prefers breast/meat/plain rows over prepared meals,
breaded products, sauces, or restaurant items. Greek yogurt prefers plain Greek
yogurt without over-penalizing normal yogurt/dairy descriptors.

Other form conflicts such as flour, crackers, candy, chocolate, breaded,
lunchmeat, chips, melon, pepper, and rolls are likewise penalties only when
unrequested. The search may return fewer than its limit when the alternatives
are not core-food relevant instead of padding the result list with junk.
Snack/cake/cookie/sandwich/cereal, deli, prepackaged, honey-glazed, and
unrequested fruit or vanilla flavors follow the same rule. Explicit queries
such as `rice cakes`, `rice crackers`, `milk chocolate`, `banana chips`,
`peanut butter cookies`, `rice noodles`, `egg sandwich`, `steak sauce`, and
`breaded chicken` override their matching form penalty. For a milk identity,
whole fluid milk outranks yogurt, buttermilk, evaporated milk, desserts, and
other unrequested dairy forms.

The AI estimate fallback remains last-resort only. A trusted candidate must be
selection-eligible, not merely medium confidence, to auto-select during AI
parse or block an estimate. This prevents rows such as `Bread, egg, toasted`,
raw chicken, dry rice, raw steak, and raw/frozen egg products from becoming
implicit defaults for plain edible-food queries. Explicit requests such as
`raw chicken`, `dry rice`, `raw egg`, `egg white`, and `raw steak` override
that rule. Canadian Nutrient File, improved Open Food Facts text search, and
commercial APIs can be evaluated later.

USDA enrichment is intentionally bounded for mobile latency. The backend
preserves USDA search relevance when it collects metadata, then applies the
same edible-default and foreign-head checks before fetching details. It fetches
only a small top window with bounded concurrency, short per-detail timeouts,
and an overall enrichment budget. Normal food search uses a smaller/faster
budget than AI parse and AI estimate trusted-candidate rechecks. Failed, 404,
or timed-out USDA detail rows are skipped and are never treated as loggable
trusted candidates. If USDA is slow, endpoints return partial usable candidates
instead of waiting for every possible detail result.

The initial detail window is identity-ranked. If its relevant detail rows are
unloggable or fail and the requested count is still unmet, retrieval may
backfill from additional core-relevant USDA metadata while the same endpoint
budget remains; modifier-only metadata is never used as backfill.

When primary metadata lacks two strong edible-default rows, retrieval may make
one bounded intent fallback query within the same endpoint budget. Metadata is
evaluated for default suitability without requiring detail nutrients, because
nutrition is not present until the detail stage. Examples include `rice ->
cooked plain rice`, `eggs -> egg cooked`, `boiled egg -> egg cooked boiled`,
`scrambled eggs -> egg cooked scrambled`, `chicken breast -> chicken breast
cooked`, `steak -> beef steak cooked`, `salmon -> salmon cooked`, `oats <->
oatmeal`, and `milk -> fluid milk`. The original query remains the final
ranking intent. Explicit forms either retain their original query or use a
form-preserving fallback such as `breaded chicken -> chicken breast breaded`;
they never expand away from the requested form. Potato uses only `cooked
potato` as its standard fallback; it never performs a second `baked potato`
request in the same search. There is no public `searchDepth` parameter yet.

Candidate adequacy is checked before spending that one fallback. A technically
relevant result is inadequate when it is primarily a product, composite, or
non-default form for the profile, such as rice noodles or rice with milk for
plain rice, malted milk for milk, steak sauce for steak, or oat bran/oat milk
for oats. Ranking remains deterministic and the original query remains the
display and final-ranking intent. Empty USDA metadata responses are not cached,
so a transient empty result cannot make a later warm-cache retry empty.

USDA lookup also uses process-local in-memory caching only. Search metadata is
cached by normalized query for tens of minutes; successful normalized detail
records are cached for roughly a day; 404 misses are cached for under an hour;
timeouts are cached only briefly. Ranking still runs fresh per request, so the
cache stores source/normalized data rather than a final ranked list.

One logical enrichment may issue the primary USDA metadata query plus at most
one bounded fallback metadata query. The logical allowance remains 20
enrichments per limiter window; because each enrichment can make at most two
metadata searches, metadata traffic is capped at 40 calls per window. This
prevents a fallback from prematurely exhausting the logical search allowance.
Detail enrichment remains bounded by its existing concurrency, timeout,
detail-window, and total-budget controls. No unbounded retry or serial detail
fetch behavior was added.

The same identity, adequacy, confidence, and `selectionEligible` rules are
used by normal search, AI parsing, and trusted-candidate checks before an
AI-estimate fallback. AI parsing does not simply accept the first lexical
match; it may return `needs_review` when several plausible trusted candidates
remain. A foreign-head composite such as `Bread, egg, toasted` is not selected
for eggs, while `egg white` is eligible when explicitly requested. The test
`2 eggs, toast, banana` produces separate candidate groups. Low-trust AI
nutrition remains available only after trusted retrieval finds no
selection-eligible candidate. AI estimates are unlinked FoodLog snapshots and
never populate trusted FoodItem or USDA caches.

Phase 12.7 final validation passed with Node `v22.23.0`, pnpm `10.34.3`, and
PostgreSQL database `food_tracker_test`: format check, lint, typecheck, build,
and the full suite (13 test files, 326 tests). `git diff --check` passed and
the forbidden native/package/config/environment/Prisma scans produced no
output. API terminal smoke, mixed regression/out-of-sample testing,
compound-identity holdout testing, and physical-phone smoke testing also
passed. Representative holdouts included `sweet potato`, `rice noodles`,
`egg sandwich`, `whole milk`, `almond milk`, `chicken sandwich`, `whole wheat
bread`, `brown rice noodles`, `baked sweet potato`, and `turkey sandwich`,
alongside the core banana/rice/eggs/milk/chicken breast/steak/salmon/oats/
potato/Greek yogurt/peanut butter queries. Cold and warm-cache behavior stayed
stable with no empty results or request errors.

Remaining limitations are non-blocking targeted follow-up: USDA secondary
ordering and naming can be imperfect; generic banana can still rank dessert
products below raw banana; generic eggs can prefer prepared scrambled/omelet
variants; generic sweet potato can include processed products; breaded chicken
can still rank meatless breaded products too highly; unknown foods outside the
small deterministic profile set primarily use lexical ranking; public
expanded search/show-more remains deferred; and semantic typo handling,
embeddings, vector search, recipes, and additional providers remain out of
scope. These should be future targeted search-quality work, not an extension
of Phase 12.7.

### Phase 12.8 Serving Intelligence

Phase 12.8 should add safer serving and household-unit conversion for entries
such as `1 egg`, `2 eggs`, `1 slice`, `1 cup`, and `100 g`. The app must
preserve honest review states when conversion is uncertain and must not imply a
precise gram conversion without a trusted basis.

### Phase 12.9 Recipes And Mixed Meals

Phase 12.9 should address homemade meals, ingredient-based logging, reusable
recipes, and mixed-meal review. Recipes should reuse trusted ingredient data
and should not let AI become the nutrition source of truth.

### Phase 13 Custom Food Library

Phase 13 should improve personal food-library behavior: saving adjusted logs as
reusable custom foods when safe, improving saved/recent reuse, adding default
serving preferences, and keeping trusted global foods separate from
user-created custom foods.

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
