# Pre-Phase-24 Whole-Product Regression and Debugging Execution Plan

## Objective

Establish a verified, reproducible functional baseline of the complete intended
Food Tracker product before Phase 24. Exercise real user journeys through the
iOS Simulator, verify persisted/backend facts, challenge failure and recovery
states, root-cause and minimally fix verified defects, complete a critical
journey re-sweep, perform targeted physical-iPhone acceptance, and record a
durable behavioral baseline.

This phase is not a new-feature, redesign, speculative-refactoring, or
automated-suite-only phase. Visual polish belongs to Phase 24. The governing
rule is: **ugly is Phase 24; unusable is debugging.**

## Authority, safety, and resolved decisions

- Remain on `pre-phase-24-product-regression-debugging`; never switch, merge,
  rebase, force-push, or merge into `main`.
- Preserve `.agents/`, `.aidesigner/`, `.codex/`, `.superpowers/`, `backups/`,
  current design-reference images, `apps/api/food_search_diagnostic.mjs`,
  generated `apps/mobile/ios/` and `apps/mobile/android/`, and local database
  safety state. Never use `git add .` or `git add -A`.
- Authorized account policy: QA A is the primary seeded functional account;
  QA B is the independently recognizable isolation/account-switching account;
  disposable QA C is the explicitly disposable permanent-deletion account.
  Everyday/personal accounts must never be reset, reseeded, mutated
  destructively, or deleted. Missing approved identities block only dependent
  rows; do not substitute or bypass Firebase authentication.
- After relevant automated and targeted verification is green and the exact
  candidate is committed, Codex may deploy that candidate to the existing
  `food-tracker-staging-api` in the existing Railway staging environment.
  Verify the served SHA/provenance before using staging as evidence. No
  production deployment/data mutation, PR, merge, architecture/source/scale
  redesign, or notification/APNs work is authorized.
- Node 22.x and pnpm 10.34.3 are required for every validation command.
- Automated tests use an explicit database ending in `_test`; never reset or
  migrate development data for tests.
- Prisma/schema, dependency, broad architecture, folder restructuring, new
  product features, or destructive action outside approved QA data require a
  separate approval boundary after reproduction and root-cause evidence.

## Stage 0 — Contract reconstruction

Before debugging, read `AGENTS.md`, README, roadmap, architecture/API/data and
Prisma decision documents, product/AI strategy, mobile testing context, all
relevant Phase 18/19 and Phase 20–22 closeouts/specs/plans, current history,
API/mobile/shared implementation, and existing tests. Produce a contract
register recording canonical behavior, accepted evidence, superseded wording,
and affected scenarios.

Preserve these invariants:

- Simple and Complex are views of one backend/domain/history; terminology is
  `Simple` and `Complex`.
- Historical FoodLog nutrition snapshots are immutable against later FoodItem,
  provider, recipe, reference-data, or search-index changes. FoodLog edits do
  not mutate FoodItems.
- Numeric, explicit zero, and Unknown remain distinct through save, reopen,
  History, and analytics. Unknown never becomes zero.
- Lose/Gain allow 0.50–2.00 lb/week in 0.05 steps with no age gate. Maintain
  stores a null rate. Selected rates remain selected even when feasibility or
  calorie-floor constraints limit a plan; unsupported forecasts are absent.
- Effective target authority is override > personalized/reference > derived >
  missing. Missing is not zero.
- Trusted Postgres food data is nutrition authority; Pinecone is derived
  candidate infrastructure; Gemini is not nutrition authority.
- Hydration uses WaterLog only, with the implemented initial goal around
  2000 mL/day; food water does not count. Recipes, Mixed Meals, Food Library,
  barcode, photo, analytics, recommendations, auth, and account lifecycle are
  in scope.
- Storage is UTC and product-day grouping is user-local.
- Apple Sign-In acceptance, notification/APNs acceptance, supplements, drink
  taxonomy, new provider portfolios, production, App Store/TestFlight/EAS,
  Android standalone acceptance, and Phase 24 visual redesign are excluded.

The planning inspection found possible stale phase wording, a possible text-AI
post-retrieval adequacy gap, and a likely missing-unit recovery lead. These are
hypotheses until execution proves them.

## Stage 1 — Mechanical baseline

