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

Latest mechanical recheck (2026-09-12) under Node 22/pnpm 10.34.3 passed
API Vitest (116 files / 1,401 tests), mobile Vitest (67 files / 444 tests),
mobile Jest (71 suites / 212 tests), workspace typecheck, workspace lint,
workspace build, Prisma generate/validate, and test-database migration
deploy/status. No development database was used. Root
`format:check` still reports the pre-existing
protected/untracked documentation set plus the tracked saved-views test
formatting warning; no unrelated formatting was changed.

Post-fix workspace typecheck, lint, and build plus Prisma generate/validate also
pass. A later read-only `prisma migrate status` check returned `P1001` because
the local PostgreSQL/Docker service was unavailable; no migration or database
mutation was attempted. The earlier full baseline remains the authoritative
green migration deploy/status evidence until the service is restored.

A subsequent mobile-only rerun after the snapshot-macro and meal-keyboard
corrections passed all 67 Vitest files / 444 tests and all 71 Jest suites /
212 tests.

The approved per-command Xcode beta retry then completed a fresh Debug build
against iOS 27 (`** BUILD SUCCEEDED **`), installed the exact `FoodTracker.app`
on Fresh QA Simulator `A716FD01-3A7D-4D5C-90D7-71C139F9EAD1`, and exercised the
current authenticated route. Generated native/build caches remain local and
untracked. The focused follow-up commit `1a52472` makes the multiline meal
description recoverable: its Done key dismisses the keyboard and the required
Read meal footer then activates into editable Review foods. The real Simulator
rerun observed candidate/serving controls and Log selected without saving a log.

An authorized staging retry used a clean `git archive` of committed candidate
`42b4d5b` and the existing `food-tracker-staging-api` service/environment.
With the documented `--path-as-root` mode, Railway indexed and uploaded the
archive but rejected the deployment because free-tier SFO deploys are
unavailable during the peak window (8 AM–8 PM America/Los_Angeles). No new
deployment was created; deployment history still shows the prior failed
`3bbfb81d` attempt and the last verified served deployment `f522fae3`.

## Product-contract authority

The canonical contract is recorded in
`docs/superpowers/pre-phase-24-contract-register.md` and the execution plan.
Simple/Complex remain two views of one domain; historical FoodLog snapshots,
Unknown-versus-zero semantics, current Goal Pace, target priority, trusted
retrieval authority, bounded AI fallback, water-only hydration, local-day
semantics, account isolation, and the Phase 24 visual boundary remain locked.

## Matrix coverage at this checkpoint

`docs/superpowers/pre-phase-24-regression-matrix.csv` currently contains 63
scenarios:

- `PASS-AUTOMATED`: 9
- `PASS-SIMULATOR`: 51
- `PASS-STAGING-API`: 1
- `PASS-STAGING-SIMULATOR`: 1
- `OPEN-DEFECT`: 0
- `OPEN-INVESTIGATION`: 0
- `BLOCKED`: 1

The matrix's existing `AI-001` row now records the `AI-KEYBOARD-001` P1 defect
and its `1a52472` correction. The previously reproduced keyboard trap is no
longer open; the broader `1 apple` recoverability and AI corpus remain required
final-sweep journeys.

The photo-review serving-preview finding `PHOTO-SERVING-001` was closed as not
reproduced after a controlled real-photo rerun. The earlier mixed-meal preview handoff finding
`MIX-UI-001` was resolved as not reproduced after explicit meal-name entry and
authoritative preview confirmation. The earlier multi-food AI component-completeness finding
`AI-MULTI-001` was not reproduced after full-scroll review and response-boundary
verification; it remains a named regression scenario rather than an open
defect. The only matrix row currently marked `BLOCKED` is physical-device
acceptance. Nine automated-only rows still require Simulator-specific variants
or controlled-injection evidence before they can be promoted to Simulator PASS:
`ONB-001`, `ONB-002`, `SEARCH-003`, `SERV-001`, `AI-002`, `BAR-001`, `BAR-002`,
`PHOTO-001`, and `FAIL-002`. `FAIL-002` now also has supplemental real-Simulator
rapid-selector evidence (7D followed by 90D settled on 90D), but controlled
delayed-response injection remains automated-only. QA C deletion and
QA C isolation deletion are now observed passes after the authorized
reauthentication/deletion recovery correction. QA A → QA B switching and the named real-UI
`1 apple` recoverability journey are observed Simulator passes.

The resumed Complex nutrient recheck closed `NUTRIENT-EDIT-001`: after setting
`Added Sugar = 2 g`, saving, leaving, and reopening `QA Archive Probe` through
the real Simulator History route, the live field value remained `2`. An
authenticated staging readback of the same FoodLog recorded both the final
nutrient and `nutritionOverride` value as `2`. Source tracing identified the
serving-preview effect clobbering the hydrated snapshot override; the minimal
state helper/effect correction preserves it while retaining preview behavior
for non-overridden entries.

