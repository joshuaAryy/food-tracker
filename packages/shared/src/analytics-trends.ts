import { z } from 'zod';
import {
  analyticsAggregationSchema,
  analyticsCoverageFilterSchema,
  analyticsMetricKeySchema,
  analyticsVisualizationSchema,
  type AnalyticsAggregation,
  type AnalyticsCoverageFilter,
  type AnalyticsMetricKey,
  type AnalyticsUnit,
  type AnalyticsVisualization,
} from './analytics-metrics.js';
import type { AnalyticsComparisonStrategy } from './analytics-comparisons.js';

export type { AnalyticsComparisonStrategy } from './analytics-comparisons.js';

export const LOGGING_DAY_STATES = ['complete', 'partial', 'unlogged'] as const;
export const LOGGING_DAY_PHASES = ['closed', 'in_progress'] as const;
export const METRIC_DATA_STATES = ['recorded', 'partial', 'unknown'] as const;

export type LoggingDayState = (typeof LOGGING_DAY_STATES)[number];
export type LoggingDayPhase = (typeof LOGGING_DAY_PHASES)[number];
export type MetricDataState = (typeof METRIC_DATA_STATES)[number];

export const loggingDayStateSchema = z.enum(LOGGING_DAY_STATES);
export const loggingDayPhaseSchema = z.enum(LOGGING_DAY_PHASES);
export const metricDataStateSchema = z.enum(METRIC_DATA_STATES);

export type AnalyticsPeriod =
  | { kind: 'relative'; days: number }
  | { kind: 'custom'; startDate: string; endDate: string };

export const analyticsPeriodSchema = z.discriminatedUnion('kind', [
  z.strictObject({
    kind: z.literal('relative'),
    days: z.number().int().positive(),
  }),
  z.strictObject({
    kind: z.literal('custom'),
    startDate: z.iso.date(),
    endDate: z.iso.date(),
  }),
]);

export interface AnalyticsDailyPoint {
  kind: 'daily';
  date: string;
  loggingDayState: LoggingDayState;
  loggingDayPhase: LoggingDayPhase;
  metricDataState: MetricDataState | null;
  value: number | null;
  normalizedValue?: number;
  foodLogCount: number;
  metricRecordedLogCount: number;
  metricUnknownLogCount: number;
}

export interface AnalyticsAggregatedPoint {
  kind: 'aggregated';
  bucketStartDate: string;
  bucketEndDate: string;
  value: number | null;
  normalizedValue?: number;
  loggingCounts: {
    complete: number;
    partial: number;
    inProgress: number;
    unlogged: number;
  };
  metricCounts: {
    recorded: number;
    partial: number;
    unknown: number;
  };
  numericDayCount: number;
}

export type AnalyticsPoint = AnalyticsDailyPoint | AnalyticsAggregatedPoint;

export interface AnalyticsAxisDomain {
  minimum: number;
  maximum: number;
}

export interface AnalyticsInterpretation {
  kind:
    | 'below_range'
    | 'above_range'
    | 'within_range'
    | 'below_minimum'
    | 'meets_minimum'
    | 'above_limit'
    | 'within_limit';
  message: string;
}

export type AnalyticsForecast =
  | {
      kind: 'available';
      model: 'mean' | 'linear_trend';
      todayDate: string;
      horizonDays: number;
      points: { date: string; value: number; lower: number; upper: number }[];
    }
  | {
      kind: 'unavailable';
      reason: 'insufficient_coverage' | 'unstable' | 'not_applicable';
    };

export type AnalyticsReference =
  | {
      kind: 'target' | 'minimum' | 'limit';
      value: number;
      unit: AnalyticsUnit;
      source: 'user' | 'derived' | 'default';
    }
  | {
      kind: 'range';
      lower: number;
      upper: number;
      unit: AnalyticsUnit;
      source: 'user' | 'derived' | 'default';
    }
  | {
      kind: 'none';
      unit: AnalyticsUnit;
      reason: 'not_configured' | 'not_applicable';
    };

