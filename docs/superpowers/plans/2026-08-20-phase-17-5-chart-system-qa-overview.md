# Phase 17.5 Chart System, QA Data, and Overview Fidelity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Phase 17.5 analytics visually coherent, current-date QA data useful, and Complex Insights Overview faithful to the final Figma composition without changing approved analytics semantics.

**Architecture:** Add a pure mobile chart-style resolver that feeds the existing daily hybrid chart and preserves specialized hydration, weight, consistency, and Macro compositions. Extend only the staging fixture generator for deterministic current-date and nutrient-state coverage, and increase Overview card geometry through existing card components rather than introducing a new layout framework.

**Tech Stack:** React Native, Expo, TypeScript, NativeWind, `react-native-svg`, Vitest, Jest, Express/Prisma fixture scripts, PostgreSQL test database.

**Spec:** `docs/superpowers/specs/2026-08-20-phase-17-5-chart-system-qa-overview-design.md`

## Global Constraints

- Stay on `phase-17-5-custom-analytics`; do not create a PR, merge, deploy production, or claim physical-iPhone acceptance.
- Do not touch `.agents/`, `.aidesigner/`, `.codex/`, `backups/`, or `docs/design-references/current images/`.
- Never use `git add .` or `git add -A`; stage only reviewed owned paths.
- Do not change Prisma schema/migrations, shared API contracts, backend analytics semantics, authentication, dependencies, or generated native state.
- Preserve axes, adaptive ticks, grids, missing-date domains, trend continuity, null/unknown semantics, hydration persistence, logging completeness, paired routing, comparison timelines, reference semantics, and empty states.
- Use Node `v22.x` and pnpm `10.34.3`; backend tests use `food_tracker_test` only.
- Production code follows TDD: write a focused failing test, run it and observe the expected failure, implement the smallest change, then rerun the focused test before refactoring.
- Runtime visual review uses the final Figma nodes and a real Simulator where available; Simulator and physical-device status are reported separately.

---

### Task 1: Centralized chart style system and daily hybrid hierarchy

**Files:**
- Create: `apps/mobile/src/lib/analytics/chart-style.ts`
- Test: `apps/mobile/src/lib/analytics/chart-style.test.ts`
- Modify: `apps/mobile/src/components/analytics/charts/bar-trend-chart.tsx`
- Modify: `apps/mobile/src/components/analytics/trends/calories-report.tsx`
- Modify: `apps/mobile/src/components/analytics/nutrients/vitamin-c-detail-report.tsx`
- Modify: `apps/mobile/src/components/analytics/trends/logging-consistency-report.tsx`
- Test: `apps/mobile/src/components/analytics/charts/__tests__/chart-axis-fidelity.test.tsx`
- Test: `apps/mobile/src/components/analytics/charts/__tests__/trend-continuity.test.tsx`

**Interfaces:**
- `chartStyleForMetric(metric: AnalyticsMetricKey): AnalyticsChartStyle` returns a deterministic family, raw-bar fill/stroke/opacity, trend color/width, reference treatment, selected colors, and tooltip accent.
- `BarTrendChart` accepts an optional `chartStyle?: AnalyticsChartStyle` while retaining existing geometry, interaction, accessibility, and null handling.
- `referenceTreatment` supports `none`, `line`, and `bounds`; `bounds` draws two quiet dashed/dotted bounds for a true range and never paints a dominant gradient slab.

- [ ] **Step 1: Write the failing style contract test.** Assert that Calories, Protein, Sodium, Vitamin C, Iron, Magnesium, Calcium, Hydration, Weight, and Logging Consistency resolve to deliberate family identities; assert that Protein and Sodium do not share the fallback red identity; assert that raw opacity is lower than selected opacity and trend width is stronger than raw treatment; assert that status is not part of the metric style.
- [ ] **Step 2: Run the style test and verify the expected failure.**

  Run: `corepack pnpm --filter @food-tracker/mobile exec vitest run src/lib/analytics/chart-style.test.ts`

  Expected: FAIL because `chart-style.ts` and `chartStyleForMetric` do not yet exist.
