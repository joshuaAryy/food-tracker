import { z } from 'zod';

export const reportPeriodSchema = z.enum(['week', 'month']);
export const reportModeSchema = z.enum(['simple', 'complex']);
export const reportQuerySchema = z.strictObject({
  period: reportPeriodSchema,
  date: z.iso.date().optional(),
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
export type ReportMode = z.infer<typeof reportModeSchema>;
export type ReportingMetricReason = z.infer<typeof reportingMetricReasonSchema>;
export type ReportsResponse = z.infer<typeof reportsResponseSchema>;
export type ProgressResponse = z.infer<typeof progressResponseSchema>;
export type ConsistencyResult = z.infer<typeof consistencyResultSchema>;
export type AdherenceResult = z.infer<typeof adherenceResultSchema>;
export type WeightResult = z.infer<typeof weightResultSchema>;
