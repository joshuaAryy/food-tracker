# Phase 17.5 Simulator Visual Validation Ledger

Status: Chart-system implementation and automated validation complete; the
fresh exact-viewport Simulator capture and authorized staging reseed remain
open. Physical iPhone status: **PENDING USER RE-VALIDATION**.

## 2026-08-20 chart-system update

This entry supersedes the current-evidence interpretation of the historical
Gate 3 notes below; those notes are retained as prior evidence.

- Starting implementation baseline: `9ab7304`.
- Final implementation commit: `7b1814c`.
- Chart system: `chartStyleForMetric` now centralizes family identity, raw-bar
  emphasis, trend treatment, reference bounds, selected state, and tooltip
  accent. Direct daily-hybrid callers use the resolver, while hydration,
  weight, logging consistency, and Macro compositions retain their specialized
  renderers.
- Macro: donut and daily-mix charts share one palette and geometry module;
  controlled white radial separators preserve segment boundaries without
  creating oversized gaps.
- Overview: Complex cards preserve the approved minimum geometry, and Logging
  Consistency uses a materially larger, responsive heatmap preview. The
  production Complex route reaches the expanded presentation, and
  `loggingDayPhase` preserves the distinct `in_progress` state. Simple/compact
  states and unavailable, unknown, empty, and error semantics remain covered.
- Figma nodes reviewed for this change: Complex Overview `338:276`, Macros
  `338:720`, Calories `338:469`, and Logging Consistency `338:928` in
  `GFLStsF0ADwaizoVKGeLny`.

### Current runtime and account boundary

The XcodeBuildMCP audit found only the already booted iPhone 17 on iOS 27.0.
Its current semantic snapshot was a pre-existing Macros screen, and its
optimized screenshot was `368x800`; that is not fresh 390/393 evidence and is
not counted as a validation capture. A fresh native build/install was not
performed because the generated `apps/mobile/ios` workspace was not present in
the working tree at audit time. No 402-point or 368-point artifact substitutes
for the required 390/393 review.

The deterministic fixture and safety tests pass for anchor `2026-08-20`, but
the guarded staging reset was not run: the required explicit existing
Firebase-linked QA UID or email was not supplied in this task context. No
account was created, guessed, or reseeded.

### Current automated evidence

- Node `v22.23.0`; pnpm `10.34.3`; PostgreSQL container `food-tracker-postgres`
  running on localhost:5432.
- Mobile Vitest: 55 files / 387 tests passed.
- Mobile Jest: 67 suites / 195 tests passed.
- API focused changed-boundary tests: 3 files / 19 tests passed.
- API full suite: 95 files / 1,181 tests passed against `food_tracker_test`.
- Prisma generate/validate, root lint, typecheck, build, API/shared/mobile
  typecheck/lint/build, `git diff --check`, and owned-file Prettier checks
  passed.
- Repository-wide `format:check` remains red only because it scans 25
  pre-existing generated/protected `.agents`/`.superpowers` artifacts; those
  paths were not modified.

## Environment

- Device: iPhone 17e, iOS 27.0, 390-point logical-width class.
- Native project: `apps/mobile/ios/FoodTracker.xcworkspace`.
- Runtime: authenticated standalone Release Simulator bundle; no Metro dependency
  was used for the seeded-data checkpoint.
- API target: existing Railway staging service; no production target used.
- Latest staging deployment: `4557bf89-1275-49d8-85d1-c62cfbdb227d` (`SUCCESS`);
  `/health` returned 200 with `{"status":"ok"}` after rollout.
- Automated runtime evidence: the fresh Release app installed on the current
  iPhone 17e Simulator, preserved the authenticated staging session, loaded the
  deterministic QA data, and returned a schema-valid Insights response after
  the staging analytics boundary fix. No password, Firebase token, or UID was
  printed.
- Physical iPhone validation: intentionally not performed.

## Reference captures

Figma captures were taken from file `GFLStsF0ADwaizoVKGeLny`:

| Surface | Node |
| --- | --- |
| Simple Insights | `338:98` |
| Complex Insights | `338:276` |
| Pinned analysis | `450:22` |
| Simple Explore | `520:21` |
| Complex Explore | `364:21` |
| Calories 30D | `338:469` |
| Calories 7D | `363:21` |
| Calories 90D | `363:177` |
| Weight | `338:605` |
| Macros | `338:720` |
| Logging Consistency | `338:928` |
| Hydration | `426:159` |
| Configure | `447:21` |
| Custom Range | `447:189` |
| Saved Views | `449:75` |
| Save View | `449:25` |
| Compare picker | `447:66` |
| Nutrient library | `424:21` |
| Canonical Water Log | `440:28` |

