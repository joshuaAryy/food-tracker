import {
  ANALYTICS_METRIC_REGISTRY,
  SIMPLE_ANALYTICS_METRIC_KEYS,
  analyticsMetricForKey,
} from '@food-tracker/shared';
import { describe, expect, it } from 'vitest';

describe('analytics metric registry', () => {
  it('defines the approved Simple metric catalog from one canonical registry', () => {
    expect(SIMPLE_ANALYTICS_METRIC_KEYS).toEqual([
      'calories',
      'protein',
      'carbs',
      'fat',
      'macroComposition',
      'weight',
      'hydration',
      'loggingConsistency',
    ]);

    expect(Object.keys(ANALYTICS_METRIC_REGISTRY)).toEqual(
      expect.arrayContaining([...SIMPLE_ANALYTICS_METRIC_KEYS]),
    );
  });

  it('keeps metric units and Simple/Complex exposure explicit', () => {
    expect(analyticsMetricForKey('calories')).toMatchObject({
      unit: 'kcal',
      simpleAvailable: true,
      complexAvailable: true,
    });
    expect(analyticsMetricForKey('hydration')).toMatchObject({
      unit: 'mL',
      simpleAvailable: true,
      complexAvailable: true,
    });
    expect(analyticsMetricForKey('vitaminC')).toMatchObject({
      unit: 'mg',
      simpleAvailable: false,
      complexAvailable: true,
    });
  });
});
