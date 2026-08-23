import { FOOD_RETRIEVAL_CORPUS } from './corpus.js';
import {
  FOOD_RETRIEVAL_BENCHMARK_VERSION,
  type AcceptanceGates,
  type BenchmarkCandidate,
  type BenchmarkMetrics,
  type BenchmarkObservation,
  type CountMetric,
  type FoodRetrievalBenchmarkQuery,
} from './types.js';

function rate(hits: number, total: number): number {
  return total === 0 ? 0 : hits / total;
}

function countMetric(hits: number, total: number): CountMetric {
  return { hits, total, rate: rate(hits, total), misses: total - hits };
}

function normalized(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function candidateMatches(
  candidate: BenchmarkCandidate | undefined,
  query: FoodRetrievalBenchmarkQuery | undefined,
): boolean {
  if (candidate === undefined) return false;
  if (candidate.matchesExpected !== undefined) {
    return candidate.matchesExpected;
  }
  if (query === undefined) return false;
  const expected = [
    query.gold.canonicalName,
    ...(query.gold.aliases ?? []),
  ].map(normalized);
  return expected.includes(normalized(candidate.name));
}

function selectedCandidate(
  observation: BenchmarkObservation,
): BenchmarkCandidate | undefined {
  if (observation.selectedCandidateId === null) return undefined;
  return observation.candidates.find(
    (candidate) => candidate.id === observation.selectedCandidateId,
  );
}

function topKHit(
  observation: BenchmarkObservation,
  query: FoodRetrievalBenchmarkQuery | undefined,
  size: number,
): boolean {
  return observation.candidates
    .slice(0, size)
    .some((candidate) => candidateMatches(candidate, query));
}

function percentile(
  values: readonly number[],
  percentileValue: number,
): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const rank = Math.max(1, Math.ceil(sorted.length * percentileValue));
  return sorted[rank - 1] ?? 0;
}

function duplicateCandidateCount(observation: BenchmarkObservation): number {
  const keys = new Set<string>();
  for (const candidate of observation.candidates) {
    keys.add(
      candidate.duplicateKey ??
        `${candidate.provider ?? 'unknown'}:${normalized(candidate.name)}`,
    );
  }
  return observation.candidates.length - keys.size;
}

function duplicateQueryCount(
  observations: readonly BenchmarkObservation[],
  corpus: readonly FoodRetrievalBenchmarkQuery[],
): number {
  const queryById = new Map(corpus.map((query) => [query.id, query]));
  const seen = new Set<string>();
  let duplicates = 0;
  for (const observation of observations) {
    const query = queryById.get(observation.queryId);
    if (query === undefined) continue;
    const key = normalized(query.query);
    if (seen.has(key)) duplicates += 1;
    seen.add(key);
  }
  return duplicates;
}

