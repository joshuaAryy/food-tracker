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

The report includes Top-1/3/5, safety, duplicates, trusted selections,
provider coverage, latency, external calls, normal-search coverage, and miss
sets. `deriveAcceptanceGates` sets retrieval floors from the observed baseline
hit counts and preserves hard zero/one safety gates; it does not invent target
percentages. The resulting gates are the baseline contract for later retrieval
tasks. Holdout settings must not be tuned using this corpus split.
