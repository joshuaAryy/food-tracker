import { describe, expect, it } from 'vitest';
import { metricReference } from '../src/modules/analytics/trends/references.js';
import { resolveReportingGoals } from '../../../packages/shared/src/reporting-goals.js';

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
  it('uses the shared default Vitamin C minimum for trend and overview inputs', () => {
    const expected = resolveReportingGoals(missingInputs).vitaminC;

    expect(expected).toMatchObject({
      value: 90,
      direction: 'minimum',
      unit: 'mg',
      source: 'default',
    });
    expect(metricReference('vitaminC', missingInputs)).toEqual({
      kind: 'minimum',
      value: 90,
      unit: 'mg',
      source: 'default',
    });
  });
});
