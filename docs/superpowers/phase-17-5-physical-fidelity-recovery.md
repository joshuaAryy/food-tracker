# Phase 17.5 physical-fidelity recovery and Visual QA Workflow V2

Status: authenticated simulator source evidence is available; the in-flight
chart-continuity, scale, diversity, and fidelity correction is implemented and
the regenerated native Debug build now succeeds. The prior GestureDetector
failure and the subsequent `Cannot find native module 'ExpoAsset'` runtime
failure were both isolated; Expo prebuild, CocoaPods, and the serialized native
rebuild completed successfully. Fresh staging-Metro analytics captures are now
retained for Macro Balance and Vitamin C at the native iPhone 17 resolution.
Final visual sign-off remains open because matched 390/393pt evidence, clean
overlay-free captures, some authenticated target routes, and sparse-data chart
comparisons remain unproven.
Physical iPhone validation:
**PENDING USER RE-VALIDATION**.

## 2026-08-18 in-flight correction audit

The current correction is being evaluated against fresh exact-node Figma
captures, not the earlier zero-discrepancy screenshots. Fresh references were
downloaded to:

```text
/tmp/food-tracker-phase17-5-visual-v2/figma-fresh-2026-08-18/
```

The exact references are `338:276` Complex Insights, `338:720` Macro,
`338:605` Weight, `338:928` Logging Consistency, `426:159` Hydration, and
`425:21` Vitamin C. The fresh captures confirm the approved 390pt geometry:
large first-class detail cards, metric-specific chart layers, visible raw
observations, and non-red section accents. They supersede earlier claims that
the existing native captures were sufficient for convergence.

The signed-in iPhone 17 simulator is currently on the authenticated Logging
Consistency route. The settled UI snapshot contains the 90D report and no
render error. The simulator log does contain an earlier HTTP 401 from the
staging `setup/status` request during the authentication handoff; this is being
tracked separately from the visual correction and is not being treated as a
successful physical acceptance result.

Current correction acceptance matrix:

| Surface | Exact node | Required current evidence | Status |
| --- | --- | --- | --- |
| Complex Insights | `338:276` | fresh native before/after captures plus two independent reviews | pending rebuild |
| Macro Balance | `338:720` | 124pt-class composition, daily mix, protein trend, fresh native review | pending rebuild |
| Weight | `338:605` | raw points, sage trend, goal/forecast context, fresh native review | pending rebuild |
| Logging 30D/90D | `338:928` | intentional period-specific scale and semantics, two-pass review | pending rebuild |
| Hydration | `426:159` | blue outlined daily vessels/columns, goal line, fresh native review | pending rebuild |
| Vitamin C | `425:21` | neutral daily observations plus continuous derived trend and range styling | pending rebuild |

No API, schema, shared-contract, dependency, or production changes are
authorized by this correction. Physical iPhone validation remains a user-only
checkpoint and stays pending.

This ledger supersedes the prior zero-discrepancy conclusion in
`phase-17-5-fidelity-capture-ledger.md` based on physical-device evidence. The
historical ledger is retained.

## Workflow V2

### Authoritative reference

Figma file: `GFLStsF0ADwaizoVKGeLny`  
Final handoff: `517:73`  
Final node index: `524:21`  
Master viewport: 390pt. Responsive companion viewport: approximately 393pt.

Every target uses a fresh `get_design_context`/screenshot capture from its
exact final node. Metadata alone, older screenshots, hidden drafts, and
implementation assumptions are insufficient evidence.

Fresh Figma captures retained under the evidence root:

```text
figma/complex-insights.png
figma/macros.png
figma/weight.png
figma/logging-consistency.png
figma/hydration.png
figma/water-log.png
figma/vitamin-c.png
```

The current exact-node downloads are also retained in
`/tmp/food-tracker-phase17-5-visual-v2/final-fresh/`, including the native-size
Complex, Macro, Weight, Logging, Hydration, and Vitamin C references.

### Capture layout

Temporary evidence root:

`/tmp/food-tracker-phase17-5-visual-v2/`

Each target records:

```text
figma.png
simulator-before.png
simulator-after-1.png
simulator-after-2.png
```

