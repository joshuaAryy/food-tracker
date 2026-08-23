import { describe, expect, it } from 'vitest';
import {
  FOOD_RETRIEVAL_BENCHMARK_VERSION,
  FOOD_RETRIEVAL_CORPUS,
  deriveAcceptanceGates,
  evaluateObservations,
  runFoodRetrievalBenchmark,
  compareAblations,
  compareBaselineToCandidate,
  type BenchmarkObservation,
} from '../src/benchmarks/food-retrieval/index.js';

function observation(
  queryId: string,
  overrides: Partial<BenchmarkObservation> = {},
): BenchmarkObservation {
  return {
    queryId,
    candidates: [],
    selectedCandidateId: null,
    latencyMs: 10,
    externalCallCount: 0,
    pineconeCallCount: 0,
    bulkProviderCallCount: 0,
    historicalSnapshotMutated: false,
    privateVectorCount: 0,
    ...overrides,
  };
}

describe('food retrieval benchmark corpus', () => {
  it('is versioned, deterministic, and split into development and holdout sets', () => {
    expect(FOOD_RETRIEVAL_BENCHMARK_VERSION).toBe('2026-08-23');
    expect(FOOD_RETRIEVAL_CORPUS).toHaveLength(120);
    expect(new Set(FOOD_RETRIEVAL_CORPUS.map((query) => query.id)).size).toBe(
      120,
    );
    expect(
      FOOD_RETRIEVAL_CORPUS.filter((query) => query.split === 'development'),
    ).toHaveLength(80);
    expect(
      FOOD_RETRIEVAL_CORPUS.filter((query) => query.split === 'holdout'),
    ).toHaveLength(40);
    expect(FOOD_RETRIEVAL_CORPUS).toEqual(
      [...FOOD_RETRIEVAL_CORPUS].sort((left, right) =>
        left.id.localeCompare(right.id),
      ),
    );
    expect(
      new Set(FOOD_RETRIEVAL_CORPUS.flatMap((query) => query.tags)),
    ).toEqual(
      new Set([
        'exact_generic',
        'exact_branded',
        'misspelling',
        'abbreviation',
        'semantic_descriptive',
        'preparation_form',
        'compound',
        'regional_terminology',
        'ambiguous',
        'messy_fragment',
        'barcode',
      ]),
    );
    expect(
      FOOD_RETRIEVAL_CORPUS.find((query) => query.query === 'greek yogrt')
        ?.tags,
    ).toContain('misspelling');
    expect(
      FOOD_RETRIEVAL_CORPUS.find((query) => query.query === '3017620422003')
        ?.tags,
    ).toContain('barcode');
  });
});

describe('food retrieval benchmark metrics', () => {
  it('computes top-k, safety, provider, latency, external-call, and miss metrics', () => {
    const [first, second, third] = FOOD_RETRIEVAL_CORPUS.slice(0, 3);
    if (first === undefined || second === undefined || third === undefined) {
      throw new Error('benchmark corpus fixture is unexpectedly short');
    }

    const report = evaluateObservations([
      observation(first.id, {
        candidates: [
          {
            id: 'wrong',
            name: 'Wrong food',
            provider: 'usda_fdc',
            source: 'reference',
            trusted: false,
            matchesExpected: false,
          },
          {
            id: 'right',
            name: first.gold.canonicalName,
            provider: first.gold.expectedProvider ?? null,
            source: 'reference',
            trusted: true,
            matchesExpected: true,
          },
        ],
        selectedCandidateId: 'right',
        latencyMs: 20,
        externalCallCount: 1,
        pineconeCallCount: 2,
        privateVectorCount: 1,
      }),
      observation(second.id, {
        candidates: [
          {
            id: 'right',
            name: second.gold.canonicalName,
            provider: second.gold.expectedProvider ?? null,
            source: 'reference',
            trusted: true,
            matchesExpected: true,
          },
          {
            id: 'right',
            name: second.gold.canonicalName,
            provider: second.gold.expectedProvider ?? null,
            source: 'reference',
            trusted: true,
            matchesExpected: true,
          },
        ],
        selectedCandidateId: 'right',
        latencyMs: 40,
        historicalSnapshotMutated: true,
        bulkProviderCallCount: 1,
      }),
      observation(third.id, {
        candidates: [
          {
            id: 'semantic',
            name: 'Semantic result',
            provider: 'usda_fdc',
            source: 'reference',
            trusted: true,
            evidence: 'semantic',
            matchesExpected: true,
            defaultSelectionSafe: false,
          },
        ],
        selectedCandidateId: 'semantic',
        latencyMs: 80,
      }),
    ]);

    expect(report.queryCount).toBe(3);
    expect(report.topK.top1.hits).toBe(2);
    expect(report.topK.top3.hits).toBe(3);
    expect(report.topK.top5.hits).toBe(3);
    expect(report.safety.unsafeDefaultSelections).toBe(1);
    expect(report.safety.semanticOrFuzzyOnlyTrustedSelections).toBe(1);
    expect(report.safety.historicalSnapshotMutations).toBe(1);
    expect(report.safety.privateVectors).toBe(1);
    expect(report.duplicates.duplicateCandidates).toBe(1);
    expect(report.latencyMs.p50).toBe(40);
    expect(report.latencyMs.p95).toBe(80);
    expect(report.externalCalls.total).toBe(1);
    expect(report.externalCalls.pineconeCalls).toBe(2);
    expect(report.externalCalls.bulkProviderCalls).toBe(1);
    expect(report.externalCalls.maxPineconeCallsPerQuery).toBe(2);
    expect(report.missSets.top1).toEqual([first.id]);
  });

  it('derives floors from the observed baseline instead of inventing percentages', () => {
    const baseline = evaluateObservations([
      observation('query-a', {
        candidates: [
          {
            id: 'a',
            name: 'A',
            provider: null,
            source: 'reference',
            trusted: false,
            matchesExpected: true,
          },
        ],
      }),
      observation('query-b'),
    ]);

    const gates = deriveAcceptanceGates(baseline);
    expect(gates.baselineQueryCount).toBe(2);
    expect(gates.minimumTop1Hits).toBe(1);
    expect(gates.minimumTop3Hits).toBe(1);
    expect(gates.minimumTop5Hits).toBe(1);
    expect(gates.maximumUnsafeDefaultSelections).toBe(0);
    expect(gates.baselineMissSets.top1).toEqual(['query-b']);
    expect(gates.classTop1Floors).toEqual({});
  });

  it('uses corpus gold labels for class and normal-search coverage', () => {
    const corpus = FOOD_RETRIEVAL_CORPUS.slice(0, 2).map((query, index) => ({
      ...query,
      queryClass: index === 0 ? ('exact' as const) : ('normal' as const),
      normalSearch: index === 1,
    }));
    const report = evaluateObservations(
      corpus.map((query) =>
        observation(query.id, {
          candidates: [
            {
              id: `${query.id}-candidate`,
              name: query.gold.canonicalName,
              provider: query.gold.expectedProvider ?? null,
              source: 'reference',
              trusted: false,
            },
          ],
        }),
      ),
      corpus,
    );

    expect(report.classTop1.exact?.hits).toBe(1);
    expect(report.classTop1.normal?.hits).toBe(1);
    expect(report.normalSearchCoverage).toMatchObject({ hits: 1, total: 1 });
    expect(
      report.providerCoverage[corpus[0]?.gold.expectedProvider ?? ''],
    ).toMatchObject({
      hits: 2,
      total: 2,
    });
  });
});

