import type { SetupInput } from '@food-tracker/shared';
import { resolvePersonalizationPlan } from '../modules/personalization/resolver.js';

const LEGACY_PACE_RATE = {
  slow: 0.5,
  moderate: 1,
  aggressive: 1.5,
  lean_bulk: 0.5,
  moderate_bulk: 0.75,
  aggressive_bulk: 1,
} as const;

export function calculatePersonalizedPlan(
  input: SetupInput & {
    profile: SetupInput['profile'] & { currentWeightLb?: number | null };
  },
  today = new Date(),
) {
  const pace = input.goals.goalPace;
  return resolvePersonalizationPlan(
    {
      birthDate: input.profile.birthDate,
      timezone: input.profile.timezone,
      sex: input.profile.sex,
      heightInches: input.profile.heightInches,
      currentWeightLb:
        input.profile.currentWeightLb ?? input.profile.startingWeightLb,
      startingWeightLb: input.profile.startingWeightLb,
      activityLevel: input.profile.activityLevel,
      trainingStyle: input.profile.trainingStyle,
      goalType: input.goals.goalType,
      targetWeightLb: input.goals.targetWeightLb,
      targetRateLbPerWeek:
        input.goals.targetRateLbPerWeek ??
        (pace === null ? null : LEGACY_PACE_RATE[pace]),
    },
    today,
  );
}

export function calculatePersonalizedTargets(
  input: SetupInput,
  today = new Date(),
): {
  age: number;
  targetCalories: number;
  targetProteinGrams: number;
  targetCarbsGrams: number;
  targetFatGrams: number;
  targetFiberGrams: number;
  limitSugarGrams: number;
  limitSodiumMg: number | null;
  targetRateLbPerWeek: number | null;
  estimatedGoalDate: string | null;
  ratePlanning: ReturnType<typeof calculatePersonalizedPlan>['ratePlanning'];
} {
  const plan = calculatePersonalizedPlan(input, today);
  return {
    age: plan.age.completedYears,
    targetCalories: plan.recommendedTargets.calories,
    targetProteinGrams: plan.recommendedTargets.proteinGrams,
    targetCarbsGrams: plan.recommendedTargets.carbsGrams,
    targetFatGrams: plan.recommendedTargets.fatGrams,
    targetFiberGrams: plan.recommendedTargets.fiberGrams,
    limitSugarGrams: plan.recommendedTargets.sugarGrams,
    limitSodiumMg: plan.recommendedTargets.sodiumMg,
    targetRateLbPerWeek:
      plan.ratePlanning.status === 'available'
        ? plan.ratePlanning.selectedRateLbPerWeek
        : null,
    estimatedGoalDate:
      plan.estimatedGoal.status === 'available'
        ? plan.estimatedGoal.date
        : null,
    ratePlanning: plan.ratePlanning,
  };
}
