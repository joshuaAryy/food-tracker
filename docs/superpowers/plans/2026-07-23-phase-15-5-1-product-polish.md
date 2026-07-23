# Phase 15.5.1 Reporting Product Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every displayed reporting nutrient a deterministic typed goal and truthful period percentage while preserving the approved Phase 15.5 artwork, layout, and calendar semantics.

**Architecture:** Extend the existing `UserGoal` record with nullable core nutrient fields, derive missing values through a shared pure resolver, and expose resolved goals plus period calculations from the existing reporting endpoints. Legacy rows use lazy derivation; new onboarding rows persist the derived values. Mobile consumes response metadata through shared presentation helpers and uses one `Simple`/`Complex` label map.

**Tech Stack:** TypeScript, Zod, Prisma/PostgreSQL, Express, Vitest, React Native/Expo, React Native SVG.

## Global Constraints

- Required validation runtime is Node `v22.23.0` with pnpm `10.34.3`.
- Do not change the approved Progress, Insights, or Streak visual hierarchy, artwork, spacing, colors, SVGs, responsive behavior, or calendar semantics.
- Keep `UserGoal` as the only persisted goal system; do not introduce a second goal table or an LLM calculation path.
- Clients never send `userId`; the mock-auth server boundary remains authoritative.
- `simple` and `complex` remain stored enum values; only user-facing labels change to `Simple` and `Complex`.
- New database fields are additive and nullable. Existing calorie/protein values remain stable.
- Period goal denominator is the existing report eligible-day count, and invalid denominators never yield `Infinity`, `NaN`, or fake percentages.
- Protected local state `.gitignore`, `.agents/`, `.aidesigner/`, `.codex/`, and `docs/design-references/current images/` is not staged, edited, formatted, or committed.
- Nothing is pushed or merged.

## File Inventory

- Modify `apps/api/prisma/schema.prisma`; create one additive Prisma migration for five nullable core nutrient fields.
- Modify `packages/shared/src/types.ts`, `packages/shared/src/schemas.ts`, `packages/shared/src/reporting.ts`, and `packages/shared/src/reporting-nutrients.ts`; add `packages/shared/src/reporting-goals.ts`.
- Modify `apps/api/src/lib/personalization.ts`, `apps/api/src/lib/serializers.ts`, `apps/api/src/lib/setup-completeness.ts`, `apps/api/src/modules/setup/routes.ts`, and `apps/api/src/modules/goals/routes.ts`.
- Modify `apps/api/src/modules/analytics/reporting/service.ts` and `apps/api/src/modules/analytics/routes.ts` only for goal metadata and percentages; preserve approved streak and period-boundary semantics.
- Modify `apps/mobile/src/lib/reporting-ui.ts`, the existing reporting components, and user-facing mode copy in onboarding, profile, and Progress.
- Add focused tests in `apps/api/test/reporting-goals.test.ts`, `apps/api/test/reporting-api.test.ts`, `apps/api/test/nutrient-totals.test.ts`, `apps/api/test/setup.test.ts`, and `apps/api/test/mobile-reporting-ui.test.ts`.

## Task 1: Shared goal resolution (TDD)

**Files:** Create `packages/shared/src/reporting-goals.ts` and `apps/api/test/reporting-goals.test.ts`; modify shared exports only as needed.

- [ ] Write failing tests for complete calorie/protein inputs, explicit-over-derived priority, deterministic 4/9 macro math, fiber/sugar/sodium formulas, all units/directions/sources, and null/zero/negative/NaN invalid inputs.
- [ ] Run `corepack pnpm --filter @food-tracker/api test -- reporting-goals.test.ts` and confirm the failure is caused by the missing resolver/contract.
- [ ] Add pure shared types for `ReportingGoal` and `ReportingGoalSource`, plus a resolver that accepts numeric goal fields and returns `{ value, unit, direction, source }` without Prisma, React Native, or time dependencies.
- [ ] Add the documented product-default threshold catalog for normalized nutrients that the Complex ledger already renders, excluding water; use explicit core `UserGoal` values before derived values before defaults.
- [ ] Run the focused test again and confirm it passes, then run `git diff --check`.
- [ ] Commit the shared domain contract and tests as `feat: add complete nutrient goal model`.