Screenshots must be from the real React Native Food Tracker application using
the seeded staging QA account. Comparison is normalized to the app content
viewport; status-bar differences are excluded from geometry judgments. The
current simulator artifacts include the native launch shell, the
development-client prompt, and the rebuilt app reaching the sign-in surface:

```text
/tmp/food-tracker-phase17-5-visual-v2/simulator-launch.png
/tmp/food-tracker-phase17-5-visual-v2/simulator-metro-connected.png
/tmp/food-tracker-phase17-5-visual-v2/current.png
/tmp/food-tracker-phase17-5-visual-v2/native-rebuilt.png
/tmp/food-tracker-phase17-5-visual-v2/native-rebuilt-metro-3.png
```

The latest authenticated-access audit also captured the sign-in boundary on
both booted simulator candidates:

```text
/tmp/food-tracker-phase17-5-visual-v2/simulator-auth-audit-after-metro.png
/tmp/food-tracker-phase17-5-visual-v2/simulator-other-auth-audit.png

/tmp/food-tracker-phase17-5-visual-v2/post-onboarding-error.png
/tmp/food-tracker-phase17-5-visual-v2/post-gesture-fix-wait.png
```

The user completed onboarding on the iPhone 17 simulator. The first target
screen then failed with `GestureDetector must be used as a descendant of
GestureHandlerRootView`; the root layout now wraps the app in
`GestureHandlerRootView`, and the relaunch reaches authenticated Progress and
Insights screens without that render error. The development-client tools gear
still appears on simulator captures and is excluded from acceptance claims.
The config now sets the Expo development-client tools button off for the next
native rebuild; the current installed development client predates that native
configuration and still shows the gear.

The rebuilt native Debug app was installed and launched successfully on the
iPhone 17 simulator. An earlier authenticated Month/Complex walkthrough and
hydration section were captured after the rebuild:

```text
/tmp/food-tracker-phase17-5-visual-v2/complex-insights-current-month-native.png
/tmp/food-tracker-phase17-5-visual-v2/hydration-current-month-native.png
```

That earlier Month/Complex capture shows the intended CTA-before-tabs hierarchy,
period-summary content, macro/nutrient sections, and blue hydration vessels; it
is retained as historical evidence and is superseded for current visual review
by the post-fix captures below.
The development-client gear remains visible in the capture and is excluded
from acceptance claims.

The latest post-fix simulator evidence is retained separately. It captures the
actual authenticated Week/Complex state from the seeded account, the full
Complex hierarchy across multiple viewport positions, and a restarted Hydration
route using the seven-day default:

```text
/tmp/food-tracker-phase17-5-visual-v2/complex-insights-current-markers-after-fixes.png
/tmp/food-tracker-phase17-5-visual-v2/complex-insights-current-middle-final.png
/tmp/food-tracker-phase17-5-visual-v2/complex-insights-current-week-lower-final.png
/tmp/food-tracker-phase17-5-visual-v2/hydration-current-detail-seven-day-final.png
```

The current runtime still uses the available approximately 402pt simulator
viewport, retains the development-client gear, and contains sparse seeded data;
these are evidence limitations rather than acceptance claims.

The fresh native-resolution captures from the staging Metro session include:

```text
/tmp/food-tracker-phase17-5-visual-v2/final-fresh/macros-simulator-after-macro-native-full.png
/tmp/food-tracker-phase17-5-visual-v2/final-fresh/vitamin-c-simulator-7d-native-full.png
```

The Macro capture shows the enlarged 124pt-class composition ring, semantic
macro colors, softened daily columns, and the separate Protein preview below
the fold. The Vitamin C capture shows continuous derived trend rendering over
truthful nullable daily bars; its authenticated data state is
`Reference unavailable`, so it cannot visually reproduce the Figma reference
band until that account has an authoritative configured range.

### Geometry review

For each major card, record approximate x, y, width, height, internal padding,
heading-to-card gap, chart width, and chart height for both Figma and the
simulator. Review structural, geometry, typography, color, chart, effects, and
responsive findings separately.

Fresh Figma geometry baseline captured from the exact final nodes:

