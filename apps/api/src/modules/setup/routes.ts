import { Router } from 'express';
import {
  setupInputSchema,
  setupPreviewInputSchema,
  type SetupInput,
  type SetupPreviewInput,
  type SetupStatus,
} from '@food-tracker/shared';
import { currentUserId } from '../../lib/auth.js';
import { calculatePersonalizedTargets } from '../../lib/personalization.js';
import { AppError } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';
import { sendSuccess } from '../../lib/responses.js';
import {
  roundTo,
  serializeGoals,
  serializeProfile,
} from '../../lib/serializers.js';
import {
  isCompleteGoals,
  isCompleteProfile,
} from '../../lib/setup-completeness.js';
import { validateBody, validatedBody } from '../../middleware/validate.js';
import { isBirthDateInFuture } from '../personalization/resolver.js';

export const setupRouter = Router();

function setupStatus(
  profileComplete: boolean,
  goalsComplete: boolean,
  preferencesComplete: boolean,
): SetupStatus {
  return {
    profileComplete,
    goalsComplete,
    preferencesComplete,
    isComplete: profileComplete && goalsComplete && preferencesComplete,
  };
}

setupRouter.get('/status', async (_request, response) => {
  const userId = currentUserId(response);
  const [profile, goals, preferences] = await Promise.all([
    prisma.userProfile.findUnique({ where: { userId } }),
    prisma.userGoal.findUnique({ where: { userId } }),
    prisma.trackingPreference.findUnique({
      where: { userId },
      select: { userId: true },
    }),
  ]);

  sendSuccess(
    response,
    setupStatus(
      isCompleteProfile(profile),
      isCompleteGoals(goals),
      preferences !== null,
    ),
  );
});

setupRouter.post(
  '/preview',
  validateBody(setupPreviewInputSchema),
  async (_request, response) => {
    const input = validatedBody<SetupPreviewInput>(response);
    if (isBirthDateInFuture(input.profile.birthDate, input.profile.timezone)) {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        'Birth date cannot be in the future.',
      );
    }
    const calculatedTargets = calculatePersonalizedTargets({
      ...input,
      profile: {
        ...input.profile,
        ...(input.currentWeightLb === undefined
          ? {}
          : { currentWeightLb: input.currentWeightLb }),
      },
    } as SetupInput & {
      profile: SetupInput['profile'] & { currentWeightLb?: number | null };
    });

    sendSuccess(response, {
      age: calculatedTargets.age,
      calculatedTargets: {
        targetCalories: calculatedTargets.targetCalories,
        targetProteinGrams: calculatedTargets.targetProteinGrams,
        targetCarbsGrams: calculatedTargets.targetCarbsGrams,
        targetFatGrams: calculatedTargets.targetFatGrams,
        targetFiberGrams: calculatedTargets.targetFiberGrams,
        limitSugarGrams: calculatedTargets.limitSugarGrams,
        limitSodiumMg: calculatedTargets.limitSodiumMg,
        targetRateLbPerWeek: calculatedTargets.targetRateLbPerWeek,
        estimatedGoalDate: calculatedTargets.estimatedGoalDate,
      },
      ratePlanning: publicRatePlanning(calculatedTargets.ratePlanning),
    });
  },
);

setupRouter.put(
  '/',
  validateBody(setupInputSchema),
  async (_request, response) => {
    const userId = currentUserId(response);
    const input = validatedBody<SetupInput>(response);
    if (isBirthDateInFuture(input.profile.birthDate, input.profile.timezone)) {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        'Birth date cannot be in the future.',
      );
    }
    const calculatedTargets = calculatePersonalizedTargets(input);
    const profileData = {
      ...input.profile,
      age: calculatedTargets.age,
      birthDate: new Date(`${input.profile.birthDate}T00:00:00.000Z`),
      startingWeightLb: roundTo(input.profile.startingWeightLb, 1),
    };
    const goalsData = {
      ...input.goals,
      targetRateLbPerWeek: calculatedTargets.targetRateLbPerWeek,
      targetWeightLb: roundTo(input.goals.targetWeightLb, 1),
      targetCalories: calculatedTargets.targetCalories,
      targetProteinGrams: calculatedTargets.targetProteinGrams,
      targetCarbsGrams: calculatedTargets.targetCarbsGrams,
      targetFatGrams: calculatedTargets.targetFatGrams,
      targetFiberGrams: calculatedTargets.targetFiberGrams,
      limitSugarGrams: calculatedTargets.limitSugarGrams,
      limitSodiumMg: calculatedTargets.limitSodiumMg,
    };

    const [profile, goals, preferences] = await prisma.$transaction([
      prisma.userProfile.upsert({
        where: { userId },
        update: profileData,
        create: { userId, ...profileData },
      }),
      prisma.userGoal.upsert({
        where: { userId },
        update: goalsData,
        create: { userId, ...goalsData },
      }),
      prisma.trackingPreference.upsert({
        where: { userId },
        update: input.preferences,
        create: { userId, ...input.preferences },
      }),
    ]);

    sendSuccess(response, {
      profile: serializeProfile(profile),
      goals: serializeGoals(goals),
      preferences: {
        mode: preferences.mode,
        waterTrackingEnabled: preferences.waterTrackingEnabled,
        dailyWaterGoalMl: preferences.dailyWaterGoalMl,
      },
      calculatedTargets: {
        targetCalories: calculatedTargets.targetCalories,
        targetProteinGrams: calculatedTargets.targetProteinGrams,
        targetCarbsGrams: calculatedTargets.targetCarbsGrams,
        targetFatGrams: calculatedTargets.targetFatGrams,
        targetFiberGrams: calculatedTargets.targetFiberGrams,
        limitSugarGrams: calculatedTargets.limitSugarGrams,
        limitSodiumMg: calculatedTargets.limitSodiumMg,
        targetRateLbPerWeek: calculatedTargets.targetRateLbPerWeek,
        estimatedGoalDate: calculatedTargets.estimatedGoalDate,
      },
      ratePlanning: publicRatePlanning(calculatedTargets.ratePlanning),
      status: setupStatus(true, true, true),
    });
  },
);

function publicRatePlanning(
  ratePlanning: ReturnType<typeof calculatePersonalizedTargets>['ratePlanning'],
) {
  return ratePlanning.status === 'available'
    ? {
        status: ratePlanning.status,
        minimumRateLbPerWeek: ratePlanning.minimumRateLbPerWeek,
        maximumRateLbPerWeek: ratePlanning.maximumRateLbPerWeek,
        selectedRateLbPerWeek: ratePlanning.selectedRateLbPerWeek,
      }
    : { status: ratePlanning.status, reason: ratePlanning.reason };
}
