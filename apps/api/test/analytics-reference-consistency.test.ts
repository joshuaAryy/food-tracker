import { describe, expect, it } from 'vitest';
import { metricReference } from '../src/modules/analytics/trends/references.js';

const missingInputs = {
  goalType: null,
  targetCalories: null,
  targetProteinGrams: null,
  targetCarbsGrams: null,
  targetFatGrams: null,
  targetFiberGrams: null,
  limitSugarGrams: null,
  limitSodiumMg: null,
} as const;

describe('analytics reference consistency', () => {
  it('does not invent a Vitamin C reference without canonical effective targets', () => {
    expect(metricReference('vitaminC', missingInputs)).toEqual({
      kind: 'none',
      unit: 'mg',
      reason: 'not_configured',
    });
  });
});