export function evaluateObservations(
  observations: readonly BenchmarkObservation[],
  corpus: readonly FoodRetrievalBenchmarkQuery[] = FOOD_RETRIEVAL_CORPUS,
): BenchmarkMetrics {
  const queryById = new Map(corpus.map((query) => [query.id, query]));
  const top1Misses: string[] = [];
  const top3Misses: string[] = [];
  const top5Misses: string[] = [];
  let top1Hits = 0;
  let top3Hits = 0;
  let top5Hits = 0;
  let unsafeDefaultSelections = 0;
  let semanticOrFuzzyOnlyTrustedSelections = 0;
  let historicalSnapshotMutations = 0;
  let privateVectors = 0;
  let duplicateCandidates = 0;
  let trustedSelections = 0;
  let safeTrustedSelections = 0;
  let normalSearchHits = 0;
  let normalSearchTotal = 0;
  let externalCalls = 0;
  let queriesWithCalls = 0;
  let pineconeCalls = 0;
  let maxPineconeCallsPerQuery = 0;
  let bulkProviderCalls = 0;
  const latencyValues: number[] = [];
  const providerTotals = new Map<string, { hits: number; total: number }>();
  const classTotals = new Map<string, { hits: number; total: number }>();

  for (const observation of observations) {
    const query = queryById.get(observation.queryId);
    const isTop1 = topKHit(observation, query, 1);
    const isTop3 = topKHit(observation, query, 3);
    const isTop5 = topKHit(observation, query, 5);
    if (isTop1) top1Hits += 1;
    else top1Misses.push(observation.queryId);
    if (isTop3) top3Hits += 1;
    else top3Misses.push(observation.queryId);
    if (isTop5) top5Hits += 1;
    else top5Misses.push(observation.queryId);

    const selected = selectedCandidate(observation);
    if (
      observation.unsafeDefaultSelection === true ||
      (query?.requiresSafeDefault === true &&
        selected?.defaultSelectionSafe === false)
    ) {
      unsafeDefaultSelections += 1;
    }
    if (selected?.trusted === true) {
      trustedSelections += 1;
      if (selected.defaultSelectionSafe !== false) safeTrustedSelections += 1;
      if (selected.evidence === 'semantic' || selected.evidence === 'fuzzy') {
        semanticOrFuzzyOnlyTrustedSelections += 1;
      }
    }
    if (observation.historicalSnapshotMutated) historicalSnapshotMutations += 1;
    privateVectors += observation.privateVectorCount;
    duplicateCandidates += duplicateCandidateCount(observation);

    if (query?.normalSearch === true) {
      normalSearchTotal += 1;
      if (isTop3) normalSearchHits += 1;
    }

    const provider = query?.gold.expectedProvider;
    if (provider !== undefined) {
      const current = providerTotals.get(provider) ?? { hits: 0, total: 0 };
      current.total += 1;
      if (
        observation.candidates
          .slice(0, 5)
          .some(
            (candidate) =>
              candidate.provider === provider &&
              candidateMatches(candidate, query),
          )
      ) {
        current.hits += 1;
      }
      providerTotals.set(provider, current);
    }
    if (query !== undefined) {
      const current = classTotals.get(query.queryClass) ?? {
        hits: 0,
        total: 0,
      };
      current.total += 1;
      if (isTop1) current.hits += 1;
      classTotals.set(query.queryClass, current);
    }

    latencyValues.push(Math.max(0, observation.latencyMs));
    const callCount = Math.max(0, observation.externalCallCount);
    externalCalls += callCount;
    if (callCount > 0) queriesWithCalls += 1;
    pineconeCalls += Math.max(0, observation.pineconeCallCount);
    maxPineconeCallsPerQuery = Math.max(
      maxPineconeCallsPerQuery,
      Math.max(0, observation.pineconeCallCount),
    );
    bulkProviderCalls += Math.max(0, observation.bulkProviderCallCount);
  }

  const providerCoverage: Record<string, CountMetric> = {};
  for (const [provider, values] of [...providerTotals].sort(([left], [right]) =>
    left.localeCompare(right),
  )) {
    providerCoverage[provider] = countMetric(values.hits, values.total);
  }
  const classTop1: BenchmarkMetrics['classTop1'] = {};
  for (const [queryClass, values] of [...classTotals].sort(([left], [right]) =>
    left.localeCompare(right),
  )) {
    classTop1[queryClass as keyof BenchmarkMetrics['classTop1']] = countMetric(
      values.hits,
      values.total,
    );
  }

  return {
    benchmarkVersion: FOOD_RETRIEVAL_BENCHMARK_VERSION,
    queryCount: observations.length,
    topK: {
      top1: countMetric(top1Hits, observations.length),
      top3: countMetric(top3Hits, observations.length),
      top5: countMetric(top5Hits, observations.length),
    },
    safety: {
      unsafeDefaultSelections,
      semanticOrFuzzyOnlyTrustedSelections,
      historicalSnapshotMutations,
      privateVectors,
    },
    duplicates: {
      duplicateQueries: duplicateQueryCount(observations, corpus),
      duplicateCandidates,
    },
    trustedBehavior: {
      trustedSelections,
      safeTrustedSelections,
      trustedSelectionRate: rate(trustedSelections, observations.length),
    },
    providerCoverage,
    latencyMs: {
      mean:
        latencyValues.length === 0
          ? 0
          : latencyValues.reduce((sum, value) => sum + value, 0) /
            latencyValues.length,
      p50: percentile(latencyValues, 0.5),
      p95: percentile(latencyValues, 0.95),
      max: latencyValues.length === 0 ? 0 : Math.max(...latencyValues),
    },
    externalCalls: {
      total: externalCalls,
      queriesWithCalls,
      pineconeCalls,
      maxPineconeCallsPerQuery,
      bulkProviderCalls,
    },
    normalSearchCoverage: countMetric(normalSearchHits, normalSearchTotal),
    classTop1,
    missSets: {
      top1: top1Misses,
      top3: top3Misses,
      top5: top5Misses,
    },
  };
}

