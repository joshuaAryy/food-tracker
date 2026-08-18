# Phase 17.5 physical-fidelity recovery and Visual QA Workflow V2

Status: authenticated simulator runtime evidence is now available; source
presentation pass 3 is in progress. The onboarding/runtime crash found after
the user completed onboarding was fixed, and high-risk visual review has
identified additional geometry, chart, empty-state, and evidence gaps.
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

Current simulator evidence is captured through XcodeBuildMCP's optimized
368x800 image output (the underlying iPhone 17 simulator is approximately
402pt wide). This is useful runtime evidence but is not a matched 390/393pt
comparison. Approximate post-fix observations are recorded in the target table
and the remaining responsive evidence gap is explicit.

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
| Complex Insights | `338:276` | Insights / Complex / Overview | `/tmp/food-tracker-phase17-5-visual-v2/figma/complex-insights.png` | `/tmp/food-tracker-phase17-5-visual-v2/complex-insights-simulator-after-gesture-fix.png` | `/tmp/food-tracker-phase17-5-visual-v2/complex-insights-simulator-after-logging-order-fix.jpg` | 1 independent review; matched Month state and viewport still pending |
| Macro Balance | `338:720` | Trends / Macros | `/tmp/food-tracker-phase17-5-visual-v2/figma/macros.png` | `/tmp/food-tracker-phase17-5-visual-v2/macros-simulator-after-gesture-fix.png` | `/tmp/food-tracker-phase17-5-visual-v2/macros-simulator-after-daily-mix-fix.jpg` | 1 independent review; second pass and matched viewport required |
| Weight | `338:605` | Trends / Weight | `/tmp/food-tracker-phase17-5-visual-v2/figma/weight.png` | `/tmp/food-tracker-phase17-5-visual-v2/weight-simulator-after-gesture-fix.jpg` | `/tmp/food-tracker-phase17-5-visual-v2/weight-simulator-after-trend-fallback.jpg` | 1 independent review; line/viewport gaps remain |
| Logging Consistency 30D/90D | `338:928` | Trends / Logging consistency | `/tmp/food-tracker-phase17-5-visual-v2/figma/logging-consistency.png` | `/tmp/food-tracker-phase17-5-visual-v2/logging-consistency-simulator-30d.jpg` | `/tmp/food-tracker-phase17-5-visual-v2/logging-consistency-simulator-after-geometry-fix.jpg` | review pending; 90D capture pending |
| Hydration | `426:159` | Trends / Hydration | `/tmp/food-tracker-phase17-5-visual-v2/figma/hydration.png` | authenticated route not captured | pending | 0 |
| Water Log | `440:28` | Log Water | `/tmp/food-tracker-phase17-5-visual-v2/figma/water-log.png` | `/tmp/food-tracker-phase17-5-visual-v2/water-log-simulator.jpg` | pending | 0 |
| Vitamin C detail | `425:21` | Trends / Vitamin C / Range | `/tmp/food-tracker-phase17-5-visual-v2/figma/vitamin-c.png` | `/tmp/food-tracker-phase17-5-visual-v2/vitamin-c-simulator-after-navigation-context-fix.jpg` | second capture and independent review pending | 0 |

## Implementation evidence before simulator capture

- Presentation-only mobile changes are confined to analytics routes, chart
  primitives, nutrient presentation, custom-range labels, focused tests, and
  the Complex Insights route scale. The latest pass also removes pinned-analysis
  rendering from the exact Complex Insights overview hierarchy while retaining
  the standalone pin-management/trend surfaces, and limits Water Log history
  visuals to edit mode. No API, database, shared contract, dependency, or
  analytics-semantics changes were made.
- Exact Figma context and screenshots were freshly captured for every target;
  exact metadata dimensions are recorded in the implementation plan and the
  screenshots are retained under the temporary evidence root above.
- Focused mobile evidence currently passes: core trend fidelity Jest 7/7 and
  trend shell fidelity Jest 5/5 after the current chart, macro, weight, and
  logging layout fixes. Root-layout gesture coverage passes 1/1.
- Full mobile evidence currently passes: Vitest 53 files / 367 tests and Jest
  49 suites / 139 tests. Mobile lint and typecheck, API lint/typecheck/build,
  and root lint/typecheck/build also pass. Root format check reports 20
  warnings in pre-existing protected/ignored artifacts.
- Independent read-only visual review has now covered Complex Insights, Macro
  Balance, and Weight. Macro review confirms the center clipping is fixed but
  requires a matched viewport, a clean capture without the dev-client gear, and
  an intentional populated/empty daily-mix state. Weight review found the
  smoothed line/reference treatment still insufficient in the current data
  capture, plus compressed geometry and evidence normalization gaps.
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
  inline goal label, removed duplicate selection-description text, and used a
  backend-provided trend only when it contains enough recorded points.
- Increased Logging Consistency daily and meal-card minimum geometry to keep
  sparse 30D data from collapsing the Figma hierarchy.
- Removed the elevated shadow variant from the related nutrient card after a
  simulator-only React Navigation context error reproduced when Vitamin C's
  related trend became available; retained the shared card structure and added
  a non-null related-card regression test.

## Approval boundary

This ledger is not complete until every target has exact screenshots, measured
geometry, two independent review passes for high-risk screens, focused and
full automated validation, and a pushed branch. Current blockers are the
matched 390/393pt capture, removal of the development-client overlay from
evidence, remaining Weight trend/reference fidelity, 90D Logging Consistency,
second-pass reviews, and final Water Log/Vitamin C evidence. Physical iPhone
operation, standalone signing, installation, and acceptance remain user-only.