`SNAPSHOT-MACRO-001` was then reproduced at the same History edit boundary:
the persisted QA A `QA Archive Probe` macros (172 kcal / 1.7 g protein /
38.6 g carbs / 1.4 g fat) were shown alongside a 10 kcal / 1.0 g protein
serving preview, while source tracing showed the preview effect could replace
those top-level values before a later normalized edit submitted an override.
The focused helper regression was made deliberately red (preview values
replaced the persisted macros), restored, and passed; commit `ce09db2`
preserves snapshot macros unless the user explicitly clears the adjustment.
The rebuilt Simulator then changed serving from 100 g to 200 g, entered
`Added Sugar = 2 g`, invoked the off-screen `Save changes` action, and
reopened the row with the 200 g preview and Added Sugar 2 persisted. The
adjustment was removed, the serving restored to 100 g, and Friday's fixture
totals/row were confirmed restored. This closes the Simulator portion of
`SNAPSHOT-MACRO-001` without changing the reusable QA fixture.

`HIST-003` then exercised the canonical Food Library snapshot boundary. QA A
changed the `QA Archive Probe` manual-food calories from 10 to 20 in the real
Simulator, returned from the nested editor, and immediately saw the refreshed
20 kcal detail. The old Friday History row remained 170 kcal, proving the
historical snapshot was unchanged. The canonical food was restored to 10 kcal
and the fresh library detail/list confirmed the fixture value. The initial
reproduction (before the focused correction) showed the detail staying stale
until a full library reopen; `FoodLibraryDetailScreen` now reloads on focus,
covered by `library-detail.test.tsx`.

`LIB-REUSE-001` was reproduced during the authenticated History sweep: a
provider-backed Apple log exposed `Save to My Foods`, but the server correctly
rejected that unoverridden snapshot with HTTP 422. The mobile eligibility
predicate was corrected with a focused regression test; Metro hot reload and a
fresh QA A Simulator observation now hide the impossible action. The resumed
pass completed Saved/My Foods/Recent/Archived consumer coverage, including
custom archive/restore.

`LIB-DETAIL-001` was reproduced while validating FoodItem immutability: after
editing `QA Archive Probe` from 10 to 20 kcal, the nested manual-food editor
returned to a stale detail view even though the server-backed library list had
the new value. `FoodLibraryDetailScreen` now reloads on route focus, with a
red/green `library-detail.test.tsx` regression. The fresh beta-built QA A
Simulator showed 20 kcal immediately on return from the editor; the canonical
food was restored to 10 kcal and the old History snapshot remained unchanged.

`GOAL-PACE-001` was reproduced in QA A Profile → Edit goals: selecting Lose
exposed stale categorical pace choices and allowed the canonical numeric rate
to remain blank. The mobile correction removes those user-facing legacy
choices, requires 0.50–2.00 lb/week in 0.05 steps for Lose/Gain, preserves
Maintain as null-rate, and derives the legacy compatibility enum only when
saving. The focused Jest regression was red before the correction and green
after it. A real QA A Simulator rerun confirmed the numeric-only controls,
recoverable missing-rate validation, and a valid `0.55` save. After
termination/relaunch, Profile still showed Lose / `0.55 lb/week` and Progress
showed the propagated `2,320 kcal` target. The focused correction is committed
as `63ece53`; no historical FoodLog mutation was observed.

`GOAL-PACE-002` was reproduced from the same QA A loss plan by selecting
Maintain while `0.55 lb/week` remained in the form. Before correction, the
stale value made the form invalid and the save boundary would have submitted
it instead of canonical `null`. The focused Jest regression was red before the
correction and green after `f658b30`. The corrected Simulator flow clears the
rate immediately, shows `No pace`, persists Maintain targets, and then restores
QA A to Lose / `0.55 lb/week` and `2,320 kcal` for continued regression work.

`ACCOUNT-DELETE-001` was reproduced during the authorized disposable-account
lifecycle: the API's recent-auth guard correctly rejected a stale deletion
request, but the mobile panel exposed no way to reauthenticate. The minimal
mobile correction wires the existing Firebase password/Google reauthentication
actions into the deletion panel, keeps the confirmation editable, and retries
deletion only after successful identity verification. The focused account
deletion suite is green, and QA C's real Simulator flow showed the current
password field, `Verify identity`, successful permanent deletion, and signed-out
routing. QA C was the only account deleted; QA A, QA B, and everyday data were
not touched.

`AI-PARTIAL-001` was closed as not reproduced. A fresh QA A Simulator run entered
`chicken, rice, peas, mystery house sauce` and scrolled the complete review:
chicken, rice, and peas appeared as separate checked editable rows, while the
sauce appeared as a separate unchecked `Needs food` row with remove/review
controls and a displayed candidate that was not silently selected. `Log
selected` remained available for the resolved rows only, and no meal was saved.
The earlier apparent omission was a viewport-observation error; the direct
authenticated staging response and the complete UI review agree.