| Surface | Major geometry | Chart geometry |
| --- | --- | --- |
| Macro Balance | composition card x20/y236/w350/h300; daily mix x20/y606/w350/h280 | donut approximately 124pt |
| Weight | chart card x20/y318/w350/h372 | plot x38/y396/w272/h190 |
| Logging Consistency | heatmap card x20/y420/w350/h286 | 22 rows x 22pt cells with 8pt gaps; 292pt grid |
| Hydration | chart card x20/y330/w350/h382 | plot x38/y410/w272/h190 |
| Vitamin C | chart card x20/y318/w350/h372 | plot x38/y396/w272/h190 |
| Water Log | sheet x0/y166/w390/h734 | handle x166/y14/w58/h5; custom/time rows 62pt |

Current simulator evidence includes XcodeBuildMCP's optimized 368x800 output
and full-resolution simctl captures at 1206x2622 (3x, approximately 402x874pt).
This proves the neighboring-width runtime path but is not a matched 390/393pt
comparison. The available simulator set has no 393pt device. Approximate
post-fix observations are recorded in the target table and the remaining
responsive evidence gap is explicit. A native development-client config change
sets `toolsButton: false` for the next rebuild; the current installed client
predates that change and still shows the gear.

### Independent review

The implementer is not the sole approver. A fresh reviewer receives the exact
Figma screenshot, latest simulator screenshot, target node, and known physical
complaint. The reviewer records:

```text
Structural mismatches:
Geometry mismatches:
Typography mismatches:
Color mismatches:
Chart mismatches:
Missing effects:
Responsive issues:
Severity: Major | Moderate | Minor
```

Major and Moderate findings require a fix and a new screenshot. High-risk
surfaces require two screenshot/review passes even when the first review says
the result is close.

## Target evidence

| Surface | Final Figma node | Route | Figma screenshot | Simulator before | Simulator after | Review passes |
| --- | --- | --- | --- | --- | --- | --- |
| Complex Insights | `338:276` | Insights / Complex / Overview | `/tmp/food-tracker-phase17-5-visual-v2/figma/complex-insights.png` | `/tmp/food-tracker-phase17-5-visual-v2/complex-insights-simulator-after-gesture-fix.png` | `/tmp/food-tracker-phase17-5-visual-v2/complex-insights-current-markers-after-fixes.png`; `/tmp/food-tracker-phase17-5-visual-v2/complex-insights-current-middle-final.png`; `/tmp/food-tracker-phase17-5-visual-v2/complex-insights-current-week-lower-final.png` | 2 fresh independent reviews; compact hierarchy, title, markers, black energy trend, and macro sizing corrected; exact Month state, clean overlay-free capture, and matched 390/393pt viewport remain unproven |
| Macro Balance | `338:720` | Trends / Macros | `/tmp/food-tracker-phase17-5-visual-v2/final-fresh/macros-figma-final.png` | `/tmp/food-tracker-phase17-5-visual-v2/macros-simulator-after-gesture-fix.png` | `/tmp/food-tracker-phase17-5-visual-v2/final-fresh/macros-simulator-after-2-native-full.png` | 2 fresh native-resolution independent reviews; enlarged composition ring, Figma palette, rounded daily mix, and added section separation pass with no Major/Moderate findings; Minor roominess, seeded data, and gear-free evidence remain limitations |
| Weight | `338:605` | Trends / Weight | `/tmp/food-tracker-phase17-5-visual-v2/figma/weight.png` | `/tmp/food-tracker-phase17-5-visual-v2/weight-simulator-after-gesture-fix.jpg` | `/tmp/food-tracker-phase17-5-visual-v2/weight-simulator-current-full-final.png` | 2 independent review passes; smoothed line and sage goal label now visible, gear/viewport remain evidence limitations |
| Logging Consistency 30D/90D | `338:928` | Trends / Logging consistency | `/tmp/food-tracker-phase17-5-visual-v2/final-fresh/logging-figma-final.png` | `/tmp/food-tracker-phase17-5-visual-v2/logging-consistency-simulator-30d.jpg` | `/tmp/food-tracker-phase17-5-visual-v2/final-fresh/logging-consistency-30d-native-full-final.png`; `/tmp/food-tracker-phase17-5-visual-v2/final-fresh/logging-consistency-90d-native-full-final.png` | Final post-rebuild 30D/90D captures; final independent review approved with no Major/Moderate findings; 90D is internally coherent but lacks an approved 90D Figma frame |
| Hydration | `426:159` | Trends / Hydration | `/tmp/food-tracker-phase17-5-visual-v2/figma/hydration.png` | authenticated route not captured | `/tmp/food-tracker-phase17-5-visual-v2/hydration-current-detail-seven-day-final.png` | 2 fresh independent reviews; `‹ Overview`, seven-point presentation, and seven-day default corrected; target-state data, clean overlay-free capture, and matched viewport remain limitations |
| Water Log | `440:28` | Log Water | `/tmp/food-tracker-phase17-5-visual-v2/figma/water-log.png` | `/tmp/food-tracker-phase17-5-visual-v2/water-log-current-full.png` | `/tmp/food-tracker-phase17-5-visual-v2/water-log-current-full-after-bottom-sheet.jpg` | second fresh independent review: structural/full-width fix passes; Moderate geometry and clean-capture limitations remain because the optimized 368x800 viewport and dev-client overlay are not exact V2 evidence |
| Vitamin C detail | `425:21` | Trends / Vitamin C / Range | `/tmp/food-tracker-phase17-5-visual-v2/final-fresh/vitamin-c-figma-final.png` | `/tmp/food-tracker-phase17-5-visual-v2/vitamin-c-simulator-after-navigation-context-fix.jpg` | `/tmp/food-tracker-phase17-5-visual-v2/final-fresh/vitamin-c-simulator-after-2-native-full.png` | 2 fresh native-resolution independent reviews; continuous derived trend, truthful missing-day bars, softened grid, neutral observation layer, human-readable dates/values, and 32pt summary metric pass with no Major/Moderate findings; Minor selection/grid emphasis, unavailable reference, and matched viewport remain limitations |

