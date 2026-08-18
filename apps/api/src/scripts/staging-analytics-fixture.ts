import type {
  LoggingDayPhase,
  LoggingDayState,
  MealType,
  NutrientKey,
  NutrientUnit,
} from '@food-tracker/shared';

const DEFAULT_HISTORY_DAYS = 210;
const DEFAULT_TIMEZONE = 'America/Toronto';

export interface StagingAnalyticsFixtureOptions {
  anchorDate: string;
  historyDays?: number;
  timezone?: string;
}

export interface FixtureFoodLog {
  localDate: string;
  foodName: string;
  mealType: MealType;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  sugar: number;
  sodium: number;
  servingQuantity: number;
  servingUnit: string;
  loggedAt: Date;
}

export interface FixtureFoodLogNutrient {
  foodLogIndex: number;
  nutrientKey: NutrientKey;
  amount: number;
  unit: NutrientUnit;
}

export interface FixtureWeightLog {
  weightLb: number;
  localDate: string;
  loggedAt: Date;
}

export interface FixtureWaterLog {
  amountMl: number;
  localDate: string;
  loggedAt: Date;
}

export interface FixtureSavedView {
  name: string;
  primaryMetric: string;
  comparisonMetric: string | null;
  periodDays: number;
  aggregation: string;
  visualization: string;
  showReference: boolean;
  coverageFilter: string;
  pinned: boolean;
}

export interface StagingAnalyticsFixture {
  anchorDate: string;
  timezone: string;
  historyDays: number;
  profile: {
    name: string;
    age: number;
    birthDate: string;
    sex: string;
    heightInches: number;
    startingWeightLb: number;
    activityLevel: 'moderately_active';
    trainingStyle: 'mixed';
  };
  goal: {
    goalType: 'maintain';
    goalPace: null;
    targetWeightLb: number;
    targetCalories: number;
    targetProteinGrams: number;
    targetCarbsGrams: number;
    targetFatGrams: number;
    targetFiberGrams: number;
    limitSugarGrams: number;
    limitSodiumMg: number;
  };
  preference: {
    mode: 'complex';
    waterTrackingEnabled: true;
    dailyWaterGoalMl: number;
  };
  foodLogs: FixtureFoodLog[];
  foodLogNutrients: FixtureFoodLogNutrient[];
  weightLogs: FixtureWeightLog[];
  waterLogs: FixtureWaterLog[];
  savedViews: FixtureSavedView[];
  recommendations: Array<{
    type: string;
    severity: 'low' | 'medium';
    title: string;
    message: string;
    sourceFacts: Record<string, string | number>;
    status: 'active';
  }>;
}

const MEALS: readonly {
  name: string;
  mealType: MealType;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  sugar: number;
  sodium: number;
  hour: number;
}[] = [
  {
    name: 'Greek yogurt, oats, and berries',
    mealType: 'breakfast',
    calories: 520,
    protein: 32,
    carbs: 64,
    fat: 15,
    fiber: 9,
    sugar: 18,
    sodium: 420,
    hour: 8,
  },
  {
    name: 'Chicken quinoa power bowl',
    mealType: 'lunch',
    calories: 720,
    protein: 48,
    carbs: 76,
    fat: 22,
    fiber: 12,
    sugar: 9,
    sodium: 680,
    hour: 13,
  },
  {
    name: 'Salmon, potatoes, and greens',
    mealType: 'dinner',
    calories: 840,
    protein: 52,
    carbs: 70,
    fat: 32,
    fiber: 11,
    sugar: 7,
    sodium: 720,
    hour: 19,
  },
];

const MICRO_NUTRIENTS: readonly {
  nutrientKey: NutrientKey;
  unit: NutrientUnit;
  base: number;
  variation: number;
}[] = [
  { nutrientKey: 'vitaminC', unit: 'mg', base: 30, variation: 9 },
  { nutrientKey: 'potassium', unit: 'mg', base: 430, variation: 80 },
  { nutrientKey: 'calcium', unit: 'mg', base: 210, variation: 40 },
  { nutrientKey: 'iron', unit: 'mg', base: 3.2, variation: 0.8 },
  { nutrientKey: 'magnesium', unit: 'mg', base: 82, variation: 18 },
  { nutrientKey: 'leucine', unit: 'g', base: 2.8, variation: 0.5 },
  { nutrientKey: 'isoleucine', unit: 'g', base: 1.6, variation: 0.3 },
  { nutrientKey: 'omega3', unit: 'g', base: 0.45, variation: 0.25 },
];

function assertIsoDate(value: string): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error('anchor-date must use YYYY-MM-DD.');
  }
  const parsed = new Date(`${value}T12:00:00.000Z`);
  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== value
  ) {
    throw new Error('anchor-date must be a valid calendar date.');
  }
}

