# Phase 18/19 Execution Ledger

Plan: `docs/superpowers/plans/2026-08-23-phase-18-19-hybrid-food-retrieval.md`
Branch: `phase-18-19-hybrid-food-retrieval`
Baseline: `13e476b`
Preflight: complete; continuation started from `42b0caf`; current validated
implementation checkpoint `b0faa2c`; Node 22.23.0; pnpm 10.34.3
Protected state: preserved; no protected paths staged or modified

## Task status

- [x] A — permanent corpus, live PostgreSQL adapter, complete snapshots, baseline, ablations, and frozen gates
- [x] B — retrieval boundary/source semantics/alias identity implemented and shared by normal/AI/photo retrieval paths; candidate assembly and Unicode normalization are centralized
- [x] C — provenance schema foundation and clean dedicated-test migration deployment
- [x] D — importer contracts/Unicode normalization
- [x] E — CNF adapter and live persistence/idempotency measurement
- [x] F — Ciqual XLSX/XML adapter (official parse dry-run complete)
- [x] G — CoFID adapter (official parse dry-run complete)
- [x] H — local reference retrieval
- [x] I — pg_trgm GiST KNN migration/query path
- [x] J — Pinecone index lifecycle/document path
- [x] K — semantic generator with timeout/fallback
- [x] L — mode-specific policy and normal-search hybrid path
- [x] M — locale tie-break
- [x] N — baseline-derived development ablations and one frozen-settings holdout evaluation recorded
- [~] O — local resilience complete; Pinecone credentials and Railway execution remain external
- [~] P — local closeout evidence aligned; Pinecone/Railway external gates remain pending

## Evidence log

- Commits `8752484`, `dafd00d`, `f997d90`, and `be5ea85` persist the plan,
  retrieval foundation, dataset/index commands, ablation harness, and
  coverage-gated normal search.
- Commit `aed95f5` centralizes Unicode normalization and candidate assembly
  across normal and AI/photo retrieval while preserving mode-specific channel
  acquisition; it is pushed to `origin/phase-18-19-hybrid-food-retrieval`.
- Commits `b574084`, `c17b28f`, `7f5515e`, `1f1bf7f`, `4203102`, and `47573d1`
  add baseline-to-candidate recovery/harm comparison, CLI reporting, release
  versioned provider hashes, and consistent ranking/Unicode persistence.
- Commits through `4d9e1d9` record the contribution, documentation, locale,
  release-audit, and configurable semantic-model checkpoints; the branch is
  synchronized with its origin branch.
- Focused benchmark/retrieval tests pass: 4 files, 152 tests, including
  official-column, alias, provider, release-failure audit, source-neutrality/
  locale tie-breaks, shared candidate-generation, fuzzy-policy, semantic
  timeout/parser, index-lifecycle, baseline-to-candidate contribution
  comparisons, and duplicate/rejected-row persistence guards. The AI/photo
  fallback path typechecks and remains DB/Pinecone integration-gated.
- Benchmark CLI snapshots now require exactly one observation for every
  versioned corpus query in the requested comparison split before baseline or
  candidate metrics are accepted; full historical snapshots remain filterable
  for split-scoped comparisons.
- Legacy direct `usda_fdc` ranker inputs now use the same neutral base source
  quality as `reference`; final hydrated USDA candidates already use the
  `reference` ranking class.
- Hydrated FoodItems now pass persisted `rankingSource` semantics into the
  deterministic evaluator, while recent/saved/custom/barcode priorities still
  override the stored source class.
- Pinecone semantic rehydration now admits only active global `app_owned`
  FoodItems, preventing private or stale user records from entering the
  semantic candidate pool.
- Runtime semantic retrieval now resolves the active versioned namespace from
  `FoodSearchIndexVersion`, with the configured environment namespace as a
  graceful fallback when the lifecycle table is unavailable.
- The permanent 120-query corpus now explicitly tags misspellings, abbreviations, descriptive semantics, preparation/form, compounds, regional terminology, ambiguous/messy fragments, and barcodes while retaining the 80/40 development/holdout split.
- API lint, typecheck, and build pass under Node 22.23.0/pnpm 10.34.3.
- Schema/dependency changes are present and the committed migrations deploy
  cleanly to the dedicated test database. The live benchmark adapter now
  records split-scoped snapshots and baseline-derived reports.
