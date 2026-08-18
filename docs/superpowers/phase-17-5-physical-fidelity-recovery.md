# Phase 17.5 physical-fidelity recovery and Visual QA Workflow V2

Status: authenticated simulator runtime evidence is now available; source
presentation pass 7 is in progress. The onboarding/runtime crash found after
the user completed onboarding was fixed, and the rebuilt native app now reaches
the authenticated Complex walkthrough. The latest implementation pass corrected
the Complex compact hierarchy, solid section markers, black energy trend, macro
composition sizing, and Hydration seven-day detail default. Two fresh
independent reviews still fail final visual sign-off because exact Month state,
matched viewport, clean captures, and some sparse-data chart comparisons remain
unproven.
Physical iPhone validation:
**PENDING USER RE-VALIDATION**.

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
| Macro Balance | `338:720` | Trends / Macros | `/tmp/food-tracker-phase17-5-visual-v2/figma/macros.png` | `/tmp/food-tracker-phase17-5-visual-v2/macros-simulator-after-gesture-fix.png` | `/tmp/food-tracker-phase17-5-visual-v2/macros-current-full-after-percent-format.jpg`; `/tmp/food-tracker-phase17-5-visual-v2/macros-current-lower-after-range-fix.jpg`; `/tmp/food-tracker-phase17-5-visual-v2/macros-current-lower-after-height-fix.png` | 3 independent review passes plus lower-surface captures; whole-number percentage typography, Protein rolling treatment, and compact chart height corrected, while live range visibility, data parity, 368x800 normalization, and gear-free evidence remain limitations |
| Weight | `338:605` | Trends / Weight | `/tmp/food-tracker-phase17-5-visual-v2/figma/weight.png` | `/tmp/food-tracker-phase17-5-visual-v2/weight-simulator-after-gesture-fix.jpg` | `/tmp/food-tracker-phase17-5-visual-v2/weight-simulator-current-full-final.png` | 2 independent review passes; smoothed line and sage goal label now visible, gear/viewport remain evidence limitations |
| Logging Consistency 30D/90D | `338:928` | Trends / Logging consistency | `/tmp/food-tracker-phase17-5-visual-v2/figma/logging-consistency.png` | `/tmp/food-tracker-phase17-5-visual-v2/logging-consistency-simulator-30d.jpg` | `/tmp/food-tracker-phase17-5-visual-v2/logging-consistency-30d-simulator-current-full-post-hierarchy.png`; `/tmp/food-tracker-phase17-5-visual-v2/logging-90d-current-full.png` | 2 independent review passes; current 30D/90D data differs from Figma seed and 402pt viewport remains |
| Hydration | `426:159` | Trends / Hydration | `/tmp/food-tracker-phase17-5-visual-v2/figma/hydration.png` | authenticated route not captured | `/tmp/food-tracker-phase17-5-visual-v2/hydration-current-detail-seven-day-final.png` | 2 fresh independent reviews; `‹ Overview`, seven-point presentation, and seven-day default corrected; target-state data, clean overlay-free capture, and matched viewport remain limitations |
| Water Log | `440:28` | Log Water | `/tmp/food-tracker-phase17-5-visual-v2/figma/water-log.png` | `/tmp/food-tracker-phase17-5-visual-v2/water-log-current-full.png` | `/tmp/food-tracker-phase17-5-visual-v2/water-log-current-full-after-bottom-sheet.jpg` | second fresh independent review: structural/full-width fix passes; Moderate geometry and clean-capture limitations remain because the optimized 368x800 viewport and dev-client overlay are not exact V2 evidence |
| Vitamin C detail | `425:21` | Trends / Vitamin C / Range | `/tmp/food-tracker-phase17-5-visual-v2/figma/vitamin-c.png` | `/tmp/food-tracker-phase17-5-visual-v2/vitamin-c-simulator-after-navigation-context-fix.jpg` | `/tmp/food-tracker-phase17-5-visual-v2/vitamin-c-current-after-size-fix.png`; `/tmp/food-tracker-phase17-5-visual-v2/vitamin-c-current-lower-after-size-fix.png` | 2 independent reviews; authoritative `Reference unavailable` state, neutral selected-bar treatment, and 32pt summary metric are preserved/corrected, while data parity, selected-point emphasis, matched viewport, and gear-free evidence remain limitations |

