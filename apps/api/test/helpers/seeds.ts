import { MOCK_USER_ID, type GoalType } from '@food-tracker/shared';
import { prisma } from '../../src/lib/prisma.js';
import { recentLocalDateTime, TEST_TIMEZONE } from './dates.js';

export async function seedProfile(
  overrides: Partial<{
    age: number;
    birthDate: Date;
    sex: string;
    heightInches: number;
    timezone: string;
    startingWeightLb: number;
    name: string;
    activityLevel:
      | 'sedentary'
      | 'lightly_active'
      | 'moderately_active'
      | 'very_active'
      | 'athlete';
    trainingStyle: 'none' | 'cardio' | 'weight_training' | 'mixed' | 'athlete';
  }> = {},
) {
  return prisma.userProfile.create({
    data: {
      userId: MOCK_USER_ID,
      name: 'Test User',
      age: 30,
      birthDate: new Date('1995-01-01T00:00:00.000Z'),
      sex: 'male',
      heightInches: 70,
      timezone: TEST_TIMEZONE,
      startingWeightLb: 180,
      activityLevel: 'moderately_active',
      trainingStyle: 'mixed',
      ...overrides,
    },
  });
}

export async function seedGoals(
  overrides: Partial<{
    goalType: GoalType;
    goalPace:
      | 'slow'
      | 'moderate'
      | 'aggressive'
      | 'lean_bulk'
      | 'moderate_bulk'
      | 'aggressive_bulk'
      | null;
    targetWeightLb: number;
    targetCalories: number;
    targetProteinGrams: number;
  }> = {},
) {
  const goalType = overrides.goalType ?? 'gain';
  const goalPace =
    overrides.goalPace ?? (goalType === 'maintain' ? null : 'moderate_bulk');

  return prisma.userGoal.create({
    data: {
      userId: MOCK_USER_ID,
      goalType,
      goalPace,
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

export async function seedFoodItem(
  overrides: Partial<{
    userId: string | null;
    name: string;
    brandName: string | null;
    sourceType: 'user_custom' | 'cached_external' | 'app_owned';
    foodType: 'generic' | 'branded';
    normalizedName: string;
    normalizedBrandName: string | null;
    searchText: string;
    archivedAt: Date | null;
  }> = {},
) {
  const name = overrides.name ?? 'Seed food';
  const brandName =
    overrides.brandName === undefined ? null : overrides.brandName;
  const normalizedName =
    overrides.normalizedName ?? name.trim().toLocaleLowerCase();
  const normalizedBrandName =
    overrides.normalizedBrandName ??
    (brandName === null ? null : brandName.trim().toLocaleLowerCase());

  return prisma.foodItem.create({
    data: {
      userId: MOCK_USER_ID,
      name,
      brandName,
      sourceType: 'user_custom',
      foodType: 'generic',
      normalizedName,
      normalizedBrandName,
      searchText:
        overrides.searchText ??
        (normalizedBrandName === null
          ? normalizedName
          : `${normalizedName} ${normalizedBrandName}`),
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