- Official CNF 2026 parse dry-run completed under Node 22: 5,993 foods and 147,637 canonical nutrient rows in 7.2s, peak RSS 354 MB. This supports bounded 250-row persistence batches without introducing staging tables; PostgreSQL mutation/transaction timing remains pending.
- Official CoFID 2021 parse dry-run completed under Node 22: 2,886 foods and 38,858 canonical nutrient rows in 4.1s, peak RSS 572 MB. This is parse-only evidence; PostgreSQL mutation/transaction timing remains pending.
- Official Ciqual 2025 parse dry-run completed under Node 22: 3,484 foods and 59,819 canonical nutrient rows in 3.2s, peak RSS 358 MB; English canonical names and French/scientific aliases were read from the official XLSX/XML pair.
- Manifest-verified dry-run CLI imports completed for all three official releases: CNF 5,993, Ciqual 3,484, and CoFID 2,886 rows; no rejected rows were reported. CNF measure conversion/name files now preserve portion descriptions separately from gram weights.
- Official CNF, Ciqual, and CoFID imports have now run against
  `food_tracker_test`; create/skip counts, nutrient/serving coverage, release
  activation, and source provenance were queried after persistence.
- Pinecone lifecycle/search paths are implemented but not live-validated and remain optional at runtime.
- Full `TEST_DATABASE_URL=...food_tracker_test corepack pnpm test` now passes 98
  files and 1,230 tests after clean migration deployment.
- Root `format:check` remains red only on pre-existing protected `.agents/`/`.superpowers/` files; all changed non-protected files pass targeted Prettier checks.
- The duplicate-row persistence guard now ensures a valid provider source ID is
  mutated at most once per import, while rows rejected for non-finite nutrient
  amounts are excluded from mutation and retained in the rejected count.
- Prior full verification under Node `v22.23.0` and pnpm `10.34.3`:
  `prisma:generate`, `prisma:validate`, `lint`, `typecheck`, `build`, focused
  retrieval tests (4 files, 135 tests), and `git diff --check` pass. Root
  `format:check` reports only the protected `.agents/`/`.superpowers/`
  formatting set.
- Fresh full `TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/food_tracker_test corepack pnpm test` now passes 98 files and 1,230 tests.
- Fresh focused verification for code checkpoint `4d9e1d9`
  under Node `v22.23.0` and pnpm
  `10.34.3` passes `lint`, `typecheck`, focused retrieval tests (4 files, 142
  tests), and `git diff --check`; the prior full verification also passed
  `prisma:generate` and `prisma:validate`.
  Root `format:check` fails only on the pre-existing protected
  `.agents/`/`.superpowers/` document set. The full test command remains
  blocked before discovery by Prisma `P1001` because PostgreSQL is unavailable
  at `localhost:5432`.
- Branch commits are pushed to `origin/phase-18-19-hybrid-food-retrieval`; no PR or merge was created.
- No protected local state changed.
- Continuation validation rebuilt only `food_tracker_test` after Prisma reset
  failed on the existing siglen operator class; dropping/recreating that
  dedicated test database and deploying all 16 committed migrations succeeded.
  `pg_trgm`, the active-row GiST `siglen=32` index, and the archive-aware
  provider/source unique index were verified from PostgreSQL.
- PostgreSQL-backed fuzzy EXPLAIN evidence on 20,004 active rows used
  `FoodItem_searchText_trgm_idx` for both whole-string KNN (2.458 ms) and the
  strict-word `normalized <<<-> "searchText"` query (53.532 ms; PostgreSQL
  displays the commutator as `<->>>`). The focused retrieval suite is now 4
  files and 152 tests passing, including executable quoted SQL and
  word-vs-strict-word regression coverage.
- Fresh persistence measurements on the clean test database: CNF 2026
  imported 5,993 foods in 42.51s and reran with 5,993 skips in 12.08s; Ciqual
  2025 imported 3,484 in 14.02s and reran with 3,484 skips in 6.25s; CoFID
  2021 imported 2,886 in 11.86s and reran with 2,886 skips in 6.31s. The
  persisted catalog contains 240,103 nutrient rows; aliases are retained for
  all three providers and serving fields cover 5,947 CNF, 3,484 Ciqual, and
  2,886 CoFID foods. All releases are active with zero rejects.
