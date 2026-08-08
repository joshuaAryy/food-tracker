# Phase 17.5 Custom Analytics, Micronutrients, and Hydration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:test-driven-development` for each implementation task and `superpowers:verification-before-completion` before any completion claim. This plan uses user-controlled review/commit checkpoints; Codex must not stage, commit, push, merge, switch branches, or delete branches.

**Goal:** Deliver the approved Phase 17.5 Insights and Trends system, full Complex nutrient analytics, canonical water logging and hydration, comparisons, saved/pinned views, deterministic forecasts, offline/stale behavior, and Progress/History integration without weakening Simple mode or historical nutrition semantics.

**Architecture:** Add one canonical backend analytics engine over authoritative FoodLogs, WeightLogs, and WaterLogs. Shared Zod contracts define metrics, periods, aggregation, logging completeness, metric coverage, comparisons, references, saved views, and chart-ready responses. Mobile renders those backend facts through reusable SVG/gesture primitives and never calculates nutrition analytics, contributors, target state, or forecasts.

**Tech Stack:** Node 22, pnpm 10.34.3, TypeScript, Zod, Express 5, Prisma 6/PostgreSQL, Vitest, Expo 56, React Native 0.85, Expo Router, NativeWind, Zustand, React Native SVG, Gesture Handler, Reanimated, React Native Testing Library, Firebase Authentication, Railway staging.

---

## 1. Frozen scope and operating constraints

- Approved design source: Figma file `GFLStsF0ADwaizoVKGeLny`, page `338:21`, with handoff contract `517:73` and final-node index `524:21` authoritative over hidden drafts.
- Keep the existing branch `phase-17-5-custom-analytics`. The plan does not authorize creating or switching branches.
- Preserve all existing dirty, untracked, ignored, protected, and design-reference state.
- Before touching an already-dirty documentation path, inspect and reconcile the user's diff; never overwrite it wholesale.
- Backend owns aggregation, completeness, comparisons, contributors, reference state, deterministic interpretations, saved-view validation, and forecasts.
- Mobile owns presentation, transient UI state, pixel geometry, gesture state, and local cache mechanics.
- AI must not query the database, calculate analytics, identify deficits, select models, produce forecast values, or decide recommendation facts.
- FoodLog nutrient snapshots and WeightLogs remain authoritative. Missing provider fields never become zero.
- Simple and Complex are product boundaries, not visual themes over the same controls.
- Do not add supplements, target-editing UI, landscape/tablet optimization, Reduced Motion implementation, or a View Data accessibility table.
- Do not redesign Progress or recreate the existing global launcher.
- No generated native project, hosted resource, Firebase/Railway configuration, environment file, or secret changes are part of implementation.

### Locked user decisions

- True micronutrient ranges are contract-supported but render only when the backend has authoritative lower and upper bounds. Do not copy illustrative Figma values into production defaults.
- Hydration is available in both modes with a server-owned `2000 mL/day` default. Legacy `waterTrackingEnabled` remains compatible but does not gate visibility.
- The Phase 17.5 amount/time logger creates Water entries only. No drink-type picker or free-text drink label is added.
- Water History remains editable.
- Calorie and Weight projections are both seven days; Weight is statistically independent from calorie intake.
- Internal coverage enum is `all_logged_days`; its user-facing Figma label remains “All recorded days.”
- Weekly/monthly buckets preserve logging and metric state primarily as independent counts. They do not synthesize a single state unless a later approved UI contract explicitly requires one.

---

## 2. Canonical domain contracts

Create `packages/shared/src/analytics-metrics.ts`, `packages/shared/src/analytics-trends.ts`, `packages/shared/src/analytics-saved-views.ts`, and `packages/shared/src/water.ts`; export them from `packages/shared/src/index.ts`.

### 2.1 Metric registry

```ts
export type AnalyticsMetricKey =
  | Exclude<NutrientKey, 'water'>
  | 'weight'
  | 'macroComposition'
  | 'loggingConsistency'
  | 'hydration';

export type AnalyticsUnit = NutrientUnit | 'lb' | 'percent' | 'mL' | 'composition';

export type AnalyticsVisualization =
  | 'automatic'
  | 'bars_with_trend'
  | 'smoothed_line'
  | 'macro_donut'
  | 'stacked_macros'
  | 'completeness_heatmap'
  | 'meal_coverage_heatmap'
  | 'linked_trends'
  | 'dual_axis'
  | 'reference_normalized';

export interface AnalyticsMetricDefinition {
  key: AnalyticsMetricKey;
  displayName: string;
  group: ReportingNutrientGroup | 'body' | 'behavior' | 'hydration';
  unit: AnalyticsUnit;
  simpleAvailable: boolean;
  complexAvailable: boolean;
  searchableTerms: readonly string[];
  supportedVisualizations: readonly AnalyticsVisualization[];
  supportedAggregations: readonly AnalyticsAggregation[];
  supportedCoverageFilters: readonly AnalyticsCoverageFilter[];
  referenceSupport: 'none' | 'target' | 'minimum' | 'limit' | 'range';
}
```

- Derive nutrient names, units, aliases, and groups from `NUTRIENT_CATALOG`; do not duplicate the catalog.
- Keep mobile colors and Figma styling out of the shared registry.
- Simple allowlist: Calories, Protein, Carbohydrates, Fat, Macro Composition, Weight, Hydration, Logging Consistency.
- Complex adds the full supported nutrient catalog, custom ranges, advanced coverage, comparisons, saved views, and forecasts where applicable.
- Backend validation rejects mode-inaccessible metrics and controls even if a stale/deep link bypasses mobile hiding.

### 2.2 Period and aggregation

```ts
export type AnalyticsPeriod =
  | { kind: 'relative'; days: number }
  | { kind: 'custom'; startDate: string; endDate: string };

export type AnalyticsAggregation = 'automatic' | 'daily' | 'weekly' | 'monthly';
```

- 7D and 30D default to Daily.
- 90D defaults to Weekly.
- Custom 1–45 days defaults to Daily, 46–180 to Weekly, and 181+ to Monthly.
- Complex overrides allow Daily through 180 days, Weekly from 14 days, and Monthly from 90 days.
- Reject future dates, reversed ranges, and dates before the first eligible authoritative log.
- Weekly/monthly intake values are averages of numerically eligible daily totals, never averages created by filling missing days with zero.
- Weight buckets use recorded weigh-ins and retain raw points independently.
- Charts retain all returned points while mobile reduces only label density.

