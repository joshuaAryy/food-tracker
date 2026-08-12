# Phase 17.5 fidelity capture ledger

## Capture basis

All nodes below were inspected with `get_design_context` from Figma file
`GFLStsF0ADwaizoVKGeLny` before fixture work began. R0.1 supplies canonical
fixture contracts and the explicitly named screen regressions below. A
`fixture-contract only` mapping is deliberately not a claim that the current
screen renders that final Figma state; later recovery tasks own those render
implementations and visual captures.

| Node | Final reference | Concrete observation | Current-code discrepancy | R0.1 assertion mapping |
| --- | --- | --- | --- | --- |
| `517:73` | Handoff contract | Unknown and unlogged remain gaps; completeness, metric coverage, references, forecasts, and hydration are independent. 320pt reflows and stale refresh retains committed UI. | Insights still renders its existing flat report sections. | `analytics-fixtures.test.ts`: gap, capability, reference, and state-contract assertions. |
| `524:21` | Final-node index | Approved nodes include Simple/Complex Insights, detailed Trends, water, range, compare, saved views, and final state masters. | No node-to-test ledger existed. | This ledger; each listed node has an explicit fixture or test mapping. |
| `490:21` | Complex Insights / 320 | Compact overview retains hierarchy, 1,846 kcal average, macro/nutrient/weight facts, and completeness. | R0.1 does not render the Complex overview at 320pt. | `analyticsFixtureLayouts.compact320` fixture-contract only. |
| `490:319` | Calories Trends / 320 | `JUL 6 – AUG 4`; selected `Jul 29` is `2,490 kcal · Complete day`; coverage is `27 logged · 21 complete · 3 partial · 3 unlogged`, with 22 numeric days inside the usual range. | Existing Trend test previously supplied an Aug 1–7 response. | `trend-detail.test.tsx` renders `caloriesTrendFixture` at 320pt and asserts its JS-owned 280pt inspection-control width; fixture test asserts dates, states, range membership, selected point, and 1,846 average. |
| `492:21` | Insights / Large Type / 390 | Large Type preserves report facts while content grows vertically. | R0.1 does not render the Insights overview under a font-scale fixture. | `analyticsFixtureLayouts.largeType390` fixture-contract only. |
| `492:319` | Calories Trends / Large Type / 390 | Large Type keeps controls, selected-day facts, coverage, and contributors readable. | R0.1 cannot prove native visual type scaling, reflow, or final Figma composition. | `trend-detail.test.tsx` supplies the Large Type input, asserts native text scaling is not disabled, confirms content remains under the production scroll container, and checks the JS-owned 350pt inspection-control width. This is not a native visual-layout claim. |
| `477:21` | Loading skeleton | Shows `Insights` and `Month · Loading analytics`, never zero-filled analytics. | Current skeleton remains generic. | `analyticsStateFixtures.loading` fixture-contract only. |
| `510:437` | Refresh pending | Retains 1,846 kcal committed analytics while refreshing. | Current refresh behavior is not a final-node visual match yet. | `analyticsStateFixtures.refreshPending` fixture-contract only. |
| `510:467` | Refresh failed / stale | Keeps earlier analytics and exposes refresh failure/retry. | Current error copy is not final-node matched. | `analyticsStateFixtures.staleCached` fixture-contract only. |
| `495:21` | First-use analytics | Today has one meal, `612` kcal, `38 g protein`, and a `2 / 7 days` unlock state. | The current flat Insights section cannot compose the final one-meal/unlock node in R0.1. | Fixture test asserts all four facts, summaries, and kcal/g reference units. `insights-pinned.test.tsx` only proves the existing flat section path renders 612.0 kcal and 38.0 g; it does not claim final one-meal/unlock composition. |
| `492:455` | Current period in progress | In-progress logging is distinct from completeness and metric coverage. | Current screen lacks this final-state presentation. | `analyticsStateFixtures.currentPeriodInProgress` and the fixture contract preserve the state boundary only. |
| `492:753` | Section error | A failed area leaves energy, macro, nutrient, and consistency content available. | Section-aware rendering is not R0.1 production scope. | `analyticsStateFixtures.sectionFailure` fixture-contract only. |
| `477:141` | Full analytics unavailable | Full outage is retryable while food, weight, and water logging remain available. | Current report-level error does not match final copy. | `analyticsStateFixtures.fullUnavailable` fixture-contract only. |
| `492:1058` | Forecast unavailable | Forecast is hidden when stable coverage is insufficient; historical data is not fabricated. | Final forecast presentation is later work. | `analyticsStateFixtures.forecastUnavailable` and fixture test assert `unavailable`; no final-node render claim. |
| `492:1097` | Active scrub | Selected `Jul 29` has stable `2,490 kcal · Complete day`; focus does not change the reference. | Current chart test does not start from this final selected state. | `analyticsStateFixtures.activeScrub` and fixture test assert the exact selected date/value in the canonical response. |
| `492:1279` | Offline cached analytics | Cached report remains visible with an offline timestamp/state. | Current cache UI is not final-node matched. | `analyticsStateFixtures.offlineCached` fixture-contract only. |
| `490:550` | Log Water / 320 | Presets are 250/350/500/750 mL; only explicit drinks count; targets remain about 44pt. | No R0.1 Log Water render assertion. | `waterLogFixtures` fixture-contract only; explicit-log typing is validated by the existing water regressions. |
| `490:455` | Custom range / 320 | Inclusive history bounds, day precision, automatic aggregation, no future dates. | No R0.1 custom-range visual assertion. | `savedViewTrendQueryFixture` fixture-contract only; existing custom-range regression remains unchanged. |
| `490:496` | Compare picker / 320 | Compatible metrics can link, normalize, or use honest separate scales. | No R0.1 compare visual assertion. | `analyticsStateFixtures.complexCapabilities` fixture-contract only; Simple exclusions are asserted in the fixture test. |
| `492:1236` | Saved views long name / 320 | A pinned view has a long name; reordering changes only library order. | No R0.1 saved-view visual assertion. | `longSavedViewFixture` and fixture test assert the long-name source; existing saved-view regression remains unchanged. |

