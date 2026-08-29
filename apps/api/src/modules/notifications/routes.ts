import { createHash } from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import { currentUserId } from '../../lib/auth.js';
import { AppError } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';
import { sendSuccess } from '../../lib/responses.js';
import { validateBody, validatedBody } from '../../middleware/validate.js';

const preferenceSchema = z.strictObject({
  recommendationInsightsEnabled: z.boolean(),
  loggingRemindersEnabled: z.boolean(),
});
const installationSchema = z.strictObject({
  expoPushToken: z.string().trim().min(10),
  platform: z.enum(['ios', 'android']),
  enabled: z.boolean().default(true),
});

function tokenHash(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export const notificationsRouter = Router();

notificationsRouter.get('/preferences', async (_request, response) => {
  const userId = currentUserId(response);
  const preference = await prisma.notificationPreference.upsert({
    where: { userId },
    update: {},
    create: { userId },
  });
  sendSuccess(response, {
    recommendationInsightsEnabled: preference.recommendationInsightsEnabled,
    loggingRemindersEnabled: preference.loggingRemindersEnabled,
  });
});

notificationsRouter.put(
  '/preferences',
  validateBody(preferenceSchema),
  async (_request, response) => {
    const userId = currentUserId(response);
    const input = validatedBody<z.infer<typeof preferenceSchema>>(response);
    const preference = await prisma.notificationPreference.upsert({
      where: { userId },
      update: input,
      create: { userId, ...input },
    });
    sendSuccess(response, {
      recommendationInsightsEnabled: preference.recommendationInsightsEnabled,
      loggingRemindersEnabled: preference.loggingRemindersEnabled,
    });
  },
);

notificationsRouter.put(
  '/installations/:installationId',
  validateBody(installationSchema),
  async (request, response) => {
    const userId = currentUserId(response);
    const installationId = String(request.params.installationId);
    if (installationId === undefined || installationId.length < 8) {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        'Invalid installation identifier.',
      );
    }
    const input = validatedBody<z.infer<typeof installationSchema>>(response);
    const hash = tokenHash(input.expoPushToken);
    const installation = await prisma.$transaction(async (transaction) => {
      await transaction.notificationInstallation.updateMany({
        where: { tokenHash: hash, NOT: { installationId } },
        data: {
          userId: null,
          expoPushToken: null,
          tokenHash: null,
          disabledAt: new Date(),
        },
      });
      return transaction.notificationInstallation.upsert({
        where: { installationId },
        update: {
          userId,
          expoPushToken: input.expoPushToken,
          tokenHash: hash,
          platform: input.platform,
          enabledAt: input.enabled ? new Date() : null,
          disabledAt: input.enabled ? null : new Date(),
          lastRegisteredAt: new Date(),
        },
        create: {
          installationId,
          userId,
          expoPushToken: input.expoPushToken,
          tokenHash: hash,
          platform: input.platform,
          enabledAt: input.enabled ? new Date() : null,
          disabledAt: input.enabled ? null : new Date(),
        },
      });
    });
    sendSuccess(response, {
      installationId: installation.installationId,
      enabled: installation.disabledAt === null,
    });
  },
);

notificationsRouter.delete(
  '/installations/:installationId',
  async (request, response) => {
    const userId = currentUserId(response);
    await prisma.notificationInstallation.updateMany({
      where: { installationId: String(request.params.installationId), userId },
      data: {
        userId: null,
        expoPushToken: null,
        tokenHash: null,
        disabledAt: new Date(),
      },
    });
    sendSuccess(response, { detached: true });
  },
);
