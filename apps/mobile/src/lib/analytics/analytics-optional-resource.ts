export type AnalyticsOptionalResourceStatus =
  | 'idle'
  | 'loading'
  | 'available'
  | 'failed';

export interface AnalyticsOptionalResource<T> {
  status: AnalyticsOptionalResourceStatus;
  data: T | null;
  error: string | null;
}

export function initialAnalyticsOptionalResource<T>(): AnalyticsOptionalResource<T> {
  return { status: 'idle', data: null, error: null };
}

export function startAnalyticsOptionalResource<T>(
  resource: AnalyticsOptionalResource<T>,
): AnalyticsOptionalResource<T> {
  return { ...resource, status: 'loading', error: null };
}

export function commitAnalyticsOptionalResource<T>(
  data: T,
): AnalyticsOptionalResource<T> {
  return { status: 'available', data, error: null };
}

export function failAnalyticsOptionalResource<T>(
  resource: AnalyticsOptionalResource<T>,
  error: string,
): AnalyticsOptionalResource<T> {
  return { ...resource, status: 'failed', error };
}
