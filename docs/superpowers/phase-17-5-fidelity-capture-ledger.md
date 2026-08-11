# Phase 17.5 fidelity capture ledger

## Capture basis

All nodes below were inspected with `get_design_context` from Figma file
`GFLStsF0ADwaizoVKGeLny` before fixture work began. This ledger records the
visual/state facts that the R0.1 fixtures preserve; it does not declare the
later production recovery work complete.

| Node | Final reference | Concrete observation | Current-code discrepancy | Fixture/test mapping |
| --- | --- | --- | --- | --- |
| `517:73` | Handoff contract | Unknown and unlogged remain gaps; completeness, metric coverage, references, forecasts, and hydration are independent facts. 320pt reflows rather than scales; stale refresh retains committed UI. | `insights.tsx` currently consumes a whole-report resource and flat section rows, so it has no fixture-backed section-state contract. | `analytics-fixtures.test.ts` gap/capability assertions; all state fixtures. |
| `524:21` | Final-node index | The approved final set includes Simple/Complex Insights, detailed trends, water, custom range, compare, saved views, and state masters. | No existing node-to-test capture map. | This ledger and the screenshot checklist. |
| `490:21` | Complex Insights at 320pt | Compact width retains the report hierarchy: 1,846 kcal average, macro values, nutrient status, weight, and completeness rather than scaling them away. | No 320pt analytics layout fixture or render regression exists. | `analyticsFixtureLayouts.compact320`; future Complex overview render test. |
| `490:319` | Calories Trends at 320pt | Compact Trends preserves Configure, 7D/30D/90D/Custom, selected-day data, and `27 logged · 21 complete · 3 partial · 3 unlogged`. | The existing Trend test has one small inline response and no shared compact fixture. | `analyticsFixtureLayouts.compact320`; `caloriesTrendFixture`. |
| `492:21` | Insights Large Type at 390pt | Large Type retains the hierarchy and the same report facts while supporting vertical growth. | No explicit Large Type fixture or render regression exists. | `analyticsFixtureLayouts.largeType390`. |
| `492:319` | Calories Trends Large Type at 390pt | Large Type keeps period controls, selected-day readout, coverage, and contributors readable. | No Large Type Trend fixture exists. | `analyticsFixtureLayouts.largeType390`; `caloriesTrendFixture`. |
| `477:21` | Loading skeleton | Loading presents `Insights` and `Month · Loading analytics`, not zero-filled analytics. | Existing skeleton is generic and has no final-node fixture mapping. | `analyticsStateFixtures.loading`. |
| `510:437` | Refresh pending | Refreshing retains 1,846 kcal committed analytics and remains interactive. | Current whole-report loading state does not encode this final visual state as a fixture. | `analyticsStateFixtures.refreshPending`. |
| `510:467` | Refresh failed with stale data | Earlier analytics stays visible with `Couldn’t refresh`, `Retry`, and `Keep viewing`. | Existing error handling is report-wide rather than captured as a stale committed state fixture. | `analyticsStateFixtures.staleCached`. |
| `495:21` | First-use analytics | Early logging exposes today's recorded totals and a 2/7-day path to unlock trends. | Existing empty branch does not have a real-shaped first-use fixture. | `analyticsStateFixtures.firstUse`. |
| `492:455` | Current period in progress | Current period explicitly includes in-progress logging while retaining independent nutrient/report facts. | Existing tests do not provide an in-progress-day shared fixture. | `loggingAndCoveragePoints`; `analyticsStateFixtures.currentPeriodInProgress`. |
| `492:753` | Section error | A failed report area must not remove the successful energy, macro, nutrient, or consistency content. | No section-failure fixture exists; section-aware response work is deferred to R0.2. | `analyticsStateFixtures.sectionFailure`. |
| `477:141` | Full analytics unavailable | Full outage is retryable, while food, weight, and water logging remain available. | Existing report-level error copy is not represented by a final-node state fixture. | `analyticsStateFixtures.fullUnavailable`. |
| `492:1058` | Forecast unavailable | Forecast hides when recent data is insufficient or too variable; historical values are not forecasts. | Existing forecast policy is covered, but no shared unavailable-state fixture exists. | `analyticsStateFixtures.forecastUnavailable`; `caloriesTrendFixture.forecast`. |
| `492:1097` | Active scrub | The selected date has a stable `2,490 kcal · Complete day` readout; focus does not change the authoritative reference. | Existing chart interaction tests have no final-state fixture. | `analyticsStateFixtures.activeScrub`; future chart render test. |
| `492:1279` | Offline cached analytics | Cached report facts remain visible offline with an explicit stale timestamp/state. | Cache tests cover persistence but no final-screen cached fixture exists. | `analyticsStateFixtures.offlineCached`. |
| `490:550` | Log Water at 320pt | Presets are 250/350/500/750 mL; only explicit drinks count toward hydration; actions keep 44pt targets. | Current water test asserts only the close target; it has no shared water-log fixture. | `waterLogFixtures`; future Log Water fidelity test. |
| `490:455` | Custom range at 320pt | The range is inclusive, bounded by logged history, day-precise, and reports automatic aggregation. | Existing custom-range test uses inline route data and no shared fixture. | `savedViewTrendQueryFixture`; future range fidelity test. |
| `490:496` | Compare picker at 320pt | Comparison capability is explicit: compatible metrics may link, normalize, or use honest separate scales. | Existing Configure flow has no shared capability fixture. | `analyticsStateFixtures.complexCapabilities`; future compare fidelity test. |
| `492:1236` | Saved views long name at 320pt | A primary pinned view has a deliberately long name; reordering affects only the library, not Insights report order. | Existing saved-view tests use short inline names and no long-name fixture. | `longSavedViewFixture`; future saved-view render test. |

## Screenshot acceptance checklist

- Render the same real-shaped fixture at 390pt, 320pt, and 390pt Large Type;
  preserve readable hierarchy and approximately 44pt touch targets.
- Verify complete, partial, unlogged, and in-progress logging states without
  using metric availability to change a logging state.
- Verify recorded, partial, and unknown metric coverage with unknown rendered
  as a gap, never as zero.
- Verify true range, one-bound target, and no-bound reference semantics without
  inventing a range from a target.
- Verify sparse Vitamin D remains sparse, forecast-unavailable does not show a
  projection, and selected scrub focus does not mutate a reference.
- Verify stale/refresh/section-error/offline states retain committed healthy
  facts and present retry affordances without internal diagnostics.
- Verify the saved-view long name wraps, water fixtures count explicit drinks
  only, and Simple omits custom range, saved views, two-metric comparison, and
  the full nutrient library.
