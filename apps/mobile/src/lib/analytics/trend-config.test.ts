import { describe, expect, it } from 'vitest';
import {
  applyTrendDraft,
  createTrendDraft,
  updateTrendDraft,
} from './trend-config';

const active = {
  primaryMetric: 'calories' as const,
  period: { kind: 'relative' as const, days: 30 },
  aggregation: 'automatic' as const,
  visualization: 'automatic' as const,
  showReference: true,
  coverageFilter: 'all_logged_days' as const,
};

describe('Trend configuration draft', () => {
  it('does not replace the active Trend until Apply is explicit', () => {
    const draft = updateTrendDraft(createTrendDraft(active), {
      primaryMetric: 'protein',
    });
    expect(active.primaryMetric).toBe('calories');
    expect(draft.primaryMetric).toBe('protein');
    expect(applyTrendDraft(active, draft).primaryMetric).toBe('protein');
  });

  it('caps initial comparison at two metrics', () => {
    const draft = updateTrendDraft(createTrendDraft(active), {
      comparisonMetric: 'weight',
    });
    expect(draft.comparisonMetric).toBe('weight');
  });
});
