import type {
  GoalType,
  MealType,
  RecommendationSeverity,
  RecommendationStatus,
  RecommendationType,
  TrackingMode,
} from './enums.js';

export interface SuccessResponse<T> {
  success: true;
  data: T;
}

export interface ApiError {
  code: string;
  message: string;
  details: Record<string, unknown>;
}

export interface ErrorResponse {
  success: false;
  error: ApiError;
}

export type ApiResponse<T> = SuccessResponse<T> | ErrorResponse;

export interface Profile {
  age: number;
  sex: string;
  heightInches: number;
  timezone: string;
  startingWeightLb: number;
}

export interface Goals {
  goalType: GoalType;
  targetWeightLb: number;
  targetCalories: number;
  targetProteinGrams: number;
}

export interface TrackingPreferences {
  mode: TrackingMode;
  waterTrackingEnabled: boolean;
}

export interface FoodLog {
  id: string;
  foodName: string;
  mealType: MealType;
  calories: number;
  protein: number;
  carbs: number | null;
  fat: number | null;
  fiber: number | null;
  sugar: number | null;
  sodium: number | null;
  notes: string | null;
  servingQuantity: number | null;
  servingUnit: string | null;
  loggedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface WeightLog {
  id: string;
  weightLb: number;
  loggedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface DashboardSummary {
  date: string;
  foodLogCount: number;
  caloriesConsumed: number;
  calorieTarget: number | null;
  caloriesRemaining: number | null;
  proteinConsumed: number;
  proteinTarget: number | null;
  proteinRemaining: number | null;
  latestWeightLb: number | null;
  trackingMode: TrackingMode;
}

export interface NutrientValues {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  sugar: number;
  sodium: number;
}

export type NutrientKey = keyof NutrientValues;

export interface NutrientCompleteness {
  loggedCount: number;
  possibleCount: number;
  percent: number;
  isCompleteEnough: boolean;
}

export interface TrendWindowInterpretation {
  loggedDayAverage: number;
  loggedDays: number;
  totalDays: number;
  completenessPercent: number;
  isLowConfidence: boolean;
  warning: string | null;
}

export interface AdvancedAnalytics {
  date: string;
  timezone: string;
  rangeDays: number;
  range: {
    startDate: string;
    endDate: string;
  };
  trackingMode: TrackingMode;
  targets: {
    calories: number | null;
    proteinGrams: number | null;
  };
  calorieTrend: {
    average7Day: number;
    average30Day: number;
    difference: number;
    averageType: 'calendarDayAverage';
    past7Days: TrendWindowInterpretation;
    past30Days: TrendWindowInterpretation;
  };
  proteinTrend: {
    average7Day: number;
    average30Day: number;
    difference: number;
    averageType: 'calendarDayAverage';
    past7Days: TrendWindowInterpretation;
    past30Days: TrendWindowInterpretation;
  };
  macros: {
    totals: NutrientValues;
    averagesPerLoggedDay: NutrientValues;
    calorieSplit: {
      proteinPercent: number;
      carbsPercent: number;
      fatPercent: number;
    };
  };
  dataCompleteness: {
    foodLogCount: number;
    daysWithFoodLogs: number;
    totalDaysInRange: number;
    loggingCompletenessPercent: number;
    isLowConfidence: boolean;
    nutrients: Record<NutrientKey, NutrientCompleteness>;
    warnings: string[];
  };
  loggingConsistency: {
    past7Days: {
      loggedDays: number;
      expectedDays: 7;
    };
    past30Days: {
      loggedDays: number;
      expectedDays: 30;
    };
  };
  weightTrend: {
    latestWeightLb: number | null;
    latestLoggedAt: string | null;
    previousWeightLb: number | null;
    previousLoggedAt: string | null;
    changeLb: number | null;
    weeklySlopeLb: number | null;
  };
}

export interface Recommendation {
  id: string;
  type: RecommendationType;
  severity: RecommendationSeverity;
  title: string;
  message: string;
  sourceFacts: Record<string, unknown>;
  status: RecommendationStatus;
  createdAt: string;
}
