import type {
  AnalyticsMetricKey,
  AnalyticsReference,
  AnalyticsSavedView,
  CanonicalInsightsResponse,
  CanonicalTrendResponse,
  TrendQueryInput,
  WaterLog,
} from '@food-tracker/shared';

export const analyticsFixtureLayouts = {
  standard390: { width: 390, fontScale: 1 },
  compact320: { width: 320, fontScale: 1 },
  largeType390: { width: 390, fontScale: 1.45 },
} as const;

export const analyticsReferenceFixtures = {
  trueRange: {
    kind: 'range',
    lower: 1700,
    upper: 2300,
    unit: 'kcal',
    source: 'derived',
  },
  oneBound: {
    kind: 'target',
    value: 2000,
    unit: 'kcal',
    source: 'user',
  },
  noBound: {
    kind: 'none',
    unit: 'mcg',
    reason: 'not_configured',
  },
} as const satisfies Record<string, AnalyticsReference>;

/**
 * The Figma 30D state explicitly reports 21 complete, 3 partial, and 3
 * unlogged coverage entries. The three omitted calendar dates remain gaps,
 * rather than being fabricated as zero-valued days.
 */
const canonicalCoverageDays = [
  ['2026-07-06', 'complete'],
  ['2026-07-07', 'complete'],
  ['2026-07-08', 'complete'],
  ['2026-07-09', 'complete'],
  ['2026-07-11', 'partial'],
  ['2026-07-12', 'complete'],
  ['2026-07-13', 'complete'],
  ['2026-07-14', 'complete'],
  ['2026-07-15', 'complete'],
  ['2026-07-16', 'complete'],
  ['2026-07-17', 'complete'],
  ['2026-07-18', 'unlogged'],
  ['2026-07-19', 'complete'],
  ['2026-07-21', 'complete'],
  ['2026-07-22', 'complete'],
  ['2026-07-23', 'complete'],
  ['2026-07-24', 'partial'],
  ['2026-07-25', 'complete'],
  ['2026-07-26', 'complete'],
  ['2026-07-27', 'complete'],
  ['2026-07-28', 'complete'],
  ['2026-07-29', 'complete'],
  ['2026-07-31', 'unlogged'],
  ['2026-08-01', 'complete'],
  ['2026-08-02', 'partial'],
  ['2026-08-03', 'complete'],
  ['2026-08-04', 'unlogged'],
] as const satisfies readonly (readonly [
  string,
  'complete' | 'partial' | 'unlogged',
])[];

function loggingDayPhaseFor(date: string): 'closed' | 'in_progress' {
  return date === '2026-08-04' ? 'in_progress' : 'closed';
}

function pointsForMetric(
  value: number,
  selectedValue = value,
  valuesByDate: Readonly<Record<string, number>> = {},
): CanonicalTrendResponse['points'] {
  return canonicalCoverageDays.map(([date, loggingDayState]) => {
    if (loggingDayState === 'unlogged') {
      return {
        kind: 'daily' as const,
        date,
        loggingDayState,
        loggingDayPhase: loggingDayPhaseFor(date),
        metricDataState: null,
        value: null,
        foodLogCount: 0,
        metricRecordedLogCount: 0,
        metricUnknownLogCount: 0,
      };
    }
    return {
      kind: 'daily' as const,
      date,
      loggingDayState,
      loggingDayPhase: loggingDayPhaseFor(date),
      metricDataState:
        loggingDayState === 'partial'
          ? ('partial' as const)
          : ('recorded' as const),
      value:
        valuesByDate[date] ?? (date === '2026-07-29' ? selectedValue : value),
      foodLogCount: loggingDayState === 'partial' ? 2 : 3,
      metricRecordedLogCount: loggingDayState === 'partial' ? 1 : 3,
      metricUnknownLogCount: loggingDayState === 'partial' ? 1 : 0,
    };
  });
}

export const loggingAndCoveragePoints = pointsForMetric(1792, 2490, {
  '2026-07-27': 1782,
  '2026-07-28': 2400,
});

