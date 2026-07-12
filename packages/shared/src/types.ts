import type {
  GoalType,
  ActivityLevel,
  GoalPace,
  FoodItemSourceType,
  FoodItemType,
  FoodSourceProvider,
  MealType,
  RecommendationSeverity,
  RecommendationStatus,
  RecommendationType,
  Sex,
  TrainingStyle,
  TrackingMode,
} from './enums.js';
import type {
  ColumnBackedNutrientKey,
  NormalizedNutrientKey,
  NutrientKey,
  NutrientUnit,
} from './nutrients.js';
import type {
  FoodItemServingOptions,
  FoodLogServingSnapshot,
  Recipe,
  RecipeSnapshot,
} from './schemas.js';
import type { ParsedServingSuggestion } from './serving-text.js';

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
  name: string;
  age: number;
  birthDate: string;
  sex: Sex;
  heightInches: number;
  timezone: string;
  startingWeightLb: number;
  activityLevel: ActivityLevel;
  trainingStyle: TrainingStyle;
}

export interface Goals {
  goalType: GoalType;
  goalPace: GoalPace | null;
  targetWeightLb: number;
  targetCalories: number;
  targetProteinGrams: number;
}

export interface TrackingPreferences {
  mode: TrackingMode;
  waterTrackingEnabled: boolean;
}

export interface SetupStatus {
  profileComplete: boolean;
  goalsComplete: boolean;
  preferencesComplete: boolean;
  isComplete: boolean;
}

export interface SetupResult {
  profile: Profile;
  goals: Goals;
  preferences: TrackingPreferences;
  calculatedTargets: {
    targetCalories: number;
    targetProteinGrams: number;
  };
  status: SetupStatus;
}

export interface SetupPreviewResult {
  age: number;
  calculatedTargets: {
    targetCalories: number;
    targetProteinGrams: number;
  };
}

export interface FoodLog {
  id: string;
  foodItemId: string | null;
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
  servingSnapshot: FoodLogServingSnapshot | null;
  recipeId: string | null;
  recipeSnapshot: RecipeSnapshot | null;
  nutrients: NormalizedNutrientMap;
  loggedAt: string;
  createdAt: string;
  updatedAt: string;
}

export type { Recipe };

export interface AdditionalNutrient {
  amount: number;
  unit: string;
}

export interface NutrientAmount {
  amount: number;
  unit: NutrientUnit;
}

export type NormalizedNutrientMap = Partial<
  Record<NormalizedNutrientKey, NutrientAmount>
>;

export interface FoodBarcode {
  id: string;
  barcode: string;
  barcodeFormat: string | null;
  regionCode: string;
}

export interface FoodItem {
  id: string;
  name: string;
  brandName: string | null;
  sourceType: FoodItemSourceType;
  foodType: FoodItemType;
  sourceProvider: FoodSourceProvider | null;
  sourceId: string | null;
  sourceUpdatedAt: string | null;
  isSaved: boolean;
  servingQuantity: number | null;
  servingUnit: string | null;
  servingWeightGrams: number | null;
  servingOptions: FoodItemServingOptions | null;
  defaultWholeItemServing?: DefaultWholeItemServing | null;
  calories: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
  fiber: number | null;
  sugar: number | null;
  sodium: number | null;
  additionalNutrients: Record<string, AdditionalNutrient> | null;
  nutrients: NormalizedNutrientMap;
  barcodes: FoodBarcode[];
  createdAt: string;
  updatedAt: string;
}

export interface DefaultWholeItemServing {
  optionId: string;
  label: string;
  quantity: number;
  unit: string;
  equivalentWeightGrams: number | null;
  equivalentVolumeMl: number | null;
}

export type AiFoodCandidateMatchReason =
  | 'recent'
  | 'saved'
  | 'custom'
  | 'app'
  | 'cached_external'
  | 'barcode_cached'
  | 'usda_fdc';

export type AiFoodCandidateConfidence = 'high' | 'medium' | 'low';

export type AiFoodReviewStatus = 'matched' | 'needs_review' | 'unmatched';

export interface AiFoodParseExternalFood {
  sourceProvider: 'usda_fdc';
  sourceId: string;
  name: string;
  brandName: string | null;
  foodType: FoodItemType;
  servingBasisText: string;
  servingQuantity: number | null;
  servingUnit: string | null;
  servingWeightGrams: number | null;
  servingOptions: FoodItemServingOptions | null;
  defaultWholeItemServing?: DefaultWholeItemServing | null;
  calories: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
  fiber: number | null;
  sugar: number | null;
  sodium: number | null;
  nutrients: NormalizedNutrientMap;
}

export interface AiFoodParseFoodItemCandidate {
  candidateType: 'food_item';
  foodItem: FoodItem;
  externalFood: null;
  rank: number;
  matchReason: AiFoodCandidateMatchReason;
  confidence: AiFoodCandidateConfidence;
  defaultServingMultiplier: number;
}

export interface AiFoodParseExternalCandidate {
  candidateType: 'external_food';
  foodItem: null;
  externalFood: AiFoodParseExternalFood;
  rank: number;
  matchReason: 'usda_fdc';
  confidence: AiFoodCandidateConfidence;
  defaultServingMultiplier: number;
}

export type AiFoodParseCandidate =
  | AiFoodParseFoodItemCandidate
  | AiFoodParseExternalCandidate;

export interface AiFoodParsedItem {
  id: string;
  parsedName: string;
  quantityText: string | null;
  servingText: string | null;
  servingSuggestion: ParsedServingSuggestion;
  reviewStatus: AiFoodReviewStatus;
  loggable: boolean;
  selectedCandidateId: string | null;
  candidates: AiFoodParseCandidate[];
}

export interface AiFoodParseResult {
  description: string;
  items: AiFoodParsedItem[];
}

export interface AiNutritionEstimateResult {
  source: 'ai_estimate';
  trustLevel: 'low';
  foodName: string;
  servingText: string | null;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number | null;
  sugar: number | null;
  sodium: number | null;
  nutrients: Record<string, never>;
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
    nutrients: Record<ColumnBackedNutrientKey, NutrientCompleteness>;
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

export interface DailyNutrientTotals {
  date: string;
  nutrients: Partial<Record<NutrientKey, NutrientAmount>>;
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
