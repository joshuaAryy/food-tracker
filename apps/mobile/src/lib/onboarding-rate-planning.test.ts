import { describe, expect, it } from 'vitest';
import type { SetupPreviewResult } from '@food-tracker/shared';
import { onboardingRatePlanningState } from './onboarding-rate-planning';

describe('onboarding rate-planning state', () => {
  it('keeps a failed preview separate from an unavailable planning decision', () => {
    expect(onboardingRatePlanningState(null)).toBe('error');
  });

  it('preserves a legitimate unavailable planning decision', () => {
    const preview = {
      age: 42,
      calculatedTargets: {
        targetCalories: 2_000,
        targetProteinGrams: 140,
        targetCarbsGrams: 200,
        targetFatGrams: 70,
        targetFiberGrams: 28,
        limitSugarGrams: 50,
        limitSodiumMg: 2_300,
        targetRateLbPerWeek: null,
        estimatedGoalDate: null,
      },
      ratePlanning: {
        status: 'unavailable' as const,
        reason: 'goal_type_not_supported' as const,
      },
    } satisfies SetupPreviewResult;

    expect(onboardingRatePlanningState(preview)).toBe('unavailable');
  });
});