### Evidence dimensions and viewport ledger

| Surface | Figma dimensions | Latest simulator dimensions | Logical viewport | Implementation / review iteration |
| --- | --- | --- | --- | --- |
| Complex Insights | 390×2760 px | 1206×2622 px | ≈402×874pt; optimized capture ≈368×800 | 2 / 2 reviews |
| Macro Balance | 390×1390 px | 1206×2622 px | ≈402×874pt; optimized capture ≈368×800 | 4 / 2 native-resolution reviews |
| Weight | 390×1290 px | 1206×2622 px | ≈402×874pt; optimized capture ≈368×800 | 2 / 2 reviews |
| Logging Consistency 30D/90D | 390×1544 px | 1206×2622 px | ≈402×874pt; optimized capture ≈368×800 | 2 / 2 reviews |
| Hydration | 390×1450 px | 1206×2622 px | ≈402×874pt; optimized capture ≈368×800 | 2 / 2 reviews |
| Water Log | 390×900 px | 1206×2622 px | ≈402×874pt; optimized capture ≈368×800 | 2 / 2 reviews |
| Vitamin C detail | 390×1580 px | 1206×2622 px | ≈402×874pt; optimized capture ≈368×800 | 2 / 2 native-resolution reviews |

## Implementation evidence before simulator capture

- Presentation-only mobile changes are confined to analytics routes, chart
  primitives, nutrient presentation, custom-range labels, focused tests, and
  the Complex Insights route scale. The latest pass also removes pinned-analysis
  rendering from the exact Complex Insights overview hierarchy while retaining
  the standalone pin-management/trend surfaces, limits Water Log history
  visuals to edit mode, moves Logging section labels outside their cards to
  match the Figma hierarchy, and configures the next native dev-client rebuild
  to hide its tools button. No API, database, shared contract, dependency, or
  analytics-semantics changes were made.
- Exact Figma context and screenshots were freshly captured for every target;
  exact metadata dimensions are recorded in the implementation plan and the
  screenshots are retained under the temporary evidence root above.
- Focused mobile evidence currently passes: Complex Insights boundary 7/7,
  core trend fidelity 10/10, Vitamin C detail 2/2, Trend detail 5/5, and
  trend shell fidelity 5/5 after the current chart, macro, hydration, and
  compact hierarchy fixes.