Reconfirm branch, SHA, protected state, Node versions, pnpm version, PostgreSQL,
and remote references:

```bash
node -v
corepack pnpm -v
corepack pnpm --filter @food-tracker/api exec node -v
corepack pnpm --filter @food-tracker/mobile exec node -v
git status --short --branch
git branch -vv
git rev-parse HEAD
git ls-remote origin refs/heads/main refs/heads/pre-phase-24-product-regression-debugging
git diff --check
```

Use the dedicated test database and verify its name before commands:

```bash
export TEST_DATABASE_URL='postgresql://postgres:postgres@localhost:5432/food_tracker_test'
docker exec food-tracker-postgres pg_isready
corepack pnpm prisma:generate
DATABASE_URL="$TEST_DATABASE_URL" corepack pnpm prisma:validate
DATABASE_URL="$TEST_DATABASE_URL" corepack pnpm --filter @food-tracker/api exec prisma migrate status
DATABASE_URL="$TEST_DATABASE_URL" corepack pnpm --filter @food-tracker/api exec prisma migrate deploy
DATABASE_URL="$TEST_DATABASE_URL" corepack pnpm --filter @food-tracker/api exec prisma migrate status
```

Run the complete baseline:

```bash
corepack pnpm format:check
corepack pnpm lint
corepack pnpm typecheck
corepack pnpm build
TEST_DATABASE_URL="$TEST_DATABASE_URL" corepack pnpm test
corepack pnpm --filter @food-tracker/mobile exec vitest run
corepack pnpm --filter @food-tracker/mobile test:jest
git diff --check
git status --short --branch
```

Run only one database-resetting Vitest process against `food_tracker_test`.
Record exact counts and every failure disposition. Protected-file formatting
exceptions are reported rather than “fixed.” Read-only Expo public config
checks must assert target/bundle/plugin safety without printing secrets.

Record Railway project/environment/service, deployed SHA, deployment ID, sleep
state, and source equivalence. Do not warm health/readiness before the cold-start
experiment.

## Stage 2 — Matrix, fixtures, and evidence harness

Create and maintain:

- `docs/superpowers/pre-phase-24-regression-matrix.csv`
- `docs/superpowers/pre-phase-24-regression-defects.md`
- `docs/superpowers/pre-phase-24-regression-closeout.md`

The matrix schema is:

```text
id, contract_reference, area, scenario, starting_state, user_actions,
expected_visible_behavior, expected_backend_behavior, recovery_expectation,
evidence_source, status, severity_if_failed, automated_regression,
execution_class, phase_24_defer_note, bug_id, source_sha, deployed_sha,
fixture_version, account_alias, timezone, device_runtime_viewport,
observed_result, last_executed_at
```

Use `NOT_RUN`, `IN_PROGRESS`, `PASS`, `FAIL`, `BLOCKED`,
`DEFERRED_VISUAL`, and contract-justified `NOT_APPLICABLE`. Evidence classes
remain separate: `API_AUTOMATED`, `MOBILE_AUTOMATED`,
`SIMULATOR_REAL_BACKEND`, `SIMULATOR_CONTROLLED_RESPONSE`, `LIVE_PROVIDER`,
`STAGING_COLD_START`, and `PHYSICAL_USER`.

Prepare a new/empty fixture, an independently calculated arithmetic fixture,
complete/partial/unlogged/in-progress coverage fixtures, and a long-history
fixture. Use a separate `food_tracker_regression_test` for persistent local
Simulator UAT and a separate benchmark database when needed. Fixture tooling
must require exact approved QA identities, explicit reset intent, deterministic
anchor date/timezone, scoped record deletion, target-override handling, and
sanitized counts.

Use a localhost-only failure proxy or existing injection seam for delay,
transport loss, 401/429/500/503, malformed responses, response loss after a
forwarded mutation, and recorded provider responses. Preserve real auth and do
not log secrets, tokens, proof values, or photos.

## Stage 3 — Simulator control loop

Inspect the existing generated workspace and Pods before any regeneration. Use
per-command `DEVELOPER_DIR=/Users/teiko/Downloads/Xcode-beta.app/Contents/Developer`
when required, existing `FoodTracker.xcworkspace`, and an available iOS 27
Simulator such as `Food Tracker QA iPhone 17`. Do not globally change
`xcode-select`, delete native trees, or start with clean prebuild.