### 2.3 Orthogonal logging and metric coverage

```ts
export type LoggingDayState = 'complete' | 'partial' | 'unlogged';
export type LoggingDayPhase = 'closed' | 'in_progress';
export type MetricDataState = 'recorded' | 'partial' | 'unknown';

export type AnalyticsCoverageFilter =
  | 'all_logged_days'
  | 'complete_and_partial'
  | 'complete_only';
```

`LoggingDayState` is derived only from FoodLog/meal behavior. `MetricDataState` is derived only from the selected metric's presence in authoritative snapshots.

Initial logging-completeness policy lives in `apps/api/src/modules/analytics/trends/logging-day-policy.ts`:

```ts
export interface LoggingDayPolicy {
  version: string;
  requiredMealTypes: readonly MealType[];
  optionalMealTypes: readonly MealType[];
}

export const INITIAL_LOGGING_DAY_POLICY: LoggingDayPolicy = {
  version: 'phase-17.5-v1',
  requiredMealTypes: ['breakfast', 'lunch', 'dinner'],
  optionalMealTypes: ['snack', 'other'],
};
```

The Breakfast + Lunch + Dinner threshold is an explicit initial implementation policy supported by the Figma meal-coverage presentation, not an immutable product requirement. Record it in `docs/technical-decisions.md`; any change requires product evidence and updated policy tests.

Logging rules:

- A closed day with all policy-required meal types is `complete`.
- A closed day with at least one FoodLog but missing a required meal type is `partial`.
- A day with no FoodLogs is `unlogged`.
- The current local day uses `phase: 'in_progress'` and is never eligible as a closed complete day, even if all required meals have already been logged.
- Logging Consistency and meal-coverage heatmaps depend only on these facts.

Metric rules for a logged day:

- `recorded`: every relevant authoritative FoodLog records the selected metric.
- `partial`: at least one but not every relevant authoritative FoodLog records it.
- `unknown`: FoodLogs exist but none record it.
- Explicit numeric zero is `recorded` with `value: 0`.
- An unlogged day has `metricDataState: null`.
- Missing micronutrient data never downgrades logging completeness.

Required daily point contract:

```ts
export interface AnalyticsDailyPoint {
  kind: 'daily';
  date: string;
  loggingDayState: LoggingDayState;
  loggingDayPhase: LoggingDayPhase;
  metricDataState: MetricDataState | null;
  value: number | null;
  normalizedValue?: number;
  foodLogCount: number;
  metricRecordedLogCount: number;
  metricUnknownLogCount: number;
}
```

Required aggregated bucket contract:

```ts
export interface AnalyticsAggregatedPoint {
  kind: 'aggregated';
  bucketStartDate: string;
  bucketEndDate: string;
  value: number | null;
  normalizedValue?: number;
  loggingCounts: {
    complete: number;
    partial: number;
    inProgress: number;
    unlogged: number;
  };
  metricCounts: {
    recorded: number;
    partial: number;
    unknown: number;
  };
  numericDayCount: number;
}

export type AnalyticsPoint = AnalyticsDailyPoint | AnalyticsAggregatedPoint;
```

Do not add one collapsed weekly/monthly logging or metric state. If a future UI needs a derived summary state, add it as an explicitly named derived field with documented precedence and tests rather than overloading the source counts.

Coverage filters operate only on logging behavior:

- `all_logged_days` (“All recorded days”): admits complete, partial, and logged in-progress days. Unlogged days remain gaps.
- `complete_and_partial`: admits closed complete and closed partial days; excludes in-progress and unlogged days.
- `complete_only`: admits only closed logging-complete days.

After logging filtering, metric rules still apply:

- Recorded values participate numerically, including zero.
- Partial metric values participate with explicit partial-data metadata and interpretation.
- Unknown values remain gaps and never participate numerically.
- All responses retain independent logging and metric counts so exclusions remain explainable.

### 2.4 References

```ts
export type AnalyticsReference =
  | {
      kind: 'target' | 'minimum' | 'limit';
      value: number;
      unit: AnalyticsUnit;
      source: 'user' | 'derived' | 'default';
    }
  | {
      kind: 'range';
      lower: number;
      upper: number;
      unit: AnalyticsUnit;
      source: 'user' | 'derived' | 'default';
    }
  | {
      kind: 'none';
      unit: AnalyticsUnit;
      reason: 'not_configured' | 'not_applicable';
    };
```

- Require finite `lower < upper` for ranges.
- Never fabricate a range from one target.
- Adapt existing calorie accepted ranges only because both bounds are deterministically available.
- Preserve existing target/minimum/limit sources without adding generic micronutrient target persistence or editing UI.

### 2.5 Trend query and response

```ts
export interface TrendQueryInput {
  primaryMetric: AnalyticsMetricKey;
  comparisonMetric?: AnalyticsMetricKey;
  period: AnalyticsPeriod;
  aggregation: AnalyticsAggregation;
  visualization: AnalyticsVisualization;
  showReference: boolean;
  coverageFilter: AnalyticsCoverageFilter;
  includeForecast?: boolean;
}
```

The response must include resolved timezone/range/aggregation, mode, comparison strategy, fixed full-period axis domains, series points, references, summaries, independent coverage counts, contributor summary where applicable, deterministic interpretation facts, first eligible date, today, and forecast availability/result.

---

## 3. Persistence and API boundaries

### 3.1 WaterLog

Modify `apps/api/prisma/schema.prisma` and create `apps/api/prisma/migrations/20260808090000_add_water_logs_and_hydration_goal/migration.sql`:

```prisma
model WaterLog {
  id        String   @id @default(uuid()) @db.Uuid
  userId    String   @db.Uuid
  amountMl  Int
  loggedAt  DateTime @db.Timestamptz
  createdAt DateTime @default(now()) @db.Timestamptz
  updatedAt DateTime @updatedAt @db.Timestamptz
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([userId, loggedAt])
}
```

