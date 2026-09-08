import { Router } from 'express';
import { z } from 'zod';
import { NUTRIENT_CATALOG, type NutrientKey } from '@food-tracker/shared';
import { currentUserId } from '../../lib/auth.js';
import { AppError, notFoundError } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';
import { sendSuccess } from '../../lib/responses.js';
import { validateBody, validatedBody } from '../../middleware/validate.js';
import { TARGETABLE_NUTRIENT_POLICY } from './effective-resolver.js';
import { resolveUserNutritionTargets } from './service.js';

const valueSchema = z.strictObject({ value: z.number().nonnegative() });

export const nutritionTargetsRouter = Router();

export function targetRows(
  targets: Awaited<ReturnType<typeof resolveUserNutritionTargets>>,
  mode: 'simple' | 'complex' = 'simple',
) {
  return Object.values(targets).filter((target) => {
    const policy = TARGETABLE_NUTRIENT_POLICY[target.nutrientKey];
    return (
      policy !== undefined && (mode === 'complex' || policy.mode === 'simple')
    );
  });
}

async function resolvedTargetRows(userId: string) {
  const [targets, preferences] = await Promise.all([
    resolveUserNutritionTargets(userId),
    prisma.trackingPreference.findUnique({
      where: { userId },
      select: { mode: true },
    }),
  ]);
  return targetRows(targets, preferences?.mode ?? 'simple');
}

nutritionTargetsRouter.get('/', async (_request, response) => {
  sendSuccess(response, {
    targets: await resolvedTargetRows(currentUserId(response)),
  });
});

nutritionTargetsRouter.put(
  '/:nutrientKey',
  validateBody(valueSchema),
  async (request, response) => {
    const userId = currentUserId(response);
    const nutrientKey = request.params.nutrientKey as NutrientKey;
    const policy = TARGETABLE_NUTRIENT_POLICY[nutrientKey];
    if (policy === undefined || !(nutrientKey in NUTRIENT_CATALOG)) {
      throw notFoundError('Targetable nutrient');
    }
    const preferences = await prisma.trackingPreference.findUnique({
      where: { userId },
      select: { mode: true },
    });
    if (policy.mode === 'complex' && preferences?.mode !== 'complex') {
      throw notFoundError('Targetable nutrient');
    }
    const input = validatedBody<{ value: number }>(response);
    if ((policy.direction !== 'limit' && input.value <= 0) || input.value < 0) {
      throw new AppError(
        400,
        'INVALID_TARGET_VALUE',
        'Target value is outside the allowed range.',
      );
    }
    await prisma.userNutrientTargetOverride.upsert({
      where: {
        userId_nutrientKey: { userId: currentUserId(response), nutrientKey },
      },
      update: { value: input.value, origin: 'user' },
      create: {
        userId: currentUserId(response),
        nutrientKey,
        value: input.value,
        origin: 'user',
      },
    });
    sendSuccess(response, {
      targets: await resolvedTargetRows(userId),
    });
  },
);

nutritionTargetsRouter.delete('/:nutrientKey', async (request, response) => {
  const nutrientKey = request.params.nutrientKey as NutrientKey;
  if (TARGETABLE_NUTRIENT_POLICY[nutrientKey] === undefined) {
    throw notFoundError('Targetable nutrient');
  }
  await prisma.userNutrientTargetOverride.deleteMany({
    where: { userId: currentUserId(response), nutrientKey },
  });
  sendSuccess(response, {
    targets: await resolvedTargetRows(currentUserId(response)),
  });
});
