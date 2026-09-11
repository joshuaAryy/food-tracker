# Pre-Phase-24 Regression and Debugging Closeout

**Status:** IN PROGRESS — not merge-ready and not phase-complete.

This document is the durable checkpoint for the whole-product regression sweep.
It records evidence actually obtained so far; it does not convert automated or
API evidence into Simulator or physical-device acceptance.

## Baseline and repository state

- Base/main merge baseline: `619f9eac17109f536eb12defb44f0589b29024fa`.
- Active branch: `pre-phase-24-product-regression-debugging`.
- Current branch includes this closeout checkpoint; verify the exact tip with
  `git rev-parse HEAD` during final closeout.
- Node: `v22.23.0`; pnpm: `10.34.3`.
- Protected and pre-existing local state remains untouched, including the
  modified Phase 17.5 ledger and known untracked/protected paths.
- No PR was created, no merge was performed, and no production deployment or
  production data mutation occurred.

## Product-contract authority

The canonical contract is recorded in
`docs/superpowers/pre-phase-24-contract-register.md` and the execution plan.
Simple/Complex remain two views of one domain; historical FoodLog snapshots,
Unknown-versus-zero semantics, current Goal Pace, target priority, trusted
retrieval authority, bounded AI fallback, water-only hydration, local-day
semantics, account isolation, and the Phase 24 visual boundary remain locked.

## Matrix coverage at this checkpoint

`docs/superpowers/pre-phase-24-regression-matrix.csv` currently contains 57
scenarios:

- `PASS-AUTOMATED`: 42
- `PASS-SIMULATOR`: 7
- `PASS-STAGING-API`: 1
- `PASS-STAGING-SIMULATOR`: 1
- `BLOCKED`: 6

The six blocked scenarios are authenticated relaunch, QA A → QA B switching,
QA C deletion, the real-UI `1 apple` recoverability journey, QA C isolation
deletion, and physical-device acceptance.

## Automated validation

Fresh validation at branch tip `3dbf388` completed under Node 22 and pnpm
10.34.3:

- API: 116 test files / 1,401 tests passed.
- Mobile Vitest: 64 files / 438 tests passed.
- Mobile Jest: 68 suites / 203 tests passed.
- Lint, typecheck, workspace build, Prisma generate/validate, and test-database
  migration deploy/status passed.
- `git diff --check` passed.
- Root `format:check` still reports only the known 26 protected/local files;
  none was edited.

## Verified regression evidence

- `AI-RAG-001`: post-retrieval adequacy evaluation was proven missing at the
  request boundary, fixed in the existing AI/retrieval boundary, and covered by
  regression tests. The named `1 apple` UI recovery scenario remains separate.
- `AUTH-BOOTSTRAP-001`: rejected auth-session cleanup was reproduced, fixed,
  and covered by a focused regression test.
- QA A/B Firebase identity mapping, deterministic QA A staging fixture, and
  FoodLog/saved-view/weight ownership checks are evidenced. QA A staging data
  includes the seeded food logs, sparse nutrient snapshots, weights, water logs,
  saved views, and recommendations described in the defect ledger.
- Reversible QA A hydration and weight persistence probes passed create/read,
  update where applicable, delete, and post-delete checks.
- QA A Goal/target and analytics/Insights/streak/daily-nutrient response shapes
  were read-only verified against the seeded staging service.
- The verified Railway deployment `f522fae3` remains the runtime evidence for
  its exact candidate `14c0472c1aeb59abe75e4f0cf8507dd70e74a98a`.
- The current docs-only candidate upload created `b4b203be` but was correctly
  marked `SKIPPED` because no watched runtime files changed; it is not staging
  runtime evidence.
- At this checkpoint the existing staging service responds `/health=200`,
  `/health/ready=200`, and unauthenticated `/api/v1/setup/status=401` with the
  structured `AUTHORIZATION_REQUIRED` response.
- A fresh read-only QA A/B staging smoke returned 200 for setup, profile, goals,
  dashboard, food logs, water logs, weight logs, recommendations, saved views,
  recipes, and nutrition targets. QA A remained at 560 food logs, 485 water
  logs, 106 weights, two recommendations, four saved views, and zero recipes;
  QA B remained empty for owned logs/recommendations/views/recipes while both
  accounts returned 24 nutrition-target records.

Detailed reproduction and evidence remain in
`docs/superpowers/pre-phase-24-regression-defects.md`.

## Unresolved execution gates

1. The macOS host session is locked or the display is unavailable. Simulator
   snapshots can be captured, but XcodeBuildMCP actions do not produce an
   observed state transition. No authenticated Simulator row is marked PASS
   from action-return status or screenshots alone. The host must be unlocked by
   the user before the authenticated matrix can resume.
2. The supplied disposable QA C credential pair still returns Firebase
   `INVALID_LOGIN_CREDENTIALS`. No substitute account has been created or
   deleted. Re-verify the QA C email and expected UID before destructive tests.
3. Physical-iPhone acceptance remains a user-owned final gate.
4. A current runtime-changing candidate still requires a real Railway
   deployment and served-provenance check before current-HEAD staging UAT.

## Intentional exclusions and deferrals

Notifications/APNs, Apple Sign-In provisioning, supplements, drink taxonomy,
new provider portfolios, speculative architecture, new product features,
production deployment/data, App Store/TestFlight/EAS, standalone Android
acceptance, and Phase 24 visual redesign are excluded. Cosmetic findings remain
deferred; only verified unusability is fixed in this phase.

## Resume and completion requirements

After the host is unlocked and approved QA C access is corrected, resume the
blocked Simulator rows using the real UI and backend persistence checks. Then
perform the full critical-journey re-sweep, targeted physical-iPhone pass,
current runtime-changing staging cold-start validation, final automated checks,
and closeout review. Do not mark this document complete until the matrix has no
unresolved P0/P1 or meaningful functional P2, all required gates are evidenced,
the final branch is pushed, and the working tree contains only intentional
changes.
