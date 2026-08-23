import {
  candidateMatchesExpected,
  evaluateObservations,
  topKHit,
} from './metrics.js';
import type {
  BenchmarkMetrics,
  BenchmarkObservation,
  CountMetric,
  FoodRetrievalBenchmarkQuery,
  RetrievalComparison,
} from './types.js';

export type RetrievalAblation =
  | 'legacy'
  | 'datasets'
  | 'fuzzy'
  | 'semantic'
  | 'full_hybrid';

export interface AblationReport {
  mode: RetrievalAblation;
  metrics: BenchmarkMetrics;
}

export function compareAblations(
  observations: Readonly<
    Record<RetrievalAblation, readonly BenchmarkObservation[]>
  >,
): AblationReport[] {
  return (
    ['legacy', 'datasets', 'fuzzy', 'semantic', 'full_hybrid'] as const
  ).map((mode) => ({
    mode,
    metrics: evaluateObservations(observations[mode] ?? []),
  }));
}

function countMetric(hits: number, total: number): CountMetric {
  return {
    hits,
    total,
    rate: total === 0 ? 0 : hits / total,
    misses: total - hits,
  };
}

function observationMap(
  observations: readonly BenchmarkObservation[],
): Map<string, BenchmarkObservation> {
  return new Map(
    observations.map((observation) => [observation.queryId, observation]),
  );
}

function matchingCandidateWithEvidence(
  observation: BenchmarkObservation,
  query: FoodRetrievalBenchmarkQuery,
  size: number,
  evidence: 'fuzzy' | 'semantic',
): boolean {
  return observation.candidates
    .slice(0, size)
    .some(
      (candidate) =>
        candidate.evidence === evidence &&
        candidateMatchesExpected(candidate, query),
    );
}

export function compareBaselineToCandidate(input: {
  baseline: readonly BenchmarkObservation[];
  candidate: readonly BenchmarkObservation[];
  corpus: readonly FoodRetrievalBenchmarkQuery[];
}): RetrievalComparison {
  const baselineMetrics = evaluateObservations(input.baseline, input.corpus);
  const candidateMetrics = evaluateObservations(input.candidate, input.corpus);
  const baselineById = observationMap(input.baseline);
  const candidateById = observationMap(input.candidate);
  const baselineMisses = input.corpus.filter((query) => {
    const observation = baselineById.get(query.id);
    return observation !== undefined && !topKHit(observation, query, 3);
  });
  let fuzzyRecovery = 0;
  let semanticRecovery = 0;
  let semanticBadTop1 = 0;
  let providerExpansion = 0;
  let top1Regression = 0;
  for (const query of input.corpus) {
    const baseline = baselineById.get(query.id);
    const candidate = candidateById.get(query.id);
    if (baseline === undefined || candidate === undefined) continue;
    if (topKHit(baseline, query, 1) && !topKHit(candidate, query, 1)) {
      top1Regression += 1;
    }
    if (!topKHit(baseline, query, 3) && topKHit(candidate, query, 3)) {
      if (matchingCandidateWithEvidence(candidate, query, 3, 'fuzzy'))
        fuzzyRecovery += 1;
      if (matchingCandidateWithEvidence(candidate, query, 3, 'semantic'))
        semanticRecovery += 1;
    }
    const top = candidate.candidates[0];
    const deterministicExpectedBelow = candidate.candidates
      .slice(1)
      .some(
        (item) =>
          (item.evidence === undefined ||
            item.evidence === 'exact' ||
            item.evidence === 'none') &&
          candidateMatchesExpected(item, query),
      );
    if (
      top?.evidence === 'semantic' &&
      !candidateMatchesExpected(top, query) &&
      deterministicExpectedBelow
    ) {
      semanticBadTop1 += 1;
    }
    const expectedProvider = query.gold.expectedProvider;
    if (expectedProvider !== undefined) {
      const baselineProviderHit = baseline.candidates
        .slice(0, 5)
        .some(
          (item) =>
            item.provider === expectedProvider &&
            candidateMatchesExpected(item, query),
        );
      const candidateProviderHit = candidate.candidates
        .slice(0, 5)
        .some(
          (item) =>
            item.provider === expectedProvider &&
            candidateMatchesExpected(item, query),
        );
      if (!baselineProviderHit && candidateProviderHit) providerExpansion += 1;
    }
  }
  return {
    baseline: baselineMetrics,
    candidate: candidateMetrics,
    fuzzyMissRecovery: countMetric(fuzzyRecovery, baselineMisses.length),
    semanticMissRecovery: countMetric(semanticRecovery, baselineMisses.length),
    semanticBadTop1: countMetric(semanticBadTop1, input.candidate.length),
    providerExpansion: countMetric(providerExpansion, input.corpus.length),
    top1Regression: countMetric(top1Regression, input.corpus.length),
    latencyDeltaMs: {
      p50: candidateMetrics.latencyMs.p50 - baselineMetrics.latencyMs.p50,
      p95: candidateMetrics.latencyMs.p95 - baselineMetrics.latencyMs.p95,
    },
  };
}
