import type {
  GoalType,
  MealType,
  RecommendationSeverity,
  RecommendationStatus,
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
  caloriesConsumed: number;
  calorieTarget: number | null;
  caloriesRemaining: number | null;
  proteinConsumed: number;
  proteinTarget: number | null;
  proteinRemaining: number | null;
  latestWeightLb: number | null;
  trackingMode: TrackingMode;
}

export interface Recommendation {
  id: string;
  type: string;
  severity: RecommendationSeverity;
  title: string;
  message: string;
  sourceFacts: Record<string, unknown>;
  status: RecommendationStatus;
  createdAt: string;
}