The resumed QA A Debug/Metro `1 apple` recheck also remained recoverable. The
authenticated parse response preserved quantity `1` and returned a bounded
Apple candidate with a trusted medium-item relationship (200 g); the real
Simulator Review screen exposed editable amount, unit, and candidate controls
and showed the corresponding 122 kcal provisional preview. Changing the
amount to `1` recalculated the preview to 1 kcal / 1 g, and cancelling returned
to the Log food form without saving. The serving suggestion itself was marked
needs-review for the missing unit, so no high-confidence nutrition inference
is claimed; existing serving-state tests cover the candidate-specific
whole-item conversion. No new defect or code change was inferred from this
recheck.

The QA A Simulator also exercised the photo logger's camera path with the
iOS-simulator black-camera surface. Capture produced an editable photo review
where the recognition-only `black screen` row could be excluded or restored;
`Add a missed food` opened trusted-food search, selecting Apple produced an
editable 100 g row with mass/whole-item serving controls, and `Cancel photo
log` returned without saving. This is Simulator evidence for review
recoverability only; real camera, orientation/HEIC, permissions, and
device-library behavior remain in the physical acceptance gate.

The QA A hydration recheck completed the reversible edit/delete path in the
Simulator: an existing 250 mL History entry was opened, changed to 500 mL,
saved, reopened with the updated amount, and permanently removed through the
explicit Delete water entry confirmation. The row disappeared from Water
History afterward. This supplements the prior quick-add, Other Amount, and
local Undo evidence without changing the water-only contract.

In the same Fresh Simulator session, QA A toggled to Simple and opened the
shared Log water sheet. The 250/350/500/750 mL controls, Other Amount,
logged-at control, and explicit water-only semantics were reachable; closing
without saving left no mutation. Complex was restored afterward.

The QA A Complex History recheck also completed the three-state nutrient
journey at the real UI boundary. `Added Sugar` was set to explicit `0`, saved,
and reopened as `0`; it was then cleared, saved, and reopened with no value,
retaining the distinct Unknown state. This uses the existing QA Archive Probe
fixture and does not alter the canonical FoodItem.

## Automated validation

The current validation completed under Node `v22.23.0` and pnpm `10.34.3`
after the Food Library eligibility correction and Simulator rebuild:

- API: 116 test files / 1,401 tests passed.
- Mobile Vitest: 67 files / 444 tests passed, including the AI serving and
  nutrient-state helper suites.
- Mobile Jest: 70 suites / 211 tests passed, including the Profile Goal Pace
  and account-deletion reauthentication regressions.
- Lint, typecheck, workspace build, Prisma generate/validate, and test-database
  migration deploy/status passed.
- A resumed full API-test attempt was made against the dedicated
  `food_tracker_test` database with Pinecone credentials cleared; Docker
  PostgreSQL was restarted non-destructively and the full API suite then
  passed 116 files / 1,401 tests with no pending migrations.
- A current-candidate staging retry from a clean `git archive` of `42b4d5b`
  was attempted with explicit project/environment/service selectors and
  `--path-as-root`; Railway uploaded the archive but rejected the deploy during
  the free-tier SFO peak window, so no new deployment or served-SHA claim is
  made.
- `git diff --check` passed.
- After `f658b30`, the workspace typecheck, workspace lint, and shared/API
  build completed successfully under Node `v22.23.0` and pnpm `10.34.3`.
- Mobile typecheck, lint, and the focused `food-library-ui.test.ts` passed. The
  focused test was observed failing before the helper existed and passing after
  the correction.
- The resumed normalized-nutrient correction passes its focused Vitest suite,
  the full 67-file Vitest run (444 tests), mobile Jest (70 suites / 211 tests),
  mobile typecheck, and mobile lint. Its real Simulator edit → save → reopen
  journey and authenticated persisted-snapshot readback now agree on
  `Added Sugar = 2 g`.
- The authenticated serving review recheck exercised a cooked-rice candidate
  with no trustworthy cup relationship: the real Simulator exposed only
  supported mass controls, required an amount, and did not offer or silently
  apply a cup conversion. The review remained recoverable and no log was
  saved.
- QA A Simulator Calories trends exercised the ineligible forecast state: the
  app explained that recent complete-day coverage was insufficient and showed
  no fabricated future line, while recorded history remained visible.
- A Node 22 direct `calculateAuthoritativeServing` probe independently retained
  an explicit normalized zero in the final/snapshot nutrients and omitted an
  Unknown patch, confirming the backend calculation semantics while database
  integration remains unavailable.
- A fresh Node 22 source-health rerun passed workspace typecheck, workspace
  lint, workspace build, Prisma generate, Prisma validate, and `git diff --check`.
