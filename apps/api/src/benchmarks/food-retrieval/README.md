# Food retrieval benchmark

This directory contains the permanent Phase 18/19 benchmark contract. The
corpus is versioned as `2026-08-23` and contains 120 reviewed queries: 80
development queries and 40 holdout queries across exact, preparation, branded,
semantic, and normal-search classes. Each query also carries review tags for
misspellings, abbreviations, descriptive semantics, preparation/form,
compounds, regional terminology, ambiguous fragments, messy fragments, and
barcodes; these tags keep the broader quality corpus visible without weakening
the stable metric classes.

The harness evaluates recorded observations. It does not call PostgreSQL,
USDA, Open Food Facts, Pinecone, or any other provider. A retriever adapter can
run elsewhere and persist observations using this shape:

```json
{
  "benchmarkVersion": "2026-08-23",
  "name": "legacy",
  "observations": [
    {
      "queryId": "exact-001",
      "candidates": [],
      "selectedCandidateId": null,
      "latencyMs": 0,
      "externalCallCount": 0,
      "pineconeCallCount": 0,
      "bulkProviderCallCount": 0,
      "historicalSnapshotMutated": false,
      "privateVectorCount": 0
    }
  ]
}
```

Run a recorded legacy snapshot with:

```bash
corepack pnpm --filter @food-tracker/api benchmark:food-retrieval -- --snapshot /path/to/legacy.json
```

Compare a recorded candidate run against that baseline with:

```bash
corepack pnpm --filter @food-tracker/api benchmark:food-retrieval -- --snapshot /path/to/legacy.json --candidate /path/to/full-hybrid.json --json
```

The report includes Top-1/3/5, safety, duplicates, trusted selections,
provider coverage, latency, external calls, normal-search coverage, and miss
sets. `deriveAcceptanceGates` sets retrieval floors from the observed baseline
hit counts and preserves hard zero/one safety gates; it does not invent target
percentages. `compareBaselineToCandidate` additionally reports fuzzy and
semantic miss recovery, semantic bad-top-1 harm, provider expansion, Top-1
regressions, and p50/p95 latency deltas. The resulting gates are the baseline
contract for later retrieval tasks. Holdout settings must not be tuned using
this corpus split.

The live PostgreSQL adapter is available through
`benchmark:food-retrieval-live`. It supports `legacy`, `datasets`, `fuzzy`,
`semantic`, and `full_hybrid` modes, seeds only deterministic global benchmark
rows, and writes a snapshot containing only the observations executed for the
requested split: 80 development, 40 holdout, or 120 for `all`. `--split`
controls retrieval execution as well as the written artifact; development runs
never invoke the holdout queries. Use a dedicated real-catalog database such
as `food_tracker_benchmark_test`; ordinary Vitest continues using
`food_tracker_test` and resets it. The first measured baseline and frozen-gate
results are recorded in
`docs/superpowers/phase-18-19-benchmark-results.md`.