- Live benchmark evidence is recorded in
  `docs/superpowers/phase-18-19-benchmark-results.md`: legacy development
  baseline is 40/80 Top-1/3/5 and holdout is 25/40; full hybrid reaches 70/80
  development Top-1 and 27/40 holdout Top-1 with zero safety violations and
  zero Top-1 regressions. Dataset-only fails the baseline-derived exact/Top-K
  floors. Semantic remains disabled pending Pinecone credentials.
- Continuation commit `f21d9b8` quotes the Prisma camelCase `"searchText"`
  identifier in every fuzzy KNN SQL expression, changes strict-word retrieval
  to PostgreSQL `<<<->`, and aligns the unreleased trigram index with
  `gist_trgm_ops(siglen=32)` plus the active-row `"archivedAt" IS NULL`
  predicate. Three PostgreSQL-backed regression tests cover executable SQL,
  strict distance semantics, archived exclusion, and the live index definition.
- The dedicated `food_tracker_test` database was rebuilt only after an explicit
  `_test` URL assertion. All 16 committed migrations applied successfully;
  `pg_trgm` is installed. Controlled fixtures verified that archived duplicate
  provider identities coexist while two active identities are rejected by the
  partial unique index. Whole-string and strict-word `EXPLAIN (ANALYZE,
  BUFFERS)` both used `FoodItem_searchText_trgm_idx`; PostgreSQL displayed the
  strict commutator as `<->>>` for the query orientation `normalized <<<->
  "searchText"`.
- Focused retrieval validation is now 4 files and 147 tests passing. The fresh
  full database-backed suite is 98 files and 1,226 tests passing. Two test
  fixture helpers were made unique under the provider/source invariant, and
  the server diagnostic source scan now excludes intentional offline
  benchmark/import CLI entrypoints without weakening runtime diagnostics.
- Manifest-verified live persistence completed in `food_tracker_test` for all
  three official releases. CNF 2026 created 5,993 foods and 141,426 supported
  nutrient rows in 45.34s (peak RSS 377,356,288 bytes); the rerun skipped
  5,993 rows in 21.30s. Ciqual 2025 created 3,484 foods in 18.62s (peak RSS
  348,995,584 bytes); the rerun skipped 3,484 in 10.88s. CoFID 2021 created
  2,886 foods in 15.19s (peak RSS 541,360,128 bytes); the rerun skipped 2,886
  in 7.70s. All releases are active with zero rejects. Persisted serving
  coverage is CNF 5,947/5,993, Ciqual 3,484/3,484, and CoFID 2,886/2,886;
  Ciqual English canonical names retain French and scientific aliases.
- The development `food_tracker` database was inspected read-only and remains
  untouched: migration metadata for
  `20260823120000_phase_18_19_food_retrieval_foundation` is failed with the
  recorded duplicate `usda_fdc:2708402`, and that duplicate still has count 2.
  No reset, manual row edit, or `migrate resolve` was performed.
- The first live baseline, five-channel ablation run, and frozen holdout are
  recorded in `docs/superpowers/phase-18-19-benchmark-results.md`. Semantic
  retrieval made zero calls because Pinecone credentials were unavailable, so
  full hybrid was evaluated as the validated lexical + fuzzy path. Pinecone
  and Railway remain external validation gates.
- After PostgreSQL became available, the dedicated `food_tracker_test` target
  successfully applied both Phase 18/19 migrations. A direct migration command
  without `DATABASE_URL` correctly exposed a development-database duplicate
  (`usda_fdc:2708402`) and failed transactionally; inspection confirmed no
  Phase 18/19 columns or indexes were left in `food_tracker`, and no cleanup or
  reset was performed there.
- Commit `4d086d6` makes provider/source uniqueness archive-aware: the migration
  archives later active duplicate identities deterministically before creating a
  partial active-row unique index, and import lookup ignores archived history.
  Focused retrieval tests now pass 4 files/144 tests.
- The first full database-backed suite reached migration setup but exhausted
  host storage during Vitest SSR temp-file creation (`ENOSPC`): 2 suites passed,
  133 tests executed, and 96 suites failed during setup. The dedicated test
  database was not reset after this run because Docker Desktop became
  unresponsive; Docker volumes and the development database remain untouched.
- Docker Desktop engine recovery is currently blocked by a wedged virtualization
  process after the host reached 100% capacity. Only regenerable pnpm and Google
  application caches were removed to recover space; no repository, protected,
  Docker image, or volume data was removed.
