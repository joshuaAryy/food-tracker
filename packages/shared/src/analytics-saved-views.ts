import { z } from 'zod';
import {
  analyticsAggregationSchema,
  analyticsCoverageFilterSchema,
  analyticsMetricKeySchema,
  analyticsVisualizationSchema,
  type AnalyticsAggregation,
  type AnalyticsCoverageFilter,
  type AnalyticsMetricKey,
  type AnalyticsVisualization,
} from './analytics-metrics.js';

const savedViewNameSchema = z.string().trim().min(1).max(80);
const savedViewIdSchema = z.uuid();

export const analyticsSavedViewConfigurationSchema = z.strictObject({
  primaryMetric: analyticsMetricKeySchema,
  comparisonMetric: analyticsMetricKeySchema.nullable().optional(),
  periodDays: z.number().int().positive(),
  aggregation: analyticsAggregationSchema,
  visualization: analyticsVisualizationSchema,
  showReference: z.boolean(),
  coverageFilter: analyticsCoverageFilterSchema,
});

export const analyticsSavedViewCreateSchema =
  analyticsSavedViewConfigurationSchema.extend({ name: savedViewNameSchema });

export const analyticsSavedViewUpdateSchema = analyticsSavedViewCreateSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one saved-view field is required',
  });

export const analyticsSavedViewParamsSchema = z.strictObject({
  id: savedViewIdSchema,
});

export const analyticsSavedViewOrderSchema = z
  .strictObject({ ids: z.array(savedViewIdSchema) })
  .refine(({ ids }) => new Set(ids).size === ids.length, {
    message: 'Saved-view order must not contain duplicate ids',
    path: ['ids'],
  });

export const analyticsPreferenceUpdateSchema = z
  .strictObject({
    preferredSimpleMetric: analyticsMetricKeySchema.optional(),
    pinnedSavedViewId: savedViewIdSchema.nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one analytics preference field is required',
  });

export interface AnalyticsSavedView {
  id: string;
  name: string;
  primaryMetric: AnalyticsMetricKey | string;
  comparisonMetric: AnalyticsMetricKey | string | null;
  periodDays: number;
  aggregation: AnalyticsAggregation | string;
  visualization: AnalyticsVisualization | string;
  showReference: boolean;
  coverageFilter: AnalyticsCoverageFilter | string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  unavailableMetrics: string[];
}

export interface AnalyticsPreferenceValue {
  preferredSimpleMetric: AnalyticsMetricKey;
  pinnedSavedViewId: string | null;
}

export type AnalyticsSavedViewConfiguration = z.infer<
  typeof analyticsSavedViewConfigurationSchema
>;
export type AnalyticsSavedViewCreateInput = z.infer<
  typeof analyticsSavedViewCreateSchema
>;
export type AnalyticsSavedViewUpdateInput = z.infer<
  typeof analyticsSavedViewUpdateSchema
>;
export type AnalyticsSavedViewOrderInput = z.infer<
  typeof analyticsSavedViewOrderSchema
>;
export type AnalyticsPreferenceUpdateInput = z.infer<
  typeof analyticsPreferenceUpdateSchema
>;
