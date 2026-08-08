import { z } from 'zod';
import { type TrackingMode } from './enums.js';
import {
  NUTRIENT_CATALOG,
  NUTRIENT_KEYS,
  type NutrientKey,
  type NutrientUnit,
} from './nutrients.js';
import {
  reportingNutrientGroupForCategory,
  type ReportingNutrientGroup,
} from './reporting-nutrients.js';

export type AnalyticsMetricKey =
  | Exclude<NutrientKey, 'water'>
  | 'weight'
  | 'macroComposition'
  | 'loggingConsistency'
  | 'hydration';

export type AnalyticsUnit =
  | NutrientUnit
  | 'lb'
  | 'percent'
  | 'mL'
  | 'composition';

export const ANALYTICS_VISUALIZATIONS = [
  'automatic',
  'bars_with_trend',
  'smoothed_line',
  'macro_donut',
  'stacked_macros',
  'completeness_heatmap',
  'meal_coverage_heatmap',
  'linked_trends',
  'dual_axis',
  'reference_normalized',
] as const;

export type AnalyticsVisualization = (typeof ANALYTICS_VISUALIZATIONS)[number];

export const ANALYTICS_AGGREGATIONS = [
  'automatic',
  'daily',
  'weekly',
  'monthly',
] as const;

export type AnalyticsAggregation = (typeof ANALYTICS_AGGREGATIONS)[number];

export const ANALYTICS_COVERAGE_FILTERS = [
  'all_logged_days',
  'complete_and_partial',
  'complete_only',
] as const;

export type AnalyticsCoverageFilter =
  (typeof ANALYTICS_COVERAGE_FILTERS)[number];

export interface AnalyticsMetricDefinition {
  key: AnalyticsMetricKey;
  displayName: string;
  group: ReportingNutrientGroup | 'body' | 'behavior' | 'hydration';
  unit: AnalyticsUnit;
  simpleAvailable: boolean;
  complexAvailable: boolean;
  searchableTerms: readonly string[];
  supportedVisualizations: readonly AnalyticsVisualization[];
  supportedAggregations: readonly AnalyticsAggregation[];
  supportedCoverageFilters: readonly AnalyticsCoverageFilter[];
  referenceSupport: 'none' | 'target' | 'minimum' | 'limit' | 'range';
}

const ALL_AGGREGATIONS: readonly AnalyticsAggregation[] = [
  'automatic',
  'daily',
  'weekly',
  'monthly',
];

const ALL_COVERAGE_FILTERS: readonly AnalyticsCoverageFilter[] = [
  'all_logged_days',
  'complete_and_partial',
  'complete_only',
];

const SIMPLE_ANALYTICS_METRIC_KEYS = [
  'calories',
  'protein',
  'carbs',
  'fat',
  'macroComposition',
  'weight',
  'hydration',
  'loggingConsistency',
] as const satisfies readonly AnalyticsMetricKey[];

export { SIMPLE_ANALYTICS_METRIC_KEYS };

function nutrientReferenceSupport(
  key: Exclude<NutrientKey, 'water'>,
): AnalyticsMetricDefinition['referenceSupport'] {
  if (key === 'calories') return 'range';
  if (key === 'sugar' || key === 'sodium' || key === 'caffeine') return 'limit';
  if (key === 'protein' || key === 'carbs' || key === 'fat') return 'target';
  return 'minimum';
}

function nutrientMetricDefinition(
  key: Exclude<NutrientKey, 'water'>,
): AnalyticsMetricDefinition {
  const nutrient = NUTRIENT_CATALOG[key];
  return {
    key,
    displayName: nutrient.displayName,
    group: reportingNutrientGroupForCategory(nutrient.category),
    unit: nutrient.defaultUnit,
    simpleAvailable: SIMPLE_ANALYTICS_METRIC_KEYS.some(
      (simpleKey) => simpleKey === key,
    ),
    complexAvailable: true,
    searchableTerms: [
      key,
      nutrient.displayName,
      ...(nutrient.sourceAliases ?? []),
    ],
    supportedVisualizations: ['automatic', 'bars_with_trend', 'smoothed_line'],
    supportedAggregations: ALL_AGGREGATIONS,
    supportedCoverageFilters: ALL_COVERAGE_FILTERS,
    referenceSupport: nutrientReferenceSupport(key),
  };
}