- Add `waterLogs WaterLog[]` to `User`.
- Add `dailyWaterGoalMl Int @default(2000)` to `TrackingPreference`.
- Retain `waterTrackingEnabled` unchanged but do not use it as a visibility gate.
- Define strict input `{ amountMl: z.number().int().min(1).max(5000), loggedAt: z.iso.datetime() }`.
- All create/edit/delete routes derive `userId` from authentication.
- Hydration analytics use only WaterLogs. Food nutrient `water` remains excluded.

Routes in `apps/api/src/modules/waterLogs/routes.ts`:

```text
GET    /api/v1/water-logs?date=YYYY-MM-DD
GET    /api/v1/water-logs?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
GET    /api/v1/water-logs/:id
POST   /api/v1/water-logs
PUT    /api/v1/water-logs/:id
DELETE /api/v1/water-logs/:id
```

### 3.2 Saved views and analytics preferences

Create `apps/api/prisma/migrations/20260808100000_add_analytics_saved_views/migration.sql` with additive `AnalyticsSavedView` and `AnalyticsPreference` tables.

Persist saved-view fields as name, primary metric, optional comparison metric, relative `periodDays`, aggregation, visualization, reference visibility, coverage filter, `sortOrder`, and timestamps. Store metric/visualization values as validated strings so an unavailable future metric does not destroy the saved record.

`AnalyticsPreference` is one row per user and stores:

```ts
interface AnalyticsPreferenceValue {
  preferredSimpleMetric: AnalyticsMetricKey;
  pinnedSavedViewId: string | null;
}
```

Lifecycle:

```text
save → open → modify temporarily → update existing / save as new
rename → duplicate → pin → unpin → reorder → delete
```

- Exactly one nullable pinned pointer exists per user.
- Pinning replaces the pointer transactionally after ownership validation.
- Unpinning sets `pinnedSavedViewId` to `null` and restores Calories fallback.
- Deleting the pinned view clears the pointer in the same transaction.
- Reordering changes only Saved Views library order.
- Saving a Custom range persists its inclusive day count as a rolling relative period.
- Preserve unavailable metrics and return replacement metadata.
- Poor data coverage does not block saving.

Routes:

```text
GET    /api/v1/analytics/preferences
PUT    /api/v1/analytics/preferences
GET    /api/v1/analytics/saved-views
POST   /api/v1/analytics/saved-views
PATCH  /api/v1/analytics/saved-views/:id
DELETE /api/v1/analytics/saved-views/:id
POST   /api/v1/analytics/saved-views/:id/duplicate
PUT    /api/v1/analytics/saved-views/order
```

`PUT /analytics/preferences` accepts `pinnedSavedViewId: string | null`; `null` is explicit unpin.

### 3.3 Trends and Insights routes

Create `apps/api/src/modules/analytics/trends/routes.ts` and register it in `apps/api/src/routes/api.ts`:

```text
GET  /api/v1/analytics/trends/catalog
POST /api/v1/analytics/trends/query
POST /api/v1/analytics/trends/contributors
GET  /api/v1/analytics/insights?period=week|month
```

- Keep `/analytics/reports`, `/analytics/progress`, and `/analytics/advanced` temporarily compatible.
- Phase 17.5 Insights and all Trends screens consume only canonical contracts.
- Never pass legacy `{ logged: false, calories: 0 }` data into a Phase 17.5 component.
- Add regression tests rejecting adapters/defaults that convert missing values with `?? 0` or zero-filled arrays.
- By Slice C, every number on Insights—averages, summaries, target status, charts, comparisons, and interpretations—comes from the canonical engine.

---

## 4. Chart, interaction, and mobile architecture

### Dependency decision

Use a hybrid low-level chart system:

- installed `react-native-svg` for visual primitives;
- installed Gesture Handler for scrub/range gestures;
- installed Reanimated for selected guides and restrained transitions;
- native React Native text/controls for accessibility;
- pure TypeScript domain/geometry helpers for tests.

Do not add Victory Native, Skia, D3, or another chart framework. Add only Expo-compatible `expo-haptics ~56.0.3`.

### Mobile routes

Create:

- `apps/mobile/src/app/trends/index.tsx`
- `apps/mobile/src/app/trends/[metric].tsx`
- `apps/mobile/src/app/trends/configure.tsx`
- `apps/mobile/src/app/trends/custom-range.tsx`
- `apps/mobile/src/app/trends/saved-views.tsx`
- `apps/mobile/src/app/trends/save-view.tsx`
- `apps/mobile/src/app/trends/contributors.tsx`
- `apps/mobile/src/app/water-log.tsx`

Register modal/full-screen behavior in `apps/mobile/src/app/_layout.tsx`.

### Reusable chart files

Create:

- `apps/mobile/src/components/analytics/charts/chart-frame.tsx`
- `cartesian-plot.tsx`
- `bar-trend-chart.tsx`
- `line-trend-chart.tsx`
- `macro-chart.tsx`
- `heatmap-chart.tsx`
- `comparison-chart.tsx`
- `forecast-chart.tsx`
- `chart-selection-overlay.tsx`
- `apps/mobile/src/lib/analytics/chart-domain.ts`
- `chart-geometry.ts`
- `chart-interaction.ts`

Required primitives: daily bars plus rolling trend, weekly aggregates plus longer trend, smoothed line, raw points, reference band, threshold line, macro donut, stacked macro bars, logging/meal heatmaps, nutrient-coverage heatmaps, normalized comparison, dual axis, selected-date guide, selected point, sparse gaps, forecast line, and uncertainty region.

Logging heatmaps consume only logging state/phase. Nutrient-coverage heatmaps consume only metric state. A shared renderer may accept either dataset, but must never merge the semantics.

### State, cache, and API client

Create:

- `apps/mobile/src/store/analytics-store.ts`
- `apps/mobile/src/lib/analytics/analytics-resource.ts`
- `analytics-cache.ts`
- `nutrient-search.ts`
- `trend-config.ts`
- `trend-routing.ts`

Use existing `expo-file-system` for durable analytics cache:

- cache only fully validated committed data;
- partition by Firebase session uid without sending it to the API;
- use schema-versioned canonical query keys;
- write a temporary file and move it atomically;
- retain `fetchedAt` for stale/offline copy;
- clear all user cache on sign-out and account deletion.

Atomic refresh:

