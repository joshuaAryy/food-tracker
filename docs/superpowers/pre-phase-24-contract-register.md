# Pre-Phase-24 Product Contract Register

This register is the Stage-0 reference for the whole-product regression sweep.
It records the behavior that acceptance evidence must prove; implementation and
existing tests are evidence sources, not higher authorities.

## Authority and evidence

Correctness is resolved in this order: canonical rules in the execution
objective; later accepted Food Tracker behavior; current authoritative specs,
contracts, and decision documents; normal product conventions; implementation;
then existing tests. A build, HTTP 200, rendered component, or passing unit
test never proves a complete product journey. A Simulator PASS requires real
launch, actions, observed UI state, and persistence checks where applicable.

The validated source baseline for the current staging evidence is
`14c0472c1aeb59abe75e4f0cf8507dd70e74a98a`. The active branch is
`pre-phase-24-product-regression-debugging`; later documentation-only commits
must not be treated as application-source changes. The latest
application-code validation candidate is `1a52472`; subsequent checkpoints
contain only evidence documentation. Current-HEAD staging reprovenance remains
pending the Railway provider window.

## Canonical behavior register

| Area | Authoritative rule | Required proof | Superseded or deferred wording |
| --- | --- | --- | --- |
| Modes | `Simple` and `Complex` are views of one backend, domain, history, and user state. Simple exposes low-friction core tracking; Complex exposes deeper controls and nutrient detail. | Create data in Simple, inspect it in Complex, edit, return to Simple, and verify one canonical record set. | Do not reintroduce `Detailed`; visual differences belong to Phase 24. |
| Historical nutrition | FoodLog snapshots are immutable authority. FoodItem, provider, reference, search-index, recipe, or later correction changes cannot rewrite old nutrition. FoodLog editing cannot mutate the canonical FoodItem. | Create/read old logs after source edits; compare persisted snapshots and downstream History/analytics. | Missing nutrients are not repaired by UI coercion. |
| Nutrient states | Numeric, explicit `0`, and `Unknown`/null/absent remain distinct through save, reopen, History, and analytics. Unknown is never zero; unlogged is not zero. | Complex correction journey plus sparse analytics fixtures and source-observation checks. | Do not fabricate ranges, coverage, or values. |
| Onboarding and goals | No welcome detour. Lose/Gain allow 0.50–2.00 lb/week in 0.05 steps with no age gate. Maintain stores `targetRateLbPerWeek = null`. Selected rates are retained even when safe-rate/calorie-floor constraints limit a forecast. | Startup routing, all rate values, Maintain, edits, failed saves/retry, and historical-log preservation. | Older age gates, stale rate rules, and unsupported future analytics are not authoritative. |
| Targets | Effective priority is user override > personalized/reference > derived > missing. Missing is not zero. `Use Recommended` removes the override without erasing the recommended truth. | Set, reopen, reset, propagate to analytics/reference context, and compare source values. | Presentation polish is deferred; functional priority errors are in scope. |
| Search and food authority | Postgres FoodItem/provider data is nutritional authority. Pinecone/search infrastructure only supplies candidates. Ranking evaluates identity, form/preparation, query interpretation, source quality, completeness, serving usability, and selection safety. A result must be loggable. | Query classes spanning exact, plural, typo, preparation, generic/branded, compound, ambiguous, custom/saved/recent, incomplete, and provider-diverse data; then Search → log → History → Insights. | Do not treat relevance-only results or Pinecone as nutrition truth. |
| AI text logging | Natural language is parsed, trusted retrieval runs, bounded candidate/serving/context evidence returns, adequacy is judged, and each component becomes trusted, review-required, or minimally scoped fallback-eligible. Gemini is not nutrition authority; server validation has final authority. | Named corpus plus at least 40 meaningful variations, request-boundary evidence, editable review, partial fallback, provider failure, and `1 apple` recovery through the real UI. | The planning gap was a hypothesis until proven. Execution proved and fixed the missing evaluation boundary in `AI-RAG-001`; no broad RAG/agent rewrite is authorized. |
| Serving | Deterministic backend serving resolution is authoritative. Trusted count semantics may resolve `2 eggs`; an unsupported volume relationship such as `1 cup cooked rice` remains review-required. Preview nutrition must equal the saved FoodLog snapshot. | Quantity/unit changes, candidate replacement, alternate servings, unsupported units, preview/persistence comparison, and duplicate-submit protection. | `servingWeightGrams` is not universal density. |
| Barcode and photo | Barcode normalization/cache-first/provider fallback and photo preprocessing/review are final features. Photo processing preserves orientation rules, max edge/size/quality constraints, library originals, and explicit row disposition. | Unknown/offline barcode recovery; portrait/landscape/HEIC/no-food/ambiguous/partial photo rows; atomic save and retry. Device-specific camera/scanner/library evidence is physical. | No notification/APNs or new provider work. |
| Food Library | Saved, My, Recent, and Archived views reuse the canonical food domain. Recent is a usage view, not a second database. Archive/restore/default-serving behavior must work in logging, recipes, and mixed meals. | Library mutation plus consumer flows and historical snapshot checks. | Cosmetic Library redesign is Phase 24. |
| Recipes and Mixed Meals | Recipes are user-owned reusable compositions with ingredient snapshots; edits affect future use only. Mixed Meals are one-off composed results with atomic persistence and immutable History. | Create → log → edit recipe → old History unchanged → new log updated; mixed-meal preview/edit/retry/double-submit journeys. | Do not invent new recipe or meal features. |
| Hydration and weight | WaterLog is water-only, shared by Simple/Complex, with amount/time, Other Amount, quick-add, edit/delete/Undo where implemented. Food water does not silently count. Weight uses implemented local-date semantics and feeds intended analytics/goal consumers. | Multiple entry points, local-day boundaries, edit/delete/Undo, mode switching, refresh, and trend propagation. | No supplements or drink taxonomy. |
| Analytics and recommendations | Analytics are deterministic backend facts. Test complete/partial/missing/unknown/zero/sparse/in-progress states, ranges, comparisons, contributors, references, saved/pinned views, cache, and forecast eligibility. Recommendations are bounded, deterministic, stable, dismissal-aware, and mode/target/log dependent. | Independently calculate source facts; verify date/coverage denominators, no fabricated forecast, stable identities, and downstream state changes. | Typography, spacing, chart aesthetics, and hierarchy are Phase 24. |
| Auth and ownership | Firebase identity and server authorization remain separate. Test signed-out/bootstrap, email/password, Google where supported, relaunch/background/foreground/sign-out, invalid states, account switching, and ownership isolation. | Dedicated QA A/B/C only: A functional seed, B independent recognizable account, C explicitly disposable deletion account. | Apple Sign-In provisioning is excluded. Never substitute an everyday account. |
| Time and recovery | Storage is UTC; product day is user-local. Every failure path must avoid crashes, infinite loading, duplicate mutation, corruption, false certainty, or trapped state. Uncertain mutations require reconciliation before retry. | Midnight/date ranges/timezone checks plus controlled transport/auth/validation/response-loss/stale-response failures. | Do not redesign Railway scale-to-zero; controlled cold start is intentional. |

