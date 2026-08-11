import { z } from 'zod';
import {
  canonicalInsightsResponseSchema,
  canonicalTrendResponseSchema,
  loggingDayPhaseSchema,
  loggingDayStateSchema,
  metricDataStateSchema,
  type CanonicalTrendResponse,
  type LoggingDayPhase,
  type LoggingDayState,
  type MetricDataState,
} from './analytics-trends.js';

export const ANALYTICS_INSIGHTS_SECTION_KEYS = [
  'calories',
  'protein',
  'carbs',
  'fat',
  'macroComposition',
  'weight',
  'hydration',
  'loggingConsistency',
] as const;

export type AnalyticsSectionKey =
  (typeof ANALYTICS_INSIGHTS_SECTION_KEYS)[number];

export const analyticsSectionKeySchema = z.enum(
  ANALYTICS_INSIGHTS_SECTION_KEYS,
);

export type AnalyticsSectionFailure = {
  status: 'failed';
  code: 'section_unavailable';
  retryable: true;
};

export type AnalyticsSectionResult<T = CanonicalTrendResponse> =
  | { status: 'available'; data: T; fetchedAt: string }
  | AnalyticsSectionFailure;

export const analyticsSectionFailureSchema = z.strictObject({
  status: z.literal('failed'),
  code: z.literal('section_unavailable'),
  retryable: z.literal(true),
});

export const analyticsSectionResultSchema = z.discriminatedUnion('status', [
  z.strictObject({
    status: z.literal('available'),
    data: canonicalTrendResponseSchema,
    fetchedAt: z.iso.datetime({ offset: true }),
  }),
  analyticsSectionFailureSchema,
]);

export const ANALYTICS_OVERVIEW_KEYS = [
  'periodSummary',
  'energy',
  'macros',
  'nutrientHighlights',
  'hydration',
  'weight',
  'loggingConsistency',
] as const;

export type AnalyticsOverviewKey = (typeof ANALYTICS_OVERVIEW_KEYS)[number];

export const analyticsOverviewKeySchema = z.enum(ANALYTICS_OVERVIEW_KEYS);

export type AnalyticsOverviewFailure = AnalyticsSectionFailure;
export type AnalyticsOverviewResult<T> =
  | { status: 'available'; data: T; fetchedAt: string }
  | AnalyticsOverviewFailure;

const analyticsNumberSchema = z.number().finite();
const analyticsDateSchema = z.iso.date();
const overviewReferenceSourceSchema = z.enum(['user', 'derived', 'default']);
const overviewReferenceNoneReasonSchema = z.enum([
  'not_configured',
  'not_applicable',
]);

export type AnalyticsOverviewPeriodSummary = {
  resolvedRange: { startDate: string; endDate: string };
  loggedDayCount: number;
  eligibleDayCount: number;
  streak: { currentDays: number; longestDays: number };
  currentDayPhase: LoggingDayPhase;
  consistency: number | null;
  interpretation: 'first_use' | 'building' | 'consistent' | 'needs_attention';
};

export type AnalyticsOverviewEnergy = {
  average: number | null;
  numericDayCount: number;
  reference:
    | {
        kind: 'range';
        lower: number;
        upper: number;
        unit: 'kcal';
        source: 'user' | 'derived' | 'default';
      }
    | {
        kind: 'none';
        unit: 'kcal';
        reason: 'not_configured' | 'not_applicable';
      };
  withinRangeDayCount: number;
  comparison: {
    direction: 'up' | 'down' | 'unchanged' | 'unknown';
    percentage: number | null;
  };
  status:
    | 'below_range'
    | 'within_range'
    | 'above_range'
    | 'no_reference'
    | 'unknown';
};

export type AnalyticsOverviewMacros = {
  protein: { grams: number | null; percentage: number | null };
  carbs: { grams: number | null; percentage: number | null };
  fat: { grams: number | null; percentage: number | null };
  status: 'recorded' | 'partial' | 'unknown';
};

type AnalyticsOverviewNutrientAvailability = MetricDataState;
type AnalyticsOverviewReferenceSource = 'user' | 'derived' | 'default';
type AnalyticsOverviewNoReference = {
  kind: 'none';
  reason: 'not_configured' | 'not_applicable';
};

