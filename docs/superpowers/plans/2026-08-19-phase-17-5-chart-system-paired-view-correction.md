# Phase 17.5 chart system and paired-view correction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Phase 17.5 analytics charts, comparisons, paired navigation, references, hydration copy, and overview composition match the physical-device correction brief without changing backend facts.

**Architecture:** Extend the existing React Native/SVG chart primitives with pure axis/tick presentation helpers. Keep overview mini-charts and specialized Weight, Hydration, Logging Consistency, and macro representations distinct from the full daily-intake hybrid chart family. Build paired navigation from the active canonical `TrendQueryInput`, and preserve the existing shared reference contract.

**Tech Stack:** TypeScript, React Native, Expo Router, NativeWind, `react-native-svg`, Jest/RNTL, Vitest, PostgreSQL-backed API tests.

**Spec:** `docs/superpowers/specs/2026-08-19-phase-17-5-chart-system-paired-view-correction-design.md`

## Global Constraints

- Stay on `phase-17-5-custom-analytics`; do not create a PR, merge, production deployment, or force-push.
- Preserve `.agents/`, `.aidesigner/`, `.codex/`, `backups/`, and `docs/design-references/current images/`.
- Node must be `v22.x`; pnpm must be `10.34.3`.
- Do not edit Prisma schema/migrations, dependencies, or backend analytics semantics.
- Unknown values remain unknown; explicit zero remains zero; missing observations never become zero bars.
- Logging-day completeness remains separate from metric coverage.
- Weight, Hydration, Logging Consistency, and macro composition retain specialized representations.
- Physical iPhone validation remains `PENDING USER RE-VALIDATION`.

---

### Task 1: Add pure adaptive axis and reference presentation helpers

**Files:**
- Create: `apps/mobile/src/lib/analytics/chart-axis.ts`
- Create: `apps/mobile/src/lib/analytics/chart-axis.test.ts`
- Modify: `apps/mobile/src/lib/analytics/chart-domain.ts`
- Test: `apps/mobile/src/lib/analytics/chart-domain.test.ts`

**Interfaces:**
- `selectDateTickIndexes(dates: readonly string[], periodDays?: number): number[]` returns ordered, deduplicated indexes with endpoint coverage and adaptive density.
- `numericAxisTicks(domain: { minimum: number; maximum: number }, options?: { targetCount?: number; includeZero?: boolean }): number[]` returns finite, ordered, human-readable scale values.
- `axisReferenceLabel(reference: AnalyticsReference): string | null` returns labeled target/minimum/limit/range copy using the canonical unit and returns null for `none`.

- [ ] **Step 1: Write the failing helper tests.** Cover 7D daily/alternate ticks, 30D weekly anchors, 90D monthly-or-2–4-week anchors, custom-length density, endpoint inclusion, no ISO label output, zero inclusion for additive domains, tight non-zero domains for Weight, and labeled target/limit/range references.
- [ ] **Step 2: Run the focused tests and verify expected failures.**

Run: `corepack pnpm --filter @food-tracker/mobile exec jest --runInBand src/lib/analytics/chart-axis.test.ts src/lib/analytics/chart-domain.test.ts`

Expected: new helper imports or assertions fail because adaptive tick and semantic reference helpers do not yet exist.
- [ ] **Step 3: Implement the pure helpers.** Use UTC/noon date-only parsing, preserve date positions, avoid locale-dependent raw ISO output, round tick steps to readable 1/2/5 multiples, and never mutate canonical data.
- [ ] **Step 4: Run the focused tests and verify green.**
- [ ] **Step 5: Commit the helper slice.**

Run: `git add apps/mobile/src/lib/analytics/chart-axis.ts apps/mobile/src/lib/analytics/chart-axis.test.ts apps/mobile/src/lib/analytics/chart-domain.ts apps/mobile/src/lib/analytics/chart-domain.test.ts && git commit -m "feat: add analytics chart axis helpers"`

### Task 2: Render real axes and hybrid detail charts

**Files:**
- Modify: `apps/mobile/src/components/analytics/charts/cartesian-plot.tsx`
- Modify: `apps/mobile/src/components/analytics/charts/bar-trend-chart.tsx`
- Modify: `apps/mobile/src/components/analytics/charts/line-trend-chart.tsx`
- Modify: `apps/mobile/src/components/analytics/charts/forecast-chart.tsx`
- Modify: `apps/mobile/src/lib/analytics/trend-presentation.ts`
- Modify: `apps/mobile/src/app/trends/[metric].tsx`
- Test: `apps/mobile/src/components/analytics/charts/__tests__/trend-continuity.test.tsx`
- Test: `apps/mobile/src/components/analytics/charts/__tests__/chart-axis-fidelity.test.tsx`
- Test: `apps/mobile/src/components/analytics/trends/__tests__/core-trend-reports-fidelity.test.tsx`

