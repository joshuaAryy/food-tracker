import { evaluateObservations } from './metrics.js';
import type { BenchmarkMetrics, BenchmarkObservation } from './types.js';

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
