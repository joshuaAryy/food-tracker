import type { NutrientKey } from '@food-tracker/shared';
import { prisma } from '../../lib/prisma.js';
import { calculatePersonalizedPlan } from '../../lib/personalization.js';
import {
  resolveEffectiveNutritionTargets,
  TARGETABLE_NUTRIENT_POLICY,
  type RecommendedTarget,
} from './effective-resolver.js';
import { resolveDriReferenceTarget } from './dri-reference.js';

const CORE_TARGETS: Array<
  [
    NutrientKey,
    keyof ReturnType<typeof calculatePersonalizedPlan>['recommendedTargets'],
    RecommendedTarget['source'],
  ]
> = [
  ['calories', 'calories', 'personalized'],
  ['protein', 'proteinGrams', 'personalized'],
  ['carbs', 'carbsGrams', 'derived'],
  ['fat', 'fatGrams', 'derived'],
  ['fiber', 'fiberGrams', 'derived'],
  ['sugar', 'sugarGrams', 'derived'],
  ['sodium', 'sodiumMg', 'reference'],
];

export async function resolveUserNutritionTargets(userId: string) {
  const [profile, goal, overrides, latestWeight] = await Promise.all([
    prisma.userProfile.findUnique({ where: { userId } }),
    prisma.userGoal.findUnique({ where: { userId } }),
    prisma.userNutrientTargetOverride.findMany({ where: { userId } }),
    prisma.weightLog.findFirst({
      where: { userId, weightLb: { gt: 0 } },
      orderBy: [{ loggedAt: 'desc' }, { createdAt: 'desc' }],
      select: { weightLb: true },
    }),
  ]);
  const recommended: Partial<Record<NutrientKey, RecommendedTarget>> = {};

  if (
    profile?.birthDate &&
    profile.sex &&
    profile.heightInches &&
    profile.startingWeightLb &&
    profile.activityLevel &&
    profile.trainingStyle &&
    goal?.goalType &&
    goal.targetWeightLb
  ) {
    const plan = calculatePersonalizedPlan({
      profile: {
        name: profile.name ?? 'User',
        birthDate: profile.birthDate.toISOString().slice(0, 10),
        sex: profile.sex as 'male' | 'female',
        heightInches: profile.heightInches,
        timezone: profile.timezone,
        startingWeightLb: Number(profile.startingWeightLb),
        currentWeightLb: latestWeight?.weightLb
          ? Number(latestWeight.weightLb)
          : null,
        activityLevel: profile.activityLevel,
        trainingStyle: profile.trainingStyle,
      },
      goals: {
        goalType: goal.goalType,
        goalPace: goal.goalPace,
        targetRateLbPerWeek: goal.targetRateLbPerWeek?.toNumber() ?? null,
        targetWeightLb: Number(goal.targetWeightLb),
      },
      preferences: { mode: 'simple', waterTrackingEnabled: false },
    });
    for (const [key, planKey, source] of CORE_TARGETS) {
      const value = plan.recommendedTargets[planKey];
      if (value !== null) {
        recommended[key] = {
          value,
          unit: TARGETABLE_NUTRIENT_POLICY[key]?.unit ?? 'g',
          direction: TARGETABLE_NUTRIENT_POLICY[key]?.direction ?? 'target',
          source,
        };
      }
    }
    for (const nutrientKey of Object.keys(
      TARGETABLE_NUTRIENT_POLICY,
    ) as NutrientKey[]) {
      if (recommended[nutrientKey] !== undefined) continue;
      const reference = resolveDriReferenceTarget(
        nutrientKey,
        plan.age.completedYears,
        profile.sex as 'male' | 'female',
      );
      if (reference) recommended[nutrientKey] = reference;
    }
  }

  if (goal !== null) {
    const legacy: Array<[NutrientKey, number | null]> = [
      ['calories', goal.targetCalories],
      ['protein', goal.targetProteinGrams?.toNumber() ?? null],
      ['carbs', goal.targetCarbsGrams?.toNumber() ?? null],
      ['fat', goal.targetFatGrams?.toNumber() ?? null],
      ['fiber', goal.targetFiberGrams?.toNumber() ?? null],
      ['sugar', goal.limitSugarGrams?.toNumber() ?? null],
      ['sodium', goal.limitSodiumMg],
    ];
    for (const [key, value] of legacy) {
      if (recommended[key] === undefined && value !== null) {
        recommended[key] = {
          value,
          unit: TARGETABLE_NUTRIENT_POLICY[key]?.unit ?? 'g',
          direction: TARGETABLE_NUTRIENT_POLICY[key]?.direction ?? 'target',
          source: 'derived',
        };
      }
    }
  }

  return resolveEffectiveNutritionTargets({
    recommended,
    overrides: overrides.map((override) => ({
      nutrientKey: override.nutrientKey as NutrientKey,
      value: Number(override.value),
      origin: override.origin,
    })),
  });
}
