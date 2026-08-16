# Phase 17.5 physical-fidelity recovery design

## Outcome

Recover the Phase 17.5 mobile presentation against the final Figma nodes and
the physical-device failures supplied in the recovery brief. Preserve the
existing backend-owned facts, logging-day semantics, metric availability
semantics, persistence, cache lifecycle, navigation, and chart primitives.

Physical iPhone validation remains user-owned and pending after this work.

## Evidence-first workflow

The recovery ledger records, per target surface, the exact final Figma node,
fresh Figma screenshot, simulator screenshots before and after each change,
390pt and neighboring-width viewports, measured card geometry, independent
review findings, and remaining severity. The old simulator ledger remains
unchanged except for its superseded-status annotation.

High-risk surfaces use two passes:

```text
implement → capture → independent review → fix Major/Moderate findings
          → capture → independent review
```

The required high-risk set is Complex Insights, Macro Balance, Weight,
Hydration, Logging Consistency at 30D and 90D, and Vitamin C detail.

## Presentation boundaries

All values remain canonical source values. Formatting is applied only at the
presentation boundary. Date-only strings are formatted with a noon anchor so
local timezone conversion cannot move a displayed day. Unknown values remain
unknown, explicit zero remains zero, and logging completeness remains separate
from metric coverage.

The existing `react-native-svg`, React Native, and Reanimated/chart stack is
extended where necessary. No new chart dependency is planned. Hydration uses
durable local/native rendering rather than short-lived Figma asset URLs.

## Component changes

- Macro Balance: use the final `338:720` proportions, a larger donut with
  bounded center typography, separated legend hierarchy, Figma macro colors,
  and a meaningful Protein trend region.
- Weight: use the final `338:605` chart surface and preserve trend, target,
  forecast, scrub, axes, and summary facts without hiding sparse data.
- Logging Consistency: compose 30D and 90D intentionally from their period
  density, retaining complete/partial/unlogged/in-progress semantics and
  separate meal coverage.
- Hydration: use the final `426:159` and `440:28` visual language with blue
  vessel outlines/fills, partial and empty states, target treatment, and
  quick-add hierarchy while keeping the existing persistence path.
- Nutrient detail: use exact final node `425:21` for Vitamin C, including
  range chart composition, reference treatment, related metric, and
  contributor hierarchy.
- Complex Insights: remove generic compact sizing where it conflicts with the
  final `338:276` hierarchy; adjust sections independently.

## Validation

Focused tests cover formatting, responsive geometry, macro center fitting,
hydration visual states, period-specific consistency layout, and nutrient
detail presentation. The complete repository gate runs under Node 22.23.x and
pnpm 10.34.3 against `food_tracker_test`, followed by `git diff --check` and
intentional-path review. No claim of physical iPhone acceptance is permitted.