export interface TrendQueryInput {
  primaryMetric: AnalyticsMetricKey;
  comparisonMetric?: AnalyticsMetricKey;
  period: AnalyticsPeriod;
  aggregation: AnalyticsAggregation;
  visualization: AnalyticsVisualization;
  showReference: boolean;
  coverageFilter: AnalyticsCoverageFilter;
  includeForecast?: boolean;
}

export const trendQueryInputSchema = z.strictObject({
  primaryMetric: analyticsMetricKeySchema,
  comparisonMetric: analyticsMetricKeySchema.optional(),
  period: analyticsPeriodSchema,
  aggregation: analyticsAggregationSchema,
  visualization: analyticsVisualizationSchema,
  showReference: z.boolean(),
  coverageFilter: analyticsCoverageFilterSchema,
  includeForecast: z.boolean().optional(),
});

export const analyticsContributorsQueryInputSchema =
  trendQueryInputSchema.extend({
    includeAll: z.boolean().optional(),
  });

export interface CanonicalTrendResponse {
  timezone: string;
  trackingMode: 'simple' | 'complex';
  primaryMetric: AnalyticsMetricKey;
  aggregation: Exclude<AnalyticsAggregation, 'automatic'>;
  resolvedRange: { startDate: string; endDate: string };
  firstEligibleDate: string | null;
  today: string;
  reference: AnalyticsReference;
  interpretation: AnalyticsInterpretation | null;
  relatedMetrics: AnalyticsMetricKey[];
  points: AnalyticsPoint[];
  rollingTrend?: {
    window: number;
    values: (number | null)[];
  };
  forecast?: AnalyticsForecast;
  summary: { numericDayCount: number; average: number | null };
  comparison?: {
    strategy: AnalyticsComparisonStrategy;
    metric: AnalyticsMetricKey;
    points: AnalyticsPoint[];
    reference: AnalyticsReference;
    sharedAxisDomain: AnalyticsAxisDomain | null;
    primaryAxisDomain: AnalyticsAxisDomain | null;
    comparisonAxisDomain: AnalyticsAxisDomain | null;
  };
  macroComposition?: {
    protein: number | null;
    carbs: number | null;
    fat: number | null;
  };
}

export interface AnalyticsContributor {
  foodName: string;
  value: number;
  percentage: number;
}

export interface AnalyticsContributorsResponse {
  metric: AnalyticsMetricKey;
  resolvedRange: { startDate: string; endDate: string };
  recordedTotal: number;
  contributors: AnalyticsContributor[];
  remainder: { value: number; percentage: number } | null;
  hasMore: boolean;
}

export interface CanonicalInsightsResponse {
  mode: 'simple' | 'complex';
  period: 'week' | 'month';
  sections: Partial<Record<AnalyticsMetricKey, CanonicalTrendResponse>>;
}

const analyticsNumberSchema = z.number().finite();
const analyticsDateSchema = z.iso.date();
const analyticsUnitSchema = z.string().min(1);
const analyticsReferenceSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.enum(['target', 'minimum', 'limit']),
    value: analyticsNumberSchema,
    unit: analyticsUnitSchema,
    source: z.enum(['user', 'derived', 'default']),
  }),
  z.object({
    kind: z.literal('range'),
    lower: analyticsNumberSchema,
    upper: analyticsNumberSchema,
    unit: analyticsUnitSchema,
    source: z.enum(['user', 'derived', 'default']),
  }),
  z.object({
    kind: z.literal('none'),
    unit: analyticsUnitSchema,
    reason: z.enum(['not_configured', 'not_applicable']),
  }),
]);
const analyticsPointSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('daily'),
    date: analyticsDateSchema,
    loggingDayState: loggingDayStateSchema,
    loggingDayPhase: loggingDayPhaseSchema,
    metricDataState: metricDataStateSchema.nullable(),
    value: analyticsNumberSchema.nullable(),
    normalizedValue: analyticsNumberSchema.optional(),
    foodLogCount: z.number().int().nonnegative(),
    metricRecordedLogCount: z.number().int().nonnegative(),
    metricUnknownLogCount: z.number().int().nonnegative(),
  }),
  z.object({
    kind: z.literal('aggregated'),
    bucketStartDate: analyticsDateSchema,
    bucketEndDate: analyticsDateSchema,
    value: analyticsNumberSchema.nullable(),
    normalizedValue: analyticsNumberSchema.optional(),
    loggingCounts: z.object({
      complete: z.number().int().nonnegative(),
      partial: z.number().int().nonnegative(),
      inProgress: z.number().int().nonnegative(),
      unlogged: z.number().int().nonnegative(),
    }),
    metricCounts: z.object({
      recorded: z.number().int().nonnegative(),
      partial: z.number().int().nonnegative(),
      unknown: z.number().int().nonnegative(),
    }),
    numericDayCount: z.number().int().nonnegative(),
  }),
]);

