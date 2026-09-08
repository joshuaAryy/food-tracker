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

  it.each([
    ['lose', 0.25],
    ['lose', 0.3],
    ['lose', 0.35],
    ['lose', 0.4],
    ['lose', 0.75],
    ['lose', 1.15],
    ['lose', 1.95],
    ['lose', 2],
    ['gain', 0.25],
    ['gain', 0.3],
    ['gain', 0.55],
    ['gain', 0.8],
    ['gain', 0.95],
    ['gain', 1],
  ] as const)('accepts policy rate %s for %s', (goalType, rate) => {
    expect(
      goalsSchema.safeParse({
        ...base,
        goalType,
        goalPace: goalType === 'lose' ? 'moderate' : 'moderate_bulk',
        targetRateLbPerWeek: rate,
      }).success,
    ).toBe(true);
  });

  it.each([
    ['lose', 0.2, 'moderate'],
    ['lose', 2.05, 'moderate'],
    ['gain', 1.05, 'moderate_bulk'],
    ['gain', 0.2, 'moderate_bulk'],
  ] as const)(
    'rejects policy-invalid rate %s for %s',
    (goalType, rate, goalPace) => {
      expect(
        goalsSchema.safeParse({
          ...base,
          goalType,
          goalPace,
          targetRateLbPerWeek: rate,
        }).success,
      ).toBe(false);
    },
  );
});
