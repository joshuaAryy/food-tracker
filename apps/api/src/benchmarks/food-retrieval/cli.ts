import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { FOOD_RETRIEVAL_CORPUS } from './corpus.js';
import { compareBaselineToCandidate } from './ablation.js';
import {
  acceptanceGateViolations,
  deriveAcceptanceGates,
  evaluateObservations,
} from './metrics.js';
import type {
  BenchmarkCandidate,
  BenchmarkObservation,
  BenchmarkSnapshot,
  BenchmarkRunName,
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

function isRunName(value: unknown): value is BenchmarkRunName {
  return (
    value === 'legacy' ||
    value === 'datasets' ||
    value === 'fuzzy' ||
    value === 'semantic' ||
    value === 'full_hybrid'
  );
}

export function validateBenchmarkSnapshotCoverage(
  snapshot: BenchmarkSnapshot,
  corpus = FOOD_RETRIEVAL_CORPUS,
  split: BenchmarkSplit | 'all' = 'all',
): void {
  const allExpectedIds = new Set(corpus.map((query) => query.id));
  const expectedIds = new Set(
    corpus
      .filter((query) => split === 'all' || query.split === split)
      .map((query) => query.id),
  );
  const observedIds = snapshot.observations.map(
    (observation) => observation.queryId,
  );
  const observedForSplit = observedIds.filter((queryId) =>
    expectedIds.has(queryId),
  );
  const observedSet = new Set(observedForSplit);
  const duplicateIds = observedIds.filter(
    (queryId, index) => observedIds.indexOf(queryId) !== index,
  );
  const unknownIds = observedIds.filter(
    (queryId) => !allExpectedIds.has(queryId),
  );
  const missingIds = [...expectedIds].filter(
    (queryId) => !observedSet.has(queryId),
  );
  if (
    observedForSplit.length !== expectedIds.size ||
    duplicateIds.length > 0 ||
    unknownIds.length > 0 ||
    missingIds.length > 0
  ) {
    throw new Error(
      `Snapshot must contain exactly one observation for every ${split} benchmark query (expected ${expectedIds.size}; observed ${observedForSplit.length}; missing ${missingIds.length}; duplicate ${duplicateIds.length}; unknown ${unknownIds.length}).`,
    );
  }
}

function readSnapshot(
  path: string,
  split: BenchmarkSplit | 'all',
): BenchmarkSnapshot {
  const parsed: unknown = JSON.parse(readFileSync(path, 'utf8'));
  const runName = isRecord(parsed) ? parsed.name : null;
  if (
    !isRecord(parsed) ||
    parsed.benchmarkVersion !== '2026-08-23' ||
    !isRunName(runName) ||
    !Array.isArray(parsed.observations) ||
    !parsed.observations.every(isObservation)
  ) {
    throw new Error(
      'Snapshot must contain benchmarkVersion 2026-08-23, a supported run name, and valid observations.',
    );
  }
  const snapshot: BenchmarkSnapshot = {
    benchmarkVersion: '2026-08-23',
    name: runName,
    observations: parsed.observations,
  };
  validateBenchmarkSnapshotCoverage(snapshot, FOOD_RETRIEVAL_CORPUS, split);
  return snapshot;
}

function printHelp(): void {
  console.log(`Food retrieval benchmark CLI

Usage:
  pnpm benchmark:food-retrieval -- --snapshot <legacy-path> [--candidate <candidate-path>] [--split all|development|holdout] [--json]

Snapshots are recorded runs. With only --snapshot, the CLI evaluates the
legacy baseline. With --candidate, it additionally reports channel recovery,
semantic harm, provider expansion, regressions, and latency deltas. The CLI
never calls PostgreSQL or a provider.
`);
}

function parseArgs(args: readonly string[]): {
  snapshotPath: string | null;
  candidateSnapshotPath: string | null;
  split: BenchmarkSplit | 'all';
  json: boolean;
  help: boolean;
} {
  let snapshotPath: string | null = null;
  let candidateSnapshotPath: string | null = null;
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
    } else if (argument === '--candidate') {
      candidateSnapshotPath = args[index + 1] ?? null;
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
  return { snapshotPath, candidateSnapshotPath, split, json, help };
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
  const snapshot = readSnapshot(options.snapshotPath, options.split);
  if (snapshot.name !== 'legacy') {
    throw new Error('--snapshot must contain the legacy run.');
  }
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
  const candidateSnapshot =
    options.candidateSnapshotPath === null
      ? null
      : readSnapshot(options.candidateSnapshotPath, options.split);
  if (candidateSnapshot?.name === 'legacy') {
    throw new Error('--candidate must contain a non-legacy run.');
  }
  const comparison =
    candidateSnapshot === null
      ? null
      : compareBaselineToCandidate({
          baseline: observations,
          candidate: candidateSnapshot.observations.filter((observation) =>
            selectedIds.has(observation.queryId),
          ),
          corpus: FOOD_RETRIEVAL_CORPUS.filter((query) =>
            selectedIds.has(query.id),
          ),
        });
  const candidateViolations =
    comparison === null
      ? null
      : acceptanceGateViolations(comparison.candidate, gates);
  const report = {
    benchmarkVersion: '2026-08-23',
    split: options.split,
    metrics,
    gates,
    violations,
    candidateViolations,
    ...(comparison === null ? {} : { comparison }),
  };
  if (options.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(
      comparison === null
        ? `Legacy baseline (${options.split})`
        : `Legacy-to-candidate comparison (${options.split})`,
    );
    console.log(`Queries: ${metrics.queryCount}`);
    if (comparison === null) {
      console.log(
        `Top-1/3/5: ${metrics.topK.top1.hits}/${metrics.topK.top3.hits}/${metrics.topK.top5.hits}`,
      );
      console.log(
        `Top-1 misses: ${metrics.missSets.top1.join(', ') || 'none'}`,
      );
    } else {
      console.log(
        `Baseline Top-1/3/5: ${metrics.topK.top1.hits}/${metrics.topK.top3.hits}/${metrics.topK.top5.hits}`,
      );
      console.log(
        `Candidate Top-1/3/5: ${comparison.candidate.topK.top1.hits}/${comparison.candidate.topK.top3.hits}/${comparison.candidate.topK.top5.hits}`,
      );
      console.log(
        `Candidate Top-1 misses: ${comparison.candidate.missSets.top1.join(', ') || 'none'}`,
      );
    }
    console.log(
      `Acceptance gate violations: ${(candidateViolations ?? violations).join(', ') || 'none'}`,
    );
    if (comparison !== null) {
      console.log(
        `Fuzzy/semantic recovery: ${comparison.fuzzyMissRecovery.hits}/${comparison.fuzzyMissRecovery.total} / ${comparison.semanticMissRecovery.hits}/${comparison.semanticMissRecovery.total}`,
      );
      console.log(
        `Semantic bad Top-1: ${comparison.semanticBadTop1.hits}/${comparison.semanticBadTop1.total}; Top-1 regressions: ${comparison.top1Regression.hits}/${comparison.top1Regression.total}`,
      );
    }
  }
  return (candidateViolations ?? violations).length === 0 ? 0 : 2;
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