## Task 2: Additive schema and onboarding/goal APIs

**Files:** Modify `apps/api/prisma/schema.prisma`, `packages/shared/src/types.ts`, `packages/shared/src/schemas.ts`, `apps/api/src/lib/personalization.ts`, `apps/api/src/lib/serializers.ts`, `apps/api/src/lib/setup-completeness.ts`, `apps/api/src/modules/setup/routes.ts`, and `apps/api/src/modules/goals/routes.ts`; create `apps/api/prisma/migrations/20260723120000_complete_reporting_goals/migration.sql`; test setup and goals suites.

- [ ] Add nullable `Decimal(6,1)` fields `targetCarbsGrams`, `targetFatGrams`, `targetFiberGrams`, `limitSugarGrams`, and nullable integer `limitSodiumMg`; write only additive `ALTER TABLE ... ADD COLUMN` migration statements.
- [ ] Keep setup input free of target fields; have setup calculate and persist all seven supported values. Make the five direct-goal override fields optional/nullable so legacy clients remain valid and null means derive rather than zero.
- [ ] Add failing setup/goals assertions for persisted derived fields, explicit override persistence, null legacy serialization, and unchanged calorie/protein values. Run the focused suites to observe the contract failures.
- [ ] Implement serialization, rounding, setup persistence, and direct goals updates while leaving `isCompleteGoals` compatible with legacy rows that are repaired lazily.
- [ ] Run `corepack pnpm prisma:generate`, the focused setup/goals suites, `corepack pnpm prisma:validate`, and migration deployment against the dedicated test database.
- [ ] Commit only this boundary as `feat: persist complete nutrient goals`.

## Task 3: Typed reporting contract and backend percentages (TDD)

**Files:** Modify `packages/shared/src/reporting.ts`, `packages/shared/src/reporting-nutrients.ts`, `packages/shared/src/types.ts`, `apps/api/src/modules/analytics/reporting/service.ts`, and `apps/api/src/modules/analytics/routes.ts`; test `apps/api/test/reporting-api.test.ts` and `apps/api/test/nutrient-totals.test.ts`.

- [ ] Add failing API fixtures for current/previous week, current/previous month, partial periods, no logged days, recorded zero, absent nullable values, explicit overrides, missing setup, and sugar/sodium above 100%.
- [ ] Require `reportingGoals`, per-detail `goal`, `periodGoal`, and nullable `percentage`; require `periodGoal === daily goal * eligibleDays`, preserve absent nutrients, and assert no `NaN`/`Infinity` values or client-supplied `userId`.
- [ ] Extend Zod schemas with goal direction/source metadata and response fields without changing existing unavailable metric envelopes.
- [ ] Resolve goals at the reporting boundary from `UserGoal`, lazily deriving missing legacy fields. Pass the same goal map into current, previous-completed, and equivalent windows.
- [ ] Calculate each recorded nutrient percentage as `period total / (daily goal * eligible-day count) * 100`; preserve over-limit values and null invalid denominators. Keep the existing Sunday–Saturday, partial-period, and previous-month boundary logic unchanged.
- [ ] Extend `/analytics/nutrients/daily` with the same resolved goal metadata and one-day percentages so Progress renders backend facts.
- [ ] Run focused reporting/API, nutrient-total, reporting-domain, and streak-calendar suites; commit as `feat: expose period nutrient goals in reporting`.

## Task 4: Mobile presentation and mode terminology (TDD)

