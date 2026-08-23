# Phase 18/19 Execution Ledger

Plan: `docs/superpowers/plans/2026-08-23-phase-18-19-hybrid-food-retrieval.md`
Branch: `phase-18-19-hybrid-food-retrieval`
Baseline: `13e476b`
Preflight: complete; branch equals `main`; Node 22.23.0; pnpm 10.34.3
Protected state: preserved; no protected paths staged or modified

## Task status

- [~] A — benchmark infrastructure complete; live legacy baseline pending PostgreSQL
- [x] B — retrieval boundary/source semantics/alias identity implemented and shared by normal/AI/photo retrieval paths
- [~] C — provenance schema foundation implemented; migration deployment pending PostgreSQL
- [x] D — importer contracts/Unicode normalization
- [~] E — CNF adapter/persistence strategy (official parse dry-run complete; live mutation measurement pending)
- [x] F — Ciqual XLSX/XML adapter (official parse dry-run complete)
- [x] G — CoFID adapter (official parse dry-run complete)
- [x] H — local reference retrieval
- [x] I — pg_trgm GiST KNN migration/query path
- [x] J — Pinecone index lifecycle/document path
- [x] K — semantic generator with timeout/fallback
- [x] L — mode-specific policy and normal-search hybrid path
- [x] M — locale tie-break
- [~] N — ablation/tuning/holdout pending the measured legacy baseline
- [~] O — staging/resilience pending PostgreSQL, Pinecone credentials, and Railway execution
- [~] P — documentation aligned; final closeout pending blocked gates

## Evidence log

- Commits `8752484`, `dafd00d`, `f997d90`, and `be5ea85` persist the plan,
  retrieval foundation, dataset/index commands, ablation harness, and
  coverage-gated normal search.
- Focused benchmark/retrieval tests pass: 4 files, 129 tests, including official-column, alias, provider, fuzzy-policy, semantic timeout/parser, and index-lifecycle regressions. The AI/photo fallback path typechecks and remains DB/Pinecone integration-gated.
- API lint, typecheck, and build pass under Node 22.23.0/pnpm 10.34.3.
- Schema/dependency changes are present but migration deployment is blocked by unavailable PostgreSQL.
- The permanent benchmark CLI is ready, but no live legacy baseline is claimed until the test database is available.
- Official CNF 2026 parse dry-run completed under Node 22: 5,993 foods and 147,637 canonical nutrient rows in 7.2s, peak RSS 354 MB. This supports bounded 250-row persistence batches without introducing staging tables; PostgreSQL mutation/transaction timing remains pending.
- Official CoFID 2021 parse dry-run completed under Node 22: 2,886 foods and 38,858 canonical nutrient rows in 4.1s, peak RSS 572 MB. This is parse-only evidence; PostgreSQL mutation/transaction timing remains pending.
- Official Ciqual 2025 parse dry-run completed under Node 22: 3,484 foods and 59,819 canonical nutrient rows in 3.2s, peak RSS 358 MB; English canonical names and French/scientific aliases were read from the official XLSX/XML pair.
- Manifest-verified dry-run CLI imports completed for all three official releases: CNF 5,993, Ciqual 3,484, and CoFID 2,886 rows; no rejected rows were reported. CNF measure conversion/name files now preserve portion descriptions separately from gram weights.
- Dataset adapters are pure parsing/normalization paths; no live PostgreSQL dataset import has run.
- Pinecone lifecycle/search paths are implemented but not live-validated and remain optional at runtime.
- Full `pnpm test` remains blocked at Prisma migration deploy with `P1001` because no PostgreSQL server is reachable at `localhost:5432`; no migration or persistent import claim is made.
- Root `format:check` remains red only on pre-existing protected `.agents/`/`.superpowers/` files; all changed non-protected files pass targeted Prettier checks.
- Branch commits are pushed to `origin/phase-18-19-hybrid-food-retrieval`; no PR or merge was created.
- No protected local state changed.
