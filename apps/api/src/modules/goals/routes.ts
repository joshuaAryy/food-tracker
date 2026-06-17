import { Router } from 'express';
import { goalsSchema, type Goals } from '@food-tracker/shared';
import { currentUserId } from '../../lib/auth.js';
import { notFoundError } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';
import { sendSuccess } from '../../lib/responses.js';
import { roundTo, serializeGoals } from '../../lib/serializers.js';
import { validateBody, validatedBody } from '../../middleware/validate.js';

export const goalsRouter = Router();

goalsRouter.get('/', async (_request, response) => {
  const goals = await prisma.userGoal.findUnique({
    where: { userId: currentUserId(response) },
  });

  if (goals === null) {
    throw notFoundError('Goals');
  }

  sendSuccess(response, serializeGoals(goals));
});

goalsRouter.put('/', validateBody(goalsSchema), async (_request, response) => {
  const userId = currentUserId(response);
  const input = validatedBody<Goals>(response);
  const data = {
    ...input,
    targetWeightLb: roundTo(input.targetWeightLb, 1),
    targetProteinGrams: roundTo(input.targetProteinGrams, 1),
  };
  const goals = await prisma.userGoal.upsert({
    where: { userId },
    update: data,
    create: { userId, ...data },
  });

  sendSuccess(response, serializeGoals(goals));
});