- Final mobile Jest evidence for the correction passes 56 suites / 155 tests;
  the complete mobile Vitest run passes 53 files / 371 tests. Mobile lint and
  typecheck, API lint/typecheck/build, and root lint/typecheck/build also pass
  for the source correction. The regenerated-native runtime pass is tracked
  separately below.
  Root format check remains blocked by exactly 20 warnings in pre-existing
  protected/ignored artifacts. The required root API test command now passes
  against the dedicated `food_tracker_test` database after PostgreSQL was
  restored.
- Independent read-only visual review has covered Complex Insights, Macro
  Balance, Weight, Logging Consistency, Water Log, and Vitamin C. The final
  native-resolution Logging pass and the second Macro/Vitamin pass have no
  Major/Moderate findings. Remaining limitations are Minor halo/grid emphasis,
  seeded-data differences, missing approved 90D Figma reference, and known
  viewport/overlay limitations on earlier surfaces. Macro, Weight, Water Log,
  and Vitamin C still require clean no-overlay and matched-width evidence;
  Complex remains blocked by the authenticated account's Week/simple state.
- A final presentation-format audit found and corrected raw selected comparison
  values by routing them through the centralized metric formatter; a noisy
  `129.4857142857143` regression fixture now renders as `129.5`. The custom
  range UI already formats date-only values through the centralized date helper.
- The existing Firebase-linked staging QA target was verified read-only and
  reseeded through a Railway PostgreSQL SSH tunnel after extending only the
  seed transaction timeout for tunnel latency. The guarded seed completed with
  560 food logs, 4,514 nutrient snapshots, 106 weight logs, 485 water logs,
  four saved views, and one pinned view. A custom-token check also reached the
  staging API setup-status endpoint with HTTP 200. This proves staging data and
  API authorization, but does not substitute for the app's persisted Firebase
  Auth state or simulator target screenshots.
- Regenerated only the disposable `apps/mobile/ios/` native state, reran
  CocoaPods, and completed a serialized Debug `xcodebuild` against
  `FoodTracker.xcworkspace`, scheme `FoodTracker`, and the iPhone 17 simulator.
  The rebuilt app installed and launched without the `ExpoAsset` error. With
  the local API running, Firebase authentication succeeds and setup status
  correctly routes to onboarding because the restored development database has
  no completed setup for this user. Earlier authenticated target captures
  remain development-client evidence, not standalone Release or
  physical-device acceptance.
- The restored API test gate passes 94 files / 1,179 tests against the dedicated
  `food_tracker_test` database after the `food-tracker-postgres` container was
  restored. Prisma generation/validation and the 14 committed test migrations
  also pass; no development database was used.

## In-flight correction evidence

### Trend continuity

- Old behavior: derived trend paths inherited the raw nullable series and
  visibly split at missing dates, especially in Vitamin C.
- New behavior: derived rolling trend values bridge interior missing dates by
  default, while raw observations remain nullable and truthful. The fixed
  date domain still includes every represented day; unknown and unlogged values
  are not converted to zero.
- Missing observations remain represented by the raw daily layer as gaps,
  missing markers, or unavailable selected values. The bridge exists only in
  the derived trend layer.
- Affected compositions: `LineTrendChart`, `BarTrendChart`, nutrient and
  calorie reports, Weight, and any report that supplies a rolling trend series.
  `connectTrendGaps={false}` remains available for an intentional opt-out.
- Regression evidence: `trend-continuity.test.tsx` plus chart geometry/domain
  coverage; the final mobile Jest run passed 56 suites / 155 tests and the
  final Vitest run passed 53 files / 371 tests before the regenerated-native
  runtime pass.

### Chart visual system

- Line-only treatment was removed from the detail compositions that have
  authoritative daily observations: Calories now uses pale rounded daily
  columns under an ink trend; Vitamin C uses neutral daily bars plus its
  derived trend; Weight retains recorded points, a sage trend area, and goal
  context; Hydration retains its daily vessel/column composition; Logging
  Consistency remains a state heatmap; Macro Balance remains a composition
  chart with a Protein trend preview.
- Daily-value indicators remain separate from derived trend values, and the
  fixed x-domain preserves missing dates.
- Metric-specific colors now follow the approved section treatments: energy
  uses neutral/ink, weight uses sage, Vitamin C uses neutral observation bars
  with its nutrient trend treatment, and hydration remains blue.