const sparseVitaminDPoints: CanonicalTrendResponse['points'] =
  canonicalCoverageDays.map(([date, loggingDayState]) => {
    if (loggingDayState === 'unlogged') {
      return {
        kind: 'daily' as const,
        date,
        loggingDayState,
        loggingDayPhase: loggingDayPhaseFor(date),
        metricDataState: null,
        value: null,
        foodLogCount: 0,
        metricRecordedLogCount: 0,
        metricUnknownLogCount: 0,
      };
    }
    if (date === '2026-07-29') {
      return {
        kind: 'daily' as const,
        date,
        loggingDayState,
        loggingDayPhase: loggingDayPhaseFor(date),
        metricDataState: 'recorded' as const,
        value: 18.2,
        foodLogCount: 3,
        metricRecordedLogCount: 1,
        metricUnknownLogCount: 2,
      };
    }
    return {
      kind: 'daily' as const,
      date,
      loggingDayState,
      loggingDayPhase: loggingDayPhaseFor(date),
      metricDataState: 'unknown' as const,
      value: null,
      foodLogCount: loggingDayState === 'partial' ? 2 : 3,
      metricRecordedLogCount: 0,
      metricUnknownLogCount: loggingDayState === 'partial' ? 2 : 3,
    };
  });

function trendFixture(
  primaryMetric: AnalyticsMetricKey,
  options: {
    readonly trackingMode?: 'simple' | 'complex';
    readonly reference?: AnalyticsReference;
    readonly points?: CanonicalTrendResponse['points'];
    readonly average?: number | null;
    readonly numericDayCount?: number;
    readonly forecast?: CanonicalTrendResponse['forecast'];
    readonly resolvedRange?: CanonicalTrendResponse['resolvedRange'];
    readonly firstEligibleDate?: string;
    readonly today?: string;
  } = {},
): CanonicalTrendResponse {
  const points = [...(options.points ?? loggingAndCoveragePoints)];
  return {
    timezone: 'America/New_York',
    trackingMode: options.trackingMode ?? 'simple',
    primaryMetric,
    aggregation: 'daily',
    resolvedRange:
      options.resolvedRange ??
      ({ startDate: '2026-07-06', endDate: '2026-08-04' } as const),
    firstEligibleDate: options.firstEligibleDate ?? '2026-07-06',
    today: options.today ?? '2026-08-04',
    reference: options.reference ?? analyticsReferenceFixtures.noBound,
    interpretation: null,
    relatedMetrics: [],
    points,
    summary: {
      numericDayCount: options.numericDayCount ?? 24,
      average: options.average ?? 1846,
    },
    ...(options.forecast === undefined ? {} : { forecast: options.forecast }),
  };
}

export const caloriesTrendFixture = trendFixture('calories', {
  reference: analyticsReferenceFixtures.trueRange,
  points: loggingAndCoveragePoints,
  average: 1846,
  numericDayCount: 24,
  forecast: { kind: 'unavailable', reason: 'insufficient_coverage' },
});

export const activeScrubTrendFixture = caloriesTrendFixture;

export const sparseVitaminDTrendFixture = trendFixture('vitaminD', {
  trackingMode: 'complex',
  reference: analyticsReferenceFixtures.noBound,
  points: sparseVitaminDPoints,
  average: 18.2,
  numericDayCount: 1,
});

export const simpleInsightsFixture = {
  mode: 'simple',
  period: 'month',
  sections: {
    calories: caloriesTrendFixture,
    protein: trendFixture('protein', {
      reference: { kind: 'target', value: 145, unit: 'g', source: 'user' },
      points: pointsForMetric(149),
      average: 149,
    }),
    carbs: trendFixture('carbs', {
      reference: { kind: 'target', value: 250, unit: 'g', source: 'user' },
      points: pointsForMetric(269),
      average: 269,
    }),
    fat: trendFixture('fat', {
      reference: { kind: 'target', value: 65, unit: 'g', source: 'user' },
      points: pointsForMetric(49),
      average: 49,
    }),
    macroComposition: trendFixture('macroComposition', {
      average: null,
      numericDayCount: 0,
    }),
    weight: trendFixture('weight', {
      reference: { kind: 'target', value: 128, unit: 'lb', source: 'user' },
      points: pointsForMetric(129.4),
      average: 129.4,
    }),
    hydration: trendFixture('hydration', {
      reference: { kind: 'target', value: 2000, unit: 'mL', source: 'user' },
      points: pointsForMetric(1630),
      average: 1630,
    }),
    loggingConsistency: trendFixture('loggingConsistency', {
      points: pointsForMetric(87),
      average: 87,
    }),
  },
} satisfies CanonicalInsightsResponse;

function complexTrendFixture(
  trend: CanonicalTrendResponse,
): CanonicalTrendResponse {
  return { ...trend, trackingMode: 'complex' };
}