**Interfaces:**
- Full chart components accept `dates`, `periodDays`, `unit`, `showAxes`, and a semantic reference label while preserving existing overview defaults.
- `coreTrendPresentation()` returns `bars_with_trend` for additive daily metrics and nutrient metrics, while retaining `weight_line`, `macro`, and logging-specific presentations.

- [ ] **Step 1: Add failing render tests.** Assert that full charts expose human-readable X ticks, numeric Y ticks with units, restrained grid lines, semantic reference text, bars for raw values, a separate trend path, and no bar for a null observation while the date remains represented.
- [ ] **Step 2: Run the focused tests and verify the failures.**
- [ ] **Step 3: Implement the smallest axis layout.** Keep chart plot geometry separate from axis gutters; use the shared helpers; default `showAxes` off for overview mini-charts; use zero-inclusive domains for additive bars and preserve non-zero Weight domains.
- [ ] **Step 4: Expand the presentation registry and route wiring.** Pass canonical dates, aggregation/range length, units, trend values, reference/range, and semantic reference labels from `[metric].tsx`; do not compute nutrition facts in mobile.
- [ ] **Step 5: Run chart and trend focused tests; refactor only while green.**
- [ ] **Step 6: Commit the chart-system slice.**

Run: `git add apps/mobile/src/components/analytics/charts apps/mobile/src/lib/analytics/trend-presentation.ts apps/mobile/src/app/trends/'[metric].tsx' apps/mobile/src/components/analytics/charts/__tests__ apps/mobile/src/components/analytics/trends/__tests__/core-trend-reports-fidelity.test.tsx && git commit -m "feat: add axes to detailed analytics charts"`

### Task 3: Preserve specialized Weight and Hydration chart families

**Files:**
- Modify: `apps/mobile/src/components/analytics/trends/weight-report.tsx`
- Modify: `apps/mobile/src/components/analytics/trends/hydration-report.tsx`
- Modify: `apps/mobile/src/components/analytics/trends/hydration-target-card.tsx`
- Test: `apps/mobile/src/components/analytics/trends/__tests__/weight-report.test.tsx`
- Test: `apps/mobile/src/components/analytics/trends/__tests__/hydration-report.test.tsx`

- [ ] **Step 1: Add failing tests.** Assert Weight has raw points, a non-zero Y domain, X-axis date context, target/forecast treatment, and no nutrient bars. Assert Hydration has rounded blue vessel columns, explicit goal labeling, X/Y context, and missing days that remain missing.
- [ ] **Step 2: Run the focused tests and verify red.**
- [ ] **Step 3: Implement specialized layouts.** Reuse axis helpers and existing canonical values; keep hydration-specific colors and persistence, and do not force a zero baseline onto Weight.
- [ ] **Step 4: Run the focused tests and verify green.**
- [ ] **Step 5: Commit the specialized chart slice.**

Run: `git add apps/mobile/src/components/analytics/trends/weight-report.tsx apps/mobile/src/components/analytics/trends/hydration-report.tsx apps/mobile/src/components/analytics/trends/hydration-target-card.tsx apps/mobile/src/components/analytics/trends/__tests__/weight-report.test.tsx apps/mobile/src/components/analytics/trends/__tests__/hydration-report.test.tsx && git commit -m "fix: preserve specialized weight and hydration charts"`

### Task 4: Give comparison charts a shared timeline and truthful legend

**Files:**
- Modify: `apps/mobile/src/components/analytics/charts/comparison-chart.tsx`
- Modify: `apps/mobile/src/components/analytics/trends/comparison-trend-report.tsx`
- Modify: `apps/mobile/src/components/analytics/nutrients/nutrient-pair-report.tsx`
- Test: `apps/mobile/src/components/analytics/charts/comparison-chart.test.tsx`
- Test: `apps/mobile/src/components/analytics/trends/__tests__/comparison-fidelity.test.tsx`
- Test: `apps/mobile/src/components/analytics/trends/__tests__/comparison-trend-report.test.tsx`

