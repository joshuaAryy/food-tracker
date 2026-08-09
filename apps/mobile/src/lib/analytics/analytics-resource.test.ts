import { describe, expect, it } from 'vitest';
import {
  analyticsResourceReducer,
  initialAnalyticsResource,
} from './analytics-resource';

describe('analytics resource state', () => {
  it('keeps committed data while refresh is pending and atomically replaces it only after validation', () => {
    const committed = analyticsResourceReducer(initialAnalyticsResource<number>(), {
      type: 'commit',
      value: 10,
      updatedAt: 1,
    });
    const refreshing = analyticsResourceReducer(committed, { type: 'refresh' });
    expect(refreshing).toMatchObject({ value: 10, status: 'refreshing' });
    expect(
      analyticsResourceReducer(refreshing, {
        type: 'commit',
        value: 20,
        updatedAt: 2,
      }),
    ).toMatchObject({ value: 20, status: 'ready', updatedAt: 2 });
  });

  it('retains stale committed data when replacement fails and allows a later retry', () => {
    const state = analyticsResourceReducer(
      analyticsResourceReducer(
        initialAnalyticsResource<number>(),
        { type: 'commit', value: 10, updatedAt: 1 },
      ),
      { type: 'failure', message: 'Offline' },
    );
    expect(state).toMatchObject({ value: 10, status: 'stale', error: 'Offline' });
    expect(analyticsResourceReducer(state, { type: 'refresh' })).toMatchObject({
      value: 10,
      status: 'refreshing',
      error: null,
    });
  });

  it('keeps a first-load failure distinct from stale committed data', () => {
    expect(
      analyticsResourceReducer(initialAnalyticsResource<number>(), {
        type: 'failure',
        message: 'Unavailable',
      }),
    ).toMatchObject({ value: null, status: 'error', error: 'Unavailable' });
  });
});
