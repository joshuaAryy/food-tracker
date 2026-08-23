export const FOOD_RETRIEVAL_BENCHMARK_VERSION = '2026-08-23' as const;

export type BenchmarkSplit = 'development' | 'holdout';

export type BenchmarkQueryClass =
  | 'exact'
  | 'branded'
  | 'preparation'
  | 'semantic'
  | 'normal';

export type BenchmarkQueryTag =
  | 'exact_generic'
  | 'exact_branded'
  | 'misspelling'
  | 'abbreviation'
  | 'semantic_descriptive'
  | 'preparation_form'
  | 'compound'
  | 'regional_terminology'
  | 'ambiguous'
  | 'messy_fragment'
  | 'barcode';

export interface BenchmarkGoldLabel {
  canonicalName: string;
  aliases?: readonly string[];
  expectedProvider?: string;
  expectedSourceId?: string;
}

export interface FoodRetrievalBenchmarkQuery {
  id: string;
  query: string;
  split: BenchmarkSplit;
  queryClass: BenchmarkQueryClass;
  tags: readonly BenchmarkQueryTag[];
  gold: BenchmarkGoldLabel;
  normalSearch: boolean;
  requiresSafeDefault: boolean;
}

export type BenchmarkEvidence = 'exact' | 'fuzzy' | 'semantic' | 'none';

export interface BenchmarkCandidate {
  id: string;
  name: string;
  provider: string | null;
  source: string;
  trusted: boolean;
  matchesExpected?: boolean;
  evidence?: BenchmarkEvidence;
  defaultSelectionSafe?: boolean;
  duplicateKey?: string;
}

export interface BenchmarkObservation {
  queryId: string;
  candidates: readonly BenchmarkCandidate[];
  selectedCandidateId: string | null;
  latencyMs: number;
  externalCallCount: number;
  pineconeCallCount: number;
  bulkProviderCallCount: number;
  historicalSnapshotMutated: boolean;
  privateVectorCount: number;
  unsafeDefaultSelection?: boolean;
}

export interface CountMetric {
  hits: number;
  total: number;
  rate: number;
  misses: number;
}

export interface BenchmarkMetrics {
  benchmarkVersion: typeof FOOD_RETRIEVAL_BENCHMARK_VERSION;
  queryCount: number;
  topK: {
    top1: CountMetric;
    top3: CountMetric;
    top5: CountMetric;
  };
  safety: {
    unsafeDefaultSelections: number;
    semanticOrFuzzyOnlyTrustedSelections: number;
    historicalSnapshotMutations: number;
    privateVectors: number;
  };
  duplicates: {
    duplicateQueries: number;
    duplicateCandidates: number;
  };
  trustedBehavior: {
    trustedSelections: number;
    safeTrustedSelections: number;
    trustedSelectionRate: number;
  };
  providerCoverage: Record<string, CountMetric>;
  latencyMs: {
    mean: number;
    p50: number;
    p95: number;
    max: number;
  };
  externalCalls: {
    total: number;
    queriesWithCalls: number;
    pineconeCalls: number;
    maxPineconeCallsPerQuery: number;
    bulkProviderCalls: number;
  };
  normalSearchCoverage: CountMetric;
  classTop1: Partial<Record<BenchmarkQueryClass, CountMetric>>;
  missSets: {
    top1: string[];
    top3: string[];
    top5: string[];
  };
}

export interface AcceptanceGates {
  baselineQueryCount: number;
  minimumTop1Hits: number;
  minimumTop3Hits: number;
  minimumTop5Hits: number;
  minimumNormalSearchCoverageHits: number;
  classTop1Floors: Partial<Record<BenchmarkQueryClass, number>>;
  maximumUnsafeDefaultSelections: 0;
  maximumSemanticOrFuzzyOnlyTrustedSelections: 0;
  maximumHistoricalSnapshotMutations: 0;
  maximumPrivateVectors: 0;
  maximumPineconeCallsPerQuery: 1;
  maximumBulkProviderCalls: 0;
  baselineMissSets: BenchmarkMetrics['missSets'];
}

export interface BenchmarkRun extends BenchmarkMetrics {
  split: BenchmarkSplit | 'all';
  observations: readonly BenchmarkObservation[];
}

export interface RetrievalComparison {
  baseline: BenchmarkMetrics;
  candidate: BenchmarkMetrics;
  fuzzyMissRecovery: CountMetric;
  semanticMissRecovery: CountMetric;
  semanticBadTop1: CountMetric;
  providerExpansion: CountMetric;
  top1Regression: CountMetric;
  latencyDeltaMs: {
    p50: number;
    p95: number;
  };
}

export interface BenchmarkSnapshot {
  benchmarkVersion: typeof FOOD_RETRIEVAL_BENCHMARK_VERSION;
  name: 'legacy';
  observations: readonly BenchmarkObservation[];
}
