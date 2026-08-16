# Phase 17.5 physical-fidelity recovery V2 implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to execute this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Restore the Phase 17.5 mobile analytics presentation to the final Figma composition and leave auditable simulator evidence without changing backend facts or claiming physical-iPhone acceptance.

**Architecture:** Keep the existing React Native/SVG chart primitives and backend-owned analytics contracts. Add shared presentation helpers for metric precision and date-only labels, then make high-risk report components responsive by component and period rather than applying a global compact scale. Record exact Figma and simulator evidence in a dedicated recovery ledger.

**Tech Stack:** TypeScript, React Native, Expo Router, NativeWind classes, `react-native-svg`, Vitest, Jest/RNTL, Figma MCP, Xcode/iOS Simulator.

## Global Constraints

- Stay on `phase-17-5-custom-analytics`; do not create a branch, PR, merge, or production deployment.
- Preserve `.agents/`, `.aidesigner/`, `.codex/`, `backups/`, and `docs/design-references/current images/`.
- Node must be `v22.x`; pnpm must be `10.34.3`.
- Do not edit Prisma schema/migrations, API/shared contracts, dependencies, or analytics semantics.
- Use exact final Figma nodes from `GFLStsF0ADwaizoVKGeLny`; Vitamin C is `425:21`.
- Unknown stays unknown, explicit zero stays zero, and logging completeness stays separate from metric coverage.
- High-risk surfaces require implement → screenshot → independent review → fix → screenshot → independent review.
- Physical iPhone validation remains `PENDING USER RE-VALIDATION`.

---

### Task 1: Establish auditable Visual QA Workflow V2

**Files:**
- Modify: `docs/superpowers/phase-17-5-fidelity-capture-ledger.md`
- Create: `docs/superpowers/phase-17-5-physical-fidelity-recovery.md`
- Create: `docs/superpowers/specs/2026-08-16-phase-17-5-physical-fidelity-recovery-design.md`
- Create: `docs/superpowers/plans/2026-08-16-phase-17-5-physical-fidelity-v2.md`

- [x] Add a superseded annotation to the historical ledger.
- [x] Document exact-node capture, 390pt plus neighboring-width validation, measured geometry, independent review, and two-pass high-risk acceptance.
- [ ] Run changed-file Prettier and `git diff --check`.
- [ ] Commit only these four intentional documentation paths as `docs: establish visual QA workflow v2`.

### Task 2: Add presentation-formatting regressions

**Files:**
- Modify: `apps/mobile/src/lib/reporting-ui.ts`
- Modify: `apps/mobile/src/lib/date-time.ts`
- Test: `apps/mobile/src/lib/reporting-ui.test.ts`
- Test: `apps/mobile/src/lib/date-time.test.ts`

**Interfaces:**
- `formatMetricValue(value: number | null | undefined, options?: { maximumFractionDigits?: number; minimumFractionDigits?: number }): string` returns `—` for nullish values, preserves `0`, and uses locale grouping.
- `formatMetricWithUnit(value, unit, options?)` returns a single formatted value plus unit without duplicate whitespace.

- [ ] Write failing tests for floating-point noise, explicit zero, null unknown, metric-specific precision, and date-only ISO output.
- [ ] Run the focused Vitest tests and confirm the new assertions fail for the current implementation.
- [ ] Implement the smallest helpers using the existing date-only noon-anchor approach.
- [ ] Run the focused tests and confirm they pass.
- [ ] Replace Phase 17.5 user-facing direct `toFixed`/raw interpolation in report, chart tooltip, selected-point, comparison, custom-range, and forecast surfaces.

### Task 3: Recompose Macro Balance and Weight

**Files:**
- Modify: `apps/mobile/src/components/analytics/charts/macro-chart.tsx`
- Modify: `apps/mobile/src/components/analytics/insights/macro-balance-card.tsx`
- Modify: `apps/mobile/src/components/analytics/insights/weight-direction-card.tsx`
- Modify: `apps/mobile/src/components/analytics/trends/macros-report.tsx`
- Modify: `apps/mobile/src/components/analytics/trends/weight-report.tsx`
- Test: existing macro, chart, insights, and trend fidelity tests plus focused additions beside the changed components.

