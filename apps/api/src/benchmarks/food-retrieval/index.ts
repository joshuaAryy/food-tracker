export { FOOD_RETRIEVAL_CORPUS } from './corpus.js';
export {
  acceptanceGateViolations,
  deriveAcceptanceGates,
  evaluateObservations,
} from './metrics.js';
export { runFoodRetrievalBenchmark } from './harness.js';
export {
  compareAblations,
  compareBaselineToCandidate,
  type AblationReport,
  type RetrievalAblation,
} from './ablation.js';
export { evaluateLegacyBaseline, legacySnapshot } from './legacy-baseline.js';
export {
  FOOD_RETRIEVAL_BENCHMARK_VERSION,
  type AcceptanceGates,
  type BenchmarkCandidate,
  type BenchmarkEvidence,
  type BenchmarkMetrics,
  type BenchmarkObservation,
  type BenchmarkRun,
  type BenchmarkRunName,
  type BenchmarkSnapshot,
  type BenchmarkSplit,
  type BenchmarkQueryTag,
  type CountMetric,
  type FoodRetrievalBenchmarkQuery,
  type RetrievalComparison,
} from './types.js';