- [ ] **Step 1: Add failing tests.** Assert 3–5 shared X ticks, shared-date selection guide, independent dual Y scales, and legend/axis/tooltip colors matching the actual primary and comparison paths.
- [ ] **Step 2: Run focused comparison tests and verify red.**
- [ ] **Step 3: Implement a series-color map passed to plot and legend.** Render date ticks from the shared primary/comparison date domain, preserve normalized percentages where required, and keep selection synchronized by date.
- [ ] **Step 4: Run focused tests and verify green.**
- [ ] **Step 5: Commit the comparison slice.**

Run: `git add apps/mobile/src/components/analytics/charts/comparison-chart.tsx apps/mobile/src/components/analytics/trends/comparison-trend-report.tsx apps/mobile/src/components/analytics/nutrients/nutrient-pair-report.tsx apps/mobile/src/components/analytics/charts/comparison-chart.test.tsx apps/mobile/src/components/analytics/trends/__tests__/comparison-fidelity.test.tsx apps/mobile/src/components/analytics/trends/__tests__/comparison-trend-report.test.tsx && git commit -m "fix: add shared comparison chart timeline"`

### Task 5: Correct paired-view query construction and navigation

**Files:**
- Modify: `apps/mobile/src/lib/analytics/trend-routing.ts`
- Modify: `apps/mobile/src/app/trends/[metric].tsx`
- Modify: `apps/mobile/src/components/analytics/nutrients/related-metric-card.tsx`
- Modify: `apps/mobile/src/components/analytics/nutrients/nutrient-pair-report.tsx`
- Test: `apps/mobile/src/lib/analytics/trend-routing.test.ts`
- Test: `apps/mobile/src/components/analytics/nutrients/__tests__/related-nutrient-fidelity.test.tsx`
- Test: `apps/mobile/src/components/analytics/nutrients/__tests__/vitamin-c-detail-report.test.tsx`
- Test: `apps/mobile/src/app/trends/__tests__/trend-detail.test.tsx`

**Interfaces:**
- `pairedTrendQuery(active: TrendQueryInput, relatedMetric: AnalyticsMetricKey): TrendQueryInput` preserves all active query controls, sets `primaryMetric` to the current metric, and sets `comparisonMetric` to the related metric.
- `pairedTrendRoute(active, relatedMetric): { pathname: string; params: { query: string } }` routes to the current primary metric comparison report.

- [ ] **Step 1: Write failing pure-query tests** for Iron + Vitamin C and Sodium + Potassium, including period, aggregation, visualization, `showReference`, and coverage preservation.
- [ ] **Step 2: Run the focused routing test and verify red.**
- [ ] **Step 3: Implement the pure query/route helpers.** Do not drop `includeForecast` when present; do not route to the secondary standalone detail.
- [ ] **Step 4: Wire both nutrient detail callbacks through the helper.**
- [ ] **Step 5: Add failing/then passing route assertions** that the pushed pathname is the current primary metric and serialized query contains the comparison metric.
- [ ] **Step 6: Commit the paired navigation slice.**

Run: `git add apps/mobile/src/lib/analytics/trend-routing.ts apps/mobile/src/app/trends/'[metric].tsx' apps/mobile/src/components/analytics/nutrients/related-metric-card.tsx apps/mobile/src/components/analytics/nutrients/nutrient-pair-report.tsx apps/mobile/src/lib/analytics/trend-routing.test.ts apps/mobile/src/components/analytics/nutrients/__tests__ apps/mobile/src/app/trends/__tests__/trend-detail.test.tsx && git commit -m "fix: open nutrient paired comparisons directly"`

### Task 6: Preserve one authoritative reference across surfaces

**Files:**
- Modify only if a failing regression proves a needed source fix: `apps/api/src/modules/analytics/trends/service.ts`, `apps/api/src/modules/analytics/trends/references.ts`, or `apps/mobile/src/lib/analytics/saved-view-configuration.ts`
- Modify: `apps/mobile/src/components/analytics/nutrients/nutrient-reference-summary.tsx`
- Modify: `apps/mobile/src/lib/analytics/trend-data-state.ts`
- Test: `apps/api/test/analytics-trends-api.test.ts`
- Test: `apps/api/test/analytics-insights-overview.test.ts`
- Test: `apps/mobile/src/components/analytics/nutrients/__tests__/nutrient-reference-fidelity.test.tsx`
- Test: `apps/mobile/src/app/trends/__tests__/trend-detail.test.tsx`

