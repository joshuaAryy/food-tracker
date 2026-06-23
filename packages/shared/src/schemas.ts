import { z } from 'zod';
import {
  ACTIVITY_LEVELS,
  GOAL_PACES,
  GOAL_TYPES,
  MEAL_TYPES,
  RECOMMENDATION_SEVERITIES,
  RECOMMENDATION_STATUSES,
  SEXES,
  TRACKING_MODES,
  TRAINING_STYLES,
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

export const timezoneSchema = z.string().refine(
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
export const sexSchema = z.enum(SEXES);
export const activityLevelSchema = z.enum(ACTIVITY_LEVELS);
export const trainingStyleSchema = z.enum(TRAINING_STYLES);
export const goalPaceSchema = z.enum(GOAL_PACES);
export const trackingModeSchema = z.enum(TRACKING_MODES);
export const mealTypeSchema = z.enum(MEAL_TYPES);
export const recommendationSeveritySchema = z.enum(RECOMMENDATION_SEVERITIES);
export const recommendationStatusSchema = z.enum(RECOMMENDATION_STATUSES);
export const recommendationsQuerySchema = z.strictObject({
  status: recommendationStatusSchema.optional().default('active'),
});

export const profileSchema = z.strictObject({
  name: z.string().trim().min(1),
  age: z.number().int().nonnegative(),
  birthDate: localDateSchema,
  sex: sexSchema,
  heightInches: z.number().int().positive(),
  timezone: timezoneSchema,
  startingWeightLb: z.number().positive(),
  activityLevel: activityLevelSchema,
  trainingStyle: trainingStyleSchema,
});

const goalsBaseSchema = z.strictObject({
  goalType: goalTypeSchema,
  goalPace: goalPaceSchema.nullable(),
  targetWeightLb: z.number().positive(),
  targetCalories: z.number().int().nonnegative(),
  targetProteinGrams: z.number().nonnegative(),
});

export const goalsSchema = goalsBaseSchema.refine(
  ({ goalType, goalPace }) =>
    (goalType === 'maintain' && goalPace === null) ||
    (goalType === 'lose' &&
      (goalPace === 'slow' ||
        goalPace === 'moderate' ||
        goalPace === 'aggressive')) ||
    (goalType === 'gain' &&
      (goalPace === 'lean_bulk' ||
        goalPace === 'moderate_bulk' ||
        goalPace === 'aggressive_bulk')),
  {
    message: 'goalPace must match goalType',
    path: ['goalPace'],
  },
);

export const trackingPreferencesSchema = z.strictObject({
  mode: trackingModeSchema,
  waterTrackingEnabled: z.boolean(),
});

export const setupStatusSchema = z
  .strictObject({
    profileComplete: z.boolean(),
    goalsComplete: z.boolean(),
    preferencesComplete: z.boolean(),
    isComplete: z.boolean(),
  })
  .refine(
    ({ profileComplete, goalsComplete, preferencesComplete, isComplete }) =>
      isComplete === (profileComplete && goalsComplete && preferencesComplete),
    {
      message: 'isComplete must match the section completion state',
      path: ['isComplete'],
    },
  );

export const setupInputSchema = z
  .strictObject({
    profile: profileSchema.omit({ age: true }),
    goals: goalsBaseSchema.omit({
      targetCalories: true,
      targetProteinGrams: true,
    }),
    preferences: trackingPreferencesSchema,
  })
  .refine(
    ({ goals }) =>
      (goals.goalType === 'maintain' && goals.goalPace === null) ||
      (goals.goalType === 'lose' &&
        (goals.goalPace === 'slow' ||
          goals.goalPace === 'moderate' ||
          goals.goalPace === 'aggressive')) ||
      (goals.goalType === 'gain' &&
        (goals.goalPace === 'lean_bulk' ||
          goals.goalPace === 'moderate_bulk' ||
          goals.goalPace === 'aggressive_bulk')),
    {
      message: 'goalPace must match goalType',
      path: ['goals', 'goalPace'],
    },
  );

export const setupResultSchema = z.strictObject({
  profile: profileSchema,
  goals: goalsSchema,
  preferences: trackingPreferencesSchema,
  calculatedTargets: z.strictObject({
    targetCalories: z.number().int().nonnegative(),
    targetProteinGrams: z.number().nonnegative(),
  }),
  status: setupStatusSchema,
});

export type SetupInput = z.infer<typeof setupInputSchema>;

export const setupPreviewResultSchema = z.strictObject({
  age: z.number().int().nonnegative(),
  calculatedTargets: z.strictObject({
    targetCalories: z.number().int().nonnegative(),
    targetProteinGrams: z.number().nonnegative(),
  }),
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

export type FoodLogInput = z.infer<typeof foodLogInputSchema>;
export type WeightLogInput = z.infer<typeof weightLogInputSchema>;

export const idParamsSchema = z.strictObject({
  id: z.uuid(),
});

export const foodLogsQuerySchema = dateRangeSchema
  .extend({
    date: localDateSchema.optional(),
    mealType: mealTypeSchema.optional(),
    limit: z.coerce.number().int().min(1).max(50).optional(),
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

export const advancedAnalyticsQuerySchema = z.strictObject({
  date: localDateSchema.optional(),
  timezone: timezoneSchema.optional(),
  rangeDays: z.coerce.number().int().min(1).max(365).default(30),
});