- Rounded geometry was refined in the shared bar/column path without applying
  one universal radius to every chart.

### Independent review findings carried forward

- Macro Balance first native-resolution review: Moderate hero/control spacing
  and approximately 25pt too little separation before Daily Macro Mix; Minor
  halo strength. The second pass added the section separation and has no
  Major/Moderate findings. Data differences are seeded-account differences,
  not a UI defect.
- Vitamin C first native-resolution review: Major chart-layer/control divergence
  from the configured-range Figma state, while the current `Reference
  unavailable` state and visible raw missing-day gaps are truthful. The second
  pass softened grid weight without fabricating a reference range and has no
  Major/Moderate findings; selection/grid emphasis remains Minor.

### Logging Consistency

- Old scale: 30D used a compact 22pt-cell heatmap in a 286pt card; 90D used a
  compressed 280x190 pattern.
- New scale: 30D uses 22pt cells, 8pt gaps, a 292pt grid, a 284pt daily
  completeness card, and a 354pt meal-coverage card. Its 4x10 presentation
  fills the approved visual field without changing the 30-day data series.
  90D uses its own 14pt cell/4pt gap composition, a 320x254 period-pattern
  area, and a 270pt meal-coverage minimum.
- 30D and 90D intentionally use different geometry. Complete, partial,
  unlogged, and in_progress semantics are unchanged and remain independent of
  calorie adherence.
- Evidence: `loggingConsistencyLayout` geometry tests and the focused report
  fidelity assertions pass; final native captures are retained at
  `final-fresh/logging-consistency-30d-native-full-final.png` and
  `final-fresh/logging-consistency-90d-native-full-final.png`. The final
  independent review approved both surfaces with no Major/Moderate findings.
- The 30D grid now uses a balanced 4x10 presentation without changing the
  daily data series. Out-of-range presentation slots are outlined and labeled
  separately; they are not unlogged values. The recent-day copy states the
  in-progress day independently, and the 90D meal card no longer reserves an
  oversized empty lower area.

### Nutrient Highlights

- The card received a second fidelity pass: larger card/radius/padding and row
  spacing, promoted metric values, semantic accent dots, restrained status
  pills, explicit Minimum/Limit/Target/Range reference labels, and a larger
  20pt gauge area with a 10pt rounded rail and correctly placed markers.
- Unknown/reference-unavailable states remain explicit and are never rendered
  as zero. Focused Insights coverage passes 3 suites / 9 tests.
- Remaining discrepancy: the independent Complex review still found the
  overview capture underscaled versus the 390pt Figma reference; the lower
  Hydration surface requires clean post-rebuild evidence.

### Parallel execution

- Four independent implementation workstreams ran concurrently, all using
  Terra-level agents: chart continuity; Logging Consistency scale; Nutrient
  Highlights fidelity; and metric-specific chart composition/rounded geometry.
- Write scopes were disjoint; no merge conflict or protected-path change was
  required. Terra-level read-only reviewers inspected the Complex, Macro,
  Vitamin C, and Logging captures after implementation; the final Logging
  review approved the corrected 30D/90D screenshots with no Major/Moderate
  findings.
- Parallel execution shortened the implementation loop, but screenshots and
  independent review remain the approval gate.

## Physical findings being recovered

- Macro donut/card: cramped center value, legend competition, insufficient
  chart height, and clipped typography.
- Weight: underused chart area, weak trend/reference/forecast presence, and
  insufficient card composition.
- Logging Consistency: compressed 30D/90D heatmap and meal-coverage hierarchy.
- Hydration: black vessels instead of the final blue/outline/partial language.
- Global visual language: insufficient glow, range illumination, saturation,
  depth, and section emphasis.
- Presentation: raw floating-point values and ISO dates visible to users.
- Vitamin C: flat detail composition and incorrect chart/reference/related
  metric hierarchy.

## Current bounded fixes

- Added the missing seeded QA profile birth date so the fixture satisfies the
  backend's complete-profile setup contract; added deterministic and persistence
  regression coverage.
- Wrapped the root app in `GestureHandlerRootView` and added a root-layout
  regression test, fixing the post-onboarding GestureDetector render error.
