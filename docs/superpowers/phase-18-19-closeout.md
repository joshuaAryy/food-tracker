# Phase 18/19 Closeout

## Outcome

Phase 18 and Phase 19 were intentionally delivered as one macro phase:
**Phase 18/19 — Food Data + Intelligent Retrieval**. The macro phase is
complete and merged into `main` by PR #8.

Implementation branch: `phase-18-19-hybrid-food-retrieval`
Final implementation: `0b92bd3f7a10cd55ae09f714e09c004fc6a241d6`
Main merge commit: `76adc247fa00e2e070775cf9bd64de820795343d`

## Delivered

- Personal/local lexical retrieval with trusted early-stop behavior.
- PostgreSQL `pg_trgm` fuzzy retrieval and explicit application thresholds.
- Pinecone semantic candidate retrieval with timeout and failure fallback.
- Exact-identity candidate union and deterministic evaluation/ranking.
- Safe review/default-selection behavior; semantic evidence never grants trust.
- Unicode/diacritic normalization and authoritative provider aliases, including
  Ciqual English, French, and scientific names.
- Provider-neutral national reference ranking with locale as only a final
  comparable-reference tie-break.
- Gated USDA fallback; barcode and photo paths retain their distinct policies.
- Versioned, checksummed, auditable CNF 2026, Ciqual 2025, and CoFID 2021
  ingestion with exact mappings, idempotency, resumability, row-level atomic
  persistence, duplicate prevention, and safe release promotion.
- PostgreSQL-derived global Pinecone documents, pagination/reconciliation,
  stale-vector deletion, versioned lifecycle, and bounded 429 retry recovery.

## Final Architecture

```text
personal/local lexical
  → trusted early stop when adequate
  → pg_trgm fuzzy expansion
  → Pinecone semantic expansion (at most one attempt per request)
  → mode-appropriate USDA fallback
  → exact-identity union
  → deterministic evaluator/ranker
  → safe selection or review
```

PostgreSQL is authoritative for FoodItems, nutrients, servings, and historical
FoodLog snapshots. Pinecone is a derived global candidate index only. It
contains eligible global `app_owned` reference/app-curated foods and excludes
private/custom/recent/saved, Open Food Facts cached, and dynamic/cached USDA
records. Semantic similarity is never authoritative nutrition or selection
truth.

## Dataset / Staging State

Railway staging completed and activated all three approved national datasets:

| Dataset | Active foods | Nutrient rows | Archived | Rejected |
| --- | ---: | ---: | ---: | ---: |
| CNF 2026 | 5,993 | 141,426 | 0 | 0 |
| Ciqual 2025 | 3,484 | 97,057 | 0 | 0 |
| CoFID 2021 | 2,886 | 38,858 | 0 | 0 |
| **Combined** | **12,363** | **277,341** | **0** | **0** |

There are zero duplicate national provider/source/release identities.

Active Pinecone staging lifecycle:

- index version: `food-search-v1:multilingual-e5-large`
- namespace: `food-search-staging-next-food-search-v1-multilingual-e5-large`
- status: `active`
- document count: `12,363`
- `activatedAt`: non-null

Before activation, reconciliation proved 12,363 PostgreSQL-eligible documents,
12,363 Pinecone documents, zero missing, and zero stale IDs. Staging semantic
smoke covered `chicken breast`, `crème fraîche`, and `salmon` with real
cross-provider CNF/Ciqual/CoFID candidates. A live integrated-inference
429/`RESOURCE_EXHAUSTED` was retried after the configured quota wait and all
12,363 documents completed without omission.

## Benchmark Results

The permanent 120-query corpus and frozen 80/40 development/holdout split are
preserved. Metrics are Top-1 / Top-3 / Top-5:

| Mode | Development | Holdout |
| --- | --- | --- |
| Legacy | 40 / 40 / 40 | 25 / 25 / 25 |
| Datasets | 40 / 40 / 40 | — |
| Fuzzy | 71 / 72 / 72 | 27 / 28 / 28 |
| Semantic | 43 / 43 / 44 | 25 / 25 / 25 |
| Full hybrid | 71 / 72 / 72 | 27 / 28 / 28 |

The frozen holdout met the required quality floor with zero acceptance
violations, zero semantic bad Top-1 results, and zero Top-1 regressions. No
holdout tuning occurred after settings were frozen. Semantic search remains a
candidate-recall mechanism, not the authoritative rank/selection mechanism.

## Validation

Final local validation used Node `v22.23.0`, pnpm `10.34.3`, and the disposable
`food_tracker_test` database:

- Full API suite: **100 files, 1,269 tests passed**.
- DB-backed provider/retrieval suite: **39/39 passed**.
- Focused ranking/aliases/semantic-timeout/index-lifecycle suite: **4 files,
  134/134 passed**.
- Prisma validate, workspace lint, workspace typecheck, workspace build,
  changed-file Prettier, and `git diff --check` passed.
- Comprehensive review found no implementation defect.