export type AnalyticsOverviewNutrientHighlight =
  | {
      metric: 'fiber';
      value: number | null;
      unit: 'g';
      availability: AnalyticsOverviewNutrientAvailability;
      reference:
        | {
            kind: 'minimum';
            value: number;
            unit: 'g';
            source: AnalyticsOverviewReferenceSource;
          }
        | (AnalyticsOverviewNoReference & { unit: 'g' });
      status: 'below_minimum' | 'meets_minimum' | 'unknown';
    }
  | {
      metric: 'sodium';
      value: number | null;
      unit: 'mg';
      availability: AnalyticsOverviewNutrientAvailability;
      reference:
        | {
            kind: 'limit';
            value: number;
            unit: 'mg';
            source: AnalyticsOverviewReferenceSource;
          }
        | (AnalyticsOverviewNoReference & { unit: 'mg' });
      status: 'within_limit' | 'above_limit' | 'unknown';
    }
  | {
      metric: 'vitaminC';
      value: number | null;
      unit: 'mg';
      availability: AnalyticsOverviewNutrientAvailability;
      reference:
        | {
            kind: 'minimum';
            value: number;
            unit: 'mg';
            source: AnalyticsOverviewReferenceSource;
          }
        | (AnalyticsOverviewNoReference & { unit: 'mg' });
      status: 'below_minimum' | 'meets_minimum' | 'unknown';
    };

export type AnalyticsOverviewNutrientHighlights = {
  highlights: [
    Extract<AnalyticsOverviewNutrientHighlight, { metric: 'fiber' }>,
    Extract<AnalyticsOverviewNutrientHighlight, { metric: 'sodium' }>,
    Extract<AnalyticsOverviewNutrientHighlight, { metric: 'vitaminC' }>,
  ];
};

export type AnalyticsOverviewHydration = {
  today: string;
  total: number | null;
  goal: number;
  status: 'below_goal' | 'goal_met' | 'unknown';
  trendSection: 'hydration';
};

export type AnalyticsOverviewWeightForecast = {
  todayDate: string;
  horizonDays: number;
  points: { date: string; value: number; lower: number; upper: number }[];
};

export type AnalyticsOverviewWeight = {
  current: number | null;
  availability: MetricDataState;
  change: {
    periodDays: number;
    value: number | null;
    direction: 'up' | 'down' | 'unchanged' | 'unknown';
  };
  reference:
    | {
        kind: 'target';
        value: number;
        unit: 'lb';
        source: AnalyticsOverviewReferenceSource;
      }
    | (AnalyticsOverviewNoReference & { unit: 'lb' });
  goalPathStatus:
    | 'moving_toward'
    | 'moving_away'
    | 'at_goal'
    | 'no_goal'
    | 'unknown';
  forecast: AnalyticsOverviewResult<AnalyticsOverviewWeightForecast>;
};

export type AnalyticsOverviewLoggingConsistency = {
  completeDayCount: number;
  partialDayCount: number;
  unloggedDayCount: number;
  inProgressDayCount: number;
  eligibleDayCount: number;
  streak: { currentDays: number; longestDays: number };
  days: {
    date: string;
    loggingDayState: LoggingDayState;
    loggingDayPhase: LoggingDayPhase;
  }[];
};

export interface AnalyticsOverviewDataByKey {
  periodSummary: AnalyticsOverviewPeriodSummary;
  energy: AnalyticsOverviewEnergy;
  macros: AnalyticsOverviewMacros;
  nutrientHighlights: AnalyticsOverviewNutrientHighlights;
  hydration: AnalyticsOverviewHydration;
  weight: AnalyticsOverviewWeight;
  loggingConsistency: AnalyticsOverviewLoggingConsistency;
}

export type AnalyticsOverviewResultMap = {
  [Key in AnalyticsOverviewKey]: AnalyticsOverviewResult<
    AnalyticsOverviewDataByKey[Key]
  >;
};

const overviewAvailableSchema = <DataSchema extends z.ZodType>(
  data: DataSchema,
) =>
  z.strictObject({
    status: z.literal('available'),
    data,
    fetchedAt: z.iso.datetime({ offset: true }),
  });

const overviewResultSchema = <DataSchema extends z.ZodType>(data: DataSchema) =>
  z.discriminatedUnion('status', [
    overviewAvailableSchema(data),
    analyticsSectionFailureSchema,
  ]);

const overviewStreakSchema = z.strictObject({
  currentDays: z.number().int().nonnegative(),
  longestDays: z.number().int().nonnegative(),
});

export const analyticsOverviewPeriodSummarySchema = z.strictObject({
  resolvedRange: z.strictObject({
    startDate: analyticsDateSchema,
    endDate: analyticsDateSchema,
  }),
  loggedDayCount: z.number().int().nonnegative(),
  eligibleDayCount: z.number().int().nonnegative(),
  streak: overviewStreakSchema,
  currentDayPhase: loggingDayPhaseSchema,
  consistency: analyticsNumberSchema.nullable(),
  interpretation: z.enum([
    'first_use',
    'building',
    'consistent',
    'needs_attention',
  ]),
});