- [ ] **Step 1: Add a failing regression** that an active Vitamin C query with `showReference: true` returns and renders the same 90 mg minimum in detail, Highlights, nutrient summary, and paired context; add a separate test proving `showReference: false` is intentionally unavailable.
- [ ] **Step 2: Run the focused API/mobile tests and classify the failure boundary.** A failure before response construction is an API/query issue; a response with 90 mg that renders unavailable is a mobile adapter issue.
- [ ] **Step 3: Implement only the smallest boundary fix.** Reuse `metricReference()`/canonical reference data; never hard-code 90 in the detail component.
- [ ] **Step 4: Add semantic chart labels for minimum/limit/target/range and run focused tests.**
- [ ] **Step 5: Commit the reference slice only after the root cause is evidenced.**

### Task 7: Correct hydration state copy and overview phone composition

**Files:**
- Modify: `apps/mobile/src/components/analytics/insights/hydration-insights-card.tsx`
- Modify: `apps/mobile/src/components/analytics/insights/logging-consistency-card.tsx`
- Modify: `apps/mobile/src/components/analytics/insights/nutrient-highlights-card.tsx`
- Modify: `apps/mobile/src/components/reporting-section-heading.tsx`
- Modify: `apps/mobile/src/components/reporting-icon.tsx`
- Modify: `apps/mobile/src/components/analytics/insights/insights-period-summary.tsx`
- Test: `apps/mobile/src/components/analytics/insights/__tests__/hydration-insights-card.test.tsx`
- Test: `apps/mobile/src/components/analytics/insights/__tests__/complex-overview-layout.test.tsx`
- Test: `apps/mobile/src/components/analytics/insights/__tests__/logging-consistency-card.test.tsx`
- Test: `apps/mobile/src/components/analytics/insights/__tests__/nutrient-highlights-card.test.tsx`

- [ ] **Step 1: Add failing state/copy tests.** Cover no water today with recorded history, no hydration history, request failure, and unknown goal. Assert no “Water data unavailable” for a successful no-water-today state.
- [ ] **Step 2: Add failing geometry/icon tests.** Assert section badges still contain their icon paths under marker-color overrides, Logging Consistency overview cells meet the detail-referenced minimum size, and the month summary has sufficient height/padding without disabling font scaling.
- [ ] **Step 3: Run focused tests and verify red.**
- [ ] **Step 4: Implement state-to-copy mapping and composition changes.** Keep overview density distinct from detail density, preserve status/reference semantics in Nutrient Highlights, and render icon plus colored badge rather than replacing the icon with a plain dot.
- [ ] **Step 5: Run focused tests and verify green.**
- [ ] **Step 6: Commit the overview slice.**

Run: `git add apps/mobile/src/components/analytics/insights apps/mobile/src/components/reporting-section-heading.tsx apps/mobile/src/components/reporting-icon.tsx apps/mobile/src/components/analytics/insights/__tests__ && git commit -m "fix: refine analytics overview states and composition"`

### Task 8: Evidence capture, validation, and handoff

**Files:**
- Modify: `docs/superpowers/phase-17-5-physical-fidelity-recovery.md`
- Modify: `docs/superpowers/phase-17-5-fidelity-capture-ledger.md` only for new evidence rows
- Evidence: `/tmp/food-tracker-phase17-5-chart-correction/`

- [ ] **Step 1: Run focused mobile tests for every changed workstream.** Record exact pass/fail counts and preserve any environment blocker.
- [ ] **Step 2: Run the real app smoke path where the environment allows.** Review Sodium 30D, Vitamin C 30D, Calories 30D, Protein 30D, Weight, Hydration, Protein + Weight, Iron + Vitamin C, Complex Insights, Nutrient Highlights, Logging Consistency overview, and detail.
- [ ] **Step 3: Capture before/after screenshots and record structural, axes, data-mark, trend, reference, typography, spacing, color, and interaction findings.** Do not count 402pt or old 368pt captures as required 390/393 evidence.
- [ ] **Step 4: Run the required full sequence under Node 22.23.0 and pnpm 10.34.3:** `format:check`, `lint`, `typecheck`, `build`, `test`, and `git diff --check`; force API tests to `food_tracker_test` and report PostgreSQL blockers exactly if present.
- [ ] **Step 5: Audit Git state and protected paths.** Run `git status --short --branch`, `git branch -vv`, `git log --oneline main..HEAD`, and `git diff --check`; stage only intentional tracked paths.
- [ ] **Step 6: Update the phase closeout docs** with changed scope, root causes, validation, Simulator status, physical status as pending user re-validation, known limitations, and next step.