Use the real XcodeBuildMCP Simulator controls to boot, build/install, launch,
inspect UI, tap/type/swipe, wait on UI state, capture screenshots/logs, and
stop/relaunch. A Simulator PASS requires actual launch, actions, observed UI
result, and backend persistence checks where applicable. Build success,
endpoint status, component rendering, and tests are not Simulator evidence.
Prove the loop with signed-out launch, sign-in, navigation, text input, and one
QA create/read/delete journey before broad UAT.

## Stage 4 — Auth, onboarding, profile, and deletion

Exercise signed-out and authenticated cold launches, email/password, Google,
invalid/cancelled/revoked states, five relaunches, five background/foreground
cycles, sign-out/sign-in cycles, token refresh, setup-status delay/failure,
retry, and bootstrap listener/routing stability.

Exercise onboarding directly from bootstrap to the first question, birthday
wheel synchronization/leap dates/future rejection, height and weight wheels,
all Lose/Gain rate values and invalid values, ages below 18/18/19, Maintain
null rate, back/forward edits, failed saves, retry, repeated submit, and cold
relaunch persistence.

Exercise Profile/Goal Plan edits after history exists, current-weight changes,
safe-rate feasibility, calorie floors, target propagation, and rate-free
Maintain messaging.

Use only explicitly designated disposable QA C for reauthentication,
confirmation cancel, provider failure, permanent deletion, post-delete routing,
owned-data cleanup, and fresh-account recreation. Verify B/global data remains.

## Stage 5 — Search, serving, and Food Library

Use the 120-query benchmark plus new exact, plural, typo, alias, preparation,
generic/branded, compound, ambiguous, custom/saved/recent, incomplete-nutrition,
and provider-diversity queries. Assess identity, form, source quality,
completeness, serving usability, selection safety, and whether a result can
actually produce a valid FoodLog.

Run Search → log → History → Insights journeys across query/provider classes,
including stale results, no results, provider failure, and relaunch.

Exercise mass, volume, count, fraction, missing-unit, unsupported-unit,
alternate-serving, candidate replacement, serving-after-replacement, reset,
preview, persisted snapshot, and default-serving transitions. `2 eggs` may
use trusted count data; `1 cup cooked rice` without a trusted relationship
must remain review-required.

Exercise Saved, My Foods, Recent, Archived, archive/restore, default serving,
manual-food reuse, historical-log conversion, recipes/mixed-meal consumers,
and source edits without historical mutation.

## Stage 6 — AI text, barcode, and photo

### Text architecture investigation

Trace and test the actual complete flow:

```text
natural-language input → component interpretation → trusted retrieval
→ candidate/serving/context evidence → adequacy determination
→ trusted/review-required/fallback-eligible state
→ editable review → authoritative persistence
```

The planning inspection suggests, but does not prove, that the text path may
lack required post-retrieval adequacy judgment. First establish whether the
canonical trusted/review/fallback contract is already satisfied elsewhere,
partially satisfied, or absent using request-boundary tests and representative
end-to-end scenarios. Only then select the smallest correction within the
existing AI/retrieval architecture.

Gemini may reason over bounded trusted evidence, but remains non-authoritative.
Excellent matches stay trusted; plausible imperfect matches require editable
review; materially inadequate retrieval may receive minimally scoped,
low-trust fallback. Partial fallback affects unresolved components only. Clear
multi-food input generally yields multiple appropriate trusted rows; opaque
meals must not gain fictional precision. Provider failure cannot fabricate
confidence. Server validation remains final. Do not add a new search engine,
broad agent architecture, nutrition-reasoning system, or speculative RAG
rewrite.

Run the named corpus and at least 40 meaningful variations covering counts,
fractions, mass, volume, missing/unsupported units, preparation ambiguity,
multi-food meals, opaque dishes, saved/custom foods, partial fallback, and
materially inadequate candidates. Use deterministic responses for exhaustive
UI states and live Gemini for named representatives within configured limits.

