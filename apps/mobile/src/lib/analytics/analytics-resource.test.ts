import { describe, expect, it } from 'vitest';
import {
  analyticsResourceReducer,
  initialAnalyticsResource,
} from './analytics-resource';

describe('analytics resource state', () => {
  it('keeps committed data while refresh is pending and atomically replaces it only after validation', () => {
    const committed = analyticsResourceReducer(
      initialAnalyticsResource<number>(),
      {
        type: 'commit',
        requestId: 0,
        value: 10,
        updatedAt: 1,
      },
    );
    const refreshing = analyticsResourceReducer(committed, {
      type: 'refresh',
      requestId: 1,
    });
    expect(refreshing).toMatchObject({ value: 10, status: 'refreshing' });
    expect(
      analyticsResourceReducer(refreshing, {
        type: 'commit',
        requestId: 1,
        value: 20,
        updatedAt: 2,
      }),
    ).toMatchObject({ value: 20, status: 'ready', updatedAt: 2 });
  });

  it('retains stale committed data when replacement fails and allows a later retry', () => {
    const state = analyticsResourceReducer(
      analyticsResourceReducer(initialAnalyticsResource<number>(), {
        type: 'commit',
        requestId: 0,
        value: 10,
        updatedAt: 1,
      }),
      { type: 'failure', requestId: 0, message: 'Offline' },
    );
    expect(state).toMatchObject({
      value: 10,
      status: 'stale',
      error: 'Offline',
    });
    expect(
      analyticsResourceReducer(state, { type: 'refresh', requestId: 1 }),
    ).toMatchObject({
      value: 10,
      status: 'refreshing',
      error: null,
    });
  });

  it('marks hydrated stale cache as stale before the canonical replacement is requested', () => {
    const loading = analyticsResourceReducer(
      initialAnalyticsResource<number>(),
      {
        type: 'load',
        requestId: 1,
      },
    );
    const hydrated = analyticsResourceReducer(loading, {
      type: 'hydrate',
      requestId: 1,
      value: 10,
      updatedAt: 1,
      stale: true,
    });

    expect(hydrated).toMatchObject({
      value: 10,
      status: 'stale',
      error: 'Showing cached analytics from an earlier refresh.',
    });
    expect(
      analyticsResourceReducer(hydrated, { type: 'refresh', requestId: 1 }),
    ).toMatchObject({ value: 10, status: 'refreshing', error: null });
  });

  it('keeps a first-load failure distinct from stale committed data', () => {
    expect(
      analyticsResourceReducer(initialAnalyticsResource<number>(), {
        type: 'failure',
        requestId: 0,
        message: 'Unavailable',
      }),
    ).toMatchObject({ value: null, status: 'error', error: 'Unavailable' });
  });

  it('ignores a stale request completion after a newer request starts', () => {
    const newer = analyticsResourceReducer(initialAnalyticsResource<number>(), {
      type: 'load',
      requestId: 2,
    });
    expect(
      analyticsResourceReducer(newer, {
        type: 'commit',
        requestId: 1,
        value: 10,
        updatedAt: 1,
      }),
    ).toEqual(newer);
  });
});
