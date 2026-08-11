# Task 2 (R0.2) report — versioned section-aware analytics contract

## Changed

- Added `CanonicalInsightsResponseV2`, the eight permitted section keys,
  generic `AnalyticsSectionResult`, strict envelope/result schemas, and a
  legacy-v1 validation helper in `packages/shared/src/analytics-insights.ts`.
- Exported the new shared contract from `packages/shared/src/index.ts`.
- Added `AnalyticsReportResourceState` and reducer actions that retain
  committed siblings during a canonical refresh, merge local section failure as
  stale/unavailable, reject stale request generations, expose a canonical
  whole-report section retry intent, and keep global failures report-level.
- Added a temporary, validated v1-success adapter for R1. It normalizes only
  recognized v1 sections into v2 `available` results and returns `null` for
  malformed or ambiguous input. It is not wired into the live route or cache
  flow.
- Added additive v2 cache keys: `insights-v2-week` and
  `insights-v2-month`. The v1 keys and all current consumers remain unchanged.
- Added mobile reducer/adapter/key tests and API v2 contract/parser tests.

The R0.2 seven-node Figma inspection in
`docs/superpowers/phase-17-5-fidelity-capture-ledger.md` is a task-owned
deliverable. It was independently verified, preserved through implementation,
and committed with the round-1 hardening fix.

## Why

R1 needs a stable presentation boundary that can display successful analytics
sections while one independent section is pending, stale, or unavailable.
R0.2 defines that boundary without switching the production Insights request,
adding a targeted endpoint, or changing card composition.

## Validation environment

- Repository: `/Users/teiko/food_tracker`
- Branch/base: `phase-17-5-custom-analytics` at task start `84dda7b`
- Node.js: `v22.23.0`
- pnpm: `10.34.3`
- API test database: `food_tracker_test`

## TDD evidence

- RED: the mobile R0.2 suite failed because the new report-resource module did
  not exist; the API suite failed because the v2 schema export did not exist.
- GREEN: mobile R0.2 suite passed 6 tests; API v2 contract suite passed 3
  tests after the minimal contract/resource/adapter/key implementation.

## Commands run

```bash
corepack pnpm --filter @food-tracker/shared build
corepack pnpm --filter @food-tracker/shared typecheck
corepack pnpm --filter @food-tracker/mobile typecheck
corepack pnpm --filter @food-tracker/api typecheck
corepack pnpm exec eslint <owned R0.2 source-and-test paths>
corepack pnpm exec prettier --check <owned R0.2 source-and-test paths>
corepack pnpm --filter @food-tracker/mobile exec vitest --config vitest.config.ts run src/lib/analytics/analytics-resource.test.ts src/lib/analytics/analytics-cache.test.ts src/lib/analytics/analytics-cache-file-system.test.ts src/lib/analytics/analytics-report-resource.test.ts
corepack pnpm --filter @food-tracker/mobile exec jest --runInBand src/components/auth/__tests__/auth-bootstrap.test.tsx
TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/food_tracker_test corepack pnpm --filter @food-tracker/api exec vitest run --no-file-parallelism test/analytics-insights-contract.test.ts test/analytics-insights-contract-v2.test.ts
git diff --check
```

## Automated results

- Shared build and shared/mobile/API typechecks passed.
- Scoped ESLint and Prettier checks passed.
- Mobile analytics/cache/resource regression suite: 4 files, 31 tests passed.
- Auth cache-purge regression suite: 1 suite, 12 tests passed.
- API v1/v2 Insights contract suite: 2 files, 10 tests passed; Prisma reported
  14 migrations and no pending migrations on `food_tracker_test`.
- `git diff --check` passed before staging.

## Manual validation

No visual or device validation is applicable: this task intentionally does not
change production routes, screens, or native behavior.

## Git state

- Initial R0.2 commit: `1469103 feat: define versioned section-aware analytics contract`.
- The task-owned Figma ledger was added to the round-1 correction commit.
- Protected untracked paths remained unstaged and untouched.

## Known limitations or risks

- The v2 contract is not yet requested by the API and is not consumed by the
  live Insights screen; R10 owns that route/cache migration.
- The v1 adapter is intentionally standalone. It never overwrites a v1 cache
  entry and only yields a v2 candidate after v1 and v2 validation.
- No target per-section endpoint exists or is implied; section retry records a
  canonical whole-Insights request intent.

## Suggested next step

Use this report-resource state and adapter at the R1 Insights component
boundary, keeping the live data source unchanged until R10.

## Fix round 1 — review corrections

### Findings addressed

- C1: terminal commits and failures now settle the union of expected/current
  section keys. Omitted outcomes retain prior data as stale or become
  unavailable without prior data; terminal states cannot leave a section
  pending.
- I1: v2 validation now rejects empty reports, key/primary-metric mismatches,
  and envelope/trend mode mismatches. The v1 adapter inherits the same strict
  semantic validation and rejects ambiguous candidates.
- I2: `sectionRetry` now marks only its owning section pending, including a
  target with no committed data. Healthy siblings remain available and the
  retry intent remains a canonical whole-Insights request.
- I3: cache hydration for the same request generation is ignored after a
  network commit.
- I4: report state now distinguishes `offline_cache` from `refresh_failed`
  stale provenance and provides separate safe user-facing copy.
- I5: the seven-node R0.2 Figma ledger addition is committed as task-owned
  work, and the earlier ownership statement above is corrected.
- M1: focused tests now cover whole-request and parser-driven failures,
  omitted outcomes with and without prior data, empty reports, semantic
  mismatches, target-only retry behavior, no-data retry, older generations,
  hydrate-after-commit ordering, and stale provenance.

### TDD evidence

- Mobile RED: 15 tests ran; 9 failed and 6 passed on the reviewed defects.
- API RED on `food_tracker_test`: 7 tests ran; 4 failed and 3 passed on empty,
  key-mismatched, mode-mismatched, and malformed mixed responses.
- Focused GREEN: mobile report-resource suite passed 15/15; API v2 contract
  suite passed 7/7.

### Final validation evidence

- Node.js `v22.23.0`; pnpm `10.34.3`.
- Shared build passed.
- Shared, mobile, and API typechecks passed.
- Scoped ESLint and Prettier checks passed.
- Mobile analytics/cache/resource regressions: 4 files, 40 tests passed.
- Auth cache-purge regressions: 1 suite, 12 tests passed.
- API v1/v2 contract regressions on `food_tracker_test`: 2 files, 14 tests
  passed; 14 migrations were present with no pending migrations.
- `git diff --check` and staged diff checks passed before commit.
- No live route, API endpoint/controller, cache consumer, Prisma schema,
  migration, dependency, or lockfile changed.

### Fix commit

`51b0667c1089bd5ac7e345a1290a3b9b1ea82f49 fix: harden section-aware analytics state`