const nutrientMetricDefinitions = Object.fromEntries(
  NUTRIENT_KEYS.filter(
    (key): key is Exclude<NutrientKey, 'water'> => key !== 'water',
  ).map((key) => [key, nutrientMetricDefinition(key)]),
) as Record<Exclude<NutrientKey, 'water'>, AnalyticsMetricDefinition>;

export const ANALYTICS_METRIC_REGISTRY: Record<
  AnalyticsMetricKey,
  AnalyticsMetricDefinition
> = {
  ...nutrientMetricDefinitions,
  macroComposition: {
    key: 'macroComposition',
    displayName: 'Macro Composition',
    group: 'general',
    unit: 'composition',
    simpleAvailable: true,
    complexAvailable: true,
    searchableTerms: ['macro composition', 'macros', 'macro'],
    supportedVisualizations: ['automatic', 'macro_donut', 'stacked_macros'],
    supportedAggregations: ALL_AGGREGATIONS,
    supportedCoverageFilters: ALL_COVERAGE_FILTERS,
    referenceSupport: 'none',
  },
  weight: {
    key: 'weight',
    displayName: 'Weight',
    group: 'body',
    unit: 'lb',
    simpleAvailable: true,
    complexAvailable: true,
    searchableTerms: ['weight', 'body weight'],
    supportedVisualizations: ['automatic', 'smoothed_line', 'linked_trends'],
    supportedAggregations: ALL_AGGREGATIONS,
    supportedCoverageFilters: ALL_COVERAGE_FILTERS,
    referenceSupport: 'target',
  },
  loggingConsistency: {
    key: 'loggingConsistency',
    displayName: 'Logging Consistency',
    group: 'behavior',
    unit: 'percent',
    simpleAvailable: true,
    complexAvailable: true,
    searchableTerms: ['logging consistency', 'consistency', 'meal coverage'],
    supportedVisualizations: [
      'automatic',
      'completeness_heatmap',
      'meal_coverage_heatmap',
    ],
    supportedAggregations: ALL_AGGREGATIONS,
    supportedCoverageFilters: ALL_COVERAGE_FILTERS,
    referenceSupport: 'none',
  },
  hydration: {
    key: 'hydration',
    displayName: 'Hydration',
    group: 'hydration',
    unit: 'mL',
    simpleAvailable: true,
    complexAvailable: true,
    searchableTerms: ['hydration', 'water'],
    supportedVisualizations: ['automatic', 'bars_with_trend', 'smoothed_line'],
    supportedAggregations: ALL_AGGREGATIONS,
    supportedCoverageFilters: ALL_COVERAGE_FILTERS,
    referenceSupport: 'target',
  },
};

const analyticsMetricKeys = Object.keys(
  ANALYTICS_METRIC_REGISTRY,
) as AnalyticsMetricKey[];

export const analyticsMetricKeySchema = z.enum(
  analyticsMetricKeys as [AnalyticsMetricKey, ...AnalyticsMetricKey[]],
);
export const analyticsVisualizationSchema = z.enum(ANALYTICS_VISUALIZATIONS);
export const analyticsAggregationSchema = z.enum(ANALYTICS_AGGREGATIONS);
export const analyticsCoverageFilterSchema = z.enum(ANALYTICS_COVERAGE_FILTERS);
export const analyticsMetricCatalogSchema = z.array(
  z.object({
    key: analyticsMetricKeySchema,
    displayName: z.string(),
    group: z.string(),
    unit: z.string(),
    simpleAvailable: z.boolean(),
    complexAvailable: z.boolean(),
    searchableTerms: z.array(z.string()),
    supportedVisualizations: z.array(analyticsVisualizationSchema),
    supportedAggregations: z.array(analyticsAggregationSchema),
    supportedCoverageFilters: z.array(analyticsCoverageFilterSchema),
    referenceSupport: z.enum(['none', 'target', 'minimum', 'limit', 'range']),
  }),
);

export function analyticsMetricForKey(
  key: AnalyticsMetricKey,
): AnalyticsMetricDefinition {
  return ANALYTICS_METRIC_REGISTRY[key];
}

export function analyticsMetricsForMode(
  mode: TrackingMode,
): AnalyticsMetricDefinition[] {
  return Object.values(ANALYTICS_METRIC_REGISTRY).filter((metric) =>
    mode === 'simple' ? metric.simpleAvailable : metric.complexAvailable,
  );
}

export function analyticsMetricIsAvailableInMode(
  key: AnalyticsMetricKey,
  mode: TrackingMode,
): boolean {
  const metric = analyticsMetricForKey(key);
  return mode === 'simple' ? metric.simpleAvailable : metric.complexAvailable;
}