- [ ] **Step 3: Implement the pure resolver.** Use existing design tokens and restrained chart colors; map every `AnalyticsMetricKey` family through one table with a quiet neutral fallback; keep status colors in the existing overview/status code.
- [ ] **Step 4: Rerun the focused style test and verify it passes.**
- [ ] **Step 5: Write the failing rendering regression.** Extend the chart fidelity tests to render a styled hybrid chart and assert its raw paths use the configured low-emphasis fill/stroke, its trend path uses the configured stronger color/width, missing raw values do not create bars, and Calories with a range uses two reference lines rather than a `LinearGradient`/filled range slab.
- [ ] **Step 6: Run the rendering test and verify the expected failure.**
- [ ] **Step 7: Update `BarTrendChart` minimally.** Thread `chartStyle` into the existing plot, preserve supplied legacy props for callers not yet migrated, make raw observations secondary by default when a style is supplied, keep smooth trend gap-bridging unchanged, and add only the reference branch needed for quiet bounds.
- [ ] **Step 8: Migrate all direct daily-hybrid production callers.** Pass the centralized style for Calories, Vitamin C, and Logging Consistency; use the metric-specific style for any other direct `BarTrendChart` caller found by `rg`.
- [ ] **Step 9: Rerun the focused chart tests and the existing chart suite.**

  Run: `corepack pnpm --filter @food-tracker/mobile exec vitest run src/lib/analytics/chart-style.test.ts src/components/analytics/charts/__tests__/chart-axis-fidelity.test.tsx src/components/analytics/charts/__tests__/trend-continuity.test.tsx`

- [ ] **Step 10: Commit the chart-system boundary.**

  Run: `git add apps/mobile/src/lib/analytics/chart-style.ts apps/mobile/src/lib/analytics/chart-style.test.ts apps/mobile/src/components/analytics/charts/bar-trend-chart.tsx apps/mobile/src/components/analytics/trends/calories-report.tsx apps/mobile/src/components/analytics/nutrients/vitamin-c-detail-report.tsx apps/mobile/src/components/analytics/trends/logging-consistency-report.tsx apps/mobile/src/components/analytics/charts/__tests__/chart-axis-fidelity.test.tsx apps/mobile/src/components/analytics/charts/__tests__/trend-continuity.test.tsx && git commit -m "refactor: unify analytics chart visual system"`

### Task 2: Macro composition fidelity and shared identities

**Files:**
- Modify: `apps/mobile/src/lib/analytics/macro-geometry.ts`
- Test: `apps/mobile/src/lib/analytics/macro-geometry.test.ts`
- Modify: `apps/mobile/src/components/analytics/charts/macro-chart.tsx`
- Test: `apps/mobile/src/components/analytics/charts/__tests__/macro-chart.test.tsx`
- Modify: `apps/mobile/src/components/analytics/trends/macro-daily-mix-chart.tsx`
- Test: `apps/mobile/src/components/analytics/trends/__tests__/macro-daily-mix-chart.test.tsx`

**Interfaces:**
- `macroColors` and the macro identity map are defined once in `macro-geometry.ts` and imported by donut and daily-mix renderers.
- `macroDonutGeometry(size)` returns the actual radius, stroke width, center diameter, and centered label bounds used by the donut overlay.
- `macroSeparatorLines(segments, size, radius, strokeWidth)` returns the small radial divider geometry at segment boundaries; separators remain white and bounded to the ring.

- [ ] **Step 1: Write failing geometry tests.** Assert the center bounds are centered at `size / 2`, the center hole accounts for stroke geometry, every non-empty macro segment has a separator boundary, and segment colors are stable across the shared identity map.
- [ ] **Step 2: Run the focused geometry test and verify the expected failure.**

  Run: `corepack pnpm --filter @food-tracker/mobile exec vitest run src/lib/analytics/macro-geometry.test.ts`

- [ ] **Step 3: Implement the shared geometry outputs.** Keep existing segment ordering and values; add only reusable center/separator calculations.
- [ ] **Step 4: Rerun the geometry test and verify it passes.**
- [ ] **Step 5: Write failing component assertions.** Render the donut and daily mix, then assert the center stack is vertically centered, white separator elements are present without giant gaps, and the daily mix uses the same colors as the donut.
- [ ] **Step 6: Run the component tests and verify the expected failure.**
- [ ] **Step 7: Adapt the SVG and daily-mix renderers.** Use the shared geometry, draw controlled radial white separators, preserve rounded daily bar tops, and retain accessible labels and null-day behavior.
- [ ] **Step 8: Rerun Macro geometry, Macro component, and daily-mix tests.**
- [ ] **Step 9: Commit the Macro boundary.**

  Run: `git add apps/mobile/src/lib/analytics/macro-geometry.ts apps/mobile/src/lib/analytics/macro-geometry.test.ts apps/mobile/src/components/analytics/charts/macro-chart.tsx apps/mobile/src/components/analytics/charts/__tests__/macro-chart.test.tsx apps/mobile/src/components/analytics/trends/macro-daily-mix-chart.tsx apps/mobile/src/components/analytics/trends/__tests__/macro-daily-mix-chart.test.tsx && git commit -m "fix: restore macro composition Figma fidelity"`

