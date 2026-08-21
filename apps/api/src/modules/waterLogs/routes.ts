import { Router } from 'express';
import {
  DEFAULT_TIMEZONE,
  idParamsSchema,
  waterLogInputSchema,
  waterLogsQuerySchema,
  type WaterLogInput,
  type WaterLogsQuery,
} from '@food-tracker/shared';
import { currentUserId } from '../../lib/auth.js';
import { localDateRange } from '../../lib/dates.js';
import { notFoundError } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';
import { sendSuccess } from '../../lib/responses.js';
import { serializeWaterLog } from '../../lib/serializers.js';
import {
  validateBody,
  validateParams,
  validateQuery,
  validatedBody,
  validatedParams,
  validatedQuery,
} from '../../middleware/validate.js';

export const waterLogsRouter = Router();

async function userTimezone(userId: string): Promise<string> {
  const profile = await prisma.userProfile.findUnique({
    where: { userId },
    select: { timezone: true },
  });
  return profile?.timezone ?? DEFAULT_TIMEZONE;
}

function normalizedWaterLog(input: WaterLogInput) {
  return { amountMl: input.amountMl, loggedAt: new Date(input.loggedAt) };
}

waterLogsRouter.get(
  '/',
  validateQuery(waterLogsQuerySchema),
  async (_request, response) => {
    const userId = currentUserId(response);
    const query = validatedQuery<WaterLogsQuery>(response);
    const range = localDateRange(await userTimezone(userId), query);
    const waterLogs = await prisma.waterLog.findMany({
      where: {
        userId,
        ...(range.gte === undefined && range.lt === undefined
          ? {}
          : { loggedAt: range }),
      },
      orderBy: [{ loggedAt: 'desc' }, { createdAt: 'desc' }],
    });
    sendSuccess(response, { waterLogs: waterLogs.map(serializeWaterLog) });
  },
);

waterLogsRouter.get(
  '/:id',
  validateParams(idParamsSchema),
  async (_request, response) => {
    const waterLog = await prisma.waterLog.findFirst({
      where: {
        id: validatedParams<{ id: string }>(response).id,
        userId: currentUserId(response),
      },
    });
    if (waterLog === null) throw notFoundError('Water log');
    sendSuccess(response, serializeWaterLog(waterLog));
  },
);

waterLogsRouter.post(
  '/',
  validateBody(waterLogInputSchema),
  async (_request, response) => {
    const waterLog = await prisma.waterLog.create({
      data: {
        userId: currentUserId(response),
        ...normalizedWaterLog(validatedBody<WaterLogInput>(response)),
      },
    });
    sendSuccess(response, serializeWaterLog(waterLog));
  },
);

waterLogsRouter.put(
  '/:id',
  validateParams(idParamsSchema),
  validateBody(waterLogInputSchema),
  async (_request, response) => {
    const userId = currentUserId(response);
    const { id } = validatedParams<{ id: string }>(response);
    const existing = await prisma.waterLog.findFirst({ where: { id, userId } });
    if (existing === null) throw notFoundError('Water log');
    const waterLog = await prisma.waterLog.update({
      where: { id },
      data: normalizedWaterLog(validatedBody<WaterLogInput>(response)),
    });
    sendSuccess(response, serializeWaterLog(waterLog));
  },
);

waterLogsRouter.delete(
  '/:id',
  validateParams(idParamsSchema),
  async (_request, response) => {
    const { id } = validatedParams<{ id: string }>(response);
    const result = await prisma.waterLog.deleteMany({
      where: { id, userId: currentUserId(response) },
    });
    if (result.count === 0) throw notFoundError('Water log');
    sendSuccess(response, { id, deleted: true });
  },
);
