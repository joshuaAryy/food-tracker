import { FOOD_RETRIEVAL_CORPUS } from './corpus.js';
import { evaluateObservations } from './metrics.js';
import type {
  BenchmarkObservation,
  BenchmarkRun,
  BenchmarkSplit,
  FoodRetrievalBenchmarkQuery,
} from './types.js';

export type BenchmarkRetriever = (
  query: FoodRetrievalBenchmarkQuery,
) => BenchmarkObservation | Promise<BenchmarkObservation>;

export async function runFoodRetrievalBenchmark(input: {
  retrieve: BenchmarkRetriever;
  corpus?: readonly FoodRetrievalBenchmarkQuery[];
  split?: BenchmarkSplit | 'all';
}): Promise<BenchmarkRun> {
  const corpus = input.corpus ?? FOOD_RETRIEVAL_CORPUS;
  const split = input.split ?? 'all';
  const queries = corpus.filter(
    (query) => split === 'all' || query.split === split,
  );
  const observations: BenchmarkObservation[] = [];

  for (const query of queries) {
    const observation = await input.retrieve(query);
    if (observation.queryId !== query.id) {
      throw new Error(
        `Benchmark retriever returned queryId "${observation.queryId}" for "${query.id}".`,
      );
    }
    observations.push(observation);
  }

  return {
    split,
    observations,
    ...evaluateObservations(observations, corpus),
  };
}