## R0.2 section-aware contract inspection

All seven R0.2 nodes were re-inspected individually with
`get_design_context` before contract or reducer implementation. The table
below records the concrete boundary gap against the implementation at task base
`84dda7b`.

| Node | Contract evidence from final reference | Concrete task-base discrepancy | R0.2 contract consequence |
| --- | --- | --- | --- |
| `517:73` | Refresh keeps committed UI until a validated replacement is ready; one section failure never destroys successful sections; offline uses cached analytics with a timestamp. | `CanonicalInsightsResponse` contains only raw trend values and `AnalyticsResource<T>` owns one all-or-nothing value, error, and status. Neither can represent section-owned pending, stale, error, or retry state. | Add a versioned section-result envelope and a separate report resource with per-section committed state while leaving the v1 live resource unchanged. |
| `524:21` | The exact state masters are `510:437`, `510:467`, `492:753`, `477:141`, and `492:1279`; hidden drafts are not authoritative. | The existing ledger maps those nodes to R0.1 fixtures, but no stable section-aware presentation boundary exists for later R1 components. | R1 must consume the new report/section state interface before R10 changes the network source. |
| `510:437` | “Refreshing committed analytics” keeps the earlier 1,846 kcal card visible and interactive; nothing clears before validation. | The whole-report reducer preserves its single committed value, but it cannot mark individual sections pending or express a section-owned retry without treating the report as one replacement. | Canonical refresh marks committed sections pending without clearing any sibling and uses request generations to reject older completions. |
| `510:467` | A rejected refresh keeps earlier interactive analytics, shows their prior timestamp, and offers Retry. | Whole-report failure can retain the old v1 report as stale, but a mixed refresh cannot commit successful sibling replacements while retaining only a failed section as stale/error. | Mixed-result merge replaces successful sections and retains only failed prior sections as stale/error; absent failed sections become unavailable. |
| `492:753` | A failed Weight area is local and retryable while Energy, Macros, Hydration, and Consistency remain available. | V1 sections are raw `CanonicalTrendResponse` values, the API route uses rejecting `Promise.all`, and the mobile resource has no section failure variant. | Define strict `available`/`failed` results with a generic public error and a section Retry intent that may launch the canonical whole-report request without blanking siblings. |
| `477:141` | An unreadable/invalid analytics snapshot is a full report failure; logging remains safe and available. | Parser/auth/network/global failures currently flow through the same single resource error string and cannot be distinguished from a future section outcome at the stable presentation boundary. | Malformed envelopes and global failures remain report-level and never become an empty or partially successful report. |
| `492:1279` | Offline mode keeps the full cached report visible and identifies when it was last updated. | The existing cache safely partitions by UID and preserves atomic replacement, serialization, purge barriers, and stale timestamps, but only v1 keys `insights-week` and `insights-month` exist. | Add distinct `insights-v2-week`/`insights-v2-month` keys; validate any v1 success before adapting it and never overwrite a v1 entry in place. |

