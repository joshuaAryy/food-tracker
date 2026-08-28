import { writeFile } from 'node:fs/promises';
import { prisma } from '../../lib/prisma.js';
import {
  FOOD_RETRIEVAL_CORPUS,
  runFoodRetrievalBenchmark,
  retrieveLiveBenchmarkObservation,
  type BenchmarkSnapshot,
  type BenchmarkRunName,
  type BenchmarkObservation,
  type BenchmarkSplit,
  type LiveBenchmarkMode,
} from './index.js';

function argument(name: string, fallback: string | null = null): string | null {
  const index = process.argv.indexOf(name);
  return index < 0 ? fallback : (process.argv[index + 1] ?? fallback);
}

function parseMode(value: string | null): LiveBenchmarkMode {
  if (
    value === 'legacy' ||
    value === 'datasets' ||
    value === 'fuzzy' ||
    value === 'semantic' ||
    value === 'full_hybrid'
  ) {
    return value;
  }
  throw new Error(
    '--mode must be legacy, datasets, fuzzy, semantic, or full_hybrid',
  );
}

function parseSplit(value: string | null): BenchmarkSplit | 'all' {
  if (value === 'development' || value === 'holdout' || value === 'all') {
    return value;
  }
  throw new Error('--split must be all, development, or holdout');
}

function printHelp(): void {
  console.log(`Live food retrieval benchmark

Usage:
  pnpm benchmark:food-retrieval-live -- --mode legacy --split development --output /tmp/legacy.json

The live adapter reads PostgreSQL FoodItems, applies the selected channel
ablation, and writes a snapshot for only the selected split. It never mutates
FoodItems or FoodLogs and never makes bulk-provider runtime calls.

Use a dedicated real-catalog database such as food_tracker_benchmark_test for
live runs. Ordinary Vitest continues using food_tracker_test and resets it.
`);
}

export function benchmarkSnapshotForObservations(
  mode: BenchmarkRunName,
  observations: readonly BenchmarkObservation[],
): BenchmarkSnapshot {
  return {
    benchmarkVersion: '2026-08-23',
    name: mode,
    observations,
  };
}

async function main(): Promise<void> {
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    printHelp();
    return;
  }
  const mode = parseMode(argument('--mode', 'legacy'));
  const split = parseSplit(argument('--split', 'all'));
  const output = argument('--output');
  const run = await runFoodRetrievalBenchmark({
    corpus: FOOD_RETRIEVAL_CORPUS,
    split,
    retrieve: (query) =>
      retrieveLiveBenchmarkObservation({
        prisma,
        query,
        mode,
      }),
  });
  const snapshot = benchmarkSnapshotForObservations(mode, run.observations);
  if (output === null) {
    console.log(
      JSON.stringify({ mode, split, metrics: run, snapshot }, null, 2),
    );
    return;
  }
  await writeFile(output, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');
  console.log(
    JSON.stringify({
      mode,
      split,
      output,
      queryCount: run.queryCount,
      top1: run.topK.top1,
      top3: run.topK.top3,
      top5: run.topK.top5,
      p50: run.latencyMs.p50,
      p95: run.latencyMs.p95,
      pineconeCalls: run.externalCalls.pineconeCalls,
    }),
  );
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
