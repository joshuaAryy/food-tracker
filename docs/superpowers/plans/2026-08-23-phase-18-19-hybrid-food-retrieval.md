# Phase 18/19 Food Data + Intelligent Retrieval Implementation Plan

> For agentic workers: execute task-by-task with focused review and explicit-path commits. Preserve protected local state.

**Goal:** Expand trusted food-data coverage and improve typo/semantic retrieval while preserving PostgreSQL nutrition authority and deterministic candidate evaluation.

**Architecture:** Add CNF 2026, Ciqual 2025, and CoFID 2021 as versioned global reference FoodItems. Generate candidates through local lexical, PostgreSQL GiST `pg_trgm` KNN, and optional Pinecone semantic channels, then union and evaluate deterministically. Pinecone is derived and global-only.

**Tech stack:** Node 22, pnpm 10.34.3, TypeScript, Prisma/PostgreSQL, `csv-parse`, ExcelJS, `fast-xml-parser`, official Pinecone TypeScript SDK.

**Baseline:** `phase-18-19-hybrid-food-retrieval` at `13e476b`, matching `main` before implementation.

## Global constraints

- PostgreSQL remains authoritative food/nutrition truth.
- FoodLog historical snapshots are immutable.
- Missing values remain unknown/null/absent, never zero.
- Clients never submit `userId`.
- CNF, Ciqual, and CoFID are the only new datasets.
- Private/user-owned records never enter Pinecone.
- Deterministic ranking remains authoritative after candidate generation.
- Barcode/Open Food Facts and photo adjudication safety remain intact.
- No frontend redesign, LLM reranker, queue, event bus, or unrelated schema/dependency work.
- Never modify or stage `.agents/`, `.aidesigner/`, `.codex/`, `.superpowers/`, `backups/`, current design-reference images, generated native directories, or local database safety state.

## Shared interfaces

```ts
type CandidateRankingSource =
  | 'recent' | 'saved' | 'custom' | 'app_curated' | 'reference'
  | 'cached_external' | 'barcode_cached';

interface CandidateIdentityTerms {
  canonicalName: string;
  authoritativeAliases: readonly string[];
}

interface GeneratedCandidate {
  candidate: AiFoodParseCandidate;
  identity: CandidateIdentityTerms;
  provenance: {
    rankingSource: CandidateRankingSource;
    sourceProvider: FoodSourceProvider | null;
    sourceRegion: string | null;
  };
  evidence: RetrievalEvidence;
}
```

`authoritativeAliases` contains only provider-authoritative equivalents. It excludes category, provider labels, region, arbitrary metadata, full `searchText`, fuzzy matches, and semantic matches. Identity terms are normalized with the shared Unicode/diacritic normalizer and matched within one canonical name or one alias; tokens are never assembled across aliases.

Initial ranking source semantics are recent 32, saved 28, custom 24, curated app 18, reference 18, barcode cached 8, cached external 4. Generic USDA and CNF/Ciqual/CoFID all use `reference`; the generic USDA-only bonus is removed. Provider and region remain separate and locale is only a final comparable-reference tie-break.

## Task sequence

### A — Permanent benchmark and legacy baseline

Create the reviewed approximately-120-query corpus, deterministic metrics/harness/CLI, development/holdout split, and legacy baseline. Measure Top-1/3/5, safety, duplicates, trusted behavior, provider coverage, latency, external calls, miss sets, and normal-search coverage. Before any feature tuning, record concrete acceptance gates derived from observed baseline denominators and misses. Hard gates are no unsafe trusted/default selections, no semantic/fuzzy-only trusted selection, no historical snapshot mutation, no private vectors, no bulk-provider runtime network dependency, at most one Pinecone call per request, and no material exact/branded/preparation regression. Commit baseline before proceeding.

### B — Retrieval boundary, source semantics, and alias identity

Create the provider-neutral retrieval types, local generator, union, mode-policy interfaces, and provenance-aware ranker input. Distinguish `app_curated` from `reference`. Extend ranker identity input with `CandidateIdentityTerms`; evaluate canonical name and each authoritative alias independently. Keep all existing preparation, negative-descriptor, branded, loggability, eligibility, confidence, and photo safeguards.

### C — Provenance schema foundation

Add `cnf`, `ciqual`, and `cofid`; release/import-run/index-version models; FoodItem release/hash/region/category/aliases fields; FoodItemNutrient source provenance fields; provider/source uniqueness; active-release/index constraints. Add `pg_trgm` and GiST index in a reviewed migration. Do not add staging tables yet.

### D — Common ingestion and Unicode normalization

