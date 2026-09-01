import { Router } from 'express';
import {
  DEFAULT_TIMEZONE,
  idParamsSchema,
  weightLogInputSchema,
  weightLogsQuerySchema,
} from '@food-tracker/shared';
import type { z } from 'zod';
import { currentUserId } from '../../lib/auth.js';
import { localDateRange } from '../../lib/dates.js';
import { notFoundError } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';
import { sendSuccess } from '../../lib/responses.js';
import { roundTo, serializeWeightLog } from '../../lib/serializers.js';
import {
  validateBody,
  validateParams,
  validateQuery,
  validatedBody,
  validatedParams,
  validatedQuery,
} from '../../middleware/validate.js';

type WeightLogInput = z.infer<typeof weightLogInputSchema>;
type WeightLogsQuery = z.infer<typeof weightLogsQuerySchema>;
type IdParams = z.infer<typeof idParamsSchema>;

export const weightLogsRouter = Router();

async function userTimezone(userId: string): Promise<string> {
  const profile = await prisma.userProfile.findUnique({
    where: { userId },
    select: { timezone: true },
  });
  return profile?.timezone ?? DEFAULT_TIMEZONE;
}

function normalizedWeightLog(input: WeightLogInput) {
  return {
    weightLb: roundTo(input.weightLb, 1),
    loggedAt: new Date(input.loggedAt),
  };
}

weightLogsRouter.get(
  '/',
  validateQuery(weightLogsQuerySchema),
  async (_request, response) => {
    const userId = currentUserId(response);
    const query = validatedQuery<WeightLogsQuery>(response);
    const range = localDateRange(await userTimezone(userId), query);
    const weightLogs = await prisma.weightLog.findMany({
      where: {
        userId,
        ...(range.gte === undefined && range.lt === undefined
          ? {}
          : { loggedAt: range }),
      },
      orderBy: [{ loggedAt: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
    });
    sendSuccess(response, { weightLogs: weightLogs.map(serializeWeightLog) });
  },
);

weightLogsRouter.get(
  '/:id',
  validateParams(idParamsSchema),
  async (_request, response) => {
    const userId = currentUserId(response);
    const { id } = validatedParams<IdParams>(response);
    const weightLog = await prisma.weightLog.findFirst({
      where: { id, userId },
    });

    if (weightLog === null) {
      throw notFoundError('Weight log');
    }

    sendSuccess(response, serializeWeightLog(weightLog));
  },
);

weightLogsRouter.post(
  '/',
  validateBody(weightLogInputSchema),
  async (_request, response) => {
    const weightLog = await prisma.weightLog.create({
      data: {
        userId: currentUserId(response),
        ...normalizedWeightLog(validatedBody<WeightLogInput>(response)),
      },
    });
    sendSuccess(response, serializeWeightLog(weightLog));
  },
);

weightLogsRouter.put(
  '/:id',
  validateParams(idParamsSchema),
  validateBody(weightLogInputSchema),
  async (_request, response) => {
    const userId = currentUserId(response);
    const { id } = validatedParams<IdParams>(response);
    const existing = await prisma.weightLog.findFirst({
      where: { id, userId },
    });

    if (existing === null) {
      throw notFoundError('Weight log');
    }

    const weightLog = await prisma.weightLog.update({
      where: { id },
      data: normalizedWeightLog(validatedBody<WeightLogInput>(response)),
    });
    sendSuccess(response, serializeWeightLog(weightLog));
  },
);

weightLogsRouter.delete(
  '/:id',
  validateParams(idParamsSchema),
  async (_request, response) => {
    const userId = currentUserId(response);
    const { id } = validatedParams<IdParams>(response);
    const result = await prisma.weightLog.deleteMany({ where: { id, userId } });

    if (result.count === 0) {
      throw notFoundError('Weight log');
    }

    sendSuccess(response, { id, deleted: true });
  },
);