## Screenshot acceptance checklist

- Render the real canonical response at 390pt, 320pt, and 390pt Large Type;
  preserve hierarchy and about 44pt targets.
- Preserve complete, partial, unlogged, and in-progress logging states without
  converting missing metric data into a logging-state change.
- Preserve recorded, partial, and unknown metric coverage with unknown as a
  gap, never zero.
- Keep true-range, one-bound, and no-bound references semantically distinct.
- Keep sparse Vitamin D sparse, do not fabricate unavailable forecasts, and do
  not let scrub focus mutate a reference.
- Keep healthy committed data visible during stale, refresh, section-error, and
  offline states; use retry affordances without internal diagnostics.
- Verify explicit-drink hydration, long saved-view wrapping, and Simple-mode
  exclusion of Complex-only controls.

## R0.1 correction note

The canonical Calories fixture is one coherent `JUL 6 – AUG 4` response:
`today` is Aug 4 and remains `in_progress` even though its logging state is
unlogged and metric availability is absent. It contains the Figma coverage
states (21 complete, 3 partial, 3 unlogged), 22 numeric days inside the
declared usual range, two outside days including Jul 29 at 2,490 kcal, and a
24-value average of exactly 1,846 kcal. The first-use fixture is independent
of that period and preserves its real one-meal 612 kcal / 38 g protein and
2-of-7 unlock facts with kcal/g reference units.

## R1.1 Simple Insights implementation inspection

The following final nodes were re-inspected individually with
`get_design_context` from Figma file `GFLStsF0ADwaizoVKGeLny` before the
Task 3 production implementation. The discrepancies below are against the
current branch at `f036184`.

| Node | Final reference evidence | Concrete current-code discrepancy | R1.1 consequence |
| --- | --- | --- | --- |
| `338:98` | The 390pt Simple overview is an ordered scroll composition: period header; This week/month summary; Energy balance card with compact embedded trend and trend entry; Macro balance card with donut, rows, and protein trend; Nutrient highlights; Weight direction; Logging consistency; Hydration; and a separate recommendations area. Cards are 350pt wide with quiet bordered, rounded surfaces and section headings. | `insights.tsx` renders `CanonicalInsightsContent`, which maps `Object.values(report.sections)` into identical divider rows with a rounded average and generic `View <metric> trend` navigation. It has no composed summary, no ordered Simple hierarchy, no compact chart treatments, no hydration card, and no card-local failure boundary. | Replace the flat presentation only for Simple with explicit, ordered section components driven by section state; keep its data values canonical rather than the Figma sample values. |
| `492:753` | A Weight-local failure is a 250pt card beneath the Weight direction heading: `Weight couldn’t load`, safe explanatory copy that names still-available sibling areas, and a 44pt `Retry weight` action. Energy, macros, nutrients, hydration, and consistency remain mounted. | The live route uses `AnalyticsResource<CanonicalInsightsResponse>` and a single report-level `ErrorState`; `CanonicalInsightsContent` receives raw sections, so it cannot render a local error/retry while retaining sibling cards. | Route Simple through the R0.2 report resource and validated v1 adapter; use an `AnalyticsSectionError` boundary per owned card and dispatch canonical-request section retry without unmounting siblings. |
| `510:437` | Refresh pending preserves the earlier Energy balance card (`1,846 kcal` in the reference) as interactive content. A compact state surface says `Refreshing…` and explains that no analytics clear before validation. | Legacy refresh toggles a report-wide `refreshing` state and the generic content has no section state or refresh-pending treatment; it cannot represent retained committed sections as pending. | Preserve mounted card data from R0.2 during refresh and render a non-destructive refresh notice; do not fabricate the reference value. |
| `510:467` | Refresh failure keeps the earlier interactive Energy balance card visible, identifies that earlier analytics are being shown, provides `Couldn’t refresh` copy with prior-time context, and exposes `Retry` plus `Keep viewing`. | The route replaces this with a generic report-level `ErrorState` and does not expose R0.2 stale provenance or a composed stale surface alongside retained cards. | Render safe stale/refresh failure copy beside the retained Simple composition and use the canonical retry callback; leave staging diagnostic handling unchanged for R12. |