1. Preserve committed UI.
2. Fetch a candidate replacement.
3. Validate the complete response.
4. Combine successful new sections with prior stale data for independently failed sections.
5. Validate the merged candidate.
6. Swap committed state once.
7. Cache only the valid committed result.

A whole-request or schema failure rejects the replacement and preserves prior state.

---

## 5. Comparison, search, contributors, and forecasts

### Comparisons

- Shared raw scale is allowlisted for compatible metrics such as Protein + Carbohydrates.
- Dual axis is used for approved cross-domain pairs such as Protein + Weight.
- Both Y domains are fixed from the full selected period and never rescale while scrubbing.
- Reference normalization is allowlisted for related pairs such as Sodium + Potassium and requires a valid reference for each.
- Different units alone never trigger normalization.
- Maximum comparison size is two.
- One scrub date controls both series.
- Missing second values remain missing; nearest WeightLog may be displayed separately without moving the shared date.

### Nutrient search

Implement locally against the backend-filtered metric catalog:

- normalize case, punctuation, spacing, display names, category terms, and aliases;
- match phrase and per-token prefixes on every keystroke;
- `vit` finds vitamin nutrients and `vit c` narrows toward Vitamin C;
- allow one-edit typo matching for tokens at least four characters long;
- rank exact phrase, token prefix, alias prefix, then typo;
- use display-name ordering for ties;
- do not reuse food-specific semantic candidate ranking.

### Contributors

- Calculate from immutable FoodLog snapshots.
- Include only explicitly recorded metric values.
- Exclude unknown values from numerator and denominator.
- Preserve explicit zero.
- Group by frozen `foodName` and use deterministic amount/name/id ordering.
- Return top three, recorded total, remainder, and `hasMore` with the Trend response.
- `POST /analytics/trends/contributors` returns the full list for See All.
- No meal-level contributor toggle is added.

### Forecast policy

Create `apps/api/src/modules/analytics/trends/forecast-policy.ts`:

```ts
export interface ForecastPolicy {
  version: string;
  minimumElapsedDays: number;
  minimumUsableDays: number;
  recentCoverageWindowDays: number;
  minimumRecentCoverage: number;
  minimumBacktestOrigins: number;
  complexityImprovementRatio: number;
  maximumNormalizedMae: number;
  maximumRelativeIntervalHalfWidth: number;
}
```

Export injectable `CALORIE_FORECAST_POLICY` and `WEIGHT_FORECAST_POLICY`. Initial values such as 42 elapsed days, 28 usable days, 5% improvement, 25% normalized MAE, and 30% relative interval half-width are implementation constants, not immutable product requirements.

Diagnostics include policy version, included/excluded counts, independent logging/metric coverage, candidate scores, backtest origins, MAE, normalized MAE, interval width/coverage, selected model, complexity justification, and unavailable reason. Keep diagnostics internal and sanitized.

Calories:

- seven-day visible horizon;
- fitting/backtesting requires a closed logging-complete day and `metricDataState: 'recorded'` for Calories;
- exclude logging-partial, in-progress, metric-partial, metric-unknown, and unlogged days while retaining diagnostic counts;
- do not incorporate partial days without a new documented policy and tests;
- compare recent mean, recent median, exponentially weighted level, weekday-adjusted mean, and robust Theil–Sen trend;
- score rolling-origin seven-day MAE over eligible held-out days;
- select complexity only when the centralized policy justifies it;
- derive widening empirical uncertainty from rolling residuals;
- join forecast to the final historical smoothed point without a jump.

Weight:

- seven-day visible horizon;
- use WeightLogs only, independently from calorie intake;
- compare last-value baseline, robust Theil–Sen trend, and recency-weighted linear trend;
- use irregular-timestamp rolling backtests and centralized policy gates;
- render solid history → explicit Today boundary → dotted seven-day projection;
- start projection at the final smoothed historical point and widen uncertainty across the horizon;
- never infer calorie-to-weight causation.

---

## 6. File inventory

### Shared/backend

- Modify `packages/shared/src/index.ts`.
- Create the four shared contract files listed above.
- Modify `apps/api/prisma/schema.prisma`; add the two exact additive migrations.
- Modify `apps/api/src/routes/api.ts`.
- Create `apps/api/src/modules/waterLogs/routes.ts`.
- Create `apps/api/src/modules/analytics/trends/registry.ts`.
- Create `logging-day-policy.ts`, `logging-day-classifier.ts`, `metric-data-coverage.ts`, `coverage-filter.ts`, `ranges.ts`, `aggregation.ts`, `references.ts`, `contributors.ts`, `comparisons.ts`, `forecast-policy.ts`, `forecast.ts`, `service.ts`, and `routes.ts` in that directory.
- Create `apps/api/src/modules/analytics/savedViews/service.ts` and `routes.ts`.
- Modify existing reporting code only for reuse/adapters and canonical migration protections.

### Mobile

- Create all routes, chart files, and analytics state/lib files listed above.
- Modify `apps/mobile/src/app/_layout.tsx`.
- Modify `apps/mobile/src/app/(tabs)/insights.tsx`.
- Modify `apps/mobile/src/app/(tabs)/progress.tsx` without redesigning Progress.
- Modify `apps/mobile/src/app/(tabs)/history.tsx` for WaterLogs.
- Modify `apps/mobile/src/components/floating-action-wheel.tsx`.
- Modify `apps/mobile/src/components/progress-reporting-summary.tsx`.
- Modify `apps/mobile/src/lib/api-client.ts`.
- Modify `apps/mobile/src/store/app-store.ts` and `apps/mobile/src/components/auth/auth-bootstrap.tsx` for analytics cleanup.
- Modify `apps/mobile/src/theme/tokens.ts`, `apps/mobile/package.json`, and `pnpm-lock.yaml` only for approved visual tokens and `expo-haptics`.

### Tests

Create API/domain suites:

- `apps/api/test/analytics-metric-registry.test.ts`
- `analytics-logging-day-state.test.ts`
- `analytics-metric-data-state.test.ts`
- `analytics-coverage-filter.test.ts`
- `analytics-range-engine.test.ts`
- `analytics-aggregation.test.ts`
- `analytics-contributors.test.ts`
- `analytics-comparisons.test.ts`
- `analytics-trends-api.test.ts`
- `analytics-saved-views.test.ts`
- `analytics-forecast-policy.test.ts`
- `analytics-forecast.test.ts`
- `water-logs.test.ts`
- `hydration-analytics.test.ts`