export function deriveAcceptanceGates(
  baseline: BenchmarkMetrics,
): AcceptanceGates {
  const classTop1Floors: AcceptanceGates['classTop1Floors'] = {};
  for (const [queryClass, metric] of Object.entries(baseline.classTop1)) {
    if (metric !== undefined) {
      classTop1Floors[queryClass as keyof AcceptanceGates['classTop1Floors']] =
        metric.hits;
    }
  }
  return {
    baselineQueryCount: baseline.queryCount,
    minimumTop1Hits: baseline.topK.top1.hits,
    minimumTop3Hits: baseline.topK.top3.hits,
    minimumTop5Hits: baseline.topK.top5.hits,
    minimumNormalSearchCoverageHits: baseline.normalSearchCoverage.hits,
    classTop1Floors,
    maximumUnsafeDefaultSelections: 0,
    maximumSemanticOrFuzzyOnlyTrustedSelections: 0,
    maximumHistoricalSnapshotMutations: 0,
    maximumPrivateVectors: 0,
    maximumPineconeCallsPerQuery: 1,
    maximumBulkProviderCalls: 0,
    baselineMissSets: baseline.missSets,
  };
}

export function acceptanceGateViolations(
  metrics: BenchmarkMetrics,
  gates: AcceptanceGates,
): string[] {
  const violations: string[] = [];
  if (metrics.topK.top1.hits < gates.minimumTop1Hits)
    violations.push('top1_floor');
  if (metrics.topK.top3.hits < gates.minimumTop3Hits)
    violations.push('top3_floor');
  if (metrics.topK.top5.hits < gates.minimumTop5Hits)
    violations.push('top5_floor');
  if (
    metrics.normalSearchCoverage.hits < gates.minimumNormalSearchCoverageHits
  ) {
    violations.push('normal_search_coverage_floor');
  }
  if (
    metrics.safety.unsafeDefaultSelections >
    gates.maximumUnsafeDefaultSelections
  ) {
    violations.push('unsafe_default_selection');
  }
  if (
    metrics.safety.semanticOrFuzzyOnlyTrustedSelections >
    gates.maximumSemanticOrFuzzyOnlyTrustedSelections
  ) {
    violations.push('semantic_or_fuzzy_only_trusted_selection');
  }
  if (
    metrics.safety.historicalSnapshotMutations >
    gates.maximumHistoricalSnapshotMutations
  ) {
    violations.push('historical_snapshot_mutation');
  }
  if (metrics.safety.privateVectors > gates.maximumPrivateVectors) {
    violations.push('private_vector');
  }
  if (
    metrics.externalCalls.maxPineconeCallsPerQuery >
    gates.maximumPineconeCallsPerQuery
  ) {
    violations.push('pinecone_call_limit');
  }
  if (
    metrics.externalCalls.bulkProviderCalls > gates.maximumBulkProviderCalls
  ) {
    violations.push('bulk_provider_runtime_call');
  }
  for (const [queryClass, minimumHits] of Object.entries(
    gates.classTop1Floors,
  )) {
    const actual =
      metrics.classTop1[queryClass as keyof BenchmarkMetrics['classTop1']];
    if ((actual?.hits ?? 0) < minimumHits) {
      violations.push(`class_top1_floor:${queryClass}`);
    }
  }
  return violations;
}