- [ ] Add failing assertions for a 390pt macro center that fits value/unit without clipping, a minimum donut diameter, separated legend, and a nontrivial Protein trend height.
- [ ] Add failing assertions for Weight chart geometry that consumes the card surface and retains target/reference/forecast affordances.
- [ ] Run focused tests and confirm the failures are caused by current compact dimensions/formatting.
- [ ] Implement component-specific dimensions mapped to Figma `338:720` and `338:605`; do not shrink typography as the primary fix.
- [ ] Apply the locked macro colors (`#C9242D`, `#33B866`, `#FFAD8F`) and semantic range/reference treatment using existing chart primitives.
- [ ] Run focused tests and refactor only while green.

### Task 4: Recompose 30D/90D Logging Consistency and Hydration

**Files:**
- Modify: `apps/mobile/src/components/analytics/trends/logging-consistency-report.tsx`
- Modify: `apps/mobile/src/components/analytics/trends/hydration-report.tsx`
- Modify: `apps/mobile/src/components/analytics/insights/hydration-insights-card.tsx`
- Modify: `apps/mobile/src/lib/analytics/overview-visuals.ts`
- Test: existing heatmap, hydration, water, and trend-report fidelity tests plus focused additions.

- [ ] Add failing tests proving 30D and 90D select intentional density/layout behavior while preserving all four logging states.
- [ ] Add failing tests for hydration empty, partial, full, and unknown vessel states using non-black blue-system colors.
- [ ] Run focused tests and confirm failures.
- [ ] Implement Figma-sized heatmap/meal-coverage/period-pattern cards for the two period classes without changing classification semantics.
- [ ] Implement durable local SVG/native vessel visuals with Figma-sampled blue outlines, fills, spacing, and target treatment; keep water CRUD untouched.
- [ ] Run focused tests and refactor while green.

### Task 5: Recompose Vitamin C detail and global visual depth

**Files:**
- Modify: `apps/mobile/src/components/analytics/trends/metric-specific-report.tsx` or the existing nutrient detail component selected by route inspection.
- Modify: existing nutrient chart/reference/related-metric components only where the route actually uses them.
- Test: existing nutrient fidelity tests plus a focused Vitamin C `425:21` regression.

- [ ] Add failing assertions for the final header/configure geometry, range chart height, reference band/line, average label, related metric, and contributor hierarchy.
- [ ] Run the focused test and confirm the failure.
- [ ] Implement the final-node composition with existing chart/reference/card components and semantic glow/range treatment.
- [ ] Ensure related metric naming/content is derived from the selected nutrient metadata, not hard-coded Vitamin C copy.
- [ ] Run focused tests and refactor while green.

### Task 6: Real-app simulator capture and independent review

**Files:**
- Modify: `docs/superpowers/phase-17-5-physical-fidelity-recovery.md`
- Evidence: `/tmp/food-tracker-phase17-5-visual-v2/`

- [ ] Build and run the actual Food Tracker iOS app against the existing staging selector with the seeded QA account.
- [ ] Capture Complex Insights, Macro, Weight, Consistency 30D/90D, Hydration, Water Log, and Vitamin C at 390pt and neighboring width.
- [ ] Record before/after filenames and measured card geometry in the ledger.
- [ ] Perform an independent visual review for every high-risk surface and record findings by category/severity.
- [ ] Fix every Major/Moderate finding and capture a second review iteration.
- [ ] Confirm navigation remains functional through Insights, Explore, Nutrients, Configure, Saved Views, Custom Range, Water Log, and pinned Protein + Weight.

### Task 7: Full validation and intentional handoff

**Files:**
- Modify only intentionally changed source/tests/docs paths.

- [ ] Run Node 22.23.x and pnpm 10.34.3 checks.
- [ ] Run Prisma generate/validate, shared build/typecheck, API typecheck/lint/build/tests against `food_tracker_test`, mobile Vitest/Jest/typecheck/lint, root typecheck/lint/build/tests, changed-file Prettier, and `git diff --check`.
- [ ] Review protected paths and stage explicit paths only.
- [ ] Commit implementation slices and docs evidence with intentional messages.
- [ ] Push `phase-17-5-custom-analytics` without force-push.
- [ ] Report exact commands/results, Git state, simulator status, and physical status as pending user re-validation.
