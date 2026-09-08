import { Prisma } from '@prisma/client';
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

const PRISMA_ERROR_TYPES = [
  {
    name: 'PrismaClientInitializationError',
    constructor: Prisma.PrismaClientInitializationError,
  },
  {
    name: 'PrismaClientKnownRequestError',
    constructor: Prisma.PrismaClientKnownRequestError,
  },
  {
    name: 'PrismaClientUnknownRequestError',
    constructor: Prisma.PrismaClientUnknownRequestError,
  },
  {
    name: 'PrismaClientRustPanicError',
    constructor: Prisma.PrismaClientRustPanicError,
  },
  {
    name: 'PrismaClientValidationError',
    constructor: Prisma.PrismaClientValidationError,
  },
] as const;

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

function stringErrorProperty(
  error: unknown,
  property: 'code' | 'errorCode' | 'name',
): string | undefined {
  if (typeof error !== 'object' || error === null) return undefined;
  try {
    const value = (error as Record<string, unknown>)[property];
    return typeof value === 'string' ? value : undefined;
  } catch {
    return undefined;
  }
}

function errorCode(error: unknown): string | undefined {
  return (
    stringErrorProperty(error, 'errorCode') ??
    stringErrorProperty(error, 'code')
  );
}

function errorConstructorName(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null) return undefined;
  try {
    const constructor = (error as { constructor?: unknown }).constructor;
    if (typeof constructor !== 'function') return undefined;
    const name = (constructor as { name?: unknown }).name;
    return typeof name === 'string' ? name : undefined;
  } catch {
    return undefined;
  }
}

function prismaErrorTypes(error: unknown): string[] {
  if (typeof error !== 'object' || error === null) return [];
  return PRISMA_ERROR_TYPES.flatMap(({ name, constructor }) => {
    try {
      return error instanceof constructor ? [name] : [];
    } catch {
      return [];
    }
  });
}

function readinessErrorMetadata(error: unknown): Record<string, unknown> {
  return {
    code: stringErrorProperty(error, 'code'),
    errorClass: errorConstructorName(error),
    errorName: stringErrorProperty(error, 'name'),
    errorCode: stringErrorProperty(error, 'errorCode'),
    prismaErrorTypes: prismaErrorTypes(error),
  };
}

export function isTransientDatabaseReadinessError(error: unknown): boolean {
  const code = errorCode(error);
  if (code !== undefined) {
    return (
      TRANSIENT_PRISMA_ERROR_CODES.has(code) ||
      TRANSIENT_TRANSPORT_ERROR_CODES.has(code)
    );
  }

  if (typeof error !== 'object' || error === null) return false;
  try {
    return error instanceof Prisma.PrismaClientInitializationError;
  } catch {
    return false;
  }
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
            ...readinessErrorMetadata(error),
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
          ...readinessErrorMetadata(error),
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
