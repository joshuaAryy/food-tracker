# Phase 17.5 Simulator Visual Validation Ledger

Status: Chart-system implementation, guarded staging reseed, and broader
Simulator visual review complete. Exact 390/393 evidence was unavailable due
to the CoreSimulator/runtime environment and is non-blocking after accepted
physical-device validation.
Physical iPhone status: **PASS — USER ACCEPTED 2026-08-21**.

## Final physical acceptance — 2026-08-21

Implementation baseline accepted: `e70ccb514b0c9bd65cc9ba1c0bdea57d207f6043`.
User-operated physical iPhone validation: **PASS**.

The user explicitly accepted the current Calories gray/reference-range
treatment, the current Logging Consistency overview scale and layout, the
unified chart system, nutrient/chart palette behavior, the Complex Overview
composition, and the overall Phase 17.5 visual fidelity. The user reported no
further requested visual changes. Exact 390pt and approximately 393pt
Simulator evidence remains unavailable and is recorded as an environment
limitation, not a completion blocker.

## Workflow closeout note

This ledger remains the automated/runtime evidence record; it does not replace
the user-owned physical gate. Future visual recovery should reuse the exact
Figma-node ledger, deterministic staging fixture, real-runtime screenshots,
independent review, and explicit viewport/account/backend checks. It should
not repeat broad self-approval, treat nearby widths as exact evidence, or keep
delegated reviewers and high-cost workers active after their bounded question
is answered.

## 2026-08-20 chart-system update

This entry supersedes the current-evidence interpretation of the historical
Gate 3 notes below; those notes are retained as prior evidence.

- Starting implementation baseline: `9ab7304`.
- Final implementation commits: `1489e92` plus the follow-up Energy preview
  treatment fix in the current closeout commit.
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
  `338:720`, Calories `338:469`, Logging Consistency `338:928`, and Nutrient
  Library `424:21` in `GFLStsF0ADwaizoVKGeLny`.
- Final visual review: the Energy preview now uses the unified trend style,
  subtle dashed reference bounds, and a light Complex-mode chart surface; the
  heavy gray range treatment was removed. Calories now has a quiet in-chart
  reference band, Logging Consistency uses a balanced single-row weekly
  preview, and Nutrient Library limits attention to prioritized exceptions.
  The independent reviewer confirmed no remaining Major, Moderate, or Minor
  discrepancy in the fresh targeted captures.

### Automated runtime and account boundary

The generated workspace was discovered, built, installed, and launched on the
booted iPhone 17 Simulator running iOS 27.0. The authenticated app loaded the
current staging fixture and was reviewed through the real Insights route. The
fresh optimized captures are `368x800` (approximately 402pt) and therefore are
not counted as required 390/393 evidence. No 402-point or 368-point artifact
substitutes for that required review.

The guarded staging reset/reseed ran only for the explicitly verified existing
Firebase-linked account `testacct4653@gmail.com`, anchored at `2026-08-20`.
The resulting fixture contains 560 food logs, 106 weights, 485 water logs,
6754 nutrient rows, four saved views, and one pinned view; read-only checks
confirmed current-day, 7D, 30D, and 90D coverage plus special nutrients.

### Fresh runtime review surfaces

The authenticated iPhone 17 Simulator pass reviewed the current staging data
through the real navigation path. Fresh screenshots are retained outside the
repository under `/tmp/`: Complex Overview sections, Calories 30D, Protein
30D, Sodium 30D, Vitamin C 30D, Macros 30D, Hydration, Logging Consistency,
the nutrient library, and Other Recorded Nutrients. The final targeted files
include `phase-17-5-calories-30d-final-after-opacity.jpg` and
`phase-17-5-logging-consistency-final-after-layout.jpg`. The latter nutrient
capture shows Caffeine recorded while Alcohol, Oxalate, and Phytate remain
intentionally unrecorded.

The current-date evidence includes Aug 20, current-week Aug 14–20, and
Calories 30D Jul 22–Aug 20. The independent visual review found no remaining
Major, Moderate, or Minor discrepancy in the reviewed surfaces; the only
limitation is the 368x800/approximately-402pt viewport, which is not exact
390/393 evidence.

### Current automated evidence

- Node `v22.23.0`; pnpm `10.34.3`; PostgreSQL container `food-tracker-postgres`
  running on localhost:5432.
- Mobile Vitest: 55 files / 387 tests passed.
- Mobile Jest: 67 suites / 197 tests passed.
- API focused changed-boundary tests: 3 files / 19 tests passed.
- API full suite: 95 files / 1,181 tests passed against `food_tracker_test`.
- Prisma generate/validate, root lint, typecheck, build, API/shared/mobile
  typecheck/lint/build, `git diff --check`, and owned-file Prettier checks
  passed.
- Repository-wide `format:check` remains red only because it scans 25
  pre-existing generated/protected `.agents`/`.superpowers` artifacts; those
  paths were not modified.

## Environment

- Device: iPhone 17, iOS 27.0, 390-point logical-width class; the captured
  runtime output was 368x800 (approximately 402pt) and is not exact 390/393
  evidence.
- Native project: `apps/mobile/ios/FoodTracker.xcworkspace`.
- Runtime: authenticated native Simulator app with the staging Metro bundle;
  the seeded-data checkpoint used the real staging API and Firebase session.
- API target: existing Railway staging service; no production target used.
- Latest staging deployment: `719f9469-52dd-46cd-8eb5-b9392711601b` (`SUCCESS`);
  `/health` returned 200 with `{"status":"ok"}` after rollout.
- Automated runtime evidence: the authenticated native Simulator app loaded
  the deterministic staging QA data through the staging Metro bundle and
  returned schema-valid Insights and trend responses. No password, Firebase
  token, or UID was printed.
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
- The fresh 2026-08-20 runtime pass then reviewed the full Overview composition,
  Calories/Protein/Sodium/Vitamin C detail charts, Macro composition and daily
  mix, Hydration, Logging Consistency, nutrient categories, special metrics,
  and intentional empty states.

## Closeout boundary

The Release artifact was rebuilt with Xcode 27, installed and launched on the
current Simulator, and rechecked after the final source changes. The account
remained authenticated against staging throughout; no credentials were
requested or exposed. The automated Gate 3 evidence remains separate from the
user-operated physical validation recorded above. The latest fresh visual pass
used the same booted Simulator with the authenticated staging Metro bundle;
its 368x800 captures remain approximate evidence only. Exact 390/393 evidence
remained unavailable and was superseded as a completion blocker by the
accepted physical-device review.
