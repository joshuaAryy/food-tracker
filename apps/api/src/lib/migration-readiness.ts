export const DEFAULT_DATABASE_READINESS_TIMEOUT_MS = 120_000;
export const DEFAULT_DATABASE_READINESS_RETRY_DELAY_MS = 5_000;

type ErrorWithCode = {
  errorCode?: unknown;
  code?: unknown;
  message?: unknown;
};

export interface DatabaseReadinessOptions {
  probe: () => Promise<void>;
  timeoutMs?: number;
  retryDelayMs?: number;
  now?: () => number;
  sleep?: (delayMs: number) => Promise<void>;
  log?: (message: string) => void;
}

function errorDetails(error: unknown): ErrorWithCode {
  return typeof error === 'object' && error !== null
    ? (error as ErrorWithCode)
    : {};
}

function errorCode(error: unknown): string | undefined {
  const details = errorDetails(error);
  if (typeof details.errorCode === 'string') return details.errorCode;
  if (typeof details.code === 'string') return details.code;
  return undefined;
}

function errorMessage(error: unknown): string {
  const message = errorDetails(error).message;
  return typeof message === 'string' ? message : '';
}

export function isTransientDatabaseReadinessError(error: unknown): boolean {
  const code = errorCode(error);
  if (code === 'P1001' || code === 'ECONNREFUSED') return true;

  return /database system is starting up|connection refused|server has closed the connection|connection reset/i.test(
    errorMessage(error),
  );
}

function safeFailureCategory(error: unknown): string {
  const code = errorCode(error);
  if (code !== undefined) return code;
  if (/database system is starting up/i.test(errorMessage(error))) {
    return 'database_starting';
  }
  if (/connection refused/i.test(errorMessage(error))) {
    return 'connection_refused';
  }
  return 'unknown';
}

export async function waitForDatabaseReady(
  options: DatabaseReadinessOptions,
): Promise<void> {
  const timeoutMs = Math.max(
    0,
    options.timeoutMs ?? DEFAULT_DATABASE_READINESS_TIMEOUT_MS,
  );
  const retryDelayMs = Math.max(
    1,
    options.retryDelayMs ?? DEFAULT_DATABASE_READINESS_RETRY_DELAY_MS,
  );
  const now = options.now ?? Date.now;
  const sleep =
    options.sleep ??
    ((delayMs: number) =>
      new Promise<void>((resolve) => setTimeout(resolve, delayMs)));
  const log = options.log ?? console.log;
  const deadline = now() + timeoutMs;
  let attempts = 0;

  while (true) {
    attempts += 1;
    try {
      await options.probe();
      log(`[migration] database ready after ${attempts} readiness attempt(s)`);
      return;
    } catch (error) {
      const remainingMs = deadline - now();
      if (!isTransientDatabaseReadinessError(error) || remainingMs <= 0) {
        log(
          `[migration] database readiness failed (${safeFailureCategory(error)}) after ${attempts} attempt(s)`,
        );
        throw new Error('Database was not ready for migrations', {
          cause: error,
        });
      }

      const delayMs = Math.min(retryDelayMs, remainingMs);
      log(
        `[migration] database not ready (${safeFailureCategory(error)}); retrying in ${delayMs}ms`,
      );
      await sleep(delayMs);
    }
  }
}
