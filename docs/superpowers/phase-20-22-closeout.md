# Phase 20–22 Technical Closeout

## Outcome

Phase 20–22 — Product Hardening + Intelligence is implementation-complete on
`phase-20-22-product-hardening-intelligence` and ready for user-controlled
review and merge. This branch has not created a PR and has not been merged.

Starting and currently deployed staging tip before this closeout:
`290c3ac64a6cb8a5a9900b04098190508d5f8034`.

The closeout preserves the existing architecture, shared contracts, database
schema, migration history, and accepted product decisions. The only tracked
implementation changes in this closeout are deterministic-test isolation and
an updated Goal Pace regression expectation.

## Status ledger

| Area | Status | Evidence |
| --- | --- | --- |
| Phase 20–22 implementation | IMPLEMENTED | Branch implementation at the starting tip, with the closeout test fixes below |
| API regression suite | AUTOMATED-VERIFIED | 116 test files and 1,399 tests passed |
| Mobile Vitest | AUTOMATED-VERIFIED | 64 test files and 438 tests passed |
| Mobile Jest | AUTOMATED-VERIFIED | 68 suites and 202 tests passed |
| Workspace, Prisma, and changed-file quality gates | AUTOMATED-VERIFIED | Typecheck, lint, build, Prisma generate/validate/migrate, focused Prettier, and diff check passed |
| Railway staging | STAGING-DEPLOYED | Exact deployed commit was `290c3ac64a6cb8a5a9900b04098190508d5f8034` |
| Physical iPhone Release UAT | PHYSICAL-UAT-ACCEPTED | User-operated Release UAT accepted the paths listed below |

No Railway redeploy was performed during this documentation/test closeout.
The API runtime behavior already deployed at `290c3ac` was not changed.

## Original six API failures and disposition

The original full run reported 1,393 of 1,399 tests passing. Each failure is
dispositioned exactly once below.

| Failure | Classification | Evidence and disposition |
| --- | --- | --- |
| `test/advanced-analytics.test.ts` — `returns deterministic empty analytics without requiring complex mode`: expected HTTP 200, received 500 after a 5,024 ms request failure | E. Nondeterministic/flaky test | The failure occurred when independent DB-backed Vitest processes ran concurrently against the shared `food_tracker_test` reset database. The test passed alone and in the final single-process full suite. A concurrent focused reproduction produced Prisma unique-ID reset failures. No analytics code change was required; DB-backed Vitest runs are now single-process. |
| `test/ai-food-parse.test.ts` — `sends Gemini generateContent JSON output using responseMimeType and responseSchema`: expected Gemini request fields, received a Pinecone query body | D. Environment/external dependency failure | The ignored local API environment had non-empty Pinecone settings. The deterministic test stubbed Gemini/USDA fetches but did not clear Pinecone settings, so retrieval made a live external request. The smallest correction clears `PINECONE_API_KEY` and `PINECONE_INDEX_HOST` in that suite's setup and teardown. |
| `test/ai-food-parse.test.ts` — `adds USDA generic candidates with explicit serving basis when no local loggable match exists`: expected 2 fetches, received 3 | D. Environment/external dependency failure | Same leaked Pinecone request as above; the extra fetch was the external retrieval call, not a product behavior change. The test now isolates the deterministic path. |
| `test/ai-food-parse.test.ts` — `does not estimate nutrition for relevant USDA eggs candidates`: expected 3 fetches, received 4 | D. Environment/external dependency failure | Same leaked Pinecone request as above. Clearing the local Pinecone settings in test setup restores the intended Gemini/USDA-only seam. |
| `test/ai-food-parse.test.ts` — `bounds AI parse USDA detail enrichment after metadata ranking`: expected 3 detail IDs beginning with `409`, received 4 beginning with `unknown` | D. Environment/external dependency failure | Same leaked Pinecone request as above changed the candidate/detail sequence. The deterministic test passes with the external retrieval path isolated. |
| `test/profile-goals-preferences.test.ts` — `persists the effective safe rate rather than the requested rate`: expected a value below 2, received 2 | B. Stale test expectation after an intentional product-policy change | The accepted policy is Lose/Gain `0.50–2.00 lb/week`, selectable in `0.05` increments, with no age gate and no profile-clipped selectable maximum. The implementation already follows that policy; the test was renamed and now asserts the accepted upper bound of `2`. |

The AI/Pinecone failures were not hidden by removing legitimate coverage:
live retrieval remains covered separately, while deterministic AI parsing tests
no longer inherit ignored developer credentials. The analytics failure was not
reproduced in the supported single-process suite and was not “fixed” with an
arbitrary timeout.

## Accepted product and physical UAT record

