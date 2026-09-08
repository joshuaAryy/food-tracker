export interface ServerDiagnostic {
  category: string;
  analysisId?: string;
  requestId?: string;
  period?: 'week' | 'month';
  metric?: string;
  trackingMode?: 'simple' | 'complex';
  status?: number;
  statusClass?: `${2 | 3 | 4 | 5}xx`;
  operation?: string;
  retryable?: boolean;
  elapsedMs?: number;
  code?: string;
  errorClass?: string;
  errorName?: string;
  errorCode?: string;
  prismaErrorTypes?: string[];
  errorMessage?: string;
  errorLocation?: string;
  environmentCategory?: string;
  errorCategory?: string;
  itemIndex?: number;
  entryIndex?: number;
  groupIndex?: number;
  candidateCount?: number;
  candidates?: number;
  selectedCandidateIndex?: number;
  contentPartCount?: number;
  providerCode?: number;
  providerStatus?: string;
  field?: string;
  unsupportedPartType?: string;
  finishReason?: string | undefined;
  finishReasons?: string[];
  violationCategories?: string[];
  invalidFieldPaths?: string[][];
  partShapes?: Record<string, string>[][];
  safetyRatings?: { category: string; probability: string }[][];
}

export type ServerDiagnosticScope =
  | 'food-tracker:diagnostic'
  | 'ai-food-parse:gemini'
  | 'ai-food-parse:usda'
  | 'photo-analysis:provider'
  | 'photo-analysis:representation'
  | 'photo-adjudication:provider'
  | 'usda-fdc';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function safeToken(value: unknown): string | undefined {
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    value.length > 80 ||
    !/^[a-zA-Z0-9_-]+$/.test(value)
  ) {
    return undefined;
  }
  return value;
}

function safeText(value: unknown, maximum = 240): string | undefined {
  if (typeof value !== 'string') return undefined;
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (normalized.length === 0) return undefined;
  return normalized.slice(0, maximum);
}

function safeApplicationLocation(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const match = /^(apps\/api\/src\/[^\s:()]+):(\d+)$/.exec(value);
  return match === null ? undefined : `${match[1]}:${match[2]}`;
}

function statusClass(status: unknown): ServerDiagnostic['statusClass'] {
  if (typeof status !== 'number' || !Number.isInteger(status)) return undefined;
  const value = Math.floor(status / 100);
  if (value === 2) return '2xx';
  if (value === 3) return '3xx';
  if (value === 4) return '4xx';
  if (value === 5) return '5xx';
  return undefined;
}

function safeInteger(value: unknown, maximum = 10_000): number | undefined {
  return typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= 0 &&
    value <= maximum
    ? value
    : undefined;
}

function safeTokenList(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const values = value.flatMap((entry) => {
    const token = safeToken(entry);
    return token === undefined ? [] : [token];
  });
  return values.length === value.length ? values.slice(0, 20) : undefined;
}

function safePathList(value: unknown): string[][] | undefined {
  if (!Array.isArray(value)) return undefined;
  const paths = value.flatMap((path) => {
    if (!Array.isArray(path)) return [];
    const segments = path.flatMap((segment) => {
      if (
        typeof segment !== 'string' ||
        !/^[a-zA-Z][a-zA-Z0-9_.[\]-]{0,63}$/.test(segment)
      ) {
        return [];
      }
      return [segment];
    });
    return segments.length === path.length ? [segments] : [];
  });
  return paths.length === value.length ? paths.slice(0, 20) : undefined;
}

function safePartShapes(
  value: unknown,
): Record<string, string>[][] | undefined {
  if (!Array.isArray(value)) return undefined;
  const shapes = value.flatMap((candidate) => {
    if (!Array.isArray(candidate)) return [];
    const parts = candidate.flatMap((part) => {
      if (!isRecord(part)) return [];
      const entries = Object.entries(part).flatMap(([key, partType]) => {
        const safeKey = safeToken(key);
        const safeType = safeToken(partType);
        return safeKey !== undefined && safeType !== undefined
          ? [[safeKey, safeType] as const]
          : [];
      });
      return entries.length === Object.keys(part).length
        ? [Object.fromEntries(entries)]
        : [];
    });
    return parts.length === candidate.length ? [parts] : [];
  });
  return shapes.length === value.length ? shapes.slice(0, 20) : undefined;
}

function safeSafetyRatings(
  value: unknown,
): { category: string; probability: string }[][] | undefined {
  if (!Array.isArray(value)) return undefined;
  const ratings = value.flatMap((ratingGroup) => {
    if (!Array.isArray(ratingGroup)) return [];
    const group = ratingGroup.flatMap((rating) => {
      if (!isRecord(rating)) return [];
      const category = safeToken(rating.category);
      const probability = safeToken(rating.probability);
      return category !== undefined && probability !== undefined
        ? [{ category, probability }]
        : [];
    });
    return group.length === ratingGroup.length ? [group] : [];
  });
  return ratings.length === value.length ? ratings.slice(0, 20) : undefined;
}