Add mobile tests under:

- `apps/mobile/src/lib/analytics/*.test.ts`
- `apps/mobile/src/store/analytics-store.test.ts`
- `apps/mobile/src/components/analytics/__tests__/`
- `apps/mobile/src/app/trends/__tests__/`
- `apps/mobile/src/app/__tests__/water-log.test.tsx`

Extend existing reporting, History, launcher, Progress, API-client, and authentication cleanup suites where regression ownership already exists.

---

## 7. Task 0 — Documentation source-of-truth checkpoint

**Do this only after the user separately authorizes implementation of the checkpoint. Do not begin Slice A in the same unreviewed step.**

**Files:** Reconcile existing user diffs in `AGENTS.md`, `README.md`, `docs/roadmap.md`, `docs/architecture.md`, `docs/api-contracts.md`, `docs/technical-decisions.md`, `docs/db-schema.md`, `docs/prisma-schema-decisions.md`, `docs/product-spec.md`, and `docs/mobile-ui-and-device-testing-context.md`; update `docs/design-system.md` only where chart rules belong.

- [ ] Re-run preflight and inspect every existing dirty documentation diff before editing.
- [ ] Confirm protected untracked directories and reference images remain untouched.
- [ ] Update the current source of truth to name Phase 17.5 “Custom Analytics, Micronutrients, and Hydration,” move Water into Phase 17.5, and leave supplements deferred.
- [ ] Record the two-dimensional logging/metric coverage model, the three logging coverage filters, range boundary, saved pin/unpin lifecycle, forecast ownership, Figma handoff nodes, and A–G slices.
- [ ] Record `INITIAL_LOGGING_DAY_POLICY` as a centralized implementation policy rather than an already-approved immutable threshold.
- [ ] Preserve historical phase records and label superseded Water/graph numbering rather than rewriting history.
- [ ] Search for stale Phase 17.5, Water, analytics, graph, coverage, and next-phase wording.
- [ ] Run Prettier on the changed documentation paths, the repository Markdown local-link check available at execution time, and `git diff --check`.
- [ ] Show the reconciled diff and validation to the user.
- [ ] Stop at a user-controlled documentation review/commit checkpoint. Do not start Slice A without explicit authorization.

Expected checkpoint result: only intentional documentation/source-of-truth changes, with all pre-existing user work preserved.

---

## 8. Slice A — Analytics domain foundation

### Task A1: Shared metric registry and mode gating (TDD)

**Files:** Create `packages/shared/src/analytics-metrics.ts`; modify `packages/shared/src/index.ts`; create `apps/api/test/analytics-metric-registry.test.ts`.

- [ ] Write failing tests for unique metric keys, nutrient catalog derivation, exact Simple allowlist, Complex full catalog, supported units, visualizations, aggregations, coverage applicability, and no normalized `water` metric.
- [ ] Run `corepack pnpm --filter @food-tracker/api test -- analytics-metric-registry.test.ts`; confirm RED because the registry does not exist.
- [ ] Implement the smallest registry satisfying the tests without mobile colors or backend calculation functions.
- [ ] Add catalog Zod schemas and backend mode-filter helper.
- [ ] Re-run the focused test and `corepack pnpm --filter @food-tracker/shared typecheck`; confirm GREEN.
- [ ] Self-review registry keys against Figma handoff and `NUTRIENT_CATALOG`.
- [ ] Stop at a user-controlled checkpoint.

### Task A2: Orthogonal logging and metric states (TDD)

**Files:** Create `logging-day-policy.ts`, `logging-day-classifier.ts`, `metric-data-coverage.ts`; create `analytics-logging-day-state.test.ts` and `analytics-metric-data-state.test.ts`.

- [ ] Write failing logging tests for closed complete core-meal day, optional Snack/Other, missing core meal, no FoodLogs, timezone boundaries, and current local day `in_progress`.
- [ ] Write failing metric tests for all logs recorded, some recorded, none recorded, explicit zero, normalized nutrients, column nutrients, and logging-complete plus metric-unknown combinations.
- [ ] Run both suites and confirm RED on missing policy/classifiers.
- [ ] Implement `INITIAL_LOGGING_DAY_POLICY` and pure logging classifier with no nutrient inspection.
- [ ] Implement pure metric coverage classifier with no meal-state mutation.
- [ ] Add explicit invariants preventing nutrient absence from changing logging state.
- [ ] Re-run tests and confirm GREEN.
- [ ] Self-review every required state combination and stop at a user checkpoint.

### Task A3: Coverage filters, ranges, and aggregation (TDD)

**Files:** Create `coverage-filter.ts`, `ranges.ts`, `aggregation.ts`; create `analytics-coverage-filter.test.ts`, `analytics-range-engine.test.ts`, and `analytics-aggregation.test.ts`.

- [ ] Write failing tests for `all_logged_days`, `complete_and_partial`, and `complete_only`, including current in-progress days and metric-unknown days that pass logging filters but remain nonnumeric.
- [ ] Write failing tests for 7D/30D/90D defaults, custom thresholds, valid overrides, first eligible day, no future dates, leap dates, and timezone/DST boundaries.
- [ ] Write failing daily tests for direct orthogonal states and weekly/monthly tests requiring independent state counts with no collapsed state.
- [ ] Assert weekly/monthly averages use only metric-recorded/partial numeric days admitted by the logging filter and never divide by unknown/unlogged days.
- [ ] Run focused suites and confirm RED.
- [ ] Implement pure range/filter/aggregation functions and Zod schemas.
- [ ] Re-run suites and inspect returned bucket shapes for type consistency.
- [ ] Stop at a user-controlled checkpoint.

### Task A4: References and canonical Calories Trends API (TDD)

**Files:** Create `references.ts`, `service.ts`, `routes.ts`; modify API routing; create `analytics-trends-api.test.ts`.

