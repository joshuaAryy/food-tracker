import { Router } from 'express';
import { goalsInputSchema, type GoalsInput } from '@food-tracker/shared';
import { currentUserId } from '../../lib/auth.js';
import { notFoundError } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';
import { sendSuccess } from '../../lib/responses.js';
import { roundTo, serializeGoals } from '../../lib/serializers.js';
import { isCompleteGoals } from '../../lib/setup-completeness.js';
import { validateBody, validatedBody } from '../../middleware/validate.js';

export const goalsRouter = Router();

goalsRouter.get('/', async (_request, response) => {
  const goals = await prisma.userGoal.findUnique({
    where: { userId: currentUserId(response) },
  });

  if (!isCompleteGoals(goals)) {
    throw notFoundError('Goals');
  }

  sendSuccess(response, serializeGoals(goals));
});

goalsRouter.put(
  '/',
  validateBody(goalsInputSchema),
  async (_request, response) => {
    const userId = currentUserId(response);
    const input = validatedBody<GoalsInput>(response);
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
    const data = {
      goalType: input.goalType,
      goalPace: input.goalPace,
      targetWeightLb: roundTo(input.targetWeightLb, 1),
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
    };
    const goals = await prisma.userGoal.upsert({
      where: { userId },
      update: data,
      create: { userId, ...data },
    });

    sendSuccess(response, serializeGoals(goals));
  },
);