`AI-APPLE-MISSING-UNIT` is mandatory. Reproduce `1 apple` through the real UI,
then prove amount/unit editing, candidate replacement, removal, cancel/back,
valid state, successful save, and History agreement. Add interaction-level
coverage; helper tests that directly construct valid state do not count.

Exercise excellent trusted matches, ambiguous review, partial fallback,
estimate failure, trusted-save/estimate-save separation, response loss,
recovery, and stale-state invalidation.

Exercise barcode normalization, cache-first/provider fallback, unknown/invalid
codes, failures, retries, serving display, save/reopen, and duplicate scans.

Exercise photo orientation, dimensions, HEIC, JPEG quality/size, cleanup,
library preservation, trusted/estimated/excluded rows, replacement, missed
foods, unsupported portions, estimate editing, provider failure/retry,
cancel/back, rapid double-save, keyboard reachability, and atomic confirmation.
Real scanner/camera/library/permission behavior is later physical evidence.

## Stage 7 — History, nutrient correction, recipes, mixed meals

Exercise current/older History days, ordinary FoodLog edit/delete/cancel/reopen,
legacy logs without serving snapshots, and source edits after logging.

Exercise Complex numeric → explicit zero → Unknown corrections, one-key edits,
invalid patch rollback, serving changes after overrides, clear/replace actions,
mode transitions, analytics coverage, and canonical FoodItem immutability.

Execute create recipe → log → edit ingredients → reopen old log → verify frozen
history → log again with updated nutrition, plus portions/grams/cooked weight,
archive/delete/unowned/malformed/failure/repeated-submit cases.

Exercise mixed-meal preview/no-write, ingredient edits/replacement/removal,
atomic save-as-recipe, rollback, repeated submit, lost response, and immutable
History snapshot.

## Stage 8 — Goals, targets, modes, hydration, weight

Exercise onboarding → Goal Plan → effective targets → override → Use Recommended
→ analytics/reference consumers, including missing/derived/reference and
unsupported reference semantics.

Run the continuous Simple → create food/weight/water → Insights/Progress →
Complex → micronutrient correction/target/comparison/saved view → Simple
journey. Verify identical canonical data and appropriate presentation depth.

Exercise Water entry, Other Amount, `+250 mL`, edit/delete, Undo targeting,
failure/retry, repeated taps, local-day boundaries, both modes, refresh, and
food-water exclusion. Exercise Weight add/edit/delete, dates, ties, fallback,
goal propagation, and analytics updates.

## Stage 9 — Analytics, Insights, reports, recommendations

Exercise all implemented core metrics, nutrient examples, empty/complete/
partial/unknown/zero/sparse/in-progress states, 7D/30D/90D/custom ranges,
daily/weekly/monthly buckets, coverage filters, comparisons, contributors,
references, saved/pinned views, and cache invalidation.

Verify facts independently: date boundaries, aggregation denominators, unknown
exclusion, logging versus nutrient coverage, comparison alignment, contributors,
reference sources/units, no fabricated ranges, and forecast eligibility. The
existing deterministic forecast policy and metric-specific aggregation remain
authoritative.

Exercise recommendation generation, maximum three active, at most one
micronutrient, Simple restrictions, coverage thresholds, stable identity,
deduplication, dismissal for local days, reactivation, archival, target-source
change, mode, and account transitions.

## Stage 10 — Failure, navigation, time, isolation, cold start

Inject failures before request, during delay, validation, pre-commit, after
commit/response loss, auth refresh, malformed success, and retry. Require no
crash, infinite loading, duplicate mutation, corruption, trapped state, or
false certainty. Uncertain mutation outcomes require authoritative
reconciliation before retry.

Enumerate actual routes and test normal entry, Back, cancel/close, invalid ID,
missing session, and supported cold/deep-link entry. Keyboard/clipping/scroll
blocking a required action is a functional defect.

Test local-day behavior around midnight, UTC/local date differences, month/year
boundaries, supported timezone changes, History, analytics, water, weight, and
dismissals.

Populate A with recognizable records/cache, switch to B, relaunch, test delayed
A responses, in-memory drafts, offline sign-out, and A IDs under B auth. No
A-owned data may appear.

For staging cold start, only after candidate validation, commit, exact deploy,
and served-source verification: allow API/DB sleep, launch normally without a
warm-up health call, observe bootstrap/retry/readiness, then inspect health and
persistence. Test authenticated and signed-out cold launches separately. Do
not redesign scale-to-zero.

