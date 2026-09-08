import { describe, expect, it } from 'vitest';
import {
  calculateAge,
  isBirthDateInFuture,
  resolvePersonalizationPlan,
} from '../src/modules/personalization/resolver.js';

const base = {
  birthDate: '2000-01-01',
  timezone: 'America/Toronto',
  sex: 'male' as const,
  heightInches: 70,
  currentWeightLb: 160,
  activityLevel: 'moderately_active' as const,
  trainingStyle: 'weight_training' as const,
  goalType: 'lose' as const,
  targetWeightLb: 150,
  targetRateLbPerWeek: 1,
};

describe('age-aware personalization', () => {
  it('derives age from birth date rather than a stored age value', () => {
    expect(calculateAge('2008-08-30', '2026-08-29', 'America/Toronto')).toBe(
      17,
    );
    expect(calculateAge('2008-08-29', '2026-08-29', 'America/Toronto')).toBe(
      18,
    );
  });

  it('uses the adolescent EER model while keeping Lose rate planning available', () => {
    const plan = resolvePersonalizationPlan(
      { ...base, birthDate: '2008-08-29' },
      new Date('2026-08-29T12:00:00.000Z'),
    );

    expect(plan.age.completedYears).toBe(18);
    expect(plan.energy.model).toBe('hc_nasem_eer_2023_adolescent');
    expect(plan.energy.includesGrowthEnergy).toBe(true);
    expect(plan.ratePlanning).toMatchObject({
      status: 'available',
      minimumRateLbPerWeek: 0.5,
      maximumRateLbPerWeek: 2,
    });
    expect(plan.goal.goalType).toBe('lose');
  });

  it('uses the adult EER model and rate adjustment at age 19', () => {
    const plan = resolvePersonalizationPlan(
      { ...base, birthDate: '2007-08-29' },
      new Date('2026-08-29T12:00:00.000Z'),
    );

    expect(plan.age.completedYears).toBe(19);
    expect(plan.energy.model).toBe('hc_nasem_eer_2023_adult');
    expect(plan.energy.includesGrowthEnergy).toBe(false);
    expect(plan.ratePlanning.status).toBe('available');
    expect(plan.ratePlanning.calorieAdjustment).toBe(-500);
    expect(plan.estimatedGoal.status).toBe('available');
    expect(plan.recommendedTargets.sodiumMg).toBe(2300);
  });

  it('normalizes automatic rates to selectable 0.05 lb/week steps', () => {
    const plan = resolvePersonalizationPlan(
      { ...base, targetRateLbPerWeek: 0.55 },
      new Date('2026-08-29T12:00:00.000Z'),
    );

    expect(plan.ratePlanning).toMatchObject({
      status: 'available',
      minimumRateLbPerWeek: 0.5,
      selectedRateLbPerWeek: 0.55,
    });
    expect(plan.ratePlanning).toMatchObject({
      maximumRateLbPerWeek: 2,
      feasibility: {
        status: 'supported',
      },
    });
  });

  it('uses the full loss policy range even when profile safety would be narrower', () => {
    const plan = resolvePersonalizationPlan(
      {
        ...base,
        sex: 'female',
        heightInches: 58,
        currentWeightLb: 90,
        activityLevel: 'sedentary',
        trainingStyle: 'none',
        targetRateLbPerWeek: 1.15,
      },
      new Date('2026-08-29T12:00:00.000Z'),
    );

    expect(plan.ratePlanning).toMatchObject({
      status: 'available',
      minimumRateLbPerWeek: 0.5,
      maximumRateLbPerWeek: 2,
      selectedRateLbPerWeek: 1.15,
      feasibility: { status: 'limited' },
    });
    expect(plan.estimatedGoal.status).toBe('unavailable');
  });

  it('uses the profile-safe recommendation only for legacy/default input', () => {
    const plan = resolvePersonalizationPlan(
      {
        ...base,
        sex: 'female',
        heightInches: 58,
        currentWeightLb: 90,
        activityLevel: 'sedentary',
        trainingStyle: 'none',
        targetRateLbPerWeek: 1.15,
        targetRateSource: 'legacy',
      },
      new Date('2026-08-29T12:00:00.000Z'),
    );

    expect(plan.ratePlanning).toMatchObject({
      selectedRateLbPerWeek: 0.9,
      maximumRateLbPerWeek: 2,
      feasibility: {
        status: 'supported',
        maximumSupportedRateLbPerWeek: 0.9,
      },
    });
  });

  it('uses the full gain policy range without clipping an explicit selection', () => {
    const plan = resolvePersonalizationPlan(
      {
        ...base,
        goalType: 'gain',
        targetWeightLb: 180,
        currentWeightLb: 70,
        heightInches: 65,
        activityLevel: 'sedentary',
        trainingStyle: 'none',
        targetRateLbPerWeek: 0.8,
      },
      new Date('2026-08-29T12:00:00.000Z'),
    );

    expect(plan.ratePlanning).toMatchObject({
      status: 'available',
      minimumRateLbPerWeek: 0.5,
      maximumRateLbPerWeek: 2,
      selectedRateLbPerWeek: 0.8,
      feasibility: { status: 'limited' },
    });
    expect(plan.estimatedGoal.status).toBe('unavailable');
  });

  it('uses age-specific sodium CDRR values', () => {
    const older = resolvePersonalizationPlan(
      { ...base, birthDate: '1955-08-29' },
      new Date('2026-08-29T12:00:00.000Z'),
    );
    expect(older.recommendedTargets.sodiumMg).toBe(1800);
  });

  it('falls back to starting weight when no current weight is supplied', () => {
    const plan = resolvePersonalizationPlan(
      { ...base, currentWeightLb: null, startingWeightLb: 160 },
      new Date('2026-08-29T12:00:00.000Z'),
    );

    expect(plan.currentWeight.source).toBe('startingWeightLb');
    expect(plan.currentWeight.valueLb).toBe(160);
  });

  it('provides Gain rate planning to younger users without an age gate', () => {
    const plan = resolvePersonalizationPlan(
      {
        ...base,
        birthDate: '2012-08-29',
        goalType: 'gain',
        targetWeightLb: 180,
        targetRateLbPerWeek: 1,
      },
      new Date('2026-08-29T12:00:00.000Z'),
    );

    expect(plan.ratePlanning).toMatchObject({
      status: 'available',
      minimumRateLbPerWeek: 0.5,
      maximumRateLbPerWeek: 2,
      selectedRateLbPerWeek: 1,
    });
    expect(plan.ratePlanning.calorieAdjustment).toBe(500);
    expect(plan.estimatedGoal.status).toBe('unavailable');
    expect(plan.goal.targetWeightLb).toBe(180);
    expect(plan.protein.source).toBe('reference');
  });

  it('does not create rate planning for maintenance', () => {
    const plan = resolvePersonalizationPlan(
      {
        ...base,
        goalType: 'maintain',
        targetWeightLb: 160,
        targetRateLbPerWeek: 0.55,
      },
      new Date('2026-08-29T12:00:00.000Z'),
    );
    expect(plan.ratePlanning).toEqual({
      status: 'unavailable',
      reason: 'goal_type_not_supported',
      calorieAdjustment: 0,
    });
  });

  it('rejects a future birth date instead of clamping to age zero', () => {
    expect(
      isBirthDateInFuture(
        '2026-08-30',
        'America/Toronto',
        new Date('2026-08-29T12:00:00.000Z'),
      ),
    ).toBe(true);
    expect(() =>
      calculateAge('2026-08-30', '2026-08-29', 'America/Toronto'),
    ).toThrow('Birth date cannot be in the future');
  });
});
