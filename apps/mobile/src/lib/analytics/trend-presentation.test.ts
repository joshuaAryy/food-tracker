import { describe, expect, it } from 'vitest';
import { coreTrendPresentation } from './trend-presentation';

describe('core Trend presentation', () => {
  it('uses metric-appropriate reusable primitives without changing canonical facts', () => {
    expect(coreTrendPresentation('calories', 'daily')).toBe('bars_with_trend');
    expect(coreTrendPresentation('hydration', 'daily')).toBe('bars_with_trend');
    expect(coreTrendPresentation('weight', 'daily')).toBe('weight_line');
    expect(coreTrendPresentation('macroComposition', 'daily')).toBe('macro');
    expect(coreTrendPresentation('loggingConsistency', 'daily')).toBe(
      'logging_heatmap',
    );
  });

  it('uses a numeric aggregate for 90-day logging consistency rather than inventing daily heatmap states', () => {
    expect(coreTrendPresentation('loggingConsistency', 'weekly')).toBe(
      'bars_with_trend',
    );
  });
});
