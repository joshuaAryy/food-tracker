import { describe, expect, it } from 'vitest';
import {
  commitAnalyticsOptionalResource,
  failAnalyticsOptionalResource,
  initialAnalyticsOptionalResource,
  startAnalyticsOptionalResource,
} from './analytics-optional-resource';

describe('analytics optional resource', () => {
  it('retains a healthy base result when an optional replacement fails', () => {
    const available = commitAnalyticsOptionalResource({ value: 42 });
    const loading = startAnalyticsOptionalResource(available);
    const failed = failAnalyticsOptionalResource(
      loading,
      'This optional analysis is temporarily unavailable.',
    );

    expect(failed).toEqual({
      status: 'failed',
      data: { value: 42 },
      error: 'This optional analysis is temporarily unavailable.',
    });
  });

  it('starts without a committed value and exposes a retryable local failure', () => {
    const initial = initialAnalyticsOptionalResource<{ value: number }>();
    const failed = failAnalyticsOptionalResource(
      startAnalyticsOptionalResource(initial),
      'Retry this analysis.',
    );

    expect(failed).toEqual({
      status: 'failed',
      data: null,
      error: 'Retry this analysis.',
    });
  });
});
