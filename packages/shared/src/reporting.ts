import { z } from 'zod';
import { reportingGoalsSchema } from './reporting-goals.js';
import { reportingNutrientDetailsSchema } from './reporting-nutrients.js';

export const reportPeriodSchema = z.enum(['week', 'month']);
export const reportModeSchema = z.enum(['simple', 'complex']);
export const reportQuerySchema = z.strictObject({
  period: reportPeriodSchema,
  date: z.iso.date().optional(),
});
export const streakCalendarQuerySchema = z.strictObject({
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
});
export const reportingMetricReasonSchema = z.enum([
  'no_data',
  'minimum_logged_days',
  'minimum_weight_logs',
  'missing_goal',
  'missing_target',
]);

export const unavailableMetricSchema = z.object({
  available: z.literal(false),
  reason: reportingMetricReasonSchema,
});

export const consistencyMetricSchema = z.object({
  eligibleDays: z.number().int().nonnegative(),
  loggedDays: z.number().int().nonnegative(),
  percentage: z.number().min(0).max(100),
});

export const availableConsistencySchema = z.object({
  available: z.literal(true),
  value: consistencyMetricSchema,
});

export const consistencyResultSchema = z.union([
  availableConsistencySchema,
  unavailableMetricSchema,
]);

export const adherenceMetricSchema = z.object({
  averageAmount: z.number().nonnegative(),
  targetAmount: z.number().positive(),
  percentage: z.number().nonnegative(),
  adherentDays: z.number().int().nonnegative(),
  loggedDays: z.number().int().nonnegative(),
});

export const adherenceResultSchema = z.union([
  z.object({ available: z.literal(true), value: adherenceMetricSchema }),
  unavailableMetricSchema,
]);

export const weightMetricSchema = z.object({
  latestWeightLb: z.number().positive().nullable(),
  latestLoggedAt: z.string().datetime().nullable(),
  changeLb: z.number().nullable(),
  direction: z.enum(['gaining', 'losing', 'steady']).nullable(),
  trendRateLbPerWeek: z.number().nullable(),
  targetWeightLb: z.number().positive().nullable(),
  progressFromBaselineLb: z.number().nullable(),
  progressToTargetPercent: z.number().min(0).max(100).nullable(),
});

export const weightResultSchema = z.union([
  z.object({ available: z.literal(true), value: weightMetricSchema }),
  unavailableMetricSchema,
]);

export const streakSummarySchema = z.object({
  loggedDays: z.number().int().nonnegative(),
  spanDays: z.number().int().nonnegative(),
  longestLoggedDays: z.number().int().nonnegative(),
  graceUsed: z.boolean(),
  graceDate: z.string().nullable(),
  todayLogged: z.boolean(),
  todayOpen: z.boolean(),
});

export const dailyBreakdownSchema = z.array(
  z.object({
    date: z.string(),
    logged: z.boolean(),
    calories: z.number().nonnegative(),
    proteinGrams: z.number().nonnegative(),
  }),
);

export const periodBoundarySchema = z.object({
  startDate: z.string(),
  endDate: z.string(),
  elapsedThroughDate: z.string(),
});

export const dateBoundarySchema = z.object({
  startDate: z.string(),
  endDate: z.string(),
});

export const acceptedCalorieRangeSchema = z.object({
  lowerRatio: z.number().nonnegative(),
  upperRatio: z.number().nonnegative(),
  lowerCalories: z.number().nonnegative(),
  upperCalories: z.number().nonnegative(),
});

export const averageCalorieStatusSchema = z.enum([
  'no_data',
  'no_target',
  'below_range',
  'within_range',
  'over_range',
]);

const reportTargetMetadataShape = {
  calorieTarget: z.number().int().nonnegative().nullable().optional(),
  proteinTargetGrams: z.number().nonnegative().nullable().optional(),
  acceptedCalorieRange: acceptedCalorieRangeSchema.nullable().optional(),
  averageCalorieStatus: averageCalorieStatusSchema.optional(),
  nutrientDetails: reportingNutrientDetailsSchema.optional(),
  reportingGoals: reportingGoalsSchema,
};

export const comparisonMetricSchema = z.object({
  current: z.number(),
  previous: z.number(),
  delta: z.number(),
});

