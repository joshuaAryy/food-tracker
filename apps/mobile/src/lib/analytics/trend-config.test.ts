import { describe, expect, it } from 'vitest';
import {
  applyTrendDraft,
  comparisonCandidates,
  createTrendDraft,
  supportsForecastControl,
  supportedAggregationsForPeriod,
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

  it('offers only approved comparison candidates and only exposes forecasts for eligible metrics', () => {
    expect(comparisonCandidates('protein')).toContain('carbs');
    expect(comparisonCandidates('protein')).toContain('weight');
    expect(comparisonCandidates('protein')).toContain('vitaminC');
    expect(comparisonCandidates('protein')).not.toContain('protein');
    expect(comparisonCandidates('protein')).not.toContain('macroComposition');
    expect(comparisonCandidates('calories')).toContain('protein');
    expect(comparisonCandidates('calories')).toContain('weight');
    expect(comparisonCandidates('calories')).not.toContain('macroComposition');
    expect(supportsForecastControl('calories')).toBe(true);
    expect(supportsForecastControl('weight')).toBe(true);
    expect(supportsForecastControl('protein')).toBe(false);
  });

  it('disables aggregation overrides that the selected range cannot support', () => {
    expect(
      supportedAggregationsForPeriod({ kind: 'relative', days: 7 }),
    ).toEqual(['automatic', 'daily']);
    expect(
      supportedAggregationsForPeriod({ kind: 'relative', days: 30 }),
    ).toEqual(['automatic', 'daily', 'weekly']);
    expect(
      supportedAggregationsForPeriod({ kind: 'relative', days: 90 }),
    ).toEqual(['automatic', 'daily', 'weekly', 'monthly']);
    expect(
      supportedAggregationsForPeriod({ kind: 'relative', days: 181 }),
    ).toEqual(['automatic', 'weekly', 'monthly']);
  });
});
