export type AnalyticsResourceStatus =
  | 'idle'
  | 'loading'
  | 'ready'
  | 'refreshing'
  | 'stale'
  | 'error';

export interface AnalyticsResource<T> {
  value: T | null;
  updatedAt: number | null;
  status: AnalyticsResourceStatus;
  error: string | null;
}

export type AnalyticsResourceAction<T> =
  | { type: 'load' | 'refresh' }
  | { type: 'commit'; value: T; updatedAt: number }
  | { type: 'failure'; message: string };

export function initialAnalyticsResource<T>(): AnalyticsResource<T> {
  return { value: null, updatedAt: null, status: 'idle', error: null };
}

/** Keeps prior validated facts visible until a whole replacement is committed. */
export function analyticsResourceReducer<T>(
  state: AnalyticsResource<T>,
  action: AnalyticsResourceAction<T>,
): AnalyticsResource<T> {
  switch (action.type) {
    case 'load':
      return state.value === null
        ? { ...state, status: 'loading', error: null }
        : { ...state, status: 'refreshing', error: null };
    case 'refresh':
      return state.value === null
        ? { ...state, status: 'loading', error: null }
        : { ...state, status: 'refreshing', error: null };
    case 'commit':
      return {
        value: action.value,
        updatedAt: action.updatedAt,
        status: 'ready',
        error: null,
      };
    case 'failure':
      return state.value === null
        ? { ...state, status: 'error', error: action.message }
        : { ...state, status: 'stale', error: action.message };
  }
}
