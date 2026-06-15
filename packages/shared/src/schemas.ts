import { z } from 'zod';
import {
  GOAL_TYPES,
  MEAL_TYPES,
  RECOMMENDATION_SEVERITIES,
  RECOMMENDATION_STATUSES,
  TRACKING_MODES,
} from './enums.js';

const optionalNonNegativeDecimal = z
  .number()
  .nonnegative()
  .nullable()
  .optional();

export const goalTypeSchema = z.enum(GOAL_TYPES);
export const trackingModeSchema = z.enum(TRACKING_MODES);
export const mealTypeSchema = z.enum(MEAL_TYPES);
export const recommendationSeveritySchema = z.enum(RECOMMENDATION_SEVERITIES);
export const recommendationStatusSchema = z.enum(RECOMMENDATION_STATUSES);

export const profileSchema = z.strictObject({
  age: z.number().int().nonnegative(),
  sex: z.string().min(1),
  heightInches: z.number().int().positive(),
  timezone: z.string().min(1),
  startingWeightLb: z.number().positive(),
});

export const goalsSchema = z.strictObject({
  goalType: goalTypeSchema,
  targetWeightLb: z.number().positive(),
  targetCalories: z.number().int().nonnegative(),
  targetProteinGrams: z.number().nonnegative(),
});

export const trackingPreferencesSchema = z.strictObject({
  mode: trackingModeSchema,
  waterTrackingEnabled: z.boolean(),
});

export const foodLogInputSchema = z.strictObject({
  foodName: z.string().min(1),
  mealType: mealTypeSchema,
  calories: z.number().int().nonnegative(),
  protein: z.number().nonnegative(),
  carbs: optionalNonNegativeDecimal,
  fat: optionalNonNegativeDecimal,
  fiber: optionalNonNegativeDecimal,
  sugar: optionalNonNegativeDecimal,
  sodium: z.number().int().nonnegative().nullable().optional(),
  notes: z.string().nullable().optional(),
  servingQuantity: z.number().positive().nullable().optional(),
  servingUnit: z.string().min(1).nullable().optional(),
  loggedAt: z.iso.datetime(),
});

export const weightLogInputSchema = z.strictObject({
  weightLb: z.number().positive(),
  loggedAt: z.iso.datetime(),
});
