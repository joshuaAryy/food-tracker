# Phase 18/19 Execution Ledger

Plan: `docs/superpowers/plans/2026-08-23-phase-18-19-hybrid-food-retrieval.md`
Branch: `phase-18-19-hybrid-food-retrieval`
Baseline: `13e476b`
Preflight: complete; branch equals `main`; Node 22.23.0; pnpm 10.34.3
Protected state: preserved; no protected paths staged or modified

## Task status

- [~] A — benchmark infrastructure complete; live legacy baseline pending PostgreSQL
- [~] B — retrieval boundary/source semantics/alias identity implemented; integration review pending
- [~] C — provenance schema foundation implemented; migration deployment pending PostgreSQL
- [x] D — importer contracts/Unicode normalization
- [x] E — CNF adapter/persistence strategy (dry-run/count path; live measurement pending)
- [x] F — Ciqual XLSX/XML adapter
- [x] G — CoFID adapter
- [x] H — local reference retrieval
- [x] I — pg_trgm GiST KNN migration/query path
- [x] J — Pinecone index lifecycle/document path
- [x] K — semantic generator with timeout/fallback
- [x] L — mode-specific policy and normal-search hybrid path
- [x] M — locale tie-break
- [ ] N — ablation/tuning/holdout
- [ ] O — staging/resilience
- [ ] P — documentation/closeout

## Evidence log

- Commits `8752484`, `dafd00d`, `f997d90`, and `be5ea85` persist the plan,
  retrieval foundation, dataset/index commands, ablation harness, and
  coverage-gated normal search.
- Focused benchmark/retrieval tests pass: 4 files, 128 tests.
- API lint, typecheck, and build pass under Node 22.23.0/pnpm 10.34.3.
- Schema/dependency changes are present but migration deployment is blocked by unavailable PostgreSQL.
- The permanent benchmark CLI is ready, but no live legacy baseline is claimed until the test database is available.
- Official CNF 2026 parse dry-run completed under Node 22: 5,993 foods and 147,637 canonical nutrient rows in 7.2s, peak RSS 354 MB. This supports bounded 250-row persistence batches without introducing staging tables; PostgreSQL mutation/transaction timing remains pending.
- Official CoFID 2021 parse dry-run completed under Node 22: 2,886 foods and 38,858 canonical nutrient rows in 4.1s, peak RSS 572 MB. This is parse-only evidence; PostgreSQL mutation/transaction timing remains pending.
- Dataset adapters are pure parsing/normalization paths; no live PostgreSQL dataset import has run.
- Pinecone lifecycle/search paths are implemented but not live-validated and remain optional at runtime.
- Branch commits are pushed to `origin/phase-18-19-hybrid-food-retrieval`; no PR or merge was created.
- No protected local state changed.
