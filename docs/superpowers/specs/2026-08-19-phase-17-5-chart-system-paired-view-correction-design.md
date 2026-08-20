# Phase 17.5 chart system and paired-view correction design

## Outcome

Make the current Phase 17.5 analytics build read as complete analytical
software on a physical iPhone: detailed daily metrics expose raw observations,
derived trend, reference context, readable axes, and restrained grid structure;
comparison charts expose a shared timeline with truthful series colors; paired
nutrient actions open the configured two-metric comparison; and overview state
copy and composition remain truthful at phone scale.

This correction preserves the existing backend-owned facts, missing-data
contract, logging-day semantics, reference semantics, persistence, and
specialized representations for Weight, Logging Consistency, and macro
composition. Physical iPhone acceptance remains user-owned and must remain
reported as pending re-validation.

## Evidence and boundaries

The pasted physical-device brief is the observed-runtime evidence for this
correction. Final Figma nodes remain design authority where available. Existing
Simulator evidence is supplementary and must not turn 402pt or historical
nearby-width captures into 390pt/393pt proof.

The implementation remains inside the existing React Native and
`react-native-svg` chart stack. No chart dependency, database/schema change,
API contract change, or analytics semantic change is planned. If the reference
investigation proves that the canonical API response is wrong, stop before
changing the contract and surface that boundary for explicit approval.

## Chart system

Add pure presentation helpers for adaptive temporal ticks and readable numeric
ticks. Full/detail charts will render a plot with an axis gutter and an X-axis
label row; overview mini-charts remain intentionally simplified. Tick rules are
approximately daily for 7D, weekly for 30D, monthly or every two to four weeks
for 90D, and density-derived for custom ranges. Labels use human-readable
date-only formatting and never raw ISO strings.

Daily intake and nutrient metrics use rounded raw daily bars plus the existing
rolling trend values. Missing raw observations produce no bar, retain their
date slot, and do not become zero. The trend may bridge missing observations
according to the existing continuity contract. A zero baseline is used for
additive metrics when truthful. Weight retains raw points, a tight non-zero
domain, target/reference, and forecast. Hydration retains its blue vessel
columns and goal semantics. Logging Consistency remains a state-cell/heatmap
representation. Macro composition remains a donut/composition view.

Reference lines and bands are labeled with their semantic kind and unit. A
minimum/target, limit, or true range must be understandable without inference.

## Comparisons and paired navigation

Comparison charts retain independent Y domains for dual-axis metrics but render
one shared temporal domain, three to five useful X ticks, a shared selection
guide, and one selected date for both series. Series colors are defined once
and reused by the plot, axis labels, legend, and tooltip.

The paired action builds a `TrendQueryInput` from the active query while
setting the current nutrient as `primaryMetric` and the related nutrient as
`comparisonMetric`. It preserves the active period, aggregation, visualization,
reference visibility, and coverage filter, then routes to the current metric's
comparison report. Iron/Vitamin C and Sodium/Potassium are regression cases.

## Reference consistency

The investigation begins at the route query and canonical trend response. The
existing API `metricReference()` and Insights overview already share
`resolveReportingGoals()`, including the default Vitamin C minimum of 90 mg.
The fix must preserve that single source of truth and make any lost reference
visible through a regression test. No Vitamin C value may be hard-coded in the
mobile detail component.

## Overview and hydration corrections

Hydration overview copy distinguishes no water today, no hydration history,
request failure, and unknown goal. Existing WaterLog persistence and analytics
states are unchanged. Section badges retain meaningful icons even when a
colored marker override is used. Logging Consistency overview cells gain
phone-scale emphasis without changing state classification. Numeric summary
geometry receives sufficient height and padding rather than smaller typography.

Nutrient Highlights keeps status semantics separate from nutrient identity
color, preserves reference markers and reference copy, and remains aligned with
the canonical reference object.

## Validation

Each behavior change follows a red-green-refactor cycle with focused Jest or
Vitest coverage. Required focused coverage includes adaptive ticks, Y-axis
labels, units, references, missing-date continuity, hybrid bars, comparison
timeline and colors, paired query/navigation, reference propagation,
hydration copy, responsive overview geometry, and icon presence. The final
repository gate runs under Node 22.x and pnpm 10.34.3, uses the dedicated
`food_tracker_test` database for API tests, and reports Simulator and physical
device validation separately.