- A fresh Xcode-beta Debug Simulator build/install completed successfully on
  the dedicated QA iPhone 17 Simulator. The app was exercised through LAN
  Metro with QA A authenticated. A later per-command Xcode-beta rebuild retry
  reached the iOS 27 destination but failed with `No space left on device`
  while writing temporary DerivedData; that exact temporary output was removed
  and the previously installed bundle was retained for UAT. No repository or
  protected state was changed by the retry.
- Root `format:check` still reports only the known 27 protected/local files;
  none was edited.

## Verified regression evidence

- `AI-RAG-001`: post-retrieval adequacy evaluation was proven missing at the
  request boundary, fixed in the existing AI/retrieval boundary, and covered by
  regression tests. QA credentials are now resolved; the real Simulator reached
  Describe meal and exercised the editable multi-food, partial-fallback, and
  opaque protein-shake variants. The exact trusted-match and beef-stew UI
  variants remain final-sweep work; the exact `large chicken shawarma plate`
  variant is now a Simulator pass with the blank-unit recovery fix. The named
  `1 apple` UI recovery scenario remains a separate observed pass.
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
- The runtime-fix candidate `fdb7016` was archived from the exact committed
  tree and submitted with explicit project/service/environment targeting, but
  Railway returned a request error before creating a deployment. A subsequent
  exact archive of candidate `17b85b0` created deployment `3bbfb81`, which
  later failed during code-snapshot creation with Railway configuration error
  `Failed to create code snapshot. Please review your last commit, or try
  again.` No build logs or served-commit metadata were produced. The served
  runtime therefore remains the previously verified `f522fae3` candidate; no
  current-HEAD staging behavior is inferred from the failed deployment or the
  continuing `/health=200` response.
- At this checkpoint the existing staging service responds `/health=200`,
  `/health/ready=200`, and unauthenticated `/api/v1/setup/status=401` with the
  structured `AUTHORIZATION_REQUIRED` response.
- A fresh read-only recheck on 2026-09-12 at 20:21 UTC returned the same
  `/health=200`, `/health/ready=200`, and structured `401
  AUTHORIZATION_REQUIRED` setup response. Railway reported failed latest
  deployment `3bbfb81d` with active deployment `f522fae3`; no current-candidate
  runtime evidence is inferred from this healthy legacy deployment.
- A fresh read-only QA A/B staging smoke returned 200 for setup, profile, goals,
  dashboard, food logs, water logs, weight logs, recommendations, saved views,
  recipes, and nutrition targets. That pre-recipe-journey snapshot recorded QA A
  at 560 food logs, 485 water logs, 106 weights, two recommendations, four
  saved views, and zero recipes; the later authenticated Simulator journey
  created the named `QA Regression` recipe. QA B remained empty for owned
  logs/recommendations/views/recipes while both accounts returned 24
  nutrition-target records.
- Additional cross-account probes using recognizable QA A resource IDs returned
  `404` to QA B for a water log, weight log, recommendation, and saved view.
- A fresh Xcode-beta-built app was installed on the QA A iOS 27 Simulator. Real
  UI interaction authenticated QA A, displayed the Complex Progress home, and
  a terminate/relaunch returned to the authenticated home without a loop. The
  system Save Password prompt was dismissed without saving credentials.
- The approved Xcode beta at
  `/Users/teiko/Downloads/Xcode-beta.app/Contents/Developer` produced a fresh
  `** BUILD SUCCEEDED **`; the exact app bundle was installed and launched on
  QA A simulator `53D0A189-7A75-49B1-97E6-A4C5DC4CB12F`.
- The QA A water quick-add journey opened the Complex Log Water sheet, exposed
  the 250 mL control and water-only semantics, persisted a 250 mL row, and
  returned an editable History row; a read-only API check confirmed one local-day
  water record.
- The QA A Food Library journey recovered from a transient unavailable state,
  exercised Saved, My Foods, Recent, and Archived tabs, reused Recent Banana in
  Food Log, and opened its editable library detail. Setting a 100 g default
  serving persisted across closing and reopening the detail; the temporary
  preference was then removed. A disposable `QA Archive Probe` manual food was
  archived, observed in Archived, restored, and observed again in My Foods.
- A controlled QA A Simulator outage stopped the local API before relaunch. The
  authenticated app showed the recoverable `We couldn't load your account`
  state with `Try again` and `Sign out` and no crash; after the API restarted,
  tapping `Try again` restored authenticated Progress without mutation or
  duplicate submission. This promotes `FAIL-001` to Simulator PASS; slow-save
  timing remains covered by automated tests.
- The QA A → QA B account-switch journey was exercised through the real Fresh QA
  Simulator. QA B authenticated through the email/password form to Complex
  Progress with no QA A food or weight entries; the home showed 0 food entries
  and 0 logged days. History showed no food entries and Insights showed 0
  logged days; stopping and relaunching the app returned to authenticated QA B
  Complex Progress with the same empty state.
  Signing back into QA A restored its recognizable Friday History state (8
  entries, 172 kcal, including `QA Archive Probe`) without cross-account
  residue. The system password-save prompts were dismissed without saving
  credentials.
  Existing API ownership probes independently returned 404 for QA A resource
  IDs under QA B. This refreshes the prior switch evidence on 2026-09-12.
