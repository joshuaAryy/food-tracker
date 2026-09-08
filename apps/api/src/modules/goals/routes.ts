import { Router } from 'express';
import { goalsInputSchema, type GoalsInput } from '@food-tracker/shared';
import { currentUserId } from '../../lib/auth.js';
import { notFoundError } from '../../lib/errors.js';
import { calculatePersonalizedPlan } from '../../lib/personalization.js';
import { prisma } from '../../lib/prisma.js';
import { sendSuccess } from '../../lib/responses.js';
import { roundTo, serializeGoals } from '../../lib/serializers.js';
import { isCompleteGoals } from '../../lib/setup-completeness.js';
import { validateBody, validatedBody } from '../../middleware/validate.js';
import { resolveUserNutritionTargets } from '../nutritionTargets/service.js';

export const goalsRouter = Router();

goalsRouter.get('/', async (_request, response) => {
  const goals = await prisma.userGoal.findUnique({
    where: { userId: currentUserId(response) },
  });

  if (!isCompleteGoals(goals)) {
    throw notFoundError('Goals');
  }

  const serialized = serializeGoals(goals);
  const effective = await resolveUserNutritionTargets(currentUserId(response));
  for (const [key, field] of [
    ['calories', 'targetCalories'],
    ['protein', 'targetProteinGrams'],
    ['carbs', 'targetCarbsGrams'],
    ['fat', 'targetFatGrams'],
    ['fiber', 'targetFiberGrams'],
    ['sugar', 'limitSugarGrams'],
    ['sodium', 'limitSodiumMg'],
  ] as const) {
    const value = effective[key]?.effectiveValue;
    if (value !== undefined)
      (serialized as unknown as Record<string, unknown>)[field] = value;
  }
  sendSuccess(response, serialized);
});

goalsRouter.put(
  '/',
  validateBody(goalsInputSchema),
  async (_request, response) => {
    const userId = currentUserId(response);
    const input = validatedBody<GoalsInput>(response);
    const [profile, latestWeight] = await Promise.all([
      prisma.userProfile.findUnique({
        where: { userId },
        select: {
          name: true,
          birthDate: true,
          sex: true,
          heightInches: true,
          timezone: true,
          startingWeightLb: true,
          activityLevel: true,
          trainingStyle: true,
        },
      }),
      prisma.weightLog.findFirst({
        where: { userId, weightLb: { gt: 0 } },
        orderBy: [{ loggedAt: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
        select: { weightLb: true },
      }),
    ]);
    const effectiveRate =
      profile?.birthDate &&
      profile.sex &&
      profile.heightInches &&
      profile.startingWeightLb &&
      profile.activityLevel &&
      profile.trainingStyle
        ? calculatePersonalizedPlan({
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
              goalType: input.goalType,
              goalPace: input.goalPace,
              targetRateLbPerWeek: input.targetRateLbPerWeek ?? null,
              targetWeightLb: input.targetWeightLb,
            },
            preferences: { mode: 'simple', waterTrackingEnabled: false },
          }).ratePlanning
        : null;
    const roundOptional = (
      value: number | null,
      places: number,
    ): number | null => (value === null ? null : roundTo(value, places));
    const {
      targetCarbsGrams,
      targetFatGrams,
      targetFiberGrams,
      limitSugarGrams,
      limitSodiumMg,
    } = input;
    const metadata = {
      goalType: input.goalType,
      goalPace: input.goalPace,
      targetRateLbPerWeek:
        effectiveRate?.status === 'available'
          ? effectiveRate.selectedRateLbPerWeek
          : null,
      targetWeightLb: roundTo(input.targetWeightLb, 1),
    };
    const goals = await prisma.$transaction(async (transaction) => {
      const saved = await transaction.userGoal.upsert({
        where: { userId },
        // Deprecated target columns are a creation-time compatibility snapshot.
        // Reads project the effective resolver; subsequent edits live only in overrides.
        update: metadata,
        create: {
          userId,
          ...metadata,
          targetCalories: input.targetCalories,
          targetProteinGrams: roundTo(input.targetProteinGrams, 1),
          ...(targetCarbsGrams === undefined
            ? {}
            : { targetCarbsGrams: roundOptional(targetCarbsGrams, 1) }),
          ...(targetFatGrams === undefined
            ? {}
            : { targetFatGrams: roundOptional(targetFatGrams, 1) }),
          ...(targetFiberGrams === undefined
            ? {}
            : { targetFiberGrams: roundOptional(targetFiberGrams, 1) }),
          ...(limitSugarGrams === undefined
            ? {}
            : { limitSugarGrams: roundOptional(limitSugarGrams, 1) }),
          ...(limitSodiumMg === undefined
            ? {}
            : { limitSodiumMg: roundOptional(limitSodiumMg, 0) }),
        },
      });
      const overrides = [
        ['calories', input.targetCalories],
        ['protein', input.targetProteinGrams],
        ['carbs', input.targetCarbsGrams],
        ['fat', input.targetFatGrams],
        ['fiber', input.targetFiberGrams],
        ['sugar', input.limitSugarGrams],
        ['sodium', input.limitSodiumMg],
      ] as const;
      const explicitFields = input.targetOverrideFields;
      const legacyFields =
        input.targetOverrides === false
          ? []
          : overrides.map(([nutrientKey]) => nutrientKey);
      const selectedFields = new Set(explicitFields ?? legacyFields);
      for (const [nutrientKey, value] of overrides) {
        if (
          !selectedFields.has(nutrientKey) ||
          value === undefined ||
          value === null
        )
          continue;
        await transaction.userNutrientTargetOverride.upsert({
          where: { userId_nutrientKey: { userId, nutrientKey } },
          update: {
            value:
              nutrientKey === 'sodium'
                ? Math.round(value)
                : roundTo(
                    value,
                    nutrientKey === 'protein' ||
                      nutrientKey === 'carbs' ||
                      nutrientKey === 'fat' ||
                      nutrientKey === 'fiber' ||
                      nutrientKey === 'sugar'
                      ? 1
                      : 0,
                  ),
            origin: 'user',
          },
          create: {
            userId,
            nutrientKey,
            value:
              nutrientKey === 'sodium'
                ? Math.round(value)
                : roundTo(
                    value,
                    nutrientKey === 'protein' ||
                      nutrientKey === 'carbs' ||
                      nutrientKey === 'fat' ||
                      nutrientKey === 'fiber' ||
                      nutrientKey === 'sugar'
                      ? 1
                      : 0,
                  ),
            origin: 'user',
          },
        });
      }
      return saved;
    });

    const serialized = serializeGoals(goals);
    const effective = await resolveUserNutritionTargets(userId);
    for (const [key, field] of [
      ['calories', 'targetCalories'],
      ['protein', 'targetProteinGrams'],
      ['carbs', 'targetCarbsGrams'],
      ['fat', 'targetFatGrams'],
      ['fiber', 'targetFiberGrams'],
      ['sugar', 'limitSugarGrams'],
      ['sodium', 'limitSodiumMg'],
    ] as const) {
      const value = effective[key]?.effectiveValue;
      if (value !== undefined)
        (serialized as unknown as Record<string, unknown>)[field] = value;
    }
    sendSuccess(response, serialized);
  },
);
