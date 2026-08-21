import { describe, expect, it } from 'vitest';
import {
  insightsCacheKey,
  isInsightsV2CachePayload,
} from './analytics-report-cache';

describe('section-aware Insights cache boundary', () => {
  it('uses distinct v2 keys for each committed report period', () => {
    expect(insightsCacheKey('week')).toBe('insights-v2-week');
    expect(insightsCacheKey('month')).toBe('insights-v2-month');
  });

  it('accepts only the complete v2 envelope and rejects a legacy flat report', () => {
    const failed = {
      status: 'failed' as const,
      code: 'section_unavailable' as const,
      retryable: true as const,
    };
    expect(
      isInsightsV2CachePayload({
        contractVersion: 2,
        mode: 'simple',
        period: 'week',
        sections: { calories: failed },
        overview: {
          periodSummary: failed,
          energy: failed,
          macros: failed,
          nutrientHighlights: failed,
          hydration: failed,
          weight: failed,
          loggingConsistency: failed,
        },
      }),
    ).toBe(true);
    expect(
      isInsightsV2CachePayload({
        mode: 'simple',
        period: 'week',
        sections: { calories: {} },
      }),
    ).toBe(false);
  });
});