The following user-operated physical iPhone Release checks are accepted:

- Goal Pace: Lose and Gain `0.50–2.00 lb/week`, selectable in `0.05` increments;
  Maintain has no rate; age does not gate Goal Pace.
- Nutrition Targets editing and `Use Recommended`.
- Account deletion flow.
- Reference-food search for banana, egg, rice, and chicken breast, with
  nutrition-backed results.
- Serving changes recalculate nutrition; selected reference foods can be
  logged; History retains the expected nutrition.
- Complex FoodLog numeric correction, explicit zero persistence, Unknown
  persistence, save/reopen persistence, and protection of the canonical
  FoodItem from FoodLog corrections.

The reference-data repair outcome is:

- 12,133 usable reference foods repaired and valid.
- 230 records missing core nutrition intentionally excluded.
- 71,841 duplicate column-backed nutrient rows removed.
- 5,993 CNF serving bases repaired.

The reference-food nutrition bug and authoritative serving snapshot bug are
resolved. These physical checks are separate from automated tests and do not
claim production release or APNs delivery.

## buildReactNativeFromSource diagnostic

Disposition: restored to the tracked branch state.

Evidence reviewed:

- Tracked `apps/mobile/app.config.ts` history contains no intentional
  `buildReactNativeFromSource` configuration.
- The corrected source CocoaPods reinstall with
  `EXPO_USE_PRECOMPILED_MODULES=0` had already resolved the stale-pod linker
  condition that motivated the diagnostic.
- The current ignored generated iOS state contains the expected React Native
  and static-framework pod resolution and was inspected without mutation.
- The diagnostic line was removed from `apps/mobile/app.config.ts` only; the
  generated `apps/mobile/ios/` and `apps/mobile/android/` directories were not
  staged, deleted, or rewritten.
- Mobile Vitest, Jest, typecheck, lint, and the read-only Expo config check
  passed after restoring the tracked config.

The flag is therefore not promoted to supported tracked configuration. Any
future native linker investigation must be treated as a new, explicitly
scoped diagnostic.

## Validation record

Validation used Node `v22.23.0`, pnpm `10.34.3`, PostgreSQL, and the dedicated
`food_tracker_test` database. The API suite was run as one process to preserve
test-database isolation.

Passed commands and results:

- `corepack pnpm test`: 116 files, 1,399 tests passed.
- `corepack pnpm --filter @food-tracker/mobile exec vitest run`: 64 files,
  438 tests passed.
- `corepack pnpm --filter @food-tracker/mobile test:jest`: 68 suites, 202 tests
  passed.
- `corepack pnpm typecheck`, `corepack pnpm lint`, and `corepack pnpm build`.
- `corepack pnpm prisma:generate` and `corepack pnpm prisma:validate`.
- `DATABASE_URL=.../food_tracker_test corepack pnpm --filter @food-tracker/api
  exec prisma migrate deploy`: 21 migrations found, none pending.
- Changed-file Prettier and `git diff --check`.

The first post-documentation full API rerun transiently reported two transport
errors (`socket hang up` in `food-log-serving-update.test.ts` and
`read ECONNRESET` in `reporting-api.test.ts`) at 1,397/1,399. Both files then
passed together (57/57) and the immediate subsequent single-process full run
passed 1,399/1,399. No application assertion, PostgreSQL restart, or persistent
database error reproduced; this was treated as an E-class transport flake and
was not hidden with retries or weakened assertions.

Root `corepack pnpm format:check` remains non-zero only because it scans
pre-existing protected or untracked files: 25 `.agents/`/`.superpowers/`
documents and `apps/api/food_search_diagnostic.mjs`. No protected file was
modified, and all changed tracked files pass focused Prettier.

## Mistakes, corrections, and prevention

- The old Goal Pace test encoded removed profile-clipping policy. It now tests
  the canonical accepted range instead of reintroducing the old behavior.
- Deterministic AI tests inherited local Pinecone configuration. Test setup
  now removes those external-service variables before and after each test.
- A prior validation run launched independent DB-backed Vitest processes in
  parallel against one reset database. The analytics failure and concurrent
  Prisma reset errors establish the cause. Future API validation uses one
  Vitest process per dedicated test database.

## Known limitations and next step

This branch is merge-ready pending user review and merge. It is not reported
as merged or released to production. Railway staging is verified at the exact
staging commit recorded above; external/live Pinecone verification remains a
separate evidence class. Physical Expo-to-APNs delivery remains deferred where
the available Apple Personal Team cannot provision `aps-environment`.

Next step: user review and merge this branch when satisfied. Do not begin
Phase 23 or Phase 24 work as part of this closeout.
