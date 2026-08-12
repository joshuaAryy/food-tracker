# Phase 17.5 Simulator Visual Validation Ledger

Status: in progress. This ledger records the real iOS Simulator checkpoint;
it is not a completion claim for Gate 3.

## Environment

- Device: iPhone 17e, iOS 27.0, 390-point logical-width class.
- Native project: `apps/mobile/ios/FoodTracker.xcworkspace`.
- Runtime: staging Debug development client connected to LAN Metro.
- API target: existing Railway staging service; no production target used.
- Latest staging deployment: `33679989-79f2-4569-8441-cc4ef75bbc2c` (`SUCCESS`);
  `/health` returned 200 with `{"status":"ok"}` after rollout.
- Automated runtime evidence: the app bundle built successfully, installed, and
  loaded the authenticated sign-in screen.
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

## Automated validation checkpoint

- API: Prisma generate/validate, typecheck, lint, build, and 94 test files / 1,178
  tests pass against `food_tracker_test`.
- Mobile: 52 Vitest files / 363 tests and 47 Jest suites / 131 tests pass;
  typecheck and lint pass.
- Root typecheck, lint, and build pass. Owned changed-file formatting and
  `git diff --check` pass. The repository-wide formatter still reports
  pre-existing protected/ignored workflow artifacts, which remain untouched.

## Remaining checkpoint

The Simulator currently shows the normal Firebase sign-in screen. Gate 1
requires an explicitly chosen existing staging Firebase-linked QA account and
the user must sign into that account in the Simulator before the deterministic
fixture can be seeded. No auth bypass, production account, or guessed identity
will be used.

After authentication, capture the seeded Simple/Complex Insights, pinned,
Explore, chart, and tools surfaces; compare each against the reference nodes;
record every major or moderate discrepancy and its fix here; and leave only
minor intentional differences before declaring Gate 3 complete.