Local reference files are kept outside the repository under
`/tmp/food-tracker-phase17-5-visual/`.

## Implemented runtime fixes observed before visual comparison

- Authenticated root route matching includes trends and water-log roots.
- Explore is placed before report cards in both Insights modes.
- Overview period macro facts use canonical daily-period semantics.
- Shared human date formatting is used for chart and report presentation.
- Metro excludes local `.env*` files from the bundle; the staging bundle now
  loads without the prior environment-file parse error.
- Derived trend paths use bounded monotone cubic controls per contiguous numeric
  segment and preserve missing-value gaps; raw points remain separately
  rendered.
- Macro overview now exposes the daily-average calorie center readout and an
  expanded Protein preview.
- Nutrient highlights now expose semantic gauge tracks and reference markers
  while preserving unknown coverage.
- Hydration overview now renders eight explicit vessel states from WaterLog
  totals rather than a generic progress bar.
- Logging Consistency overview cells use compact rounded-square geometry.
- Pinned analysis preview height is aligned to the approved chart emphasis.
- The Insights `loggingConsistency` response now bounds period-local streak
  facts to the represented period; the historical streak remains owned by the
  period summary. A remote staging diagnostic now passes the canonical shared
  response schema with no metric errors.
- Simple and Complex Insights now use the approved compact single-row
  “Explore all trends” entry point in source, with a focused mobile fidelity
  regression preventing the prior explanatory “Explore every trend” block.
- Complex Explore saved-view rows now use a bounded metadata column and native
  one-line truncation; the Release screenshot confirmed that long names no
  longer overlap their period/visualization summaries.
- Saved Views “Create a saved view” now supplies a valid default Calories/30D
  Trend query; the prior empty-query error state was reproduced on-device,
  fixed, and covered by a real screen regression.

## Automated validation checkpoint

- API: Prisma generate/validate, typecheck, lint, build, and 94 test files / 1,178
  tests pass against `food_tracker_test`.
- Mobile: 52 Vitest files / 363 tests and 47 Jest suites / 131 tests pass;
  typecheck and lint pass.
- Root typecheck, lint, and build pass. Owned changed-file formatting and
  `git diff --check` pass. The repository-wide formatter still reports
  pre-existing protected/ignored workflow artifacts, which remain untouched.
- New focused mobile fidelity validation: Simple Insights and pinned period
  metadata (2 suites / 11 tests), Complex Explore layout (1 suite / 1 test),
  and Saved Views default-query routing (1 suite / 8 tests) passed under Node
  22.23.0. The full local backend test command remains blocked by PostgreSQL
  unavailable at `localhost:5432` (`P1001`); the deployed staging diagnostic
  exercised the real response boundary successfully.

## Gate 3 evidence captured

- Actual Release Simulator captures include `simple-explore-fixed.png`,
  `complex-explore-fixed.png`, `complex-insights-compact-source-patch.png`,
  `calories-7d-fixed.png`, `calories-30d-fixed.png`, `calories-90d-fixed.png`,
  `weight-fixed.png`, `macros-fixed.png`,
  `logging-consistency-fixed.png`, `hydration-fixed.png`,
  `configure-root-fixed.png`, `custom-range-fixed.png`,
  `compare-picker-fixed.png`, `saved-views-fixed.png`, `save-view-fixed.png`,
  `nutrient-library-fixed.png`, `water-log-fixed.png`, and
  `pinned-detail-fixed.png` under `/tmp/food-tracker-phase17-5-visual/`.
- Figma references were freshly captured for all 19 required nodes listed
  above, using the exact node IDs and stored under the same temporary visual
  evidence directory.
- Convergence iterations: Insights 2 (compact hierarchy and period metadata),
  Complex Explore 2 (saved-view truncation), and each remaining required
  surface 1 focused route comparison. Final unresolved discrepancy ledger:
  Major 0, Moderate 0, Minor 0. Seed-specific values and current-day unknown
  hydration states are intentional data differences, not visual defects.
- The loaded runtime’s seeded values intentionally differ from Figma fixture
  values; comparison therefore uses hierarchy, control placement, component
  geometry, typography scale, and loading/error behavior rather than exact
  numbers.
- The first real seeded Insights request exposed a server-side schema mismatch
  in period-local logging streak facts. The minimal backend fix was deployed
  and the canonical schema diagnostic then returned `success: true` with no
  metric errors.

## Closeout boundary

The Release artifact was rebuilt with Xcode 27, installed and launched on the
current Simulator, and rechecked after the final source changes. The account
remained authenticated against staging throughout; no credentials were
requested or exposed. A physical iPhone run, Personal Team signing, and any
production distribution remain outside this automated Gate 3 claim.