- The named QA A `1 apple` AI journey was exercised in the real Simulator. The
  flow produced an editable apple candidate, allowed serving amount/unit
  editing, logged a valid 1 g result, showed the History row, and reopened it
  with Save/Log again/Delete recovery actions; no trapped incomplete-unit state
  was observed.
- Additional QA A text-AI corpus interaction reached the real review UI for
  `chicken rice and peas` and `2 eggs, toast, banana`. An initial partial-
  viewport omission concern was investigated and closed as not reproduced
  after full-scroll and response-boundary checks; no AI result was saved while
  investigating it.
- The QA A normal search journey searched `apple`, showed multiple ranked
  canonical/provider candidates, selected Apple raw, edited its serving basis,
  saved it, and observed the resulting History entry. The hydration journey
  also covered Other Amount with a persisted 333 mL History row alongside the
  250 mL quick-add row.
- The resumed QA A Simulator search variation returned a recoverable no-result
  state for the typo `appls`, then ranked Apple candidates for plural `apples`
  with raw/cooked/preparation variants. A trusted egg candidate was edited from
  100 g to 2 g; the 5 kcal provisional preview matched the resulting History
  entry after one save.
- The QA A Complex History edit for `QA Archive Probe` preserved three nutrient
  states across save/reopen: Protein `1 g` numeric, Fiber `0 g` explicit zero,
  and omitted Sugar as Unknown. The reusable FoodItem stayed unchanged.
- `MODE-ICON-001` was reproduced when native launcher-icon synchronization
  rejected after a successful mode save. The smallest correction made icon sync
  diagnostic-only on the Progress toggle; the focused red/green regression and
  a real QA A Complex → Simple → Complex Simulator re-run now show mode
  persistence without a Progress error state.
- A saved Profile Simple selection was also re-observed on QA A: after saving,
  navigation to Progress and History retained Simple mode and Friday History
  still showed 8 entries and 172 kcal. Progress then toggled back to Complex;
  the launcher confirmation was dismissed and the final Complex state remained
  usable.
- The QA A photo journey reached real Simulator review, excluded the
  recognition-only `ice plant flower` row, added missed trusted `Apple, raw`
  through search, edited its serving, reached atomic confirmation with a
  recalculated `122 kcal preview`, and backed out without saving. The
  physical camera/library/HEIC behavior remains a device gate. A controlled
  rerun replaced an unresolved row with trusted Apple, kept the 61 kcal preview
  visible through a 100 g → 3.53 oz edit, and reached matching confirmation;
  `PHOTO-SERVING-001` was closed as not reproduced.
- The QA A Recommendations tab showed three active recommendations, dismissal
  reduced the count to two, and terminate/relaunch preserved that state. Water
  History editing was also observed for `333 mL → 500 mL`.
- QA A Profile → Nutrition Targets showed Personalized, Derived, and Reference
  source labels with explicit Recommended values. Calories was changed from
  `2600` to `2500`, saved as custom, then reset with Use recommended and
  returned to the `2600` recommendation.
- The QA A AI example path also exercised provider/model recovery: `2 eggs,
  toast, banana` showed an explicit recognition-unavailable state with the
  editable draft and Read meal retry still reachable; no fabricated confidence
  or FoodLog mutation occurred.