- Made macro center typography responsive, aligned the detailed header to the
  final `Macros` Figma hierarchy, added geometry breathing room and `g` axis
  context, and replaced an empty daily-mix chart with an explicit empty state.
- Bounded generic line-chart area fills to recorded trend extents, moved Weight
  period controls after the primary metric, added the `lb` axis label and
  inline sage goal label, removed duplicate selection-description text, and
  used a backend-provided trend only when it contains enough recorded points.
- Increased Logging Consistency daily and meal-card minimum geometry to keep
  sparse 30D data from collapsing the Figma hierarchy.
- Moved Logging Consistency's DAILY COMPLETENESS, MEAL COVERAGE, and PERIOD
  PATTERN labels outside their cards to match the final Figma section hierarchy;
  added regression assertions for the new section boundaries.
- Removed the elevated shadow variant from the related nutrient card after a
  simulator-only React Navigation context error reproduced when Vitamin C's
  related trend became available; retained the shared card structure and added
  a non-null related-card regression test.
- Added Figma-tied minimum chart-card geometry for Weight, Hydration, and
  Vitamin C, restored the macro donut's pale halo/white center treatment, and
  tightened the shared Trends header hierarchy to the final small-title scale.
- Routed macro-composition fallback values through the centralized metric
  formatter so raw floating-point values cannot appear in the trend detail.
- Added stable test IDs and button semantics to the Week/Month period selector;
  this enabled simulator automation to reach the required Month/Complex state
  and is covered by a focused regression test.
- Passed `compact` through the Complex overview, changed its title to the
  compact heading variant, and added Figma-colored solid marker circles while
  preserving icon badges for other reporting surfaces.
- Changed Complex overview energy rendering to a black connected trend and
  allowed backend rolling-trend values to drive the compact preview when
  available; the macro protein preview uses the same backend trend path.
- Reduced the compact macro donut and gave its protein sparkline a flexible
  layout slot so the composition hierarchy remains readable at the simulator
  width.
- Defaulted Hydration detail to a seven-day query, retained only the final
  seven chart points as a presentation window, aligned the visible date range
  with those points, and changed the back label to `‹ Overview`.
- Normalized the Logging Consistency recent-day summary so sparse simulator
  states use the correct singular or plural `day` label; the live 30D state now
  reads `6 unlogged days` and has a focused regression assertion.
- Matched the Complex Insights Week/Month control to the compact Figma-width
  composition with a stable wrapper test ID and a focused width regression.
- Changed only the Vitamin C selected bar from blue to the Figma-aligned neutral
  gray while retaining blue for the trend line and selection guide; the focused
  detail regression now asserts the rendered neutral SVG payload.
- Replaced Water Log's inset native `formSheet` route with a documented
  `transparentModal` bottom-sheet presentation and an explicit full-width React
  Native sheet shell; the form remains API-backed and the responsive regression
  covers bottom anchoring. A fresh simulator capture shows the full-width sheet,
  corrected footer rhythm, and preserved controls; the independent second review
  leaves only Moderate viewport/overlay evidence limitations.
- Formatted detailed Macro Balance percentages with zero fractional digits while
  preserving the backend-provided percentage facts; the focused regression and
  fresh simulator capture now show whole values without decimal clutter. The
  second independent review confirms the typography correction, but retains
  Moderate geometry/chart evidence limits for the incomplete 368x800 capture,
  differing seeded data, and development-client overlay.
- Restored the detailed Protein trend's backend rolling series and true
  reference range when present, preserving raw points for selection/footer
  facts while making the chart's smoothed line and range treatment visible;
  focused coverage asserts the range gradient and the fresh lower capture shows
  the resulting composed trend card.
- Matched the detailed Protein trend chart to the compact Figma composition with
  an explicit 112pt plot height; the focused fidelity test guards that bound
  without changing the backend series or reference semantics.
- Reduced the Vitamin C detail summary metric from the oversized 38pt override
  to the approved 32pt treatment; focused coverage guards the presentation
  class while retaining the authoritative metric value and range copy.
- Routed Simple Insights consistency and report comparison deltas through the
  centralized metric formatter; focused coverage now rejects `40.6%`,
  `92.85714285714286`, and `124.4857142857143` presentation leaks while source
  facts remain unchanged.

