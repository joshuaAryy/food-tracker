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

export interface CanonicalTrendResponse {
  timezone: string;
  trackingMode: 'simple' | 'complex';
  primaryMetric: AnalyticsMetricKey;
  aggregation: Exclude<AnalyticsAggregation, 'automatic'>;
  resolvedRange: { startDate: string; endDate: string };
  firstEligibleDate: string | null;
  today: string;
  reference: AnalyticsReference;
  points: AnalyticsPoint[];
  rollingTrend?: {
    window: number;
    values: (number | null)[];
  };
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