export const complexInsightsFixture = {
  ...simpleInsightsFixture,
  mode: 'complex',
  sections: {
    calories: complexTrendFixture(simpleInsightsFixture.sections.calories),
    protein: complexTrendFixture(simpleInsightsFixture.sections.protein),
    carbs: complexTrendFixture(simpleInsightsFixture.sections.carbs),
    fat: complexTrendFixture(simpleInsightsFixture.sections.fat),
    macroComposition: complexTrendFixture(
      simpleInsightsFixture.sections.macroComposition,
    ),
    weight: complexTrendFixture(simpleInsightsFixture.sections.weight),
    hydration: complexTrendFixture(simpleInsightsFixture.sections.hydration),
    loggingConsistency: complexTrendFixture(
      simpleInsightsFixture.sections.loggingConsistency,
    ),
    vitaminD: sparseVitaminDTrendFixture,
    vitaminC: trendFixture('vitaminC', {
      trackingMode: 'complex',
      reference: { kind: 'minimum', value: 90, unit: 'mg', source: 'derived' },
      points: pointsForMetric(96),
      average: 96,
    }),
    sodium: trendFixture('sodium', {
      trackingMode: 'complex',
      reference: { kind: 'limit', value: 2300, unit: 'mg', source: 'derived' },
      points: pointsForMetric(2516),
      average: 2516,
    }),
  },
} satisfies CanonicalInsightsResponse;

export const firstUseCaloriesTrendFixture = trendFixture('calories', {
  reference: { kind: 'none', unit: 'kcal', reason: 'not_configured' },
  points: [
    {
      kind: 'daily',
      date: '2026-08-05',
      loggingDayState: 'partial',
      loggingDayPhase: 'in_progress',
      metricDataState: 'recorded',
      value: 612,
      foodLogCount: 1,
      metricRecordedLogCount: 1,
      metricUnknownLogCount: 0,
    },
  ],
  average: 612,
  numericDayCount: 1,
  resolvedRange: { startDate: '2026-07-30', endDate: '2026-08-05' },
  firstEligibleDate: '2026-07-30',
  today: '2026-08-05',
});

export const firstUseProteinTrendFixture = trendFixture('protein', {
  reference: { kind: 'none', unit: 'g', reason: 'not_configured' },
  points: [
    {
      kind: 'daily',
      date: '2026-08-05',
      loggingDayState: 'partial',
      loggingDayPhase: 'in_progress',
      metricDataState: 'recorded',
      value: 38,
      foodLogCount: 1,
      metricRecordedLogCount: 1,
      metricUnknownLogCount: 0,
    },
  ],
  average: 38,
  numericDayCount: 1,
  resolvedRange: { startDate: '2026-07-30', endDate: '2026-08-05' },
  firstEligibleDate: '2026-07-30',
  today: '2026-08-05',
});

export const savedViewFixture: AnalyticsSavedView = {
  id: '4f1c4898-0123-4567-89ab-cdef01234567',
  name: 'Protein + Weight + nutrition consistency · last 90 days',
  primaryMetric: 'protein',
  comparisonMetric: 'weight',
  periodDays: 90,
  aggregation: 'weekly',
  visualization: 'linked_trends',
  showReference: true,
  coverageFilter: 'complete_and_partial',
  sortOrder: 0,
  createdAt: '2026-08-09T00:00:00.000Z',
  updatedAt: '2026-08-09T00:00:00.000Z',
  unavailableMetrics: [],
};

export const longSavedViewFixture: AnalyticsSavedView = {
  ...savedViewFixture,
  id: '7f1c4898-0123-4567-89ab-cdef01234567',
  name: 'Protein + Weight + nutrition consistency · last 90 days · linked weekly trends',
};

export const savedViewTrendQueryFixture: TrendQueryInput = {
  primaryMetric: 'protein',
  comparisonMetric: 'weight',
  period: { kind: 'relative', days: 90 },
  aggregation: 'weekly',
  visualization: 'linked_trends',
  showReference: true,
  coverageFilter: 'complete_and_partial',
};

export const waterLogFixtures = [
  {
    id: '5f1c4898-0123-4567-89ab-cdef01234567',
    amountMl: 250,
    loggedAt: '2026-08-05T14:00:00.000Z',
    createdAt: '2026-08-05T14:00:01.000Z',
    updatedAt: '2026-08-05T14:00:01.000Z',
  },
  {
    id: '6f1c4898-0123-4567-89ab-cdef01234567',
    amountMl: 500,
    loggedAt: '2026-08-05T18:00:00.000Z',
    createdAt: '2026-08-05T18:00:01.000Z',
    updatedAt: '2026-08-05T18:00:01.000Z',
  },
] as const satisfies readonly WaterLog[];
