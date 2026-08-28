import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: [
      'test/food-retrieval-benchmark.test.ts',
      'test/food-provider-retrieval.test.ts',
      'test/candidate-ranking-alias.test.ts',
      'test/candidate-ranking.test.ts',
    ],
    fileParallelism: false,
    maxWorkers: 1,
    testTimeout: 15_000,
  },
});