### Task 3: Current-date staging fixture and nutrient/state coverage

**Files:**
- Modify: `apps/api/src/scripts/staging-analytics-fixture.ts`
- Modify: `apps/api/test/staging-analytics-seed.test.ts`

**Interfaces:**
- `buildStagingAnalyticsFixture({ anchorDate, historyDays, timezone })` remains the only fixture constructor; `anchorDate` remains required and dates are generated relative to it.
- The fixture continues to expose `foodLogs`, `foodLogNutrients`, `weightLogs`, `waterLogs`, saved views, and recommendations with the current persistence shape.
- `seedStagingAnalyticsQa` safety and reset behavior remain unchanged.

- [ ] **Step 1: Write failing fixture coverage tests.** For anchor `2026-08-20`, assert the latest food, water, and applicable weight dates reach the anchor/current week; assert `historyDays >= 181`; assert nutrient keys include representative general/energy, carbohydrate/fiber, fat/lipid, protein/amino-acid, vitamin, mineral, caffeine, and omega-3 entries; assert at least one sparse metric and explicit zero remain; assert deterministic fixture output is identical across two builds.
- [ ] **Step 2: Run the focused API test and verify the expected failure.**

  Run: `TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/food_tracker_test corepack pnpm --filter @food-tracker/api exec vitest run test/staging-analytics-seed.test.ts`

- [ ] **Step 3: Extend the deterministic nutrient schedule.** Add supported catalog keys only, use fixed cadence/variation functions, preserve sparse and unknown examples, and intentionally include values that exercise configured minima/limits without changing production calculation code.
- [ ] **Step 4: Preserve current-week/month and long-window behavior.** Keep 7D/30D/90D/custom history, explicit today-in-progress logging, deliberate unlogged/partial days, water logs, and weight history.
- [ ] **Step 5: Rerun the focused fixture test and verify it passes.**
- [ ] **Step 6: Run the full staging seed test file including safety, exact-user targeting, and idempotency.**
- [ ] **Step 7: Commit the fixture boundary.**

  Run: `git add apps/api/src/scripts/staging-analytics-fixture.ts apps/api/test/staging-analytics-seed.test.ts && git commit -m "feat: refresh deterministic staging analytics QA coverage"`

### Task 4: Complex Overview recomposition and Logging Consistency scale

**Files:**
- Modify: `apps/mobile/src/components/analytics/insights/complex-insights-overview.tsx`
- Modify: `apps/mobile/src/components/analytics/insights/energy-balance-card.tsx`
- Modify: `apps/mobile/src/components/analytics/insights/macro-balance-card.tsx`
- Modify: `apps/mobile/src/components/analytics/insights/nutrient-highlights-card.tsx`
- Modify: `apps/mobile/src/components/analytics/insights/hydration-insights-card.tsx`
- Modify: `apps/mobile/src/components/analytics/insights/weight-direction-card.tsx`
- Modify: `apps/mobile/src/components/analytics/insights/logging-consistency-card.tsx`
- Test: `apps/mobile/src/components/analytics/insights/__tests__/complex-overview-layout.test.tsx`
- Test: `apps/mobile/src/components/analytics/insights/__tests__/complex-insights-fidelity.test.tsx`
- Test: `apps/mobile/src/components/analytics/insights/__tests__/logging-consistency-card.test.tsx`

**Interfaces:**
- Existing overview resource/state props and callbacks remain unchanged.
- Complex presentation keeps the approved Figma-sized surfaces: Energy `294`, Macro `316`, Hydration `248`, Weight `250`, and nutrient highlights approximately `300` minimum; Logging Consistency must expose a materially larger, readable heatmap preview than its current compact matrix.
- Simple/compact presentation remains independently sized and continues to render loading, error, unavailable, and empty states.

