import { describe, expect, it } from 'vitest';
import {
  resolveReportingGoals,
  type ReportingGoalInputs,
} from '../../../packages/shared/src/reporting-goals.js';

const completeInputs: ReportingGoalInputs = {
  targetCalories: 2000,
  targetProteinGrams: 100,
  targetCarbsGrams: null,
  targetFatGrams: null,
  targetFiberGrams: null,
  limitSugarGrams: null,
  limitSodiumMg: null,
};

describe('reporting goal resolution', () => {
  it('derives complete core nutrient goals deterministically', () => {
    const goals = resolveReportingGoals(completeInputs);

    expect(goals.calories).toMatchObject({
      value: 2000,
      unit: 'kcal',
      direction: 'target',
      source: 'user',
    });
    expect(goals.protein).toMatchObject({
      value: 100,
      unit: 'g',
      direction: 'minimum',
      source: 'user',
    });
    expect(goals.carbs).toMatchObject({
      value: 200,
      unit: 'g',
      direction: 'minimum',
      source: 'derived',
    });
    expect(goals.fat).toMatchObject({
      value: 88.9,
      unit: 'g',
      direction: 'minimum',
      source: 'derived',
    });
    expect(goals.fiber).toMatchObject({
      value: 28,
      unit: 'g',
      direction: 'minimum',
      source: 'derived',
    });
    expect(goals.sugar).toMatchObject({
      value: 50,
      unit: 'g',
      direction: 'limit',
      source: 'derived',
    });
    expect(goals.sodium).toMatchObject({
      value: 2300,
      unit: 'mg',
      direction: 'limit',
      source: 'default',
    });
    expect(goals.vitaminC).toMatchObject({
      value: 90,
      unit: 'mg',
      direction: 'minimum',
      source: 'default',
    });
  });

  it('uses explicit nutrient overrides before derived values', () => {
    const goals = resolveReportingGoals({
      ...completeInputs,
      targetCarbsGrams: 180,
      targetFatGrams: 70,
      targetFiberGrams: 35,
      limitSugarGrams: 40,
      limitSodiumMg: 1800,
    });

    expect(goals.carbs).toMatchObject({ value: 180, source: 'user' });
    expect(goals.fat).toMatchObject({ value: 70, source: 'user' });
    expect(goals.fiber).toMatchObject({ value: 35, source: 'user' });
    expect(goals.sugar).toMatchObject({ value: 40, source: 'user' });
    expect(goals.sodium).toMatchObject({ value: 1800, source: 'user' });
  });

  it('marks missing setup and invalid denominators instead of returning zero goals', () => {
    const goals = resolveReportingGoals({
      ...completeInputs,
      targetCalories: null,
      targetProteinGrams: 0,
    });

    expect(goals.calories).toMatchObject({ value: null, source: 'missing' });
    expect(goals.protein).toMatchObject({ value: null, source: 'missing' });
    expect(goals.carbs).toMatchObject({ value: null, source: 'missing' });
    expect(goals.fat).toMatchObject({ value: null, source: 'missing' });
    expect(goals.fiber).toMatchObject({ value: null, source: 'missing' });
    expect(goals.sugar).toMatchObject({ value: null, source: 'missing' });
    expect(goals.sodium).toMatchObject({ value: null, source: 'missing' });
  });
});