## Authorized accounts and external gates

Use only dedicated Firebase-linked QA A and B plus explicitly disposable QA C.
Preserve all everyday/personal accounts. Missing approved identities block only
the dependent rows; independent automated and signed-out work continues.

Codex may deploy a verified committed candidate only to the existing Railway
`food-tracker-staging-api` staging service. Record exact source SHA, deployment
ID, served provenance, and cold-start timestamps before using staging evidence.
Production deployment/data mutation, PR creation, merging, force-push, and
branch changes are outside authority.

Physical iPhone acceptance is a final user-owned gate for real camera, barcode,
photo-library/HEIC, permissions, touch/keyboard reachability, device launch,
and representative logging. It does not require repeating the Simulator matrix.

## Phase-24 boundary and exclusions

“Ugly is Phase 24. Unusable is debugging.” Defer spacing, typography, colors,
card design, hierarchy, animation, chart aesthetics, and other cosmetic issues.
Fix verified keyboard/reachability, clipping/scroll, editability, modal traps,
and missing recovery actions. Notifications/APNs, Apple provisioning,
supplements, drink taxonomy, new provider portfolios, speculative architecture,
new product features, production, App Store/TestFlight/EAS, and standalone
Android acceptance remain excluded unless an unrelated build/runtime failure
requires diagnosis.
