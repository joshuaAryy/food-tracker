import { describe, expect, it } from 'vitest';
import { goalsSchema } from '@food-tracker/shared';

const base = {
  goalType: 'lose' as const,
  goalPace: 'moderate' as const,
  targetWeightLb: 150,
  targetCalories: 2000,
  targetProteinGrams: 130,
  targetCarbsGrams: 200,
  targetFatGrams: 70,
  targetFiberGrams: 25,
  limitSugarGrams: 50,
  limitSodiumMg: 2300,
};

describe('selectable target rates', () => {
  it.each([0.25, 0.3, 0.55, 0.95, 1.1])('accepts %s', (rate) => {
    expect(
      goalsSchema.safeParse({ ...base, targetRateLbPerWeek: rate }).success,
    ).toBe(true);
  });

  it.each([0.27, 0.333, 0, -0.05])('rejects %s', (rate) => {
    expect(
      goalsSchema.safeParse({ ...base, targetRateLbPerWeek: rate }).success,
    ).toBe(false);
  });
});