The resumed QA A Simulator pass reached the Recipes entry point from Log food,
opened the existing `QA Regression` recipe, displayed its frozen ingredient
nutrition, and logged one portion. The recipe was then edited from 100 g to
200 g Apple: the current recipe recalculated from `61 kcal` whole to `122 kcal`,
while the previously logged History entry remained `31 kcal`; a new portion log
then appeared in the day total as `61 kcal`. This completes the required
recipe-edit-after-history immutability journey.
The resumed QA A pass also reached the Mixed meal editor, verified the
incomplete meal warning, and exposed the trusted-ingredient picker after
scrolling the editor. A fresh trusted Apple selection then exposed a valid
`ready` 100 g ingredient row while the authoritative preview remained empty;
the same authenticated staging preview endpoint returned 200/61 kcal. The
earlier `MIX-UI-001` concern remains closed as not reproduced after the
explicit meal-name and authoritative-preview rerun; any remaining mixed-meal
coverage is part of the final critical re-sweep, not an open defect.
The resumed QA A AI text pass entered `2 eggs, toast, banana`, observed the
three-item review after scrolling the complete review container, and captured
an authenticated response boundary containing `eggs`, `toast`, and `banana`.
A second response-boundary call for `chicken rice and peas` returned all three
named components. The initial apparent omission was a partial-viewport
observation and was closed as not reproduced; no AI meal was saved.
The same AI review exposed matched trusted rows for eggs/banana and a
needs-review toast row with editable serving and candidate controls, confirming
the bounded trusted/review UI path without persisting a meal.
The resumed Simulator AI variation entered `rice bowl with chicken`, surfaced a
Rice cooked candidate in Review with an initially missing amount, and kept the
screen recoverable: after entering 100 g it showed a 226 kcal provisional
preview plus explicit no-trusted-cup-conversion guidance, with candidate and
serving controls still available and no save performed.
A supplemental QA A Simulator search for `milk` returned multiple distinct
generic/preparation candidates (whole pasteurised, sheep whole, human mature,
and chocolate 2%); provider/source labels were not exposed in that UI, so
provider-attribution remains an automated/API concern. The opaque `protein
shake with milk` variant also reached Review foods as one editable high-protein
candidate with serving controls and alternate candidates; `a bowl of beef stew`
also reached a single editable trusted candidate with explicit no-cup-
conversion guidance and a disabled Log selected action until serving was
resolved. Both variants were cancelled and no meal was saved.
A fresh full-scroll run of `chicken, rice, peas, mystery house sauce` showed
all four named components. Chicken, rice, and peas were checked trusted rows;
the sauce remained a separate unchecked `Needs food` row with remove/review
controls and a displayed candidate that was not silently selected. `Log
selected` therefore remained scoped to the resolved rows, and no meal was
  saved. This closes `AI-PARTIAL-001` as a viewport-observation error rather
  than a rendering defect.

The resumed QA A opaque-composite Simulator journey entered `large chicken
shawarma plate` against the rebuilt Debug bundle. The review showed one
editable `chicken shawarma` row matched to a trusted chicken candidate, with
alternate candidates and no fictional decomposition. Its parsed quantity was
`1` with no unit, so `Log selected` stayed disabled and the row explained the
supported-unit requirement. Selecting `Use g` recovered the row to a
provisional `2 kcal · 0.3 g protein` preview at `1.0 g`; changing the amount to
`200` produced `376 kcal · 52.2 g protein` at `200.0 g`. The row became
checkable and Close returned to Log food with zero saved entries. The original
blank-unit handler defect was fixed in `d35eb09` with a focused regression test;
this journey now demonstrates editable recovery without a fabricated fallback
or historical mutation.

A read-only source-boundary audit on 2026-09-12 confirmed that the current AI
route retrieves candidates for every parsed item, invokes the provider
evaluator when available, validates one decision per parsed item, and applies
trusted/review/fallback disposition before response persistence; the mobile
review renders every non-removed response row in a vertical scroll container.
The staging-targeted Fresh QA Simulator then exercised the same count-shaped
example by tapping `2 eggs, toast, banana`. Review preserved the parsed egg
amount as `2`, but the selected prepared-egg candidate had no trusted
whole-item/count relationship, so the row correctly remained in `Check this
serving` instead of silently interpreting the value as eggs or grams. Choosing
`Use g` explicitly produced a `2.0 g / 5 kcal` provisional preview; replacing
the candidate reset its amount to the candidate's `110 g` basis and remained
editable. No log was saved. This adds real Simulator count/missing-unit
recovery evidence while leaving authoritative count conversion covered by the
existing automated serving tests.
The Gemini parse prompt does not yet explicitly require preservation/reporting
of every clearly named component, so real-provider completeness remains a
named final-sweep risk. This is an inspection finding, not proof of a current
defect or permission for a speculative prompt/RAG rewrite; the required
execution evidence remains Gemini parse names versus API response names versus
the complete Simulator-rendered list.
A direct `1 cup cooked
rice` search selected a generic cooked-rice candidate with only g/kg/oz/lb
controls and a per-100 g basis, with no cup conversion offered or silently
applied. The real Scan barcode surface also opened with Ready to scan guidance
and scanner-light control; cancelling returned to the editable Log food form
without a mutation. Known-code persistence, invalid/unknown scan-result
handling, and physical scanner behavior remain pending gates rather than
inferred passes.
The QA A Simulator also opened an older Sunday Sep 6 History entry, changed
Protein from 32.8 g to 135 g, saved, returned to Today, and reopened the older
day to observe the persisted 135.0 g breakfast value. It then used the explicit
Delete food entry? confirmation and reopened Sunday to verify the entry was
gone and the day count dropped from 3 to 2 logs, with no unrelated deletion.
A Node 22 source-boundary probe of the photo serving helpers returned exact and
converted nutrition after gram/ounce edits for an equivalent trusted FoodItem;
the controlled Simulator rerun confirmed the same preview behavior in the real
review/confirmation flow.
Insights Month reports, Explore trends, a 3-day custom range (Sep 9–11),
Calories trend coverage (recorded/partial/unlogged), Progress Logging consistency
trend coverage (Complete/Partial/Unlogged/In progress), and Saved views management
(pinned/other views) were observed. A new Calories · 30D view was created,
pinned through More actions, and remained pinned after app relaunch. QA A then
renamed the pinned view to `Calories QA`, relaunched, changed its comparison
configuration, and confirmed the modified Save View screen plus the post-update
Saved Views list retained `Calories QA`. The Compare route initially omitted
the selected comparison because Calories used a special renderer; the minimal
shared comparison-renderer correction was reloaded in the Simulator, after
which the route exposed `Calories + Sugar`, dual-axis copy, both legends, and a
`Calories and Sugar comparison` accessibility target.
The Saved Views route initially had no reachable back action: its Explore
trends label was plain text while root headers were hidden. A focused red test
and minimal Pressable/`router.back()` correction were added; Metro-reloaded QA
A Simulator exposed `Back to Insights`, and tapping it returned to Explore
trends. The broader navigation family remains in progress.

