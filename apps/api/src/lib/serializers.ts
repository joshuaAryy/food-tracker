import type {
  FoodLog as PrismaFoodLog,
  Recommendation as PrismaRecommendation,
  UserGoal,
  UserProfile,
  WeightLog as PrismaWeightLog,
} from '@prisma/client';
import type {
  FoodLog,
  Goals,
  Profile,
  Recommendation,
  RecommendationType,
  WeightLog,
} from '@food-tracker/shared';

export const roundTo = (value: number, decimalPlaces: number): number => {
  const factor = 10 ** decimalPlaces;
  return Math.round((value + Number.EPSILON) * factor) / factor;
};

const decimalToNumber = (value: { toNumber(): number } | null): number | null =>
  value?.toNumber() ?? null;

export function serializeProfile(profile: UserProfile): Profile {
  return {
    age: profile.age ?? 0,
    sex: profile.sex ?? '',
    heightInches: profile.heightInches ?? 0,
    timezone: profile.timezone,
    startingWeightLb: decimalToNumber(profile.startingWeightLb) ?? 0,
  };
}

export function serializeGoals(goals: UserGoal): Goals {
  return {
    goalType: goals.goalType,
    targetWeightLb: decimalToNumber(goals.targetWeightLb) ?? 0,
    targetCalories: goals.targetCalories ?? 0,
    targetProteinGrams: decimalToNumber(goals.targetProteinGrams) ?? 0,
  };
}

export function serializeFoodLog(foodLog: PrismaFoodLog): FoodLog {
  return {
    id: foodLog.id,
    foodName: foodLog.foodName,
    mealType: foodLog.mealType,
    calories: foodLog.calories,
    protein: foodLog.protein.toNumber(),
    carbs: decimalToNumber(foodLog.carbs),
    fat: decimalToNumber(foodLog.fat),
    fiber: decimalToNumber(foodLog.fiber),
    sugar: decimalToNumber(foodLog.sugar),
    sodium: foodLog.sodium,
    notes: foodLog.notes,
    servingQuantity: decimalToNumber(foodLog.servingQuantity),
    servingUnit: foodLog.servingUnit,
    loggedAt: foodLog.loggedAt.toISOString(),
    createdAt: foodLog.createdAt.toISOString(),
    updatedAt: foodLog.updatedAt.toISOString(),
  };
}

export function serializeWeightLog(weightLog: PrismaWeightLog): WeightLog {
  return {
    id: weightLog.id,
    weightLb: weightLog.weightLb.toNumber(),
    loggedAt: weightLog.loggedAt.toISOString(),
    createdAt: weightLog.createdAt.toISOString(),
    updatedAt: weightLog.updatedAt.toISOString(),
  };
}

export function serializeRecommendation(
  recommendation: PrismaRecommendation,
): Recommendation {
  return {
    id: recommendation.id,
    type: recommendation.type as RecommendationType,
    severity: recommendation.severity,
    title: recommendation.title,
    message: recommendation.message,
    sourceFacts: recommendation.sourceFacts as Record<string, unknown>,
    status: recommendation.status,
    createdAt: recommendation.createdAt.toISOString(),
  };
}