export function createServerDiagnostic(
  category: string,
  details: Record<string, unknown> = {},
): ServerDiagnostic {
  const diagnostic: ServerDiagnostic = {
    category: safeToken(category) ?? 'unknown',
  };
  const analysisId = safeToken(details.analysisId);
  const requestId = safeToken(details.requestId);
  const period =
    details.period === 'week' || details.period === 'month'
      ? details.period
      : undefined;
  const metric = safeToken(details.metric);
  const trackingMode =
    details.trackingMode === 'simple' || details.trackingMode === 'complex'
      ? details.trackingMode
      : undefined;
  const responseStatus =
    typeof details.status === 'number' &&
    Number.isInteger(details.status) &&
    details.status >= 100 &&
    details.status <= 599
      ? details.status
      : undefined;
  const operation = safeToken(details.operation);
  const code = safeToken(details.code);
  const errorClass = safeToken(details.errorClass);
  const errorName = safeToken(details.errorName);
  const errorCode = safeToken(details.errorCode);
  const prismaErrorTypes = safeTokenList(details.prismaErrorTypes);
  const errorMessage = safeText(details.errorMessage);
  const errorLocation = safeApplicationLocation(details.errorLocation);
  const environmentCategory = safeToken(details.environmentCategory);
  const errorCategory = safeToken(details.errorCategory);
  const responseStatusClass = statusClass(details.status);

  if (analysisId !== undefined) diagnostic.analysisId = analysisId;
  if (requestId !== undefined) diagnostic.requestId = requestId;
  if (period !== undefined) diagnostic.period = period;
  if (metric !== undefined) diagnostic.metric = metric;
  if (trackingMode !== undefined) diagnostic.trackingMode = trackingMode;
  if (responseStatus !== undefined) diagnostic.status = responseStatus;
  if (responseStatusClass !== undefined) {
    diagnostic.statusClass = responseStatusClass;
  }
  if (operation !== undefined) diagnostic.operation = operation;
  if (typeof details.retryable === 'boolean') {
    diagnostic.retryable = details.retryable;
  }
  if (
    typeof details.elapsedMs === 'number' &&
    Number.isFinite(details.elapsedMs) &&
    details.elapsedMs >= 0
  ) {
    diagnostic.elapsedMs = Math.round(details.elapsedMs);
  }
  if (code !== undefined) diagnostic.code = code;
  if (errorClass !== undefined) diagnostic.errorClass = errorClass;
  if (errorName !== undefined) diagnostic.errorName = errorName;
  if (errorCode !== undefined) diagnostic.errorCode = errorCode;
  if (prismaErrorTypes !== undefined) {
    diagnostic.prismaErrorTypes = prismaErrorTypes;
  }
  if (errorMessage !== undefined) diagnostic.errorMessage = errorMessage;
  if (errorLocation !== undefined) diagnostic.errorLocation = errorLocation;
  if (environmentCategory !== undefined) {
    diagnostic.environmentCategory = environmentCategory;
  }
  if (errorCategory !== undefined) diagnostic.errorCategory = errorCategory;

  for (const key of [
    'itemIndex',
    'entryIndex',
    'groupIndex',
    'candidateCount',
    'candidates',
    'selectedCandidateIndex',
    'contentPartCount',
  ] as const) {
    const value = safeInteger(details[key]);
    if (value !== undefined) diagnostic[key] = value;
  }

  const providerCode = safeInteger(details.providerCode, 999);
  if (providerCode !== undefined) diagnostic.providerCode = providerCode;
  const providerStatus = safeToken(details.providerStatus);
  if (providerStatus !== undefined) diagnostic.providerStatus = providerStatus;
  const field = safeToken(details.field);
  if (field !== undefined) diagnostic.field = field;
  const unsupportedPartType = safeToken(details.unsupportedPartType);
  if (unsupportedPartType !== undefined) {
    diagnostic.unsupportedPartType = unsupportedPartType;
  }
  const finishReason = safeToken(details.finishReason);
  if (finishReason !== undefined || Object.hasOwn(details, 'finishReason')) {
    diagnostic.finishReason = finishReason;
  }
  const finishReasons = safeTokenList(details.finishReasons);
  if (finishReasons !== undefined) diagnostic.finishReasons = finishReasons;
  const violationCategories = safeTokenList(details.violationCategories);
  if (violationCategories !== undefined) {
    diagnostic.violationCategories = violationCategories;
  }
  const invalidFieldPaths = safePathList(details.invalidFieldPaths);
  if (invalidFieldPaths !== undefined) {
    diagnostic.invalidFieldPaths = invalidFieldPaths;
  }
  const partShapes = safePartShapes(details.partShapes);
  if (partShapes !== undefined) diagnostic.partShapes = partShapes;
  const safetyRatings = safeSafetyRatings(details.safetyRatings);
  if (safetyRatings !== undefined) diagnostic.safetyRatings = safetyRatings;

  return diagnostic;
}

export function emitServerDiagnostic(
  category: string,
  details: Record<string, unknown> = {},
  scope: ServerDiagnosticScope = 'food-tracker:diagnostic',
): void {
  console.warn(`[${scope}]`, createServerDiagnostic(category, details));
}
