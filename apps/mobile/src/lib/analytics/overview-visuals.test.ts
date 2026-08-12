import type { AnalyticsOverviewNutrientHighlight } from '@food-tracker/shared';
import { describe, expect, it } from 'vitest';
import { nutrientGauge, hydrationVesselFillLevels } from './overview-visuals';

describe('overview visual geometry', () => {
  it('keeps hydration vessels explicit and bounded by the configured goal', () => {
    expect(hydrationVesselFillLevels(1630, 2000)).toEqual([
      1, 1, 1, 1, 1, 1, 0.52, 0,
    ]);
    expect(hydrationVesselFillLevels(null, 2000)).toEqual([
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
    ]);
    expect(hydrationVesselFillLevels(2400, 2000)).toEqual([
      1, 1, 1, 1, 1, 1, 1, 1,
    ]);
  });

  it('keeps nutrient fill and reference markers semantically aligned', () => {
    const sodium: AnalyticsOverviewNutrientHighlight = {
      metric: 'sodium',
      value: 1800,
      unit: 'mg',
      availability: 'recorded',
      reference: {
        kind: 'limit',
        value: 2300,
        unit: 'mg',
        source: 'user',
      },
      status: 'within_limit',
    };
    const gauge = nutrientGauge(sodium);
    expect(gauge.fillPercent).toBeCloseTo(62.6, 1);
    expect(gauge.primaryMarkerPercent).toBeCloseTo(80, 1);
    expect(nutrientGauge({ ...sodium, value: null }).fillPercent).toBeNull();
  });
});
