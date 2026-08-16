# Phase 17.5 physical-fidelity recovery and Visual QA Workflow V2

Status: presentation implementation complete; simulator build/install and
staging Metro startup succeeded, but the installed app remains on a blank
surface after bundle download, so target-screen evidence and review are
incomplete. Physical iPhone validation: **PENDING USER RE-VALIDATION**.

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
current simulator artifacts are limited to the native launch shell,
development-client prompt, and blank post-bundle surface:

```text
/tmp/food-tracker-phase17-5-visual-v2/simulator-launch.png
/tmp/food-tracker-phase17-5-visual-v2/simulator-metro-connected.png
/tmp/food-tracker-phase17-5-visual-v2/current.png
```

### Geometry review

For each major card, record approximate x, y, width, height, internal padding,
heading-to-card gap, chart width, and chart height for both Figma and the
simulator. Review structural, geometry, typography, color, chart, effects, and
responsive findings separately.

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
| Complex Insights | `338:276` | Insights / Complex / Overview | `/tmp/food-tracker-phase17-5-visual-v2/figma/complex-insights-338-276.png` | blocked: app blank after bundle | blocked: app blank after bundle | 0 |
| Macro Balance | `338:720` | Trends / Macros | `/tmp/food-tracker-phase17-5-visual-v2/figma/macros-338-720.png` | blocked: app blank after bundle | blocked: app blank after bundle | 0 |
| Weight | `338:605` | Trends / Weight | `/tmp/food-tracker-phase17-5-visual-v2/figma/weight-338-605.png` | blocked: app blank after bundle | blocked: app blank after bundle | 0 |
| Logging Consistency 30D/90D | `338:928` | Trends / Logging consistency | `/tmp/food-tracker-phase17-5-visual-v2/figma/consistency-338-928.png` | blocked: app blank after bundle | blocked: app blank after bundle | 0 |
| Hydration | `426:159` | Trends / Hydration | `/tmp/food-tracker-phase17-5-visual-v2/figma/hydration-426-159.png` | blocked: app blank after bundle | blocked: app blank after bundle | 0 |
| Water Log | `440:28` | Log Water | `/tmp/food-tracker-phase17-5-visual-v2/figma/water-log-440-28.png` | blocked: app blank after bundle | blocked: app blank after bundle | 0 |
| Vitamin C detail | `425:21` | Trends / Vitamin C / Range | `/tmp/food-tracker-phase17-5-visual-v2/figma/vitamin-c-425-21.png` | blocked: app blank after bundle | blocked: app blank after bundle | 0 |

## Implementation evidence before simulator capture

- Presentation-only mobile changes are confined to analytics routes, chart
  primitives, nutrient presentation, custom-range labels, focused tests, and
  the Complex Insights route scale. No API, database, shared contract,
  dependency, or analytics-semantics changes were made.
- Exact Figma context and screenshots were freshly captured for every target;
  exact metadata dimensions are recorded in the implementation plan and the
  screenshots are retained under the temporary evidence root above.
- Focused mobile evidence currently passes: reporting-format Vitest 3/3;
  core trend fidelity Jest 4/4; Simple Insights fidelity Jest 4/4; Vitamin C
  detail fidelity Jest 1/1; custom-range and trend-detail suites 13/13.
- Full mobile evidence currently passes: Vitest 53 files / 366 tests and Jest
  48 suites / 134 tests. Mobile lint and typecheck, API lint/typecheck/build,
  and root lint/typecheck/build also pass. Root format check reports 20
  warnings in pre-existing protected/ignored artifacts.
- Direct `xcodebuild` against `FoodTracker.xcworkspace`, scheme `FoodTracker`,
  and the booted iPhone 17 simulator succeeded after reclaiming only the task
  V2 derived-data cache and Xcode `ModuleCache.noindex`. Install and launch
  succeeded; the guarded Node 22 staging Metro workflow bundled successfully,
  but the app remained blank after download. No target-screen or geometry
  evidence was captured.
- API tests remain blocked at setup by `P1001`: PostgreSQL is unavailable at
  `localhost:5432`; the test selector correctly resolved to `food_tracker_test`.

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

## Approval boundary

This ledger is not complete until every target has exact screenshots, measured
geometry, two independent review passes for high-risk screens, focused and
full automated validation, and a pushed branch. The simulator runtime issue
must be resolved before target-screen evidence can be collected. Physical
iPhone operation, standalone signing, installation, and acceptance remain
user-only.