- [ ] Write failing contract/API tests for target, minimum, limit, valid true range, rejected half-range, missing reference, Simple mode access, Complex access, nullable gaps, recorded zero, and no client `userId`.
- [ ] Add failing tests proving legacy unlogged zero data cannot enter canonical response adapters.
- [ ] Run focused tests and confirm RED on missing routes/contracts.
- [ ] Implement bounded FoodLog queries and canonical Calories daily/weekly response through `POST /analytics/trends/query`.
- [ ] Add `/analytics/trends/catalog` and enforce server-side mode access.
- [ ] Keep legacy routes unchanged externally while preventing their zero-fill semantics from feeding the new service.
- [ ] Re-run focused tests, reporting regressions, lint, and typecheck.
- [ ] Stop at a user-controlled Slice A checkpoint.

---

## 9. Slice B — Hydration persistence and canonical logging

### Task B1: WaterLog migration and CRUD (TDD)

**Files:** Modify Prisma schema/shared contracts/API routing; create exact Water migration and `apps/api/src/modules/waterLogs/routes.ts`; create `water-logs.test.ts`.

- [ ] Write failing tests for schema validation, create/read/list/update/delete, ownership isolation, date/timezone filters, invalid amounts, and cascade deletion.
- [ ] Run `water-logs.test.ts`; confirm RED because model/routes do not exist.
- [ ] Add additive migration, generate Prisma client, implement serializers and ownership-scoped routes.
- [ ] Split tracking-preference output/input schemas so `dailyWaterGoalMl` is returned while remaining server-owned.
- [ ] Run Prisma validation, deploy migration to `_test`, and run focused tests.
- [ ] Stop at a user checkpoint before mobile work.

### Task B2: Hydration analytics (TDD)

**Files:** Extend canonical trends service; create `hydration-analytics.test.ts`.

- [ ] Write failing tests for daily totals, 2 L default, timezone boundaries, no food-water inclusion, unlogged gaps, quick-add visibility, and 7D/30D/90D aggregation.
- [ ] Confirm RED, then implement WaterLog-only hydration series and reference facts.
- [ ] Return recent WaterLogs for detail without inventing drink labels.
- [ ] Re-run focused tests and canonical contract tests.

### Task B3: Canonical Water form, launcher, quick-add, and History (TDD)

**Files:** Create `apps/mobile/src/app/water-log.tsx`; modify layout, API client, launcher, History, app store, package files; add mobile tests.

- [ ] Add `expo-haptics` with the Expo-compatible version; do not alter other dependencies.
- [ ] Write failing RNTL tests for preset selection, Other amount, time, create, edit, delete, validation, errors, repeated submit, and accessibility.
- [ ] Write failing tests that launcher Water and Hydration Other Amount route to the same form.
- [ ] Write failing quick-add tests proving POST is shared, success haptic occurs once, Undo deletes the returned id, and failed writes never show success.
- [ ] Write failing History tests for selected-day WaterLogs, edit route, delete refresh, and hydration total.
- [ ] Implement minimal canonical form and integrations using existing screen/form conventions.
- [ ] Run mobile Vitest/Jest, API water/hydration tests, lint, and typecheck.
- [ ] Stop at the Slice B user checkpoint.

---

## 10. Slice C — Reusable chart system and core Trends

### Task C1: Chart domain and geometry primitives (TDD)

**Files:** Create chart lib/components and their focused tests.

- [ ] Write failing pure tests for fixed domains, zero baselines where appropriate, nullable gaps, selected-date lookup, label decimation, target bands, threshold lines, raw points, dual domains, normalized values, and uncertainty polygons.
- [ ] Confirm RED on missing geometry helpers.
- [ ] Implement pure scale/path/domain functions without D3 or analytics calculations.
- [ ] Add SVG renderers and native accessibility overlays.
- [ ] Add gesture tests for clamped scrub position, shared comparison date, and no repeated scrolling haptics.
- [ ] Run mobile Vitest/Jest and confirm GREEN.

### Task C2: Core trend screens (TDD)

**Files:** Create Trends routes/store/routing; extend API service for Calories, Weight, Macro Composition, Logging Consistency, and Hydration.

- [ ] Write failing API tests for all core metrics, period behavior, smoothing inputs, raw Weight points, macro series, logging heatmap facts, hydration reference, and sparse gaps.
- [ ] Write failing mobile tests for Simple curated Explore, period controls, selected readout, route restoration, loading/error/empty states, and no Complex controls.
- [ ] Implement backend facts first, then mobile rendering through reusable primitives.
- [ ] Make Logging Consistency and meal heatmaps consume logging state only.
- [ ] Keep nutrient availability out of consistency calculations.
- [ ] Run focused backend/mobile suites.

### Task C3: Canonical Insights migration (TDD)

**Files:** Modify Insights and reusable reporting components; add canonical Insights endpoint tests and mobile tests.

- [ ] Write failing tests proving every displayed Insights number uses canonical nullable/aggregated facts.
- [ ] Add source/regression assertions against missing-to-zero defaults in Insights/Trends paths.
- [ ] Implement `/analytics/insights` section-result envelope and adapt approved Simple/Complex layouts.
- [ ] Preserve independent Recommendations behavior while moving analytics sections to the canonical engine.
- [ ] Remove user-facing dependency on legacy zero-filled daily breakdowns.
- [ ] Run reporting, canonical API, mobile UI, lint, and typecheck suites.
- [ ] Stop at the Slice C user checkpoint.

---

## 11. Slice D — Complex micronutrient analytics

### Task D1: Complete nutrient library and search (TDD)

**Files:** Create nutrient search/lib and Explore/library components; extend metric catalog tests.

- [ ] Write failing tests for group ordering, Simple exclusion, Complex full catalog, aliases, `vit`, `vit c`, punctuation, one-edit typos, deterministic rank, and empty results.
- [ ] Implement pure local search over backend-allowed catalog.
- [ ] Render approved Needs Attention curation without status-badge walls.
- [ ] Use FlatList/virtualization and accessible group/search controls.
- [ ] Run focused mobile tests.

### Task D2: Nutrient details and data states (TDD)

**Files:** Extend trends service/reference/interpretation; add reusable nutrient detail components and API/mobile tests.

