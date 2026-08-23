import { FOOD_RETRIEVAL_CORPUS } from './corpus.js';
import { deriveAcceptanceGates, evaluateObservations } from './metrics.js';
import type {
  AcceptanceGates,
  BenchmarkMetrics,
  BenchmarkObservation,
  BenchmarkSnapshot,
  BenchmarkSplit,
  FoodRetrievalBenchmarkQuery,
} from './types.js';

export interface LegacyBaselineReport {
  name: 'legacy';
  split: BenchmarkSplit | 'all';
  metrics: BenchmarkMetrics;
  gates: AcceptanceGates;
}

export function evaluateLegacyBaseline(input: {
  observations: readonly BenchmarkObservation[];
  corpus?: readonly FoodRetrievalBenchmarkQuery[];
  split?: BenchmarkSplit | 'all';
}): LegacyBaselineReport {
  const corpus = input.corpus ?? FOOD_RETRIEVAL_CORPUS;
  const split = input.split ?? 'all';
  const queryIds = new Set(
    corpus
      .filter((query) => split === 'all' || query.split === split)
      .map((query) => query.id),
  );
  const observations = input.observations.filter((observation) =>
    queryIds.has(observation.queryId),
  );
  const metrics = evaluateObservations(observations, corpus);
  return {
    name: 'legacy',
    split,
    metrics,
    gates: deriveAcceptanceGates(metrics),
  };
}

export function legacySnapshot(
  observations: readonly BenchmarkObservation[],
): BenchmarkSnapshot {
  return {
    benchmarkVersion: '2026-08-23',
    name: 'legacy',
    observations,
  };
}
