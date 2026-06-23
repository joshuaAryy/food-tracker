import { Router } from 'express';
import { profileSchema, type Profile } from '@food-tracker/shared';
import { currentUserId } from '../../lib/auth.js';
import { notFoundError } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';
import { sendSuccess } from '../../lib/responses.js';
import { roundTo, serializeProfile } from '../../lib/serializers.js';
import { isCompleteProfile } from '../../lib/setup-completeness.js';
import { validateBody, validatedBody } from '../../middleware/validate.js';

export const usersRouter = Router();

usersRouter.get('/', async (_request, response) => {
  const profile = await prisma.userProfile.findUnique({
    where: { userId: currentUserId(response) },
  });

  if (!isCompleteProfile(profile)) {
    throw notFoundError('Profile');
  }

  sendSuccess(response, serializeProfile(profile));
});

usersRouter.put(
  '/',
  validateBody(profileSchema),
  async (_request, response) => {
    const userId = currentUserId(response);
    const input = validatedBody<Profile>(response);
    const data = {
      ...input,
      birthDate: new Date(`${input.birthDate}T00:00:00.000Z`),
      startingWeightLb: roundTo(input.startingWeightLb, 1),
    };
    const profile = await prisma.userProfile.upsert({
      where: { userId },
      update: data,
      create: { userId, ...data },
    });

    sendSuccess(response, serializeProfile(profile));
  },
);