- [ ] **Step 1: Write failing layout assertions.** Assert the Complex Overview cards expose their required minimum geometries, Logging Consistency uses larger cells/gaps and a readable period preview, and the overview contains all seven approved sections in the existing order.
- [ ] **Step 2: Run the layout tests and verify the expected failure for the new Logging Consistency geometry.**
- [ ] **Step 3: Adjust card composition only in Complex presentation.** Give Energy and Macro enough vertical plot/legend space, keep nutrient status rows and target markers readable, preserve hydration vessels/actions and weight forecast states, and enlarge Logging Consistency heatmap/card spacing without changing data semantics.
- [ ] **Step 4: Add/adjust fidelity tests for empty/error/unavailable states.** Explicitly retain energy trend unavailable, nutrient no-reference, hydration no-today-data, and weight forecast unavailable behavior.
- [ ] **Step 5: Run the focused Overview test suite and verify it passes.**

  Run: `corepack pnpm --filter @food-tracker/mobile exec jest --runInBand src/components/analytics/insights/__tests__/complex-overview-layout.test.tsx src/components/analytics/insights/__tests__/complex-insights-fidelity.test.tsx src/components/analytics/insights/__tests__/logging-consistency-card.test.tsx`

- [ ] **Step 6: Commit the Overview boundary.**

  Run: `git add apps/mobile/src/components/analytics/insights/complex-insights-overview.tsx apps/mobile/src/components/analytics/insights/energy-balance-card.tsx apps/mobile/src/components/analytics/insights/macro-balance-card.tsx apps/mobile/src/components/analytics/insights/nutrient-highlights-card.tsx apps/mobile/src/components/analytics/insights/hydration-insights-card.tsx apps/mobile/src/components/analytics/insights/weight-direction-card.tsx apps/mobile/src/components/analytics/insights/logging-consistency-card.tsx apps/mobile/src/components/analytics/insights/__tests__/complex-overview-layout.test.tsx apps/mobile/src/components/analytics/insights/__tests__/complex-insights-fidelity.test.tsx apps/mobile/src/components/analytics/insights/__tests__/logging-consistency-card.test.tsx && git commit -m "fix: recompose complex analytics overview"`

### Task 5: Integrated validation, visual review, staging handoff, and closeout

**Files:**
- Modify: `docs/superpowers/phase-17-5-simulator-visual-validation.md` or the existing Phase 17.5 visual evidence document that owns the new captures
- Modify: `docs/roadmap.md` only if the current phase-level completion wording is demonstrably stale after validation

- [ ] **Step 1: Verify the test database and environment.** Run `node -v`, `corepack pnpm -v`, confirm PostgreSQL readiness, and set `TEST_DATABASE_URL` to the dedicated `food_tracker_test` database before Prisma/test commands.
- [ ] **Step 2: Run Prisma validation/generation and focused changed-file format checks.**

  Run: `corepack pnpm prisma:generate`; `corepack pnpm prisma:validate`; `corepack pnpm exec prettier --check <each changed tracked file>`.

- [ ] **Step 3: Run the mobile Vitest/Jest suites, mobile typecheck/lint, API typecheck/lint/build, shared typecheck/build, and the full API suite against `food_tracker_test`.** Record exact commands, counts, and any environment blockers.
- [ ] **Step 4: Run the required root sequence under Node 22.**

  Run: `corepack pnpm format:check`; `corepack pnpm lint`; `corepack pnpm typecheck`; `corepack pnpm build`; `corepack pnpm test`; `git diff --check`.

- [ ] **Step 5: Run the real Simulator visual loop.** Prove boot, install, launch, signed-in seeded QA state, and inspect the final Figma surfaces: Complex Overview, Calories, Protein, Sodium, Vitamin C, Macros, Hydration, Logging Consistency, and representative Nutrient Library states. Record discrepancies and corrections; do not count 402pt or old 368pt captures as 390/393 evidence.
- [ ] **Step 6: Apply the guarded staging seed only to the explicit existing Firebase-linked staging QA account.** Use `--anchor-date 2026-08-20 --reset`, verify current-week/month and special-metric availability, and do not print or commit credentials. Do not create another account or deploy unless a genuine backend/runtime change requires staging deployment.
- [ ] **Step 7: Update the visual evidence document with Figma node IDs, runtime screenshot paths/evidence, reviewer findings, known exact-viewport limitations, and the mandatory physical-iPhone status `PENDING USER RE-VALIDATION`.**
- [ ] **Step 8: Perform final completion audit and handoff.** Run `git status --short --branch`, `git branch -vv`, `git log --oneline main..HEAD`, and `git diff --check`; stage only intended paths; push the branch if all validation is complete; do not merge or create a PR.