The latest QA A Simulator photo pass reopened the real Photo logging sheet and
observed its one-time-analysis, normalized-JPEG, max-edge, and 5 MiB contract
copy. Choosing the Simulator library path did not provide a selectable image in
this environment, so no review/save result is inferred; after stopping and
relaunching, authenticated Progress returned normally. Real library/HEIC,
camera permissions, and device photo review remain physical-gate checks.

The barcode path was also reopened from the QA A Log food flow. Simulator
evidence showed the Ready to scan state, guidance text, scanner-light toggle
(on → off), and Cancel barcode scan returning to the editable Log food form
without a mutation. Known/unknown barcode lookup and real camera scanning remain
the API/physical-device portions of the acceptance gate.

On 2026-09-12 the installed QA A Simulator bundle was relaunched after a
terminate/launch cycle and returned directly to authenticated Progress. The
Profile mode controls were exercised Simple → Complex with the same goal and
target values visible in both modes; Goal plan opened and returned through its
Back control; Nutrition targets opened and returned without mutation. History
Previous day/Next day/Return to today and the Food Log modal Close path were
rechecked, with no save or data mutation. These observations extend the
critical re-sweep but do not close the remaining broader launcher/deep-link/
back/cancel and final critical-journey gates.

The same QA A Simulator pass also exercised the Insights navigation family:
Explore trends opened from Insights, Calories trends opened, the 30D → 7D →
90D selectors changed the displayed ranges (Sep 6–12 through Jun 15–Sep 12),
Back from Trends returned to Explore, and Back to Insights returned to the
Insights report. No mutation occurred during these navigation checks; the
broader launcher/deep-link/cancel matrix remains for the final re-sweep.

From Progress, the logging menu reopened and closed cleanly; Log water opened
its sheet and Close returned without mutation, and Log weight opened its form
and Close likewise returned without mutation. These are additional recovery
observations, not a claim that the wider launcher/deep-link/cancel family is
complete.

The same Progress launcher pass opened Streak calendar, rendered past/gold,
partial, missed, today, and future day states, navigated Previous month to
August 2026 and Next month back to September 2026, then returned via Back.
Logging Consistency Trend opened with complete/partial/unlogged/in-progress
coverage and Back returned to Progress. No data mutation occurred in either
route.

Profile account recovery was also exercised on QA A: Delete account opened the
irreversible warning, scrolling exposed Continue and Cancel, and Cancel
returned to the editable Profile without sign-out or mutation. This validates
the non-destructive recovery path; it does not authorize or substitute for the
separate QA C deletion lifecycle already completed.

On 2026-09-12, the separate Fresh QA iPhone 17 Simulator was installed from
the already-built standalone Release bundle to exercise the signed-out launch
boundary without resetting QA A. The real UI displayed the expected Welcome
back sign-in form and Create account route; returning from Create account to
Sign in worked. Transient QA A credentials were entered only through the UI,
authentication reached Complex Progress, and a relaunch preserved the
authenticated route. The standalone bundle then showed an unexpected-response
settings state when Profile was opened and its Try again action did not recover
within the observed interval. This bundle is an older standalone artifact,
not the current Debug/LAN-Metro candidate; the direct authenticated staging
profile endpoint remained healthy and the current QA A Debug/Metro Profile
route loaded correctly. Therefore this observation is retained as stale-bundle
environment evidence, not as a current-product defect or a basis for a fix.

The current QA A Debug/Metro Profile route was then rechecked without mutation.
It displayed the saved Lose goal at `0.55 lb/week`, the propagated 2,320 kcal
and 153.7 g protein targets, and Simple/Complex controls with Complex selected.
Opening Nutrition targets showed the expected source labels (Personalized,
Derived, and Reference), editable values, recommended values, and the
explicit custom-versus-recommended copy. The target editor was exited through
Back without saving; this supplements the existing persistence tests without
claiming a new override mutation.

