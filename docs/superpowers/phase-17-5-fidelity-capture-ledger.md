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
