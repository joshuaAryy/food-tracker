# Phase 18/19 benchmark evidence

This is the first database-backed benchmark record for the permanent
2026-08-23, 120-query corpus. The run used only `food_tracker_test`, a
deterministic 120-row benchmark seed, and the persisted CNF 2026, Ciqual 2025,
and CoFID 2021 catalogs. No user-owned rows were seeded and no production or
development database was changed.

## Baseline and frozen gates

The legacy baseline was recorded before comparing retrieval channels. The
development split contains 80 queries and the holdout split contains 40.

| Split | Top-1 | Top-3 | Top-5 | Normal-search coverage | p50 / p95 |
| --- | ---: | ---: | ---: | ---: | ---: |
| Development baseline | 40/80 | 40/80 | 40/80 | not present | 2.467 / 4.992 ms |
| Holdout baseline | 25/40 | 25/40 | 25/40 | 25/31 | 2.236 / 3.053 ms |

The frozen development floors are therefore 40 Top-1/3/5 hits, with class
floors of branded 16/24, exact 24/24, preparation 0/24, and semantic 0/8.
The holdout floors are 25 Top-1/3/5 hits and 25/31 normal-search coverage.
Safety gates are hard invariants: zero unsafe defaults, zero
fuzzy/semantic-only trusted selections, zero historical snapshot mutations,
zero private vectors, at most one Pinecone call per request, and zero bulk
provider runtime calls.

## Development ablations

| Mode | Top-1 | Top-3 | Top-5 | Fuzzy recovery | Semantic recovery | Top-1 regressions | Candidate gate |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| Legacy | 40/80 | 40/80 | 40/80 | — | — | — | baseline |
| Legacy + datasets | 40/80 | 40/80 | 40/80 | 0/40 | 0/40 | 0/80 | PASS |
| + fuzzy | 71/80 | 72/80 | 72/80 | 31/40 | 0/40 | 0/80 | PASS |
| + semantic | 43/80 | 43/80 | 44/80 | 3/40 | 3/40 | 0/80 | PASS |
| Full hybrid | 71/80 | 72/80 | 72/80 | 31/40 | 0/40 | 0/80 | PASS |

The final development runs had fuzzy/full-hybrid Top-1/3/5 of 71/72/72 and
semantic Top-1/3/5 of 43/43/44. All hard safety gates were zero and no Top-1
regressions or semantic bad Top-1 results were observed. Earlier snapshots
captured before the dedicated catalog and active Pinecone namespace were
available are historical diagnostics, not acceptance evidence.

## Frozen holdout evaluation

With the development settings unchanged, the one-time full-hybrid holdout
evaluation produced:

- Top-1 27/40, Top-3 28/40, Top-5 28/40;
- normal-search coverage 28/31;
- fuzzy recovery 3/15 and provider expansion 3/40;
- zero Top-1 regressions, semantic harm, unsafe defaults, fuzzy/semantic-only
  trusted selections, historical mutations, private vectors, and bulk calls;
- p50/p95 latency 18.036/28.835 ms;
- all frozen candidate gates PASS.

Semantic retrieval remains a candidate-recall mechanism rather than an
authoritative rank or selection mechanism. The external Pinecone index and
credential gate was subsequently completed in Railway staging; the active
namespace and smoke evidence are recorded in the Phase 18/19 closeout.

## Reproduction

The live adapter and seed commands are in
`apps/api/src/benchmarks/food-retrieval/`. The requested split controls which
queries execute and which observations are written: development produces 80,
holdout 40, and `all` 120. The recorded comparison commands are:

```bash
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/food_tracker_test \
TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/food_tracker_test \
corepack pnpm --filter @food-tracker/api benchmark:food-retrieval-live \
  -- --mode full_hybrid --split all --output /tmp/full_hybrid.json

corepack pnpm --filter @food-tracker/api benchmark:food-retrieval \
  -- --snapshot /tmp/legacy.json --candidate /tmp/full_hybrid.json \
  --split holdout --json
```

Raw snapshots remain reproducible from the corpus, seed, and pinned official
artifacts; this document records the reviewed metrics and gate decisions rather
than committing latency-variable raw output.
