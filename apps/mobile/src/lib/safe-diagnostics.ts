export interface SafeDiagnostic {
  category: string;
  statusClass?: `${2 | 3 | 4 | 5}xx`;
  operation?: string;
  errorCategory?: string;
}

function safeCategory(value: unknown): string | undefined {
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    value.length > 64 ||
    !/^[a-z0-9_-]+$/.test(value)
  ) {
    return undefined;
  }
  return value;
}

function statusClass(status: unknown): SafeDiagnostic['statusClass'] {
  if (typeof status !== 'number' || !Number.isInteger(status)) return undefined;
  const value = Math.floor(status / 100);
  if (value === 2) return '2xx';
  if (value === 3) return '3xx';
  if (value === 4) return '4xx';
  if (value === 5) return '5xx';
  return undefined;
}

export function createSafeDiagnostic(
  category: string,
  details: Record<string, unknown> = {},
): SafeDiagnostic {
  const diagnostic: SafeDiagnostic = {
    category: safeCategory(category) ?? 'unknown',
  };
  const operation = safeCategory(details.operation);
  const errorCategory = safeCategory(details.errorCategory);
  const responseStatusClass = statusClass(details.status);

  if (responseStatusClass !== undefined) {
    diagnostic.statusClass = responseStatusClass;
  }
  if (operation !== undefined) diagnostic.operation = operation;
  if (errorCategory !== undefined) diagnostic.errorCategory = errorCategory;

  return diagnostic;
}

export function reportDiagnostic(
  category: string,
  details: Record<string, unknown> = {},
): void {
  if (typeof __DEV__ === 'undefined' || !__DEV__) return;
  console.warn(
    '[food-tracker:diagnostic]',
    createSafeDiagnostic(category, details),
  );
}