## Final in-flight correction evidence — 2026-08-18

### Trend continuity and chart system

- The final native review confirmed continuous derived trends across missing
  dates while raw daily observations remain visibly absent rather than being
  converted to zero. Vitamin C, Calories, Hydration, and Weight were reviewed
  with the final chart compositions; Weight additionally shows raw weigh-in
  dots, a sage smoothed trend, goal context, and an unclipped selected marker.
- Hybrid and metric-specific compositions are now visible in the reviewed
  evidence: neutral rounded calorie columns under an ink trend, neutral Vitamin
  C observation bars with a nutrient trend, blue hydration vessels with
  detached missing-day markers, and Weight raw points plus trend/goal context.
  The final independent chart review found no remaining visual severity.
- Final chart evidence: `native-after-2026-08-18-correction/calories-after.jpg`,
  `hydration-final.jpg`, `vitamin-c-final.jpg`,
  `vitamin-c-final-lower.jpg`, and `weight-final.jpg`.

### Logging Consistency and Nutrient Highlights

- The final 30D and 90D captures show the intentionally different geometry,
  larger reporting presence, readable state markers, truthful in-progress
  legend treatment, and an explicit meal-coverage summary in both periods.
  The independent fidelity review found no Major or Moderate discrepancy.
- The final Complex lower capture and Vitamin C pair show the enlarged
  Nutrient Highlights gauge/card treatment, explicit reference/unknown states,
  and the completed contributor section. The independent reviewer found no
  remaining severity; values and reference availability differ from the Figma
  fixture because the signed-in Simulator uses the current account data.
- Final logging evidence: `logging-30d-final-top.jpg`,
  `logging-30d-final-lower.jpg`, `logging-90d-final-top.jpg`, and
  `logging-90d-final-lower.jpg`. Complex evidence is
  `complex-overview-month-after.jpg` and
  `complex-overview-month-lower-after.jpg`.

### Validation and evidence boundary

- Final automated gates passed under Node `v22.23.0` and pnpm `10.34.3`:
  root API `94` files / `1,179` tests, mobile Jest `62` suites / `174` tests,
  and mobile Vitest `53` files / `373` tests. Root lint, typecheck, build,
  Prisma generate/validate, dedicated `food_tracker_test` migration deploy,
  and mobile lint/typecheck also passed.
- `format:check` remains blocked only by 20 pre-existing/untracked protected
  `.agents`/`.superpowers` artifacts; those paths were not modified.
- The native Debug Simulator build/run passed on signed-in iPhone 17 with no
  visible runtime error after settling. Captures are the optimized 368x800
  Simulator output (approximately 402pt content), not a matched 390/393pt
  Figma viewport. Physical iPhone operation and acceptance remain pending
  user re-validation.

### Parallel execution

- Six disjoint Terra implementation workstreams were completed, supplemented
  by local shared-primitive TDD and two independent final visual reviewers.
  Workstreams covered chart continuity, Logging Consistency, metric-specific
  chart compositions/geometry, Weight, Hydration, and Nutrient/Vitamin C plus
  Complex overview fidelity. No write conflicts or protected-path changes
  occurred, and the parallel loop shortened the correction cycle without
  weakening the post-render review gate.

## Approval boundary

This ledger is not complete until every target has exact screenshots, measured
geometry, two independent review passes for high-risk screens, focused and
full automated validation, and a pushed branch. Current blockers are the
matched 390/393pt capture, removal of the development-client overlay from
evidence, exact authenticated Month/Complex state capture, clean lower-surface
evidence, sparse-data Macro/Hydration chart comparisons, remaining Macro
range/data parity concerns, Vitamin C selected point/data parity concerns, and
the lack of an approved 90D Figma frame. Water Log's implementation now matches
the full-width sheet structure, but strict signoff still requires a clean
matched-width capture without the development-client overlay. Vitamin C's source
typography fix is validated; its exact data and clean viewport evidence remain
unresolved.
The guarded standalone Release preparation still requires its own disk and
physical-validation gate; no generated-native cleanup is authorized while
physical validation remains pending. Physical iPhone operation,
standalone signing, installation, and acceptance remain user-only.