- [ ] Write failing tests for recorded, metric-partial, metric-unknown, explicit zero, sparse coverage, target/minimum/limit/range, amino acids, caffeine timing, related metrics, and no causal copy.
- [ ] Assert logging completeness is unchanged across recorded/partial/unknown nutrient fixtures.
- [ ] Implement backend details and chart-ready facts.
- [ ] Render separate logging-coverage and nutrient-data explanations.
- [ ] Hide chart when numeric coverage is insufficient without hiding truthful coverage counts.
- [ ] Run focused suites.

### Task D3: Contributors (TDD)

**Files:** Create contributors service/route and contributors screen; add `analytics-contributors.test.ts`.

- [ ] Write failing tests for top three, See All, percentage denominator, remainder, explicit zero, unknown exclusion, immutable names, ownership, and deterministic ties.
- [ ] Confirm RED, implement backend snapshot-based calculation, and expose top/full contracts.
- [ ] Render approved contributor views without meal toggle.
- [ ] Run focused tests and stop at Slice D checkpoint.

---

## 12. Slice E — Configuration, Custom Range, and comparisons

### Task E1: Configure Trend draft/apply semantics (TDD)

**Files:** Create Configure route and trend-config/store helpers; extend shared schemas and mobile tests.

- [ ] Write failing tests proving edits do not replace active Trend until Apply.
- [ ] Test metric-specific control removal, max two metrics, mode gating, relative ranges, coverage options, and forecast control visibility.
- [ ] Implement draft state, Apply, discard, and temporary active configuration.
- [ ] Keep saving separate from applying.

### Task E2: Custom Range (TDD)

**Files:** Create Custom Range route, rail geometry/gesture helpers, and tests.

- [ ] Write failing tests for first eligible date, today cap, exact inclusive day count, shortcuts, day snapping, crossing prevention, viewport zoom, pan bounds, exact START/END calendars, and automatic aggregation labels.
- [ ] Implement pure rail geometry before gesture UI.
- [ ] Ensure 320pt sheet scrolls instead of shrinking and handles remain approximately 44pt targets.
- [ ] Add light haptic only when a handle changes day.

### Task E3: Comparison strategies (TDD)

**Files:** Create `comparisons.ts`, comparison API tests, and comparison chart tests.

- [ ] Write failing tests for Protein + Carbohydrates shared scale, Protein + Weight dual axis, Sodium + Potassium reference normalization, incompatible pairs, missing references, fixed domains, and shared selected date.
- [ ] Assert unrelated differing units are not automatically normalized.
- [ ] Implement allowlisted strategy resolver and backend raw/normalized contracts.
- [ ] Render shared, dual, and normalized approved masters using reusable chart primitives.
- [ ] Run Slice E suites and stop at user checkpoint.

---

## 13. Slice F — Saved views and reporting integration

### Task F1: Saved-view persistence (TDD)

**Files:** Modify Prisma schema, create exact saved-view migration, create saved-view service/routes/contracts/tests.

- [ ] Write failing tests for save, open, update, save-as-new, rename, duplicate, validation, relative Custom day count, ownership, poor coverage, and unavailable metrics.
- [ ] Deploy additive migration to `_test` and implement transaction-safe CRUD.
- [ ] Preserve unavailable metric strings on reads and expose replacement requirements.

### Task F2: Pin, unpin, reorder, and delete (TDD)

- [ ] Write failing tests for one pinned pointer, replacement pin, explicit unpin to null, Calories fallback, deleting pinned view, cross-user pin rejection, and reorder isolation.
- [ ] Implement transactional pin/unpin/delete and deterministic reorder.
- [ ] Re-run persistence and user-isolation suites.

### Task F3: Saved Views UI and pinned Insights (TDD)

**Files:** Create saved/save-view routes and manager components; extend Insights/store/mobile tests.

- [ ] Write failing RNTL tests for auto-generated editable name, update/save-as-new, rename, duplicate, pin, unpin, reorder, delete confirmation/haptic, unavailable metric replacement, and long names.
- [ ] Implement approved manager/actions and exactly one Complex Insights preview.
- [ ] Show Calories fallback after no pin or unpin.
- [ ] Persist Simple preferred metric without exposing the Complex saved-view builder.

### Task F4: Progress deep links (TDD)

**Files:** Modify Progress screen/components and routing tests.

- [ ] Write failing tests for Energy → Calories, Latest Weight → Weight, Weekly Momentum → Logging Consistency, Complex nutrient row → nutrient Trend, and View Full Reports → Insights.
- [ ] Implement Pressable/accessibility routing without changing Progress layout or facts.
- [ ] Run Slice F suites and stop at user checkpoint.

---

## 14. Slice G — Forecasts, state, responsive hardening, and closeout

### Task G1: Forecast policies and backtesting (TDD)

**Files:** Create `forecast-policy.ts`, `forecast.ts`, `analytics-forecast-policy.test.ts`, and `analytics-forecast.test.ts`.

- [ ] Write failing policy tests for centralized values, dependency injection, policy version, and boundary behavior.
- [ ] Write failing calorie tests proving only closed logging-complete plus calorie-recorded days fit/score; every excluded state remains diagnostic coverage.
- [ ] Write failing rolling-origin tests for candidate scores, simple-model tie preference, complexity justification, unavailable coverage, unstable variance, residual uncertainty, and seven-day horizon.
- [ ] Write independent Weight tests for irregular timestamps, candidate selection, unavailable gates, seven-day horizon, and no calorie inputs.
- [ ] Implement simplest candidates first; add complexity only when diagnostics clear the injected policy.
- [ ] Record backtest evidence before changing any initial policy constant.

### Task G2: Forecast presentation (TDD)

**Files:** Extend Trend response/renderers and add mobile chart tests.

- [ ] Write failing tests for solid history, Today boundary, dotted projection, first forecast point continuity, widening region, estimate copy, and unavailable states.
- [ ] Implement Calories and Weight approved presentations without fabricated fallback lines.
- [ ] Add subtle forecast reveal and no decorative glow.

### Task G3: Atomic refresh, stale/offline, and section failures (TDD)

**Files:** Implement analytics resource/cache/store and update Insights/Trend screens/auth cleanup.