function dateAtOffset(anchorDate: string, offset: number): string {
  const date = new Date(`${anchorDate}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

function loggedAt(localDate: string, hour: number, minute = 0): Date {
  return new Date(
    `${localDate}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00.000Z`,
  );
}

function dailyVariation(dayIndex: number): number {
  return Math.round(Math.sin(dayIndex * 0.47) * 42);
}

function nutrientAmount(
  dayIndex: number,
  mealIndex: number,
  base: number,
  variation: number,
): number {
  const wave = Math.sin(dayIndex * 0.31 + mealIndex * 0.9) * variation;
  return Math.max(0, Math.round((base + wave) * 100) / 100);
}

function nutrientsForFoodLog(
  dayIndex: number,
  mealIndex: number,
  foodLogIndex: number,
): FixtureFoodLogNutrient[] {
  const entries = MICRO_NUTRIENTS.map((nutrient) => ({
    foodLogIndex,
    nutrientKey: nutrient.nutrientKey,
    amount: nutrientAmount(
      dayIndex,
      mealIndex,
      nutrient.base,
      nutrient.variation,
    ),
    unit: nutrient.unit,
  }));

  // Vitamin D is intentionally sparse. A zero omega-3 snapshot is retained as
  // a real recorded value to protect the unknown-versus-zero contract.
  if (dayIndex % 6 === 0 && mealIndex === 0) {
    entries.push({
      foodLogIndex,
      nutrientKey: 'vitaminD',
      amount: 7.5,
      unit: 'mcg',
    });
  }
  if (dayIndex === 1 && mealIndex === 0) {
    const omega3 = entries.find((entry) => entry.nutrientKey === 'omega3');
    if (omega3 !== undefined) omega3.amount = 0;
  }
  return entries;
}

function mealTypesForDay(
  dayIndex: number,
  isToday: boolean,
): readonly MealType[] {
  if (isToday || dayIndex % 7 === 0) return ['breakfast', 'lunch'];
  if (dayIndex % 13 === 0) return [];
  return ['breakfast', 'lunch', 'dinner'];
}

export function buildStagingAnalyticsFixture({
  anchorDate,
  historyDays = DEFAULT_HISTORY_DAYS,
  timezone = DEFAULT_TIMEZONE,
}: StagingAnalyticsFixtureOptions): StagingAnalyticsFixture {
  assertIsoDate(anchorDate);
  if (!Number.isInteger(historyDays) || historyDays < 181) {
    throw new Error('historyDays must be an integer of at least 181.');
  }

  const foodLogs: FixtureFoodLog[] = [];
  const foodLogNutrients: FixtureFoodLogNutrient[] = [];
  const weightLogs: FixtureWeightLog[] = [];
  const waterLogs: FixtureWaterLog[] = [];

  for (let dayIndex = 0; dayIndex <= historyDays; dayIndex += 1) {
    const localDate = dateAtOffset(anchorDate, dayIndex - historyDays);
    const isToday = localDate === anchorDate;
    const variation = dailyVariation(dayIndex);
    const mealTypes = mealTypesForDay(dayIndex, isToday);

    mealTypes.forEach((mealType, mealIndex) => {
      const meal = MEALS.find((candidate) => candidate.mealType === mealType);
      if (meal === undefined) return;
      const foodLogIndex = foodLogs.length;
      foodLogs.push({
        localDate,
        foodName: meal.name,
        mealType,
        calories: meal.calories + variation,
        protein: Math.round((meal.protein + variation / 30) * 10) / 10,
        carbs: Math.round((meal.carbs + variation / 20) * 10) / 10,
        fat: Math.round((meal.fat + variation / 40) * 10) / 10,
        fiber: Math.round((meal.fiber + variation / 80) * 10) / 10,
        sugar: Math.round((meal.sugar + variation / 100) * 10) / 10,
        sodium: Math.max(0, meal.sodium + variation * 2),
        servingQuantity: 1,
        servingUnit: 'serving',
        loggedAt: loggedAt(localDate, meal.hour, dayIndex % 5),
      });
      foodLogNutrients.push(
        ...nutrientsForFoodLog(dayIndex, mealIndex, foodLogIndex),
      );
    });

    if (dayIndex % 2 === 0 || isToday) {
      const trend = dayIndex * 0.028;
      const noise = Math.sin(dayIndex * 0.53) * 0.7;
      weightLogs.push({
        localDate,
        weightLb: Math.round((188 - trend + noise) * 10) / 10,
        loggedAt: loggedAt(localDate, 7, 15),
      });
    }

    if (isToday) {
      waterLogs.push(
        { amountMl: 900, localDate, loggedAt: loggedAt(localDate, 8, 10) },
        { amountMl: 800, localDate, loggedAt: loggedAt(localDate, 14, 20) },
      );
    } else if (dayIndex % 13 !== 0) {
      const total = 1500 + ((dayIndex * 137) % 900);
      const entries = 2 + (dayIndex % 2);
      for (let entryIndex = 0; entryIndex < entries; entryIndex += 1) {
        const amount =
          entryIndex === entries - 1
            ? total - Math.floor(total / entries) * (entries - 1)
            : Math.floor(total / entries);
        waterLogs.push({
          amountMl: amount,
          localDate,
          loggedAt: loggedAt(localDate, 8 + entryIndex * 4, 10),
        });
      }
    }
  }

  return {
    anchorDate,
    timezone,
    historyDays,
    profile: {
      name: 'Phase 17.5 QA',
      age: 34,
      birthDate: '1992-06-15',
      sex: 'female',
      heightInches: 67,
      startingWeightLb: 188,
      activityLevel: 'moderately_active',
      trainingStyle: 'mixed',
    },
    goal: {
      goalType: 'maintain',
      goalPace: null,
      targetWeightLb: 182,
      targetCalories: 2200,
      targetProteinGrams: 150,
      targetCarbsGrams: 245,
      targetFatGrams: 75,
      targetFiberGrams: 28,
      limitSugarGrams: 55,
      limitSodiumMg: 2300,
    },
    preference: {
      mode: 'complex',
      waterTrackingEnabled: true,
      dailyWaterGoalMl: 2000,
    },
    foodLogs,
    foodLogNutrients,
    weightLogs,
    waterLogs,
    savedViews: [
      {
        name: 'Calories · 90D',
        primaryMetric: 'calories',
        comparisonMetric: null,
        periodDays: 90,
        aggregation: 'automatic',
        visualization: 'bars_with_trend',
        showReference: true,
        coverageFilter: 'all_logged_days',
        pinned: false,
      },
      {
        name: 'Protein + Weight · 90D',
        primaryMetric: 'protein',
        comparisonMetric: 'weight',
        periodDays: 90,
        aggregation: 'automatic',
        visualization: 'dual_axis',
        showReference: true,
        coverageFilter: 'all_logged_days',
        pinned: true,
      },
      {
        name: 'Sodium + Potassium · normalized',
        primaryMetric: 'sodium',
        comparisonMetric: 'potassium',
        periodDays: 90,
        aggregation: 'automatic',
        visualization: 'reference_normalized',
        showReference: true,
        coverageFilter: 'all_logged_days',
        pinned: false,
      },
      {
        name: 'Hydration · 30D',
        primaryMetric: 'hydration',
        comparisonMetric: null,
        periodDays: 30,
        aggregation: 'automatic',
        visualization: 'bars_with_trend',
        showReference: true,
        coverageFilter: 'all_logged_days',
        pinned: false,
      },
    ],
    recommendations: [
      {
        type: 'protein_consistency',
        severity: 'low',
        title: 'Keep protein consistent',
        message: 'Your protein average is close to the configured daily goal.',
        sourceFacts: { metric: 'protein', periodDays: 30 },
        status: 'active',
      },
      {
        type: 'hydration_follow_through',
        severity: 'medium',
        title: 'Hydration is still building',
        message:
          'A second refill would usually bring this fixture closer to goal.',
        sourceFacts: { metric: 'hydration', goalMl: 2000 },
        status: 'active',
      },
    ],
  };
}

export function classifyFixtureDays(fixture: StagingAnalyticsFixture): {
  today: { state: LoggingDayState; phase: LoggingDayPhase };
  counts: Record<LoggingDayState, number>;
  unloggedDates: string[];
} {
  const counts: Record<LoggingDayState, number> = {
    complete: 0,
    partial: 0,
    unlogged: 0,
  };
  const unloggedDates: string[] = [];
  for (let offset = -fixture.historyDays; offset < 0; offset += 1) {
    const date = dateAtOffset(fixture.anchorDate, offset);
    const meals = fixture.foodLogs
      .filter((log) => log.localDate === date)
      .map((log) => log.mealType);
    const state: LoggingDayState =
      meals.length === 0
        ? 'unlogged'
        : (['breakfast', 'lunch', 'dinner'] as const).every((meal) =>
              meals.includes(meal),
            )
          ? 'complete'
          : 'partial';
    counts[state] += 1;
    if (state === 'unlogged') unloggedDates.push(date);
  }
  const todayMeals = fixture.foodLogs
    .filter((log) => log.localDate === fixture.anchorDate)
    .map((log) => log.mealType);
  return {
    today: {
      state: todayMeals.length === 0 ? 'unlogged' : 'partial',
      phase: 'in_progress',
    },
    counts,
    unloggedDates,
  };
}

export function assertStagingSeedSafety(input: {
  appEnv: string | undefined;
  allowReset: boolean;
  target: string | undefined;
}): void {
  if (input.appEnv?.trim().toLowerCase() !== 'staging') {
    throw new Error('Refusing QA seed: APP_ENV must be staging.');
  }
  if (!input.allowReset) {
    throw new Error(
      'Refusing QA seed: explicit reset confirmation is required.',
    );
  }
  if (input.target?.trim().length === 0 || input.target === undefined) {
    throw new Error('Refusing QA seed: an explicit target user is required.');
  }
}