Root `format:check` continues to report only the 25 pre-existing protected
`.agents/`/`.superpowers` files. No project file introduced a formatting
failure, and protected state was not modified.

## What Went Well

1. Combining Phase 18 and Phase 19 was the right architecture decision.
   Provider quality, normalization, ranking, fuzzy retrieval, semantic
   retrieval, and fallback policy directly affected one another, so designing
   them together avoided an immediate provider-layer redesign.
2. Benchmark-first retrieval development worked. The permanent corpus,
   development/holdout split, ablations, frozen settings, comparison reports,
   and safety gates made quality measurable without repeated holdout tuning.
3. Deterministic authority remained intact. Recall improved without allowing
   embeddings, Pinecone, or AI to become nutrition truth or independently make
   a food safe to log.
4. PostgreSQL source-of-truth and Pinecone-derived-index separation worked:
   exact reconciliation preceded activation and verified the intended set.
5. National ingestion became production-grade through exact mappings,
   provenance/checksums, deterministic IDs, idempotency, resumability,
   row-level atomicity, release promotion, duplicate prevention, and reject
   accounting.
6. Database safety rules prevented local failure from becoming data loss. An
   accidental development-target migration hit an existing duplicate and
   failed transactionally; `food_tracker` was not reset or manually repaired.
7. External staging was treated as a real gate. Railway pg_trgm behavior,
   dataset persistence, Pinecone reconciliation/activation, rate-limit
   recovery, and semantic smoke were validated rather than inferred from
   mocks.
8. Final consolidation ended with a complete database-backed suite and broad
   review instead of relying only on focused tests.

## What Did Not Go Well

1. The branch reached 63 commits. Individual fixes were correct, but too much
   validation arrived as micro-fix cycles instead of earlier consolidated,
   production-like gates.
2. Railway/Pinecone credentials, capabilities, quotas, and lifecycle behavior
   were preflighted too late.
3. Integrated-inference token quotas were not modeled initially. The first
   staging reindex hit the 250,000 token/minute limit after partial indexing;
   bounded 429 retry later corrected this safely.
4. Lifecycle tooling lacks a dedicated activation-only command. Exact
   reconciliation was complete, but the existing activation path would have
   re-uploaded all 12,363 documents, so activation used a guarded direct
   lifecycle transaction. This is non-blocking operational hardening.
5. Database target separation was not explicit enough early on. An ambient
   `DATABASE_URL` caused one migration command to target `food_tracker`; it
   failed safely, but commands need explicit target assertions.
6. Disk exhaustion, an unresponsive Docker Desktop, and PostgreSQL P1001
   interrupted validation. These were environment blockers, not code defects.
7. A few user-run staging commands contained avoidable variable/import-mode
   mistakes. Commands should be derived from the actual runtime and checked
   before handoff.
8. Phase status documentation became stale after implementation and merge;
   closeout should happen immediately after a phase lands.

## Lessons Carried Forward

- Front-load external capability, credential, quota, and lifecycle checks.
- Establish the benchmark baseline and safety gates before tuning retrieval.
- Keep provider identity, aliases, retrieval evidence, and deterministic
  identity evidence as separate concepts.
- Assert database targets before every migration or destructive test workflow.
- Distinguish code failures from validation-environment unavailability.
- Treat derived indexes as rebuildable, reconciled artifacts with explicit
  activation and rollback state.
- Close phase documentation immediately after merge and before the next phase
  begins.

## Known Non-Blocking Limitations

- Frontend search/logging redesign and provider-filter UI remain in Phase 24.
- Restaurant-specific data, private Pinecone indexing, learned personalization,
  LLM query rewriting/reranking, new search engines, queues, and event buses
  remain out of scope.
- An activation-only index lifecycle command may be added later if repeated
  operations justify it.
- The local development `food_tracker` database retains historical failed
  migration metadata from the safely rolled-back attempt. It was not reset or
  silently repaired; any future cleanup requires explicit target confirmation
  and the safe Prisma resolve procedure.

These limitations do not block Phase 18/19 completion.

## Merge / Acceptance Record

Phase 18/19 is accepted as complete based on the final implementation commit,
PR #8 merge, the final automated validation above, frozen benchmark evidence,
and externally verified Railway/Pinecone staging state. No PR or merge was
created by this closeout branch.

## Next Direction

Phases 20, 21, and 22 will be planned and executed as one macro phase:
**Phase 20–22 — Product Hardening + Intelligence**. The next task is a
requirement audit against current `main`, classifying each historical item as
already complete, partially complete, missing, or obsolete/deferred. This
closeout intentionally does not create that implementation plan.

Phase 23 supplement tracking is deferred from the current finish line; water
logging and hydration analytics were already completed in Phase 17.5. Phase 24
remains the final current implementation phase for the frontend and
food-logging-flow redesign. Phase 25 external beta/TestFlight/App Store work
is optional/deferred, and Phases 26–29 remain post-finish roadmap ideas.