**Files:** Modify `apps/mobile/src/lib/reporting-ui.ts`, `apps/mobile/src/components/progress-reporting-summary.tsx`, `apps/mobile/src/components/highlighted-nutrient-summary.tsx`, `apps/mobile/src/components/complete-nutrient-report.tsx`, `apps/mobile/src/app/onboarding.tsx`, `apps/mobile/src/components/onboarding-plan-preview.tsx`, `apps/mobile/src/app/(tabs)/profile.tsx`, and `apps/mobile/src/app/(tabs)/progress.tsx`; test `apps/api/test/mobile-reporting-ui.test.ts`.

- [ ] Add failing helper tests for target/minimum/limit percentages, limit copy above 100%, setup-incomplete, not-recorded, genuine zero, invalid-goal states, no fake em dash, and no valid-goal `No goal set`.
- [ ] Add a source scan test for mode labels that requires `Simple`/`Complex` in onboarding, profile, Progress, and mode-preview labels while allowing ordinary adjective uses of “detailed”.
- [ ] Run `corepack pnpm --filter @food-tracker/api test -- mobile-reporting-ui.test.ts` and verify RED on the current protein-only helper and hard-coded `Detailed` labels.
- [ ] Add `trackingModeLabel('simple') === 'Simple'` and `trackingModeLabel('complex') === 'Complex'`; use it for visible/accessibility mode labels without changing internal enum names or logo selection.
- [ ] Replace protein-only mobile percentage branching with returned goal metadata. Format target/minimum percentages as percentages and limit metrics as `${percentage}% of limit`; render truthful setup/not-recorded copy and do not calculate nutrition facts in React Native.
- [ ] Render daily returned percentages beside existing Progress nutrient amounts while preserving the approved calorie-first hero, card structure, spacing, artwork, colors, and responsive layout.
- [ ] Run the focused mobile suite and modified-file Prettier check, then commit as `feat: show complete nutrient goal percentages` and, if separable, `fix: restore complex mode terminology`.

## Task 5: Repository scan, validation, and native gates

**Files:** Update only owned documentation/tests or user-facing mode labels; create evidence outside the repository at `/private/tmp/food-tracker-phase15.5.1-native-parity/`.

- [ ] Run `rg -n -i "Detailed|detailed|DETAIL" .`, classify each match, and update only mode-name uses. Do not touch protected current-image baselines, unrelated adjectives, or protected local files.
- [ ] Run under the same Node 22 environment: `node -v`, `corepack pnpm -v`, `corepack pnpm prisma:validate`, `corepack pnpm format:check`, `corepack pnpm lint`, `corepack pnpm typecheck`, `corepack pnpm build`, `corepack pnpm test`, modified-file Prettier, `git diff --check`.
- [ ] Before native work, require `df -h /` to show at least 10GiB free; then run `xcrun swiftc --version`, `xcode-select -p`, and `xcrun simctl list devices` without changing global Xcode configuration.
- [ ] Once the storage gate passes, run `corepack pnpm --filter @food-tracker/mobile ios:dev-build:device` with bundle identifier `ca.joshuaaryeetey.foodtracker` and Apple team `6JMW7252B6`, then use the existing simulator workflow.
- [ ] Capture Simple/Complex Progress and Insights, the Complex ledger, limit-over-100%, setup-incomplete, Streak/grace/perfect-week, 320-point layout, and large Dynamic Type evidence outside the repository. Physical-device approval remains a user gate if not available.
- [ ] Run `git status --short --branch`, `git branch -vv`, `git log --oneline main..HEAD`, and `git diff --check`; confirm protected state is unchanged and nothing was pushed or merged.

## Self-Review Before Execution

- Every displayed nutrient is covered by an explicit goal field, deterministic derivation, or documented shared default threshold; water remains excluded.
- Every valid goal-backed row has unit, direction, source, period goal, and finite percentage; absent, zero, incomplete, and invalid states remain distinct.
- Approved Figma-derived visuals, reporting hierarchy, navigation, recommendation lifecycle, streak semantics, and responsive behavior remain unchanged.
- No destructive migration, client-supplied identity, AI goal calculation, dependency addition, native tracking-policy change, push, merge, or protected-state mutation is included.