## R1.0a v2 overview-contract reinspection

Before Task 3A contract work, final node `338:98` was re-opened with
`get_design_context` from Figma file `GFLStsF0ADwaizoVKGeLny`. This entry
records the information boundary required by that node; it does not authorize
new presentation work or copy the illustrated values into product data.

| Overview group | Authoritative facts required by the node | Capability and failure boundary |
| --- | --- | --- |
| Period summary | Resolved displayed period, logged and eligible-day counts, streak, current-day phase, and consistency interpretation. | These are backend facts; the mobile client may format them but must not derive counts, streak, phase, or interpretation. |
| Energy | Period average, target or range context, within-range count, and previous-period comparison/status. | This is a report summary distinct from the Calories trend section; a group failure is local and must not erase the core trend result. |
| Macros | Period protein/carbohydrate/fat grams and percentages with backend-owned status. | Protein’s detailed trend remains a core section; overview composition does not calculate percentages on mobile. |
| Nutrient highlights | Exactly Fiber, Sodium, and Vitamin C, each with identity, value and unit, availability, reference, and status. | They are overview-only, non-navigable Simple highlights; they do not extend `SIMPLE_ANALYTICS_METRIC_KEYS` or authorize nutrient routes. |
| Hydration | Today total under the backend timezone policy, goal, progress/status, and the relationship to the canonical hydration trend. | A hydration outcome failure is local and cannot remove healthy overview or trend outcomes. |
| Weight | Current value, change/direction, goal-path status, reference context, and an independently resolved forecast. | Base Weight facts and forecast are separate outcomes; a forecast failure remains inside Weight and cannot erase base Weight facts. |
| Logging consistency | Complete, partial, and unlogged counts; in-progress distinction; streak and eligibility facts; and heatmap/report facts. | Logging completeness remains separate from metric availability and is backend-owned. |
| Recommendations and Explore | The node presents a separate recommendations area and an Explore-all-trends entry. | Neither is an overview analytics outcome in Task 3A; this task adds no recommendation facts, new endpoint, or navigation capability. |

The overview map must therefore support independent `available` and `failed`
outcomes for its seven groups, while malformed envelopes and global request
failures remain report-level. Unknown values remain gaps, not zeroes.

## R12.2 automated recovery gate — 2026-08-12

**Automated recovery: COMPLETE.** The final recovery gate ran under Node
`v22.23.0` and pnpm `10.34.3`. Docker Desktop was available, the existing
`food-tracker-postgres` container was accepting connections, and the dedicated
`food_tracker_test` database existed before validation. The explicit test
database migration deployment found all 14 committed migrations applied and no
pending migration; no Prisma schema or migration was created by this recovery.

The final automated evidence is:

- Prisma generate and validate: passed.
- Shared build and typecheck: passed.
- API typecheck, lint, build, and test: passed; API Vitest ran 93 files and
  1,169 tests against `food_tracker_test`, with no failures or skips.
- Mobile Vitest: passed; 49 files and 354 tests.
- Mobile Jest/RNTL: passed; 47 suites and 130 tests.
- Root typecheck, lint, build, and test: passed; root test reran the API
  suite with 93 files and 1,169 tests against `food_tracker_test`.
- `git diff --check`: passed.
- The scoped Release/mobile source scan found no `Diagnostic:` formatter,
  `api_insights_resolved`, `report_commit_dispatched`, or
  `cache_write_failed` client path. Existing request-generation fields are
  reducer state only; safe diagnostics are development-only console output;
  and internal server codes map to generic user copy.
- Prettier passed for all tracked Phase 17.5 source and documentation files.
  Repository-wide `format:check` remains intentionally red only for 20
  pre-existing untracked agent-workflow artifacts under `.agents/` and
  ignored `.superpowers/sdd/`; those artifacts were preserved.

The section-isolation and contract coverage ran in the API suite, including
Calories, Protein, Carbs, Fat, Macro Composition, Weight, Hydration, Logging
Consistency, overview outcomes, optional-resource outcomes, v1/v2 contract
validation, and malformed/global report failures.

**Physical standalone iPhone acceptance: PENDING USER VALIDATION.** This
automated record is not a claim of a standalone build, signing, installation,
or iPhone operation. **Phase merge: NOT AUTHORIZED.**