export const canonicalTrendResponseSchema = z.object({
  timezone: z.string().min(1),
  trackingMode: z.enum(['simple', 'complex']),
  primaryMetric: analyticsMetricKeySchema,
  aggregation: z.enum(['daily', 'weekly', 'monthly']),
  resolvedRange: z.object({
    startDate: analyticsDateSchema,
    endDate: analyticsDateSchema,
  }),
  firstEligibleDate: analyticsDateSchema.nullable(),
  today: analyticsDateSchema,
  reference: analyticsReferenceSchema,
  interpretation: z
    .object({
      kind: z.enum([
        'below_range',
        'above_range',
        'within_range',
        'below_minimum',
        'meets_minimum',
        'above_limit',
        'within_limit',
      ]),
      message: z.string(),
    })
    .nullable(),
  relatedMetrics: z.array(analyticsMetricKeySchema),
  points: z.array(analyticsPointSchema),
  rollingTrend: z
    .object({
      window: z.number().int().positive(),
      values: z.array(analyticsNumberSchema.nullable()),
    })
    .optional(),
  forecast: z
    .discriminatedUnion('kind', [
      z.object({
        kind: z.literal('available'),
        model: z.enum(['mean', 'linear_trend']),
        todayDate: analyticsDateSchema,
        horizonDays: z.number().int().positive(),
        points: z.array(
          z.object({
            date: analyticsDateSchema,
            value: analyticsNumberSchema,
            lower: analyticsNumberSchema,
            upper: analyticsNumberSchema,
          }),
        ),
      }),
      z.object({
        kind: z.literal('unavailable'),
        reason: z.enum(['insufficient_coverage', 'unstable', 'not_applicable']),
      }),
    ])
    .optional(),
  summary: z.object({
    numericDayCount: z.number().int().nonnegative(),
    average: analyticsNumberSchema.nullable(),
  }),
  comparison: z
    .object({
      strategy: z.enum([
        'shared_unit',
        'dual_axis',
        'reference_normalized',
        'incompatible',
      ]),
      metric: analyticsMetricKeySchema,
      points: z.array(analyticsPointSchema),
      reference: analyticsReferenceSchema,
      sharedAxisDomain: z
        .object({
          minimum: analyticsNumberSchema,
          maximum: analyticsNumberSchema,
        })
        .nullable(),
      primaryAxisDomain: z
        .object({
          minimum: analyticsNumberSchema,
          maximum: analyticsNumberSchema,
        })
        .nullable(),
      comparisonAxisDomain: z
        .object({
          minimum: analyticsNumberSchema,
          maximum: analyticsNumberSchema,
        })
        .nullable(),
    })
    .optional(),
  macroComposition: z
    .object({
      protein: analyticsNumberSchema.nullable(),
      carbs: analyticsNumberSchema.nullable(),
      fat: analyticsNumberSchema.nullable(),
    })
    .optional(),
});

export const canonicalInsightsResponseSchema = z.object({
  mode: z.enum(['simple', 'complex']),
  period: z.enum(['week', 'month']),
  sections: z.partialRecord(
    analyticsMetricKeySchema,
    canonicalTrendResponseSchema,
  ),
});