const energyReferenceSchema = z.discriminatedUnion('kind', [
  z.strictObject({
    kind: z.literal('range'),
    lower: analyticsNumberSchema,
    upper: analyticsNumberSchema,
    unit: z.literal('kcal'),
    source: overviewReferenceSourceSchema,
  }),
  z.strictObject({
    kind: z.literal('none'),
    unit: z.literal('kcal'),
    reason: overviewReferenceNoneReasonSchema,
  }),
]);

export const analyticsOverviewEnergySchema = z.strictObject({
  average: analyticsNumberSchema.nullable(),
  numericDayCount: z.number().int().nonnegative(),
  reference: energyReferenceSchema,
  withinRangeDayCount: z.number().int().nonnegative(),
  comparison: z.strictObject({
    direction: z.enum(['up', 'down', 'unchanged', 'unknown']),
    percentage: analyticsNumberSchema.nullable(),
  }),
  status: z.enum([
    'below_range',
    'within_range',
    'above_range',
    'no_reference',
    'unknown',
  ]),
});

const macroCompositionValueSchema = z.strictObject({
  grams: analyticsNumberSchema.nullable(),
  percentage: analyticsNumberSchema.nullable(),
});

export const analyticsOverviewMacrosSchema = z.strictObject({
  protein: macroCompositionValueSchema,
  carbs: macroCompositionValueSchema,
  fat: macroCompositionValueSchema,
  status: metricDataStateSchema,
});

const nutrientAvailabilitySchema = metricDataStateSchema;
const nutrientReferenceNoneSchema = (unit: 'g' | 'mg') =>
  z.strictObject({
    kind: z.literal('none'),
    unit: z.literal(unit),
    reason: overviewReferenceNoneReasonSchema,
  });

function overviewNutrientHighlightSchema(
  metric: 'fiber' | 'sodium' | 'vitaminC',
) {
  const unit = metric === 'fiber' ? 'g' : 'mg';
  const referenceKind = metric === 'sodium' ? 'limit' : 'minimum';
  const statuses =
    metric === 'sodium'
      ? ['within_limit', 'above_limit', 'unknown']
      : ['below_minimum', 'meets_minimum', 'unknown'];
  return z
    .strictObject({
      metric: z.literal(metric),
      value: analyticsNumberSchema.nullable(),
      unit: z.literal(unit),
      availability: nutrientAvailabilitySchema,
      reference: z.discriminatedUnion('kind', [
        z.strictObject({
          kind: z.literal(referenceKind),
          value: analyticsNumberSchema,
          unit: z.literal(unit),
          source: overviewReferenceSourceSchema,
        }),
        nutrientReferenceNoneSchema(unit),
      ]),
      status: z.enum(statuses as [string, ...string[]]),
    })
    .superRefine((highlight, context) => {
      if (highlight.availability === 'recorded' && highlight.value === null) {
        context.addIssue({
          code: 'custom',
          message:
            'Recorded nutrient highlights require an authoritative value.',
          path: ['value'],
        });
      }
      if (
        highlight.availability !== 'recorded' &&
        highlight.status !== 'unknown'
      ) {
        context.addIssue({
          code: 'custom',
          message:
            'Partial and unknown nutrient highlights require unknown status.',
          path: ['status'],
        });
      }
      if (
        highlight.reference.kind === 'none' &&
        highlight.status !== 'unknown'
      ) {
        context.addIssue({
          code: 'custom',
          message:
            'Nutrient highlights without a reference require unknown status.',
          path: ['status'],
        });
      }
    });
}

export const analyticsOverviewNutrientHighlightsSchema = z.strictObject({
  highlights: z.tuple([
    overviewNutrientHighlightSchema('fiber'),
    overviewNutrientHighlightSchema('sodium'),
    overviewNutrientHighlightSchema('vitaminC'),
  ]),
});

export const analyticsOverviewHydrationSchema = z.strictObject({
  today: analyticsDateSchema,
  total: analyticsNumberSchema.nonnegative().nullable(),
  goal: analyticsNumberSchema.positive(),
  status: z.enum(['below_goal', 'goal_met', 'unknown']),
  trendSection: z.literal('hydration'),
});

