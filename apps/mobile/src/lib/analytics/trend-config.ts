import {
  analyticsMetricsForMode,
  resolveAnalyticsComparisonStrategy,
  type AnalyticsMetricKey,
  type TrendQueryInput,
} from '@food-tracker/shared';

export type TrendDraft = TrendQueryInput;
export type TrendDraftChanges = Omit<
  Partial<TrendQueryInput>,
  'comparisonMetric'
> & {
  comparisonMetric?: AnalyticsMetricKey | null;
};

export function createTrendDraft(active: TrendQueryInput): TrendDraft {
  return {
    ...active,
    period: { ...active.period },
  };
}

export function updateTrendDraft(
  draft: TrendDraft,
  changes: TrendDraftChanges,
): TrendDraft {
  const { comparisonMetric, ...otherChanges } = changes;
  const next = {
    ...draft,
    ...otherChanges,
    period: changes.period === undefined ? draft.period : { ...changes.period },
  };
  if (comparisonMetric === null) {
    delete next.comparisonMetric;
  } else if (comparisonMetric !== undefined) {
    next.comparisonMetric = comparisonMetric;
  }
  return next;
}

/** Apply is the only transition that can replace the active Trend query. */
export function applyTrendDraft(
  _active: TrendQueryInput,
  draft: TrendDraft,
): TrendQueryInput {
  return createTrendDraft(draft);
}

export function comparisonCandidates(
  primaryMetric: AnalyticsMetricKey,
): AnalyticsMetricKey[] {
  return analyticsMetricsForMode('complex')
    .map((metric) => metric.key)
    .filter(
      (candidate) =>
        resolveAnalyticsComparisonStrategy(primaryMetric, candidate) !==
        'incompatible',
    );
}

export function supportsForecastControl(metric: AnalyticsMetricKey): boolean {
  return metric === 'calories' || metric === 'weight';
}
