import { MOCK_USER_ID } from '@food-tracker/shared';
import { prisma } from '../../src/lib/prisma.js';

export async function resetTestDatabase(): Promise<void> {
  const databaseName = new URL(
    process.env.DATABASE_URL ?? 'postgresql://invalid/invalid',
  ).pathname.slice(1);

  if (!databaseName.endsWith('_test')) {
    throw new Error(
      `Refusing to clean database "${databaseName}". Test database names must end in "_test".`,
    );
  }

  await prisma.$transaction([
    prisma.recommendation.deleteMany(),
    prisma.savedFoodItem.deleteMany(),
    prisma.foodBarcode.deleteMany(),
    prisma.foodLog.deleteMany(),
    prisma.foodItem.deleteMany(),
    prisma.weightLog.deleteMany(),
    prisma.trackingPreference.deleteMany(),
    prisma.userGoal.deleteMany(),
    prisma.userProfile.deleteMany(),
    prisma.user.deleteMany(),
  ]);

  await prisma.user.create({ data: { id: MOCK_USER_ID } });
}
