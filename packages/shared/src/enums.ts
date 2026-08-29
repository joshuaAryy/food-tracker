export const GOAL_TYPES = ['lose', 'maintain', 'gain'] as const;
export const SEXES = ['male', 'female'] as const;
export const ACTIVITY_LEVELS = [
  'sedentary',
  'lightly_active',
  'moderately_active',
  'very_active',
  'athlete',
] as const;
export const TRAINING_STYLES = [
  'none',
  'cardio',
  'weight_training',
  'mixed',
  'athlete',
] as const;
export const GOAL_PACES = [
  'slow',
  'moderate',
  'aggressive',
  'lean_bulk',
  'moderate_bulk',
  'aggressive_bulk',
] as const;
export const TRACKING_MODES = ['simple', 'complex'] as const;
export const MEAL_TYPES = [
  'breakfast',
  'lunch',
  'dinner',
  'snack',
  'other',
] as const;
export const RECOMMENDATION_SEVERITIES = ['low', 'medium', 'high'] as const;
export const RECOMMENDATION_STATUSES = [
  'active',
  'dismissed',
  'archived',
] as const;
export const FOOD_ITEM_SOURCE_TYPES = [
  'user_custom',
  'cached_external',
  'app_owned',
] as const;
export const FOOD_ITEM_TYPES = ['generic', 'branded'] as const;
export const FOOD_SOURCE_PROVIDERS = [
  'open_food_facts',
  'usda_fdc',
  'cnf',
  'ciqual',
  'cofid',
  'manual',
  'other',
] as const;
export const RECOMMENDATION_TYPES = [
  'protein_low',
  'calories_under_target',
  'calories_over_target',
  'missing_recent_weight_logs',
  'inconsistent_food_logging',
  'goal_progress_behind_rate',
  'goal_progress_opposite_direction',
  'maintenance_weight_drift',
  'hydration_below_target',
  'micronutrient_below_target',
] as const;

export type GoalType = (typeof GOAL_TYPES)[number];
export type Sex = (typeof SEXES)[number];
export type ActivityLevel = (typeof ACTIVITY_LEVELS)[number];
export type TrainingStyle = (typeof TRAINING_STYLES)[number];
export type GoalPace = (typeof GOAL_PACES)[number];
export type TrackingMode = (typeof TRACKING_MODES)[number];
export type MealType = (typeof MEAL_TYPES)[number];
export type RecommendationSeverity = (typeof RECOMMENDATION_SEVERITIES)[number];
export type RecommendationStatus = (typeof RECOMMENDATION_STATUSES)[number];
export type FoodItemSourceType = (typeof FOOD_ITEM_SOURCE_TYPES)[number];
export type FoodItemType = (typeof FOOD_ITEM_TYPES)[number];
export type FoodSourceProvider = (typeof FOOD_SOURCE_PROVIDERS)[number];
export type RecommendationType = (typeof RECOMMENDATION_TYPES)[number];
