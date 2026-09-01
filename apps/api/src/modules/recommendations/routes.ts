import { Router } from 'express';
import {
  idParamsSchema,
  recommendationsQuerySchema,
} from '@food-tracker/shared';
import type { z } from 'zod';
import { currentUserId } from '../../lib/auth.js';
import { notFoundError } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';
import { sendSuccess } from '../../lib/responses.js';
import { serializeRecommendation } from '../../lib/serializers.js';
import {
  validateParams,
  validateQuery,
  validatedParams,
  validatedQuery,
} from '../../middleware/validate.js';
import {
  comparePersistedRecommendations,
  generateRecommendations,
} from './service.js';

type RecommendationsQuery = z.infer<typeof recommendationsQuerySchema>;
type IdParams = z.infer<typeof idParamsSchema>;

export const recommendationsRouter = Router();

recommendationsRouter.get(
  '/',
  validateQuery(recommendationsQuerySchema),
  async (_request, response) => {
    const userId = currentUserId(response);
    const { status } = validatedQuery<RecommendationsQuery>(response);
    const recommendations = await prisma.recommendation.findMany({
      where: { userId, status },
    });

    sendSuccess(response, {
      recommendations: recommendations
        .sort(comparePersistedRecommendations)
        .slice(
          status === 'active' ? 0 : undefined,
          status === 'active' ? 3 : undefined,
        )
        .map(serializeRecommendation),
    });
  },
);

recommendationsRouter.post('/generate', async (_request, response) => {
  const recommendations = await generateRecommendations(
    currentUserId(response),
  );

  sendSuccess(response, {
    recommendations: recommendations.map(serializeRecommendation),
  });
});

recommendationsRouter.patch(
  '/:id/dismiss',
  validateParams(idParamsSchema),
  async (_request, response) => {
    const userId = currentUserId(response);
    const { id } = validatedParams<IdParams>(response);
    const existing = await prisma.recommendation.findFirst({
      where: { id, userId },
    });

    if (existing === null) {
      throw notFoundError('Recommendation');
    }

    const recommendation = await prisma.recommendation.update({
      where: { id },
      data: { status: 'dismissed', dismissedAt: new Date() },
    });

    sendSuccess(response, serializeRecommendation(recommendation));
  },
);
