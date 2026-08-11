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
    lower: 1900,
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

export const loggingAndCoveragePoints = [
  {
    kind: 'daily',
    date: '2026-08-01',
    loggingDayState: 'complete',
    loggingDayPhase: 'closed',
    metricDataState: 'recorded',
    value: 1846,
    foodLogCount: 3,
    metricRecordedLogCount: 3,
    metricUnknownLogCount: 0,
  },
  {
    kind: 'daily',
    date: '2026-08-02',
    loggingDayState: 'partial',
    loggingDayPhase: 'closed',
    metricDataState: 'partial',
    value: 1768,
    foodLogCount: 2,
    metricRecordedLogCount: 1,
    metricUnknownLogCount: 1,
  },
  {
    kind: 'daily',
    date: '2026-08-03',
    loggingDayState: 'unlogged',
    loggingDayPhase: 'closed',
    metricDataState: null,
    value: null,
    foodLogCount: 0,
    metricRecordedLogCount: 0,
    metricUnknownLogCount: 0,
  },
  {
    kind: 'daily',
    date: '2026-08-04',
    loggingDayState: 'complete',
    loggingDayPhase: 'closed',
    metricDataState: 'unknown',
    value: null,
    foodLogCount: 3,
    metricRecordedLogCount: 0,
    metricUnknownLogCount: 3,
  },
  {
    kind: 'daily',
    date: '2026-08-05',
    loggingDayState: 'partial',
    loggingDayPhase: 'in_progress',
    metricDataState: 'recorded',
    value: 520,
    foodLogCount: 1,
    metricRecordedLogCount: 1,
    metricUnknownLogCount: 0,
  },
] as const satisfies readonly CanonicalTrendResponse['points'][number][];

function trendFixture(
  primaryMetric: AnalyticsMetricKey,
  options: {
    readonly trackingMode?: 'simple' | 'complex';
    readonly reference?: AnalyticsReference;
    readonly points?: CanonicalTrendResponse['points'];
    readonly average?: number | null;
    readonly numericDayCount?: number;
    readonly forecast?: CanonicalTrendResponse['forecast'];
  } = {},
): CanonicalTrendResponse {
  const points = [...(options.points ?? loggingAndCoveragePoints)];
  return {
    timezone: 'America/New_York',
    trackingMode: options.trackingMode ?? 'simple',
    primaryMetric,
    aggregation: 'daily',
    resolvedRange: { startDate: '2026-08-01', endDate: '2026-08-07' },
    firstEligibleDate: '2026-08-01',
    today: '2026-08-05',
    reference: options.reference ?? analyticsReferenceFixtures.noBound,
    interpretation: null,
    relatedMetrics: [],
    points,
    summary: {
      numericDayCount: options.numericDayCount ?? 3,
      average: options.average ?? 1846,
    },
    ...(options.forecast === undefined ? {} : { forecast: options.forecast }),
  };
}

export const caloriesTrendFixture = trendFixture('calories', {
  reference: analyticsReferenceFixtures.trueRange,
  average: 1846,
  forecast: { kind: 'unavailable', reason: 'insufficient_coverage' },
});

export const activeScrubTrendFixture: CanonicalTrendResponse = {
  ...caloriesTrendFixture,
  points: caloriesTrendFixture.points.map((point) =>
    point.kind === 'daily' && point.date === '2026-08-01'
      ? { ...point, value: 2490 }
      : point,
  ),
};

export const sparseVitaminDTrendFixture = trendFixture('vitaminD', {
  trackingMode: 'complex',
  reference: analyticsReferenceFixtures.noBound,
  points: loggingAndCoveragePoints.map((point) =>
    point.date === '2026-08-01' ? { ...point, value: 18.2 } : point,
  ),
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
      average: 149,
    }),
    carbs: trendFixture('carbs', {
      reference: { kind: 'target', value: 250, unit: 'g', source: 'user' },
      average: 269,
    }),
    fat: trendFixture('fat', {
      reference: { kind: 'target', value: 65, unit: 'g', source: 'user' },
      average: 49,
    }),
    macroComposition: trendFixture('macroComposition', {
      average: null,
      numericDayCount: 0,
    }),
    weight: trendFixture('weight', {
      reference: { kind: 'target', value: 128, unit: 'lb', source: 'user' },
      average: 129.4,
    }),
    hydration: trendFixture('hydration', {
      reference: { kind: 'target', value: 2000, unit: 'mL', source: 'user' },
      average: 1630,
    }),
    loggingConsistency: trendFixture('loggingConsistency', {
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
      average: 96,
    }),
    sodium: trendFixture('sodium', {
      trackingMode: 'complex',
      reference: { kind: 'limit', value: 2300, unit: 'mg', source: 'derived' },
      average: 2516,
    }),
  },
} satisfies CanonicalInsightsResponse;

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
