import type {
  FoodBarcode as PrismaFoodBarcode,
  FoodItem as PrismaFoodItem,
  FoodItemNutrient as PrismaFoodItemNutrient,
  FoodLog as PrismaFoodLog,
  FoodLogNutrient as PrismaFoodLogNutrient,
  Recommendation as PrismaRecommendation,
  UserGoal,
  UserProfile,
  WeightLog as PrismaWeightLog,
} from '@prisma/client';
import type {
  AdditionalNutrient,
  FoodItem,
  FoodLog,
  Goals,
  NormalizedNutrientMap,
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

type SerializableFoodItem = PrismaFoodItem & {
  barcodes?: PrismaFoodBarcode[];
  savedByUsers?: { id: string }[];
  nutrients?: PrismaFoodItemNutrient[];
};

type SerializableFoodLog = PrismaFoodLog & {
  nutrients?: PrismaFoodLogNutrient[];
};

function serializeNutrients(
  nutrients: (PrismaFoodItemNutrient | PrismaFoodLogNutrient)[] | undefined,
): NormalizedNutrientMap {
  return Object.fromEntries(
    (nutrients ?? []).map((nutrient) => [
      nutrient.nutrientKey,
      {
        amount: nutrient.amount.toNumber(),
        unit: nutrient.unit,
      },
    ]),
  );
}

export function serializeProfile(profile: UserProfile): Profile {
  return {
    name: profile.name ?? '',
    age: profile.age ?? 0,
    birthDate: profile.birthDate?.toISOString().slice(0, 10) ?? '',
    sex: (profile.sex ?? '') as Profile['sex'],
    heightInches: profile.heightInches ?? 0,
    timezone: profile.timezone,
    startingWeightLb: decimalToNumber(profile.startingWeightLb) ?? 0,
    activityLevel: profile.activityLevel ?? 'sedentary',
    trainingStyle: profile.trainingStyle ?? 'none',
  };
}

export function serializeGoals(goals: UserGoal): Goals {
  return {
    goalType: goals.goalType,
    goalPace: goals.goalPace,
    targetWeightLb: decimalToNumber(goals.targetWeightLb) ?? 0,
    targetCalories: goals.targetCalories ?? 0,
    targetProteinGrams: decimalToNumber(goals.targetProteinGrams) ?? 0,
  };
}

export function serializeFoodLog(foodLog: SerializableFoodLog): FoodLog {
  return {
    id: foodLog.id,
    foodItemId: foodLog.foodItemId,
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
    nutrients: serializeNutrients(foodLog.nutrients),
    loggedAt: foodLog.loggedAt.toISOString(),
    createdAt: foodLog.createdAt.toISOString(),
    updatedAt: foodLog.updatedAt.toISOString(),
  };
}

export function serializeFoodItem(foodItem: SerializableFoodItem): FoodItem {
  return {
    id: foodItem.id,
    name: foodItem.name,
    brandName: foodItem.brandName,
    sourceType: foodItem.sourceType,
    foodType: foodItem.foodType,
    sourceProvider: foodItem.sourceProvider,
    sourceId: foodItem.sourceId,
    sourceUpdatedAt: foodItem.sourceUpdatedAt?.toISOString() ?? null,
    isSaved: (foodItem.savedByUsers?.length ?? 0) > 0,
    servingQuantity: decimalToNumber(foodItem.servingQuantity),
    servingUnit: foodItem.servingUnit,
    servingWeightGrams: decimalToNumber(foodItem.servingWeightGrams),
    calories: foodItem.calories,
    protein: decimalToNumber(foodItem.protein),
    carbs: decimalToNumber(foodItem.carbs),
    fat: decimalToNumber(foodItem.fat),
    fiber: decimalToNumber(foodItem.fiber),
    sugar: decimalToNumber(foodItem.sugar),
    sodium: foodItem.sodium,
    additionalNutrients: foodItem.additionalNutrients as Record<
      string,
      AdditionalNutrient
    > | null,
    nutrients: serializeNutrients(foodItem.nutrients),
    barcodes: (foodItem.barcodes ?? []).map((barcode) => ({
      id: barcode.id,
      barcode: barcode.barcode,
      barcodeFormat: barcode.barcodeFormat,
      regionCode: barcode.regionCode,
    })),
    createdAt: foodItem.createdAt.toISOString(),
    updatedAt: foodItem.updatedAt.toISOString(),
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
