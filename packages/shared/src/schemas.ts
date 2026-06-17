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

const localDateSchema = z.iso.date();

const dateRangeSchema = z
  .strictObject({
    startDate: localDateSchema.optional(),
    endDate: localDateSchema.optional(),
  })
  .refine(
    ({ startDate, endDate }) =>
      startDate === undefined || endDate === undefined || startDate <= endDate,
    {
      message: 'startDate must not be after endDate',
      path: ['startDate'],
    },
  );

const timezoneSchema = z.string().refine(
  (timezone) => {
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: timezone });
      return true;
    } catch {
      return false;
    }
  },
  { message: 'timezone must be a valid IANA timezone' },
);

export const goalTypeSchema = z.enum(GOAL_TYPES);
export const trackingModeSchema = z.enum(TRACKING_MODES);
export const mealTypeSchema = z.enum(MEAL_TYPES);
export const recommendationSeveritySchema = z.enum(RECOMMENDATION_SEVERITIES);
export const recommendationStatusSchema = z.enum(RECOMMENDATION_STATUSES);

export const profileSchema = z.strictObject({
  age: z.number().int().nonnegative(),
  sex: z.string().min(1),
  heightInches: z.number().int().positive(),
  timezone: timezoneSchema,
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

export const idParamsSchema = z.strictObject({
  id: z.uuid(),
});

export const foodLogsQuerySchema = dateRangeSchema
  .extend({
    date: localDateSchema.optional(),
    mealType: mealTypeSchema.optional(),
  })
  .refine(
    ({ date, startDate, endDate }) =>
      date === undefined || (startDate === undefined && endDate === undefined),
    {
      message: 'date cannot be combined with startDate or endDate',
      path: ['date'],
    },
  );

export const weightLogsQuerySchema = dateRangeSchema;

export const dashboardSummaryQuerySchema = z.strictObject({
  date: localDateSchema.optional(),
});
