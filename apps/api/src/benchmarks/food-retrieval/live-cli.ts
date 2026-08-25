import { writeFile } from 'node:fs/promises';
import { prisma } from '../../lib/prisma.js';
import {
  FOOD_RETRIEVAL_CORPUS,
  evaluateObservations,
  runFoodRetrievalBenchmark,
  retrieveLiveBenchmarkObservation,
  type BenchmarkSnapshot,
  type BenchmarkRunName,
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
ablation, and writes a complete reviewed-corpus snapshot. It never mutates
FoodItems or FoodLogs and never makes bulk-provider runtime calls.
`);
}

async function main(): Promise<void> {
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    printHelp();
    return;
  }
  const mode = parseMode(argument('--mode', 'legacy'));
  const split = parseSplit(argument('--split', 'all'));
  const output = argument('--output');
  // Always record a complete corpus snapshot. The split is an evaluation
  // view, not a reason to write a partial artifact that cannot be validated
  // or compared later.
  const fullRun = await runFoodRetrievalBenchmark({
    corpus: FOOD_RETRIEVAL_CORPUS,
    split: 'all',
    retrieve: (query) =>
      retrieveLiveBenchmarkObservation({
        prisma,
        query,
        mode,
      }),
  });
  const selectedIds = new Set(
    FOOD_RETRIEVAL_CORPUS.filter(
      (query) => split === 'all' || query.split === split,
    ).map((query) => query.id),
  );
  const run = {
    split,
    observations: fullRun.observations.filter((observation) =>
      selectedIds.has(observation.queryId),
    ),
    ...evaluateObservations(
      fullRun.observations.filter((observation) =>
        selectedIds.has(observation.queryId),
      ),
      FOOD_RETRIEVAL_CORPUS,
    ),
  };
  const snapshot: BenchmarkSnapshot = {
    benchmarkVersion: '2026-08-23',
    name: mode as BenchmarkRunName,
    observations: run.observations,
  };
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
