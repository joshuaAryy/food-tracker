# Task 3A (R1.0a) report — v2 overview contract and section state

## Changed

- Re-opened final Figma node `338:98` in file `GFLStsF0ADwaizoVKGeLny` before
  contract work and recorded its authoritative overview facts and capability
  boundary in `docs/superpowers/phase-17-5-fidelity-capture-ledger.md`.
- Extended `CanonicalInsightsResponseV2` with an optional, strict, independently
  keyed overview outcome map for period summary, energy, macros, exactly Fiber /
  Sodium / Vitamin C highlights, hydration, weight, and logging consistency.
- Added typed deterministic facts, reference and status enums, strict curated
  nutrient identity/reference/status validation, and the Weight-local nested
  forecast outcome. No arbitrary server prose is accepted.
- Extended the existing R0.2 report resource with committed, pending, stale,
  unavailable, and retryable state for overview groups. It retains healthy core
  sections and overview siblings, preserves request generations and terminal
  failure idempotence, and keeps parser/global failures report-level.
- Kept the v1 adapter explicit: every overview group is unavailable until a
  validated v2 response supplies backend facts. It derives no overview value.
- Added focused API contract and mobile reducer/adapter coverage. No API route,
  calculator, trend permission, metric registry, migration, dependency, native,
  or protected path changed.

## Why

The recovered Simple Insights composition needs a backend-owned summary
boundary without letting mobile infer analytics or allowing an independent
overview failure to destroy healthy report data. This is contract and resource
preparation only; Task 3B remains responsible for producing v2 backend facts.

## Validation environment

- Repository: `/Users/teiko/food_tracker`
- Branch: `phase-17-5-custom-analytics`
- Starting HEAD: `73a9e2c`
- Node.js: `v22.23.0`
- pnpm: `10.34.3`
- API test database:
  `postgresql://postgres:postgres@localhost:5432/food_tracker_test`

## TDD evidence

- RED mobile:
  `corepack pnpm --filter @food-tracker/mobile exec vitest --config vitest.config.ts run src/lib/analytics/analytics-overview-resource.test.ts src/lib/analytics/analytics-report-resource.test.ts`
  ran 30 tests: 3 new overview tests failed because no overview state or v1
  unavailable overview existed; all 27 R0.2 tests remained green.
- RED API:
  `TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/food_tracker_test corepack pnpm --filter @food-tracker/api exec vitest run --no-file-parallelism test/analytics-insights-contract-v2.test.ts`
  ran 9 tests: the new typed overview fixture failed schema parsing while the
  prior 8 tests passed. Prisma found 14 migrations with none pending.
- GREEN reran those commands after rebuilding the shared package consumed by
  the workspace tests: mobile passed 30/30 and API passed 9/9.

## Commands run

```bash
node -v
corepack pnpm -v
corepack pnpm --filter @food-tracker/shared build
corepack pnpm --filter @food-tracker/shared typecheck
corepack pnpm --filter @food-tracker/mobile typecheck
corepack pnpm --filter @food-tracker/mobile exec vitest --config vitest.config.ts run src/lib/analytics/analytics-resource.test.ts src/lib/analytics/analytics-cache.test.ts src/lib/analytics/analytics-cache-file-system.test.ts src/lib/analytics/analytics-report-resource.test.ts src/lib/analytics/analytics-overview-resource.test.ts
TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/food_tracker_test corepack pnpm --filter @food-tracker/api exec vitest run --no-file-parallelism test/analytics-insights-contract.test.ts test/analytics-insights-contract-v2.test.ts
corepack pnpm exec eslint packages/shared/src/analytics-insights.ts apps/mobile/src/lib/analytics/analytics-report-resource.ts apps/mobile/src/lib/analytics/analytics-v1-adapter.ts apps/mobile/src/lib/analytics/analytics-report-resource.test.ts apps/mobile/src/lib/analytics/analytics-overview-resource.test.ts apps/api/test/analytics-insights-contract-v2.test.ts
corepack pnpm exec prettier --check packages/shared/src/analytics-insights.ts apps/mobile/src/lib/analytics/analytics-report-resource.ts apps/mobile/src/lib/analytics/analytics-v1-adapter.ts apps/mobile/src/lib/analytics/analytics-report-resource.test.ts apps/mobile/src/lib/analytics/analytics-overview-resource.test.ts apps/api/test/analytics-insights-contract-v2.test.ts docs/superpowers/phase-17-5-fidelity-capture-ledger.md
corepack pnpm lint
corepack pnpm typecheck
corepack pnpm build
corepack pnpm test
git diff --check
```

## Automated results

- Shared build and shared typecheck passed.
- Mobile typecheck passed.
- Focused mobile overview plus R0.2 report-resource tests passed: 30/30.
- All R0.2 mobile analytics/cache/resource regressions passed: 5 files, 55/55
  tests.
- API v1/v2 Insights contract tests passed on `food_tracker_test`: 2 files,
  16/16 tests; Prisma found 14 migrations with none pending.
- Scoped ESLint and Prettier passed for every owned source, test, and ledger
  path.
- Root lint, typecheck, and build passed.
- Root test passed: 90 files, 1,148 tests.
- The root `format:check` remains blocked by 21 pre-existing out-of-scope
  formatting warnings, including protected `.agents/` and prior
  `.superpowers` records. No such file was edited. Owned-file Prettier passed.

## Manual validation

No device or visual validation is applicable. This task does not change a live
route, API implementation, or native behavior. The required Figma contract
inspection was performed and recorded before schema work.

## Git state

- The branch was already one commit ahead of origin at `73a9e2c` when Task 3A
  began.
- Only Task 3A reviewed paths are intended for the new commit. Existing
  untracked `.agents/`, `.aidesigner/`, `.codex/`, `backups/`, and design
  reference paths remain untouched and unstaged.

## Known limitations and risks

- The API still returns v1; Task 3B must produce validated v2 overview facts.
- The live route/cache migration remains deferred. The v1 adapter intentionally
  marks all overview groups unavailable rather than fabricating facts.
- Root formatting cannot be reported clean until the owner resolves the 21
  unrelated formatting warnings.

## Suggested next step

Implement Task 3B backend calculators and route assembly for these strict v2
outcomes, retaining report-level versus group-level failure boundaries.
