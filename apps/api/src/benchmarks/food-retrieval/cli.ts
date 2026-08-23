import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { FOOD_RETRIEVAL_CORPUS } from './corpus.js';
import {
  acceptanceGateViolations,
  deriveAcceptanceGates,
  evaluateObservations,
} from './metrics.js';
import type {
  BenchmarkCandidate,
  BenchmarkObservation,
  BenchmarkSnapshot,
  BenchmarkSplit,
} from './types.js';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isCandidate(value: unknown): value is BenchmarkCandidate {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    (value.provider === null || typeof value.provider === 'string') &&
    typeof value.source === 'string' &&
    typeof value.trusted === 'boolean'
  );
}

function isObservation(value: unknown): value is BenchmarkObservation {
  return (
    isRecord(value) &&
    typeof value.queryId === 'string' &&
    Array.isArray(value.candidates) &&
    value.candidates.every(isCandidate) &&
    (value.selectedCandidateId === null ||
      typeof value.selectedCandidateId === 'string') &&
    typeof value.latencyMs === 'number' &&
    typeof value.externalCallCount === 'number' &&
    typeof value.pineconeCallCount === 'number' &&
    typeof value.bulkProviderCallCount === 'number' &&
    typeof value.historicalSnapshotMutated === 'boolean' &&
    typeof value.privateVectorCount === 'number'
  );
}

function readSnapshot(path: string): BenchmarkSnapshot {
  const parsed: unknown = JSON.parse(readFileSync(path, 'utf8'));
  if (
    !isRecord(parsed) ||
    parsed.benchmarkVersion !== '2026-08-23' ||
    parsed.name !== 'legacy' ||
    !Array.isArray(parsed.observations) ||
    !parsed.observations.every(isObservation)
  ) {
    throw new Error(
      'Snapshot must contain benchmarkVersion 2026-08-23, name legacy, and valid observations.',
    );
  }
  return {
    benchmarkVersion: '2026-08-23',
    name: 'legacy',
    observations: parsed.observations,
  };
}

function printHelp(): void {
  console.log(`Food retrieval benchmark CLI

Usage:
  pnpm benchmark:food-retrieval -- --snapshot <path> [--split all|development|holdout] [--json]

The snapshot is a recorded legacy run. The CLI never calls PostgreSQL or a
provider; it evaluates the supplied observations and prints baseline-derived
acceptance gates.
`);
}

function parseArgs(args: readonly string[]): {
  snapshotPath: string | null;
  split: BenchmarkSplit | 'all';
  json: boolean;
  help: boolean;
} {
  let snapshotPath: string | null = null;
  let split: BenchmarkSplit | 'all' = 'all';
  let json = false;
  let help = false;
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === '--') {
      continue;
    }
    if (argument === '--help' || argument === '-h') {
      help = true;
    } else if (argument === '--json') {
      json = true;
    } else if (argument === '--snapshot') {
      snapshotPath = args[index + 1] ?? null;
      index += 1;
    } else if (argument === '--split') {
      const value = args[index + 1];
      index += 1;
      if (value !== 'all' && value !== 'development' && value !== 'holdout') {
        throw new Error('--split must be all, development, or holdout.');
      }
      split = value;
    } else {
      throw new Error(`Unknown argument: ${argument}`);
    }
  }
  return { snapshotPath, split, json, help };
}

export function runFoodRetrievalBenchmarkCli(args: readonly string[]): number {
  const options = parseArgs(args);
  if (options.help) {
    printHelp();
    return 0;
  }
  if (options.snapshotPath === null) {
    throw new Error('--snapshot is required. Use --help for usage.');
  }
  const snapshot = readSnapshot(options.snapshotPath);
  const selectedIds = new Set(
    FOOD_RETRIEVAL_CORPUS.filter(
      (query) => options.split === 'all' || query.split === options.split,
    ).map((query) => query.id),
  );
  const observations = snapshot.observations.filter((observation) =>
    selectedIds.has(observation.queryId),
  );
  const metrics = evaluateObservations(observations, FOOD_RETRIEVAL_CORPUS);
  const gates = deriveAcceptanceGates(metrics);
  const violations = acceptanceGateViolations(metrics, gates);
  const report = {
    benchmarkVersion: '2026-08-23',
    split: options.split,
    metrics,
    gates,
    violations,
  };
  if (options.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(`Legacy baseline (${options.split})`);
    console.log(`Queries: ${metrics.queryCount}`);
    console.log(
      `Top-1/3/5: ${metrics.topK.top1.hits}/${metrics.topK.top3.hits}/${metrics.topK.top5.hits}`,
    );
    console.log(`Top-1 misses: ${metrics.missSets.top1.join(', ') || 'none'}`);
    console.log(
      `Acceptance gate violations: ${violations.join(', ') || 'none'}`,
    );
  }
  return violations.length === 0 ? 0 : 2;
}

if (process.argv[1] !== undefined) {
  const currentFile = pathToFileURL(process.argv[1]).href;
  if (import.meta.url === currentFile) {
    try {
      process.exitCode = runFoodRetrievalBenchmarkCli(process.argv.slice(2));
    } catch (error) {
      console.error(error instanceof Error ? error.message : error);
      process.exitCode = 1;
    }
  }
}
