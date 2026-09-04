import { AppError } from './errors.js';
import { emitServerDiagnostic } from './diagnostics.js';

export const DATABASE_READINESS_MAX_ATTEMPTS = 5;
export const DATABASE_READINESS_MAX_ELAPSED_MS = 4_000;
export const DATABASE_READINESS_CACHE_MS = 15_000;
export const DATABASE_READINESS_RETRY_DELAYS_MS = [
  250, 500, 1_000, 1_500,
] as const;

const TRANSIENT_PRISMA_ERROR_CODES = new Set([
  'P1001',
  'P1002',
  'P1008',
  'P1017',
  'P2024',
]);

const TRANSIENT_TRANSPORT_ERROR_CODES = new Set([
  'ECONNABORTED',
  'ECONNREFUSED',
  'ECONNRESET',
  'ETIMEDOUT',
  'EPIPE',
]);

export interface DatabaseReadiness {
  ensureReady(): Promise<void>;
}

export interface DatabaseReadinessOptions {
  probe: () => Promise<void>;
  cacheMs?: number;
  maxAttempts?: number;
  maxElapsedMs?: number;
  retryDelaysMs?: readonly number[];
  now?: () => number;
  sleep?: (delayMs: number) => Promise<void>;
  emitDiagnostic?: (category: string, details: Record<string, unknown>) => void;
}

export class DatabaseReadinessError extends AppError {
  constructor() {
    super(
      503,
      'DATABASE_NOT_READY',
      'The database is temporarily unavailable. Please try again.',
      { retryable: true },
    );
  }
}

function errorCode(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null) return undefined;
  const details = error as { code?: unknown; errorCode?: unknown };
  if (typeof details.errorCode === 'string') return details.errorCode;
  if (typeof details.code === 'string') return details.code;
  return undefined;
}

export function isTransientDatabaseReadinessError(error: unknown): boolean {
  const code = errorCode(error);
  return (
    (code !== undefined && TRANSIENT_PRISMA_ERROR_CODES.has(code)) ||
    (code !== undefined && TRANSIENT_TRANSPORT_ERROR_CODES.has(code))
  );
}

function failureCategory(error: unknown): string {
  return errorCode(error) ?? 'non_transient';
}

function defaultSleep(delayMs: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, delayMs));
}

export function createDatabaseReadiness(
  options: DatabaseReadinessOptions,
): DatabaseReadiness {
  const cacheMs = Math.max(0, options.cacheMs ?? DATABASE_READINESS_CACHE_MS);
  const maxAttempts = Math.max(
    1,
    Math.floor(options.maxAttempts ?? DATABASE_READINESS_MAX_ATTEMPTS),
  );
  const maxElapsedMs = Math.max(
    0,
    options.maxElapsedMs ?? DATABASE_READINESS_MAX_ELAPSED_MS,
  );
  const retryDelaysMs =
    options.retryDelaysMs ?? DATABASE_READINESS_RETRY_DELAYS_MS;
  const now = options.now ?? Date.now;
  const sleep = options.sleep ?? defaultSleep;
  const emitDiagnostic =
    options.emitDiagnostic ??
    ((category, details) => emitServerDiagnostic(category, details));

  let readyAt: number | undefined;
  let inFlight: Promise<void> | undefined;

  async function recover(): Promise<void> {
    const startedAt = now();
    const deadline = startedAt + maxElapsedMs;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        await options.probe();
        readyAt = now();
        emitDiagnostic('database_readiness_recovered', {
          operation: 'database_readiness',
          attempt,
          elapsedMs: now() - startedAt,
          retryable: true,
        });
        return;
      } catch (error) {
        const elapsedMs = now() - startedAt;
        const transient = isTransientDatabaseReadinessError(error);
        const remainingMs = deadline - now();
        const retryDelayMs = retryDelaysMs[attempt - 1];

        if (
          !transient ||
          attempt >= maxAttempts ||
          remainingMs <= 0 ||
          retryDelayMs === undefined
        ) {
          emitDiagnostic('database_readiness_exhausted', {
            operation: 'database_readiness',
            attempt,
            elapsedMs,
            errorCategory: failureCategory(error),
            retryable: transient,
          });
          if (transient) throw new DatabaseReadinessError();
          throw error;
        }

        const delayMs = Math.min(Math.max(0, retryDelayMs), remainingMs);
        emitDiagnostic('database_readiness_retry', {
          operation: 'database_readiness',
          attempt,
          elapsedMs,
          errorCategory: failureCategory(error),
          retryable: true,
        });
        await sleep(delayMs);
      }
    }
  }

  return {
    ensureReady(): Promise<void> {
      const currentTime = now();
      if (
        readyAt !== undefined &&
        currentTime >= readyAt &&
        currentTime - readyAt < cacheMs
      ) {
        return Promise.resolve();
      }
      if (inFlight !== undefined) return inFlight;

      const recovery = recover();
      inFlight = recovery.finally(() => {
        inFlight = undefined;
      });
      return inFlight;
    },
  };
}