export const reportsResponseSchema = z.object({
  period: reportPeriodSchema,
  timezone: z.string(),
  trackingMode: reportModeSchema,
  goalDirection: z.enum(['lose', 'maintain', 'gain']).nullable(),
  current: z.object({
    boundaries: periodBoundarySchema,
    streak: streakSummarySchema,
    dailyBreakdown: dailyBreakdownSchema,
    eligibleDays: z.number().int().nonnegative(),
    loggedDays: z.number().int().nonnegative(),
    consistency: consistencyResultSchema,
    calorieAdherence: adherenceResultSchema,
    proteinAdherence: adherenceResultSchema,
    averageCalories: z.number().nonnegative(),
    averageProteinGrams: z.number().nonnegative(),
    weight: weightResultSchema,
    nutrients: z.record(z.string(), z.number()),
    ...reportTargetMetadataShape,
  }),
  previousCompleted: z.object({
    boundaries: periodBoundarySchema,
    dailyBreakdown: dailyBreakdownSchema,
    eligibleDays: z.number().int().nonnegative(),
    loggedDays: z.number().int().nonnegative(),
    consistency: consistencyResultSchema,
    calorieAdherence: adherenceResultSchema,
    proteinAdherence: adherenceResultSchema,
    averageCalories: z.number().nonnegative(),
    averageProteinGrams: z.number().nonnegative(),
    weight: weightResultSchema,
    nutrients: z.record(z.string(), z.number()),
    ...reportTargetMetadataShape,
  }),
  comparison: z.object({
    currentBoundary: dateBoundarySchema,
    previousEquivalentBoundary: dateBoundarySchema,
    loggedDays: comparisonMetricSchema.optional(),
    consistency: comparisonMetricSchema.optional(),
    averageCalories: comparisonMetricSchema.optional(),
    calorieAdherence: comparisonMetricSchema.optional(),
    averageProteinGrams: comparisonMetricSchema.optional(),
    proteinAdherence: comparisonMetricSchema.optional(),
    weightChangeLb: comparisonMetricSchema.optional(),
    weightTrendRateLbPerWeek: comparisonMetricSchema.optional(),
  }),
});

export const streakCalendarPhaseSchema = z.enum(['past', 'today', 'future']);
export const streakCalendarMonthRelationSchema = z.enum([
  'previous',
  'current',
  'next',
]);
export const streakCalendarCalorieStatusSchema = z.enum([
  'not_logged',
  'no_target',
  'below_range',
  'within_range',
  'over_range',
]);
export const streakCalendarStateSchema = z.enum([
  'future',
  'open',
  'missed',
  'logged_without_target',
  'partial',
  'gold',
  'over_target',
  'grace',
]);

export const streakCalendarDaySchema = z.object({
  date: z.string(),
  monthRelation: streakCalendarMonthRelationSchema,
  phase: streakCalendarPhaseSchema,
  logged: z.boolean(),
  grace: z.boolean(),
  missed: z.boolean(),
  open: z.boolean(),
  streakState: streakCalendarStateSchema,
  calories: z.number().nonnegative().nullable(),
  calorieRatio: z.number().nonnegative().nullable(),
  calorieStatus: streakCalendarCalorieStatusSchema,
  goldDay: z.boolean(),
});

export const streakCalendarWeekSchema = z.object({
  startDate: z.string(),
  endDate: z.string(),
  goldWeek: z.boolean(),
  days: z.array(streakCalendarDaySchema).length(7),
});

export const streakCalendarResponseSchema = z.object({
  timezone: z.string(),
  requestedMonth: z.string(),
  monthBoundary: dateBoundarySchema,
  displayBoundary: dateBoundarySchema,
  goalDirection: z.enum(['lose', 'maintain', 'gain']).nullable(),
  activeCalorieTarget: z.number().int().nonnegative().nullable(),
  acceptedCalorieRange: acceptedCalorieRangeSchema.nullable(),
  currentStreak: streakSummarySchema,
  weeks: z.array(streakCalendarWeekSchema),
});

export const progressResponseSchema = z.object({
  timezone: z.string(),
  trackingMode: reportModeSchema,
  goalDirection: z.enum(['lose', 'maintain', 'gain']).nullable(),
  currentStreak: z.object({
    loggedDays: z.number().int().nonnegative(),
    spanDays: z.number().int().nonnegative(),
    longestLoggedDays: z.number().int().nonnegative(),
    graceUsed: z.boolean(),
    graceDate: z.string().nullable(),
    todayLogged: z.boolean(),
    todayOpen: z.boolean(),
  }),
  consistency7Days: consistencyResultSchema,
  consistency30Days: consistencyResultSchema,
  calorieAdherence: adherenceResultSchema,
  proteinAdherence: adherenceResultSchema,
  weight: weightResultSchema,
});

export type ReportPeriod = z.infer<typeof reportPeriodSchema>;
export type ReportQuery = z.infer<typeof reportQuerySchema>;
export type StreakCalendarQuery = z.infer<typeof streakCalendarQuerySchema>;
export type ReportMode = z.infer<typeof reportModeSchema>;
export type ReportingMetricReason = z.infer<typeof reportingMetricReasonSchema>;
export type ReportsResponse = z.infer<typeof reportsResponseSchema>;
export type ProgressResponse = z.infer<typeof progressResponseSchema>;
export type ConsistencyResult = z.infer<typeof consistencyResultSchema>;
export type AdherenceResult = z.infer<typeof adherenceResultSchema>;
export type WeightResult = z.infer<typeof weightResultSchema>;
export type AcceptedCalorieRange = z.infer<typeof acceptedCalorieRangeSchema>;
export type AverageCalorieStatus = z.infer<typeof averageCalorieStatusSchema>;
export type StreakCalendarResponse = z.infer<
  typeof streakCalendarResponseSchema
>;