- [ ] Write failing reducer tests for committed → refreshing → atomic swap, invalid replacement rejection, whole-request failure, independent section failure with stale prior data, Retry, and request races.
- [ ] Write failing cache tests for atomic file replacement, schema mismatch, uid partitioning, offline load, stale timestamp, sign-out purge, and account-deletion purge.
- [ ] Implement state machine/cache with sanitized diagnostics.
- [ ] Add approved skeleton, pending refresh, stale failure, first-use, full-page unavailable, section error, and offline presentations.

### Task G4: Responsive, accessibility, and performance hardening

- [ ] Add RNTL/layout-helper tests where practical for 320pt reflow, scrollable sheets, 44pt targets, long saved names, one-line title preference, and Large Type growth.
- [ ] Confirm charts retain all data while decimating labels.
- [ ] Profile bounded API queries and prevent lifetime FoodLog loading.
- [ ] Memoize geometry, use one gesture surface per plot, keep scrub updates on the UI thread, and virtualize long libraries.
- [ ] Verify light haptics only for scrub-date changes, range-day changes, water success, pin, and destructive confirmation.

### Task G5: Documentation closeout

**Files:** Reconcile and update the same source-of-truth documents from Task 0 plus `docs/dev-setup.md` and `docs/troubleshooting.md` where commands or dependency behavior changed.

- [ ] Record delivered versus intended scope, migrations, contracts, model policy versions, chart decision, API routes, tests, physical evidence, deferred work, risks, and next-phase recommendation.
- [ ] Preserve historical numbering and superseded assumptions.
- [ ] Carry forward reporting accessibility/small-device follow-up, Apple Sign In deferred/disabled, Android standalone outstanding, paid distribution in external beta, landscape/tablet, Reduced Motion, and View Data table.
- [ ] Run stale-reference, local-link, command-accuracy, formatting, and diff checks.

---

## 15. Validation matrix

### Focused automated coverage

- Registry uniqueness and mode exposure.
- Logging policy and current-day phase.
- Independent metric recorded/partial/unknown states.
- All seven meaningful logging/metric combinations plus unlogged.
- Three logging coverage filters and unknown-after-filter behavior.
- Daily direct states; weekly/monthly independent counts.
- Target/minimum/limit/range and invalid half-ranges.
- 7D/30D/90D/Custom, DST, timezone, no-future, first-eligible, and current buckets.
- Canonical missingness; no legacy zero-fill on Insights/Trends.
- Contributors and snapshot authority.
- Water ownership/CRUD/History/quick-add/Undo/hydration totals.
- Comparison compatibility, fixed axes, normalization, and missing pairs.
- Saved full lifecycle including unpin and Calories fallback.
- Forecast policy injection, complete-day calorie eligibility, backtesting diagnostics, seven-day horizons, continuity, and unavailable behavior.
- Atomic refresh, stale/offline cache, section failures, and user cache isolation.
- Chart geometry/interactions, deep links, 320pt, Large Type, and long names.

### Required final automated sequence

Run from repository root under one Node 22 environment:

```bash
node -v
corepack pnpm -v
corepack pnpm prisma:generate
corepack pnpm prisma:validate
corepack pnpm --filter @food-tracker/api exec prisma migrate deploy
corepack pnpm --filter @food-tracker/api test
corepack pnpm --filter @food-tracker/mobile exec vitest --config vitest.config.ts run
corepack pnpm --filter @food-tracker/mobile test:jest
corepack pnpm format:check
corepack pnpm lint
corepack pnpm typecheck
corepack pnpm build
corepack pnpm test
git diff --check
git status --short --branch
```

- Migration/test deployment must use a database ending in `_test`.
- Any unsupported-engine warning invalidates the run.
- Root `test` does not replace explicit mobile Vitest and Jest runs.
- Do not weaken existing tests or treat unavailable PostgreSQL as permission to skip them.

### Physical-device validation

Use the established Phase 17 standalone iPhone staging workflow only after automated validation. The user performs/validates signing, installation, and physical behavior.

Check:

- Insights scroll performance and every chart class;
- scrub responsiveness and haptics;
- chart-to-detail continuity;
- Custom Range handles, panning, calendars, and no-future bounds;
- shared, dual-axis, and normalized comparisons;
- nutrient search, sparse states, contributors, and related metrics;
- saved lifecycle, unpin, reorder, pinned preview, and fallback;
- canonical Water create/edit/delete, quick-add/Undo, and launcher route;
- Progress deep links;
- loading, atomic refresh, stale failure, section error, and offline cache;
- 320pt and Large Type;
- Calorie and Weight seven-day forecast continuity/unavailable states;
- standalone operation without Metro, Docker, local API, or Mac connectivity.

Do not claim physical success until the user confirms it. Android standalone and paid external distribution remain outside this closeout.

---

## 16. Rollback and risk controls

- Keep schema changes additive and retain new tables if application code must roll back.
- Keep legacy endpoints temporarily available, but never use them as a second Phase 17.5 presentation engine.
- Version logging and forecast policies and local cache contracts.
- Bound queries to selected date ranges and required nutrient fields.
- Cap Daily override at 180 days; use Weekly/Monthly for longer spans.
- Preserve unavailable saved metrics rather than deleting user configuration.
- Hide unavailable forecasts through typed states rather than fabricating output.
- Preserve committed analytics during refresh and reject invalid replacements.
- Clear local analytics on identity changes.
- Never overwrite pre-existing dirty documentation; reconcile it at Task 0 and closeout.
- Every slice ends with focused validation, spec/type self-review, and a user-controlled checkpoint.

## 17. Final self-review before implementation authorization

- [ ] Every Figma production entrypoint is mapped to a route/component/task.
- [ ] Simple cannot access Complex controls through UI or API.
- [ ] Logging completeness and metric coverage remain orthogonal in types, calculations, heatmaps, copy, filters, and forecasts.
- [ ] Aggregated buckets preserve independent counts and do not invent collapsed states.
- [ ] Unknown, unlogged, partial, complete, in-progress, and recorded zero remain truthful.
- [ ] All Phase 17.5 Insights/Trends values use canonical semantics.
- [ ] Water uses one persistence path and excludes food water.
- [ ] Saved views include explicit unpin and one pinned pointer.
- [ ] Forecast thresholds are centralized implementation constants justified through diagnostics/backtesting.
- [ ] No implementation slice starts before the documentation checkpoint is separately authorized and reviewed.
- [ ] Git operations remain user-controlled.