### Evidence dimensions and viewport ledger

| Surface | Figma dimensions | Latest simulator dimensions | Logical viewport | Implementation / review iteration |
| --- | --- | --- | --- | --- |
| Complex Insights | 390×2760 px | 1206×2622 px | ≈402×874pt; optimized capture ≈368×800 | 2 / 2 reviews |
| Macro Balance | 390×1390 px | 1206×2622 px | ≈402×874pt; optimized capture ≈368×800 | 4 / 3 reviews |
| Weight | 390×1290 px | 1206×2622 px | ≈402×874pt; optimized capture ≈368×800 | 2 / 2 reviews |
| Logging Consistency 30D/90D | 390×1544 px | 1206×2622 px | ≈402×874pt; optimized capture ≈368×800 | 2 / 2 reviews |
| Hydration | 390×1450 px | 1206×2622 px | ≈402×874pt; optimized capture ≈368×800 | 2 / 2 reviews |
| Water Log | 390×900 px | 1206×2622 px | ≈402×874pt; optimized capture ≈368×800 | 2 / 2 reviews |
| Vitamin C detail | 390×1580 px | 1206×2622 px | ≈402×874pt; optimized capture ≈368×800 | 2 / 2 reviews |

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
- Final mobile Jest evidence passes 50 suites / 146 tests; the complete mobile
  Vitest run passes 53 files / 370 tests. Mobile lint and typecheck,
  API lint/typecheck/build, and root lint/typecheck/build also pass.
  Root format check remains blocked by exactly 20 warnings in pre-existing
  protected/ignored artifacts. The required root API test command remains
  blocked before collection by PostgreSQL `P1001` at `localhost:5432` while
  targeting the dedicated `food_tracker_test` database.
- Independent read-only visual review has now covered Complex Insights, Macro
  Balance, Weight, Logging Consistency, Water Log, and Vitamin C. Macro has a
  third review after the compact Protein chart correction; Vitamin C has a
  second review after the 32pt summary correction. The latest Weight capture
  now shows the backend-provided smoothed line across sparse raw days. Macro,
  Weight, Water Log, and Vitamin C still require clean no-overlay and
  matched-width evidence; Complex remains blocked by the authenticated
  account's Week/simple state.
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
- Regenerated only the disposable `apps/mobile/ios/` native state, ran
  CocoaPods, and completed a Debug `xcodebuild -jobs 2` against
  `FoodTracker.xcworkspace`, scheme `FoodTracker`, and the booted iPhone 17
  simulator after exact cache/device-support cleanup. Install and launch
  succeeded; staging Metro bundled the app to the sign-in screen. Runtime
  logs no longer show the prior `ExpoCamera` or `FileSystem` missing-module
  errors. The simulator is now authenticated and has completed onboarding;
  target captures are available, but they remain development-client evidence,
  not standalone Release or physical-device acceptance.
- API tests remain blocked at setup by `P1001`: PostgreSQL is unavailable at
  `localhost:5432`; the test selector correctly resolved to `food_tracker_test`.
  The final root test command reproduced this exact setup failure; no API test
  count is claimed from that run.

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

## Approval boundary

This ledger is not complete until every target has exact screenshots, measured
geometry, two independent review passes for high-risk screens, focused and
full automated validation, and a pushed branch. Current blockers are the
matched 390/393pt capture, removal of the development-client overlay from
evidence (requires the next native rebuild), exact authenticated Month/Complex
state capture, clean lower-surface evidence, sparse-data Macro/Hydration chart
comparisons, remaining Macro range/data parity concerns, Vitamin C selected
point/data parity concerns, and the blocked API test gate. Water Log's
implementation now matches the full-width sheet structure, but strict signoff
still requires a clean matched-width capture without the development-client
overlay. Vitamin C's source typography fix is validated; its exact data and
clean viewport evidence remain unresolved.
The guarded standalone Release preparation is also blocked before prebuild by
the 10 GiB free-disk prerequisite; no generated-native cleanup is authorized
while physical validation remains pending. Physical iPhone operation,
standalone signing, installation, and acceptance remain user-only.
