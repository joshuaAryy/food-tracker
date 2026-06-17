import type { NextFunction, Request, Response } from 'express';
import { MOCK_USER_ID } from '@food-tracker/shared';
import { prisma } from '../lib/prisma.js';

export async function mockAuth(
  _request: Request,
  response: Response,
  next: NextFunction,
): Promise<void> {
  try {
    await prisma.user.upsert({
      where: { id: MOCK_USER_ID },
      update: {},
      create: { id: MOCK_USER_ID },
    });
    response.locals.userId = MOCK_USER_ID;
    next();
  } catch (error) {
    next(error);
  }
}