Within the same Profile editor, the tracking-style control was toggled from
Complex to Simple and the live state changed to `Simple mode` with the
Simple-specific copy, while the goal, target, and profile values stayed
unchanged. Complex was selected again before leaving, so the QA A fixture
remains in its prior Complex state and no mode mutation was persisted.

The QA A Progress launcher was also re-swept through the current Debug/Metro
bundle. The logging menu exposed Log weight, Log water, Log food, and Close;
Log weight opened with date/time fields and a reachable Save weight action,
accepted a decimal `181.5` value through the native field, and was cancelled
without mutation. Log water exposed its quick amounts, Other Amount, logged-at
control, and bottom Add 250 mL action after scrolling; Close returned to
Progress. These checks provide direct reachability/recovery evidence and do
not replace the existing persistence rows.

Finally, the QA A Debug/Metro app was explicitly terminated and relaunched
from the current authenticated fixture. The launch settled on Complex Progress
with the expected tabs, logging launcher, trend controls, and no sign-in or
bootstrap error. This is a fresh session-persistence observation; it does not
close the separate cross-account or cold-start gates.

On 2026-09-13, authenticated QA A deep-link routes were exercised directly
through the installed Debug/Metro app. The canonical `/recipes` route loaded
the seeded `QA Regression` recipe; its detail view exposed frozen ingredient
nutrition and returned through Close. The saved-views route loaded pinned and
other views, opened the Calories comparison, and returned through Back from
Compare and Back to Insights. Nutrition Targets showed editable values with
Personalized/Derived/Recommended source context, while Water Log and Weight
Log opened their forms and closed without mutation. Relaunching afterward
returned to authenticated Progress and cleared transient route state. The
`/recipes/index` URL is not the canonical Expo Router index deep link and was
not treated as a product defect; the wider launcher/deep-link/cancel family
and final critical re-sweep remain pending.

The same run opened the `recipes/editor` deep link with the Name field focused
and the native keyboard visible. Close recipe editor remained reachable above
the keyboard; tapping it returned to authenticated Progress without creating a
recipe or mutating QA A data.

A fresh cross-feature QA A re-sweep then observed Today with 0 food entries and
the explicit empty-state copy, switched History to Friday September 11 with 8
entries and 172 kcal, opened Insights showing Sep 6–12 with 5 logged days and
partial-day messaging, and opened Profile showing Complex mode, Lose at
0.55 lb/week, 2,320 kcal, and 153.7 g protein. No route error or mutation was
observed; the full critical re-sweep remains pending.

Detailed reproduction and evidence remain in
`docs/superpowers/pre-phase-24-regression-defects.md`.

## Unresolved execution gates

1. Remaining authenticated Simulator rows require completion of the broader
   launcher/deep-link/back/cancel family and final critical re-sweep; native
   password prompts must be dismissed without saving credentials before logging
   flows continue.
2. `PHOTO-SERVING-001`, `MIX-UI-001`, and `AI-MULTI-001` are closed as
   not-reproduced after controlled photo serving, explicit-name/full-scroll,
   and response-boundary evidence. Keep the named photo serving scenario in
   the final critical re-sweep in case it recurs.
3. QA C credentials and the approved UID were verified before the authorized
   destructive lifecycle. The real Simulator reached deletion confirmation,
   surfaced the recent-auth requirement, completed current-password
   reauthentication through the corrected panel, permanently deleted only QA C,
   and routed to signed-out state. QA A, QA B, and everyday data remain
   untouched.
4. Physical-iPhone acceptance remains a user-owned final gate.
5. The runtime-fix candidate still requires a completed Railway deployment and
   served-provenance check before current-HEAD staging UAT. Deployment
   `3bbfb81` for exact candidate `17b85b0` failed during code-snapshot
   creation. A later exact archive of committed candidate `42b4d5b` using
   `--path-as-root` reached indexing/upload but was rejected by the free-tier
   SFO peak-hours gate, so no deployment was created. Inspect any later
   validated deployment's terminal status and source provenance before treating
   staging behavior as evidence.

## Intentional exclusions and deferrals

Notifications/APNs, Apple Sign-In provisioning, supplements, drink taxonomy,
new provider portfolios, speculative architecture, new product features,
production deployment/data, App Store/TestFlight/EAS, standalone Android
acceptance, and Phase 24 visual redesign are excluded. Cosmetic findings remain
deferred; only verified unusability is fixed in this phase.

## Resume and completion requirements

The QA-identity blocker is resolved. The fresh Xcode-beta Debug build and
install are now complete; continue remaining authenticated Simulator rows
using the real UI and backend persistence checks.
The authorized QA C deletion lifecycle is complete. Then perform the full critical-journey
re-sweep, targeted physical-iPhone pass, current runtime-changing staging
cold-start validation, final automated checks, and closeout review. Do not mark
this document complete until the matrix has no unresolved P0/P1 or meaningful
functional P2, all required gates are evidenced, the final branch is pushed,
and the working tree contains only intentional changes.