Add `csv-parse`, ExcelJS, and `fast-xml-parser`. Build strict manifest/checksum parsing, provider-neutral normalized records, deterministic hashes, dry-run counts, and shared normalization. Use NFKD, remove combining marks, preserve display strings, and minimally normalize selected French ligatures (`œ→oe`, `æ→ae`). Keep canonical aliases separate from search metadata. Define persistence strategy measurement rather than assuming one large Prisma interactive transaction.

### E — CNF 2026 adapter and persistence checkpoint

Parse Food_Name, Nutrient_Name/Amount/Source, Food Group, and measure tables. Use Food Code identity, English canonical name, French/alternate aliases, source nutrient provenance, and positive user-defined gram servings. Dry-run first; measure parsed rows, mutation counts, memory, throughput, and transaction/runtime headroom. Use bounded/set-based transactional persistence if measured safe. If staging tables are proven necessary, stop for explicit evidence review before adding them.

### F — Ciqual 2025 XLSX/XML adapter

Read composition XLSX plus official `alim_2025_11_03.xml` with `fast-xml-parser` validation and retained missing attributes. Join by `alim_code`; prefer nonblank `alim_nom_eng` as canonical name; retain `alim_nom_fr` and `alim_nom_sci` as authoritative aliases. Do not translate. Test English, French accented/unaccented, scientific, missing/censored, and mapping behavior end-to-end.

### G — CoFID 2021 adapter

Join approved worksheets by Food Code; preserve `Tr`/`N` as unknown; distinguish AOAC fibre/NSP and fatty-acid bases; convert alcoholic per-100ml only with valid source specific gravity; use 100g serving fallback; exclude old-food data.

### H — Imported-catalog lexical/reference retrieval

Build search text from canonical name, authoritative aliases, brand, category, and preparation. Rehydrate local candidates with `FoodItem.sourceAliases` into `CandidateIdentityTerms`; never pass full searchText to deterministic identity. Ensure provider/reference ranking and user isolation remain correct.

### I — PostgreSQL fuzzy KNN

Use bounded GiST KNN whole-string and strict-word trigram distance queries without `%`, `<%`, or `<<%` candidate prefilters. Apply explicit versioned application thresholds after the candidate pool. Confirm index use with `EXPLAIN (ANALYZE, BUFFERS)`. Rehydrate authoritative aliases before ranking; fuzzy evidence remains distinct and cannot grant trusted selection.

### J — Pinecone index foundation

Index only current global reference/app-curated records. Search documents include authoritative canonical and alias text plus normalized terms, but no nutrient vectors. Use versioned document/model/index metadata, inactive namespaces, reconciliation, retries, activation, rollback, partial/full rebuild, and stale-vector detection.

### K — Semantic candidate generator

Use Pinecone integrated `multilingual-e5-large` with passage/query modes, one bounded call per request, PostgreSQL rehydration, and graceful failure. Rehydrated candidates carry authoritative aliases into deterministic ranking. Semantic evidence alone cannot grant trusted selection, high confidence, or photo materialization.

### L — Mode-specific hybrid integration

Keep generators, union, diagnostics, and ranking shared. AI/photo may short-circuit when a safe trusted local candidate is adequate. Normal search requires benchmark-derived useful Top-K coverage/diversity before suppressing fuzzy, semantic, or USDA acquisition. Barcode remains independent. Apply alias identity first, then all unchanged safety gates.

### M — Locale tie-break

Use explicit validated locale, then intentional `FOOD_SEARCH_DEFAULT_REGION`, then neutral. Do not add a broad regional-language parser. Locale applies only after equal reference source quality and comparable identity/form/suitability checks.

### N — Ablation, tuning, holdout

Run legacy, datasets, fuzzy, semantic, and full hybrid ablations. Tune only development data. Freeze settings and run holdout once. Evaluate against Task A’s measured gates; do not invent or revise percentages after holdout. Disable semantic if its measured benefit/harm gate fails.

### O — Resilience and Railway staging

Deploy with semantic disabled, migrate, verify pg_trgm, dry-run/import datasets, build inactive Pinecone, benchmark, activate, then stage authenticated manual/AI/photo/barcode/outage/snapshot checks. Keep rollback flags and prior index. Do not expose credentials or QA identifiers.

### P — Documentation and closeout

Update roadmap/architecture/data/API/technical/setup documents with provider licenses/checksums, alias identity, Unicode normalization, ranking semantics, import strategy evidence, benchmark results, staging evidence, limitations, and deferred work. Run final Node 22/pnpm validation, `git diff --check`, explicit-path review, branch review, and handoff. Do not create a PR or merge.

## TDD and validation rule

Every task writes a failing focused test, confirms failure, implements the minimum behavior, confirms green, runs affected regressions, reviews the diff/interfaces, fixes findings, and commits explicit reviewed paths. Existing regression tests may not be removed, weakened, or bypassed.