## Stage 11 — Defect loop

For every defect: reproduce; capture evidence; classify P0/P1/P2/P3; identify
layer; trace state/value to origin; state a falsifiable hypothesis; add failing
regression coverage where practical; verify failure; implement the smallest
root-cause correction; run targeted and neighboring tests; repeat the real
Simulator journey; verify persisted/downstream effects; make a focused commit;
update matrix/defect ledger; resume the sweep.

No speculative fixes, symptom patches, unrelated cleanup, or “while here”
refactors. P0/P1 block acceptance. P3 normally becomes a Phase 24 deferral.

## Stage 12 — Critical Simulator re-sweep

After fixes, rerun the full automated baseline and these real journeys:

1. Sign-in → onboarding → Progress → cold relaunch.
2. Goal edit → targets → override → Use Recommended → Insights.
3. Search → non-default serving → save → History → Insights.
4. `1 apple` missing-unit recovery.
5. Trusted/ambiguous/partial-fallback text meal.
6. Barcode lookup → serving → save.
7. Photo trusted/estimated/excluded review → atomic save.
8. Complex numeric → zero → Unknown → reopen.
9. Recipe edit after historical log.
10. Mixed-meal confirmation and duplicate-submit protection.
11. Library archive/restore/default serving consumers.
12. Simple → Complex → Simple.
13. Water edit/Undo and weight propagation.
14. Analytics partial/unknown/zero/range/comparison/saved-view cases.
15. Recommendation dismissal/changed condition.
16. Failed save and uncertain-response recovery.
17. A → B isolation with delayed responses.
18. Repeated bootstrap/launch stability.
19. Verified staging cold start.
20. Disposable C deletion.

Reopen neighboring rows after shared-code changes invalidate prior evidence.

## Stage 13 — Physical-iPhone handoff

Only after automated checks, Simulator critical journeys, a committed candidate,
verified staging deployment, and Codex-performable cold-start work are complete,
stop at a clean checkpoint. Report branch/SHA/push state, deployed SHA/ID,
working-tree state, exact automated counts/flakes, matrix totals, Simulator
results, defects/fixes/commits, and remaining device-only checks.

The user-owned checklist is intentionally short: cold launch without Metro,
real camera, HEIC/photo-library and permissions, barcode scan, `1 apple` text
recovery, physical keyboard/touch reachability, Complex zero/Unknown, water and
mode switching, and background/foreground/terminate/relaunch. Do not ask the
user to repeat the Simulator matrix. Record physical results separately and do
not claim completion before they arrive.

## Stage 14 — Final validation and closeout

Create/update `docs/superpowers/pre-phase-24-regression-closeout.md` with
baseline/final SHAs, contract assumptions, matrix totals, fixtures/accounts,
Simulator/runtime, defects/severities/root causes/fixes/commits, regression
tests, provider/deployment/cold-start evidence, physical results, exact
validation commands/counts, visual-only Phase 24 deferrals, exclusions,
limitations, protected-state verification, and committed/pushed readiness.

Run the complete final validation from Stage 1, plus relevant focused tests.
Stage explicit paths only and inspect staged diffs. Do not call root formatting
green when it fails only on protected files; report the exception honestly.

Push only the active debugging branch and verify remote SHA equals local HEAD:

```bash
git push -u origin pre-phase-24-product-regression-debugging
git ls-remote origin refs/heads/pre-phase-24-product-regression-debugging
```

Do not create or merge a PR, merge into `main`, delete the branch, or force-push.

## Exit criteria

Complete only when baseline/final automated suites, typecheck, lint, build,
Prisma/migration checks, major intended journeys, AI recoverability, search/log/
History integrity, recipe/mixed-meal immutability, analytics semantics,
hydration, account isolation, Simple/Complex continuity, critical Simulator
re-sweep, staging/served-source/cold-start behavior, and targeted physical
acceptance all pass or have exact documented hardware-only limitations. No
unresolved P0/P1 or meaningful functional P2 may contaminate Phase 24. Visual
deferrals, protected-state preservation, clean tracked tree, pushed branch, and
no-PR/no-merge status must be recorded.