describe('food retrieval benchmark harness', () => {
  it('reports channel recovery, semantic harm, provider expansion, and regressions', () => {
    const [query] = FOOD_RETRIEVAL_CORPUS;
    if (query === undefined) throw new Error('benchmark corpus is empty');
    const baseline = [observation(query.id)];
    const candidate = [
      observation(query.id, {
        candidates: [
          {
            id: 'wrong-semantic',
            name: 'Wrong semantic result',
            provider: 'usda_fdc',
            source: 'reference',
            trusted: false,
            evidence: 'semantic',
            matchesExpected: false,
          },
          {
            id: 'right-fuzzy',
            name: query.gold.canonicalName,
            provider: query.gold.expectedProvider ?? null,
            source: 'reference',
            trusted: false,
            evidence: 'fuzzy',
            matchesExpected: true,
          },
          {
            id: 'right-deterministic',
            name: query.gold.canonicalName,
            provider: query.gold.expectedProvider ?? null,
            source: 'reference',
            trusted: false,
            evidence: 'none',
            matchesExpected: true,
          },
        ],
      }),
    ];
    const comparison = compareBaselineToCandidate({
      baseline,
      candidate,
      corpus: [query],
    });
    expect(comparison.fuzzyMissRecovery).toMatchObject({ hits: 1, total: 1 });
    expect(comparison.semanticMissRecovery).toMatchObject({
      hits: 0,
      total: 1,
    });
    expect(comparison.semanticBadTop1).toMatchObject({ hits: 1, total: 1 });
    expect(comparison.providerExpansion).toMatchObject({ hits: 1, total: 1 });
    expect(comparison.top1Regression).toMatchObject({ hits: 0, total: 1 });
  });

  it('supports legacy-to-hybrid ablation comparisons', () => {
    const report = compareAblations({
      legacy: [],
      datasets: [],
      fuzzy: [],
      semantic: [],
      full_hybrid: [],
    });
    expect(report.map((entry) => entry.mode)).toEqual([
      'legacy',
      'datasets',
      'fuzzy',
      'semantic',
      'full_hybrid',
    ]);
  });

  it('runs a selected split in corpus order and preserves supplied observations', async () => {
    const visited: string[] = [];
    const report = await runFoodRetrievalBenchmark({
      split: 'holdout',
      corpus: FOOD_RETRIEVAL_CORPUS,
      retrieve: async (query) => {
        visited.push(query.id);
        return observation(query.id, { latencyMs: 3 });
      },
    });

    expect(report.queryCount).toBe(40);
    expect(visited).toEqual(
      FOOD_RETRIEVAL_CORPUS.filter((query) => query.split === 'holdout').map(
        (query) => query.id,
      ),
    );
    expect(report.latencyMs.mean).toBe(3);
  });
});
