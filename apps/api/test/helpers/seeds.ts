import { MOCK_USER_ID, type GoalType } from '@food-tracker/shared';
import { prisma } from '../../src/lib/prisma.js';
import { recentLocalDateTime, TEST_TIMEZONE } from './dates.js';

export async function seedProfile(
  overrides: Partial<{
    age: number;
    sex: string;
    heightInches: number;
    timezone: string;
    startingWeightLb: number;
  }> = {},
) {
  return prisma.userProfile.create({
    data: {
      userId: MOCK_USER_ID,
      age: 30,
      sex: 'male',
      heightInches: 70,
      timezone: TEST_TIMEZONE,
      startingWeightLb: 180,
      ...overrides,
    },
  });
}

export async function seedGoals(
  overrides: Partial<{
    goalType: GoalType;
    targetWeightLb: number;
    targetCalories: number;
    targetProteinGrams: number;
  }> = {},
) {
  return prisma.userGoal.create({
    data: {
      userId: MOCK_USER_ID,
      goalType: 'gain',
      targetWeightLb: 190,
      targetCalories: 3000,
      targetProteinGrams: 150,
      ...overrides,
    },
  });
}

export async function seedPreferences(
  overrides: Partial<{
    mode: 'simple' | 'complex';
    waterTrackingEnabled: boolean;
  }> = {},
) {
  return prisma.trackingPreference.create({
    data: {
      userId: MOCK_USER_ID,
      mode: 'simple',
      waterTrackingEnabled: false,
      ...overrides,
    },
  });
}

export async function seedFoodLog(
  overrides: Partial<{
    foodName: string;
    mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack' | 'other';
    calories: number;
    protein: number;
    loggedAt: Date;
  }> = {},
) {
  return prisma.foodLog.create({
    data: {
      userId: MOCK_USER_ID,
      foodName: 'Test meal',
      mealType: 'lunch',
      calories: 500,
      protein: 40,
      loggedAt: new Date(recentLocalDateTime()),
      ...overrides,
    },
  });
}

export async function seedSevenFoodDays(input: {
  calories: number;
  protein: number;
}): Promise<void> {
  await prisma.foodLog.createMany({
    data: Array.from({ length: 7 }, (_, dayOffset) => ({
      userId: MOCK_USER_ID,
      foodName: `Day ${dayOffset + 1}`,
      mealType: 'dinner' as const,
      calories: input.calories,
      protein: input.protein,
      loggedAt: new Date(recentLocalDateTime(dayOffset)),
    })),
  });
}

export async function seedRecentWeight(weightLb = 180) {
  return prisma.weightLog.create({
    data: {
      userId: MOCK_USER_ID,
      weightLb,
      loggedAt: new Date(recentLocalDateTime()),
    },
  });
}