export const analyticsOverviewWeightForecastSchema = z.strictObject({
  todayDate: analyticsDateSchema,
  horizonDays: z.number().int().positive(),
  points: z.array(
    z.strictObject({
      date: analyticsDateSchema,
      value: analyticsNumberSchema,
      lower: analyticsNumberSchema,
      upper: analyticsNumberSchema,
    }),
  ),
});

const weightReferenceSchema = z.discriminatedUnion('kind', [
  z.strictObject({
    kind: z.literal('target'),
    value: analyticsNumberSchema,
    unit: z.literal('lb'),
    source: overviewReferenceSourceSchema,
  }),
  z.strictObject({
    kind: z.literal('none'),
    unit: z.literal('lb'),
    reason: overviewReferenceNoneReasonSchema,
  }),
]);

export const analyticsOverviewWeightSchema = z.strictObject({
  current: analyticsNumberSchema.nullable(),
  availability: metricDataStateSchema,
  change: z.strictObject({
    periodDays: z.number().int().positive(),
    value: analyticsNumberSchema.nullable(),
    direction: z.enum(['up', 'down', 'unchanged', 'unknown']),
  }),
  reference: weightReferenceSchema,
  goalPathStatus: z.enum([
    'moving_toward',
    'moving_away',
    'at_goal',
    'no_goal',
    'unknown',
  ]),
  forecast: overviewResultSchema(analyticsOverviewWeightForecastSchema),
});

export const analyticsOverviewLoggingConsistencySchema = z.strictObject({
  completeDayCount: z.number().int().nonnegative(),
  partialDayCount: z.number().int().nonnegative(),
  unloggedDayCount: z.number().int().nonnegative(),
  inProgressDayCount: z.number().int().nonnegative(),
  eligibleDayCount: z.number().int().nonnegative(),
  streak: overviewStreakSchema,
  days: z.array(
    z.strictObject({
      date: analyticsDateSchema,
      loggingDayState: loggingDayStateSchema,
      loggingDayPhase: loggingDayPhaseSchema,
    }),
  ),
});

export const analyticsOverviewMapSchema = z.strictObject({
  periodSummary: overviewResultSchema(
    analyticsOverviewPeriodSummarySchema,
  ).optional(),
  energy: overviewResultSchema(analyticsOverviewEnergySchema).optional(),
  macros: overviewResultSchema(analyticsOverviewMacrosSchema).optional(),
  nutrientHighlights: overviewResultSchema(
    analyticsOverviewNutrientHighlightsSchema,
  ).optional(),
  hydration: overviewResultSchema(analyticsOverviewHydrationSchema).optional(),
  weight: overviewResultSchema(analyticsOverviewWeightSchema).optional(),
  loggingConsistency: overviewResultSchema(
    analyticsOverviewLoggingConsistencySchema,
  ).optional(),
});

export interface CanonicalInsightsResponseV2 {
  contractVersion: 2;
  mode: 'simple' | 'complex';
  period: 'week' | 'month';
  sections: Partial<
    Record<AnalyticsSectionKey, AnalyticsSectionResult<CanonicalTrendResponse>>
  >;
  overview?: Partial<AnalyticsOverviewResultMap>;
}

export const canonicalInsightsResponseV2Schema = z
  .strictObject({
    contractVersion: z.literal(2),
    mode: z.enum(['simple', 'complex']),
    period: z.enum(['week', 'month']),
    sections: z.partialRecord(
      analyticsSectionKeySchema,
      analyticsSectionResultSchema,
    ),
    overview: analyticsOverviewMapSchema.optional(),
  })
  .superRefine((report, context) => {
    const sections = Object.entries(report.sections);
    const overviewCount = Object.keys(report.overview ?? {}).length;
    if (sections.length + overviewCount === 0) {
      context.addIssue({
        code: 'custom',
        message:
          'At least one analytics section or overview result is required.',
        path: ['sections'],
      });
      return;
    }

    for (const [key, result] of sections) {
      if (result?.status !== 'available') continue;
      if (result.data.primaryMetric !== key) {
        context.addIssue({
          code: 'custom',
          message: 'Analytics section key must match its primary metric.',
          path: ['sections', key, 'data', 'primaryMetric'],
        });
      }
      if (result.data.trackingMode !== report.mode) {
        context.addIssue({
          code: 'custom',
          message:
            'Analytics section tracking mode must match the report mode.',
          path: ['sections', key, 'data', 'trackingMode'],
        });
      }
    }
  });

/** Validates legacy reports before a caller can normalize them into v2. */
export function parseCanonicalInsightsResponseV1(value: unknown) {
  return canonicalInsightsResponseSchema.safeParse(value);
}
