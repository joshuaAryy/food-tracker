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
  requestId: number;
}

export type AnalyticsResourceAction<T> =
  | { type: 'load' | 'refresh'; requestId: number }
  | { type: 'commit'; requestId: number; value: T; updatedAt: number }
  | { type: 'failure'; requestId: number; message: string };

export function initialAnalyticsResource<T>(): AnalyticsResource<T> {
  return { value: null, updatedAt: null, status: 'idle', error: null, requestId: 0 };
}

/** Keeps prior validated facts visible until a whole replacement is committed. */
export function analyticsResourceReducer<T>(
  state: AnalyticsResource<T>,
  action: AnalyticsResourceAction<T>,
): AnalyticsResource<T> {
  switch (action.type) {
    case 'load':
      return state.value === null
        ? { ...state, requestId: action.requestId, status: 'loading', error: null }
        : { ...state, requestId: action.requestId, status: 'refreshing', error: null };
    case 'refresh':
      return state.value === null
        ? { ...state, requestId: action.requestId, status: 'loading', error: null }
        : { ...state, requestId: action.requestId, status: 'refreshing', error: null };
    case 'commit':
      if (action.requestId !== state.requestId) return state;
      return {
        value: action.value,
        updatedAt: action.updatedAt,
        status: 'ready',
        error: null,
        requestId: action.requestId,
      };
    case 'failure':
      if (action.requestId !== state.requestId) return state;
      return state.value === null
        ? { ...state, status: 'error', error: action.message }
        : { ...state, status: 'stale', error: action.message };
  }
}
