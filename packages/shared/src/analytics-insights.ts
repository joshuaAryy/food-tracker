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
const percentageSchema = analyticsNumberSchema.min(0).max(100);
const analyticsDateSchema = z.iso.date();
const overviewReferenceSourceSchema = z.enum(['user', 'derived', 'default']);
const overviewReferenceNoneReasonSchema = z.enum([
  'not_configured',
  'not_applicable',
]);

export type AnalyticsOverviewPeriodSummary = {
  resolvedRange: { startDate: string; endDate: string };
  loggedDayCount: number;
  eligibleLoggedDayCount: number;
  eligibleTotalDayCount: number;
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
  eligibleLoggedDayCount: number;
  eligibleTotalDayCount: number;
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

export const analyticsOverviewPeriodSummarySchema = z
  .strictObject({
    resolvedRange: z.strictObject({
      startDate: analyticsDateSchema,
      endDate: analyticsDateSchema,
    }),
    loggedDayCount: z.number().int().nonnegative(),
    eligibleLoggedDayCount: z.number().int().nonnegative(),
    eligibleTotalDayCount: z.number().int().nonnegative(),
    streak: overviewStreakSchema,
    currentDayPhase: loggingDayPhaseSchema,
    consistency: percentageSchema.nullable(),
    interpretation: z.enum([
      'first_use',
      'building',
      'consistent',
      'needs_attention',
    ]),
  })
  .superRefine((summary, context) => {
    if (summary.resolvedRange.startDate > summary.resolvedRange.endDate) {
      context.addIssue({
        code: 'custom',
        message: 'Overview period range must be ordered.',
        path: ['resolvedRange'],
      });
    }
    if (summary.eligibleLoggedDayCount > summary.eligibleTotalDayCount) {
      context.addIssue({
        code: 'custom',
        message: 'Eligible logged days cannot exceed eligible total days.',
        path: ['eligibleLoggedDayCount'],
      });
    }
    if (
      summary.eligibleTotalDayCount === 0 &&
      (summary.eligibleLoggedDayCount !== 0 || summary.consistency !== null)
    ) {
      context.addIssue({
        code: 'custom',
        message:
          'A period with no eligible days cannot report logged days or consistency.',
        path: ['consistency'],
      });
    }
    if (
      summary.consistency !== null &&
      summary.eligibleTotalDayCount > 0 &&
      summary.consistency !==
        Math.round(
          (summary.eligibleLoggedDayCount / summary.eligibleTotalDayCount) *
            100,
        )
    ) {
      context.addIssue({
        code: 'custom',
        message: 'Consistency must match eligible logged and total days.',
        path: ['consistency'],
      });
    }
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

export const analyticsOverviewEnergySchema = z
  .strictObject({
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
  })
  .superRefine((energy, context) => {
    if (
      energy.reference.kind === 'range' &&
      energy.reference.lower >= energy.reference.upper
    ) {
      context.addIssue({
        code: 'custom',
        message: 'Energy reference range must be ordered.',
        path: ['reference'],
      });
    }
    if (energy.withinRangeDayCount > energy.numericDayCount) {
      context.addIssue({
        code: 'custom',
        message: 'Energy days within range cannot exceed numeric days.',
        path: ['withinRangeDayCount'],
      });
    }
    if (
      energy.average === null &&
      energy.status !== 'unknown' &&
      energy.status !== 'no_reference'
    ) {
      context.addIssue({
        code: 'custom',
        message: 'Energy without an average cannot report a range status.',
        path: ['status'],
      });
    }
    if (
      energy.reference.kind === 'none' &&
      energy.status !== 'unknown' &&
      energy.status !== 'no_reference'
    ) {
      context.addIssue({
        code: 'custom',
        message: 'Energy without a reference cannot report a range status.',
        path: ['status'],
      });
    }
    if (
      energy.reference.kind === 'range' &&
      energy.average !== null &&
      energy.status !==
        (energy.average < energy.reference.lower
          ? 'below_range'
          : energy.average > energy.reference.upper
            ? 'above_range'
            : 'within_range')
    ) {
      context.addIssue({
        code: 'custom',
        message:
          'Energy status must match its authoritative average and range.',
        path: ['status'],
      });
    }
    if (
      energy.reference.kind === 'range' &&
      energy.average === null &&
      energy.status !== 'unknown'
    ) {
      context.addIssue({
        code: 'custom',
        message: 'Energy without an average must have unknown status.',
        path: ['status'],
      });
    }
    if (
      energy.comparison.percentage === null &&
      energy.comparison.direction !== 'unknown'
    ) {
      context.addIssue({
        code: 'custom',
        message: 'An unknown energy comparison must not report a direction.',
        path: ['comparison', 'direction'],
      });
    }
  });

const macroCompositionValueSchema = z.strictObject({
  grams: analyticsNumberSchema.nullable(),
  percentage: percentageSchema.nullable(),
});

export const analyticsOverviewMacrosSchema = z
  .strictObject({
    protein: macroCompositionValueSchema,
    carbs: macroCompositionValueSchema,
    fat: macroCompositionValueSchema,
    status: metricDataStateSchema,
  })
  .superRefine((macros, context) => {
    const values = [macros.protein, macros.carbs, macros.fat];
    if (
      macros.status === 'recorded' &&
      values.some((value) => value.grams === null)
    ) {
      context.addIssue({
        code: 'custom',
        message: 'Recorded macros require all authoritative gram values.',
        path: ['status'],
      });
    }
    if (
      values.some((value) => value.grams === null && value.percentage !== null)
    ) {
      context.addIssue({
        code: 'custom',
        message: 'A missing macro gram value cannot have a percentage.',
        path: ['status'],
      });
    }
    if (
      macros.status === 'unknown' &&
      values.some((value) => value.grams !== null || value.percentage !== null)
    ) {
      context.addIssue({
        code: 'custom',
        message: 'Unknown macros cannot include an authoritative gram value.',
        path: ['status'],
      });
    }
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
      if (
        highlight.availability === 'recorded' &&
        highlight.value !== null &&
        highlight.reference.kind !== 'none'
      ) {
        const expectedStatus =
          highlight.reference.kind === 'limit'
            ? highlight.value <= highlight.reference.value
              ? 'within_limit'
              : 'above_limit'
            : highlight.value < highlight.reference.value
              ? 'below_minimum'
              : 'meets_minimum';
        if (highlight.status !== expectedStatus) {
          context.addIssue({
            code: 'custom',
            message:
              'Nutrient status must match its authoritative value and reference.',
            path: ['status'],
          });
        }
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

export const analyticsOverviewHydrationSchema = z
  .strictObject({
    today: analyticsDateSchema,
    total: analyticsNumberSchema.nonnegative().nullable(),
    goal: analyticsNumberSchema.positive(),
    status: z.enum(['below_goal', 'goal_met', 'unknown']),
    trendSection: z.literal('hydration'),
  })
  .superRefine((hydration, context) => {
    const expectedStatus =
      hydration.total === null
        ? 'unknown'
        : hydration.total >= hydration.goal
          ? 'goal_met'
          : 'below_goal';
    if (hydration.status !== expectedStatus) {
      context.addIssue({
        code: 'custom',
        message:
          'Hydration status must match its authoritative total and goal.',
        path: ['status'],
      });
    }
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

export const analyticsOverviewWeightSchema = z
  .strictObject({
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
  })
  .superRefine((weight, context) => {
    if (weight.availability === 'recorded' && weight.current === null) {
      context.addIssue({
        code: 'custom',
        message: 'Recorded weight requires an authoritative current value.',
        path: ['current'],
      });
    }
    if (weight.availability !== 'recorded' && weight.current !== null) {
      context.addIssue({
        code: 'custom',
        message: 'Unavailable weight cannot include a current value.',
        path: ['current'],
      });
    }
    if (weight.change.value === null && weight.change.direction !== 'unknown') {
      context.addIssue({
        code: 'custom',
        message: 'Weight without a change value must have unknown direction.',
        path: ['change', 'direction'],
      });
    }
    if (
      weight.reference.kind === 'none' &&
      weight.goalPathStatus !== 'no_goal' &&
      weight.goalPathStatus !== 'unknown'
    ) {
      context.addIssue({
        code: 'custom',
        message: 'Weight without a target cannot report a goal path.',
        path: ['goalPathStatus'],
      });
    }
    if (weight.forecast.status === 'available') {
      const { todayDate, horizonDays, points } = weight.forecast.data;
      if (points.length > horizonDays) {
        context.addIssue({
          code: 'custom',
          message: 'Weight forecast cannot exceed its stated horizon.',
          path: ['forecast', 'data', 'points'],
        });
      }
      let previousDate = todayDate;
      points.forEach((point, index) => {
        if (point.date <= previousDate) {
          context.addIssue({
            code: 'custom',
            message:
              'Weight forecast dates must be strictly after today and ordered.',
            path: ['forecast', 'data', 'points', index, 'date'],
          });
        }
        if (point.lower > point.value || point.value > point.upper) {
          context.addIssue({
            code: 'custom',
            message: 'Weight forecast values must remain inside their bounds.',
            path: ['forecast', 'data', 'points', index],
          });
        }
        previousDate = point.date;
      });
    }
  });

export const analyticsOverviewLoggingConsistencySchema = z
  .strictObject({
    completeDayCount: z.number().int().nonnegative(),
    partialDayCount: z.number().int().nonnegative(),
    unloggedDayCount: z.number().int().nonnegative(),
    inProgressDayCount: z.number().int().nonnegative(),
    eligibleLoggedDayCount: z.number().int().nonnegative(),
    eligibleTotalDayCount: z.number().int().nonnegative(),
    streak: overviewStreakSchema,
    days: z.array(
      z.strictObject({
        date: analyticsDateSchema,
        loggingDayState: loggingDayStateSchema,
        loggingDayPhase: loggingDayPhaseSchema,
      }),
    ),
  })
  .superRefine((consistency, context) => {
    if (
      consistency.eligibleLoggedDayCount > consistency.eligibleTotalDayCount
    ) {
      context.addIssue({
        code: 'custom',
        message: 'Eligible logged days cannot exceed eligible total days.',
        path: ['eligibleLoggedDayCount'],
      });
    }
    const counts = consistency.days.reduce(
      (result, day) => {
        result[day.loggingDayState] += 1;
        if (day.loggingDayPhase === 'in_progress') result.inProgress += 1;
        return result;
      },
      { complete: 0, partial: 0, unlogged: 0, inProgress: 0 },
    );
    if (
      counts.complete !== consistency.completeDayCount ||
      counts.partial !== consistency.partialDayCount ||
      counts.unlogged !== consistency.unloggedDayCount ||
      counts.inProgress !== consistency.inProgressDayCount
    ) {
      context.addIssue({
        code: 'custom',
        message: 'Logging counts must match the authoritative day-state array.',
        path: ['days'],
      });
    }
    if (
      consistency.eligibleTotalDayCount > consistency.days.length ||
      consistency.eligibleLoggedDayCount >
        consistency.completeDayCount + consistency.partialDayCount
    ) {
      context.addIssue({
        code: 'custom',
        message:
          'Logging counts must fit the represented period and day states.',
        path: ['eligibleTotalDayCount'],
      });
    }
    if (
      consistency.streak.currentDays > consistency.days.length ||
      consistency.streak.longestDays > consistency.days.length
    ) {
      context.addIssue({
        code: 'custom',
        message:
          'Logging streak cannot exceed the represented day-state period.',
        path: ['streak'],
      });
    }
    for (let index = 1; index < consistency.days.length; index += 1) {
      const previous = consistency.days[index - 1];
      const current = consistency.days[index];
      if (
        previous !== undefined &&
        current !== undefined &&
        current.date <= previous.date
      ) {
        context.addIssue({
          code: 'custom',
          message: 'Logging day-state entries must be unique and ordered.',
          path: ['days', index, 'date'],
        });
      }
    }
  });

export const analyticsOverviewMapSchema = z.strictObject({
  periodSummary: overviewResultSchema(analyticsOverviewPeriodSummarySchema),
  energy: overviewResultSchema(analyticsOverviewEnergySchema),
  macros: overviewResultSchema(analyticsOverviewMacrosSchema),
  nutrientHighlights: overviewResultSchema(
    analyticsOverviewNutrientHighlightsSchema,
  ),
  hydration: overviewResultSchema(analyticsOverviewHydrationSchema),
  weight: overviewResultSchema(analyticsOverviewWeightSchema),
  loggingConsistency: overviewResultSchema(
    analyticsOverviewLoggingConsistencySchema,
  ),
});

export interface CanonicalInsightsResponseV2 {
  contractVersion: 2;
  mode: 'simple' | 'complex';
  period: 'week' | 'month';
  sections: Partial<
    Record<AnalyticsSectionKey, AnalyticsSectionResult<CanonicalTrendResponse>>
  >;
  overview?: AnalyticsOverviewResultMap;
}

export type CanonicalInsightsResponseV2WithOverview = Omit<
  CanonicalInsightsResponseV2,
  'overview'
> & {
  overview: AnalyticsOverviewResultMap;
};

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

/** Production Insights contract after the overview prerequisite is available. */
export const canonicalInsightsResponseV2WithOverviewSchema = z.intersection(
  canonicalInsightsResponseV2Schema,
  z.strictObject({ overview: analyticsOverviewMapSchema }),
);

/** Validates legacy reports before a caller can normalize them into v2. */
export function parseCanonicalInsightsResponseV1(value: unknown) {
  return canonicalInsightsResponseSchema.safeParse(value);
}
