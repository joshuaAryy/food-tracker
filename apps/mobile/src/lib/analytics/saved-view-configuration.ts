import {
  analyticsMetricForKey,
  analyticsSavedViewConfigurationSchema,
  trendQueryInputSchema,
  type AnalyticsMetricKey,
  type AnalyticsSavedView,
  type AnalyticsSavedViewCreateInput,
  type AnalyticsSavedViewUpdateInput,
  type TrendQueryInput,
} from '@food-tracker/shared';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function utcMidnight(date: string): number {
  const [year, month, day] = date.split('-').map(Number);
  return Date.UTC(year ?? 0, (month ?? 1) - 1, day ?? 0);
}

export function inclusivePeriodDays(period: TrendQueryInput['period']): number {
  if (period.kind === 'relative') return period.days;
  return (
    Math.round(
      (utcMidnight(period.endDate) - utcMidnight(period.startDate)) /
        MS_PER_DAY,
    ) + 1
  );
}

export function autoSavedViewName({
  primaryMetric,
  comparisonMetric,
  periodDays,
}: {
  primaryMetric: AnalyticsMetricKey;
  comparisonMetric?: AnalyticsMetricKey | undefined;
  periodDays: number;
}): string {
  const primaryName = analyticsMetricForKey(primaryMetric).displayName;
  const comparisonName =
    comparisonMetric === undefined
      ? null
      : analyticsMetricForKey(comparisonMetric).displayName;
  return `${comparisonName === null ? primaryName : `${primaryName} + ${comparisonName}`} · ${periodDays}D`;
}

/** Saved views keep relative periods even when the temporary Trend was custom. */
export function savedViewInputFromTrend(
  trend: TrendQueryInput,
  name?: string,
): AnalyticsSavedViewCreateInput {
  const periodDays = inclusivePeriodDays(trend.period);
  return {
    name:
      name?.trim() ||
      autoSavedViewName({
        primaryMetric: trend.primaryMetric,
        comparisonMetric: trend.comparisonMetric,
        periodDays,
      }),
    primaryMetric: trend.primaryMetric,
    ...(trend.comparisonMetric === undefined
      ? {}
      : { comparisonMetric: trend.comparisonMetric }),
    periodDays,
    aggregation: trend.aggregation,
    visualization: trend.visualization,
    showReference: trend.showReference,
    coverageFilter: trend.coverageFilter,
  };
}

/** Updating a saved view clears a prior comparison when the active Trend has none. */
export function savedViewUpdateInputFromTrend(
  trend: TrendQueryInput,
  name?: string,
): AnalyticsSavedViewUpdateInput {
  const input = savedViewInputFromTrend(trend, name);
  return {
    ...input,
    comparisonMetric: trend.comparisonMetric ?? null,
  };
}

/** Unavailable historical configurations stay visible but cannot be queried. */
export function trendQueryFromSavedView(
  savedView: AnalyticsSavedView,
): TrendQueryInput | null {
  if (savedView.unavailableMetrics.length > 0) return null;
  const configuration = analyticsSavedViewConfigurationSchema.safeParse({
    primaryMetric: savedView.primaryMetric,
    comparisonMetric: savedView.comparisonMetric ?? undefined,
    periodDays: savedView.periodDays,
    aggregation: savedView.aggregation,
    visualization: savedView.visualization,
    showReference: savedView.showReference,
    coverageFilter: savedView.coverageFilter,
  });
  if (!configuration.success) return null;
  return {
    primaryMetric: configuration.data.primaryMetric,
    ...(configuration.data.comparisonMetric == null
      ? {}
      : { comparisonMetric: configuration.data.comparisonMetric }),
    period: { kind: 'relative', days: configuration.data.periodDays },
    aggregation: configuration.data.aggregation,
    visualization: configuration.data.visualization,
    showReference: configuration.data.showReference,
    coverageFilter: configuration.data.coverageFilter,
  };
}

export function pinnedInsightsTrendQuery(
  pinnedSavedViewId: string | null,
  savedViews: readonly AnalyticsSavedView[],
): TrendQueryInput {
  const pinned = savedViews.find((view) => view.id === pinnedSavedViewId);
  return (
    (pinned === undefined ? null : trendQueryFromSavedView(pinned)) ?? {
      primaryMetric: 'calories',
      period: { kind: 'relative', days: 30 },
      aggregation: 'automatic',
      visualization: 'automatic',
      showReference: true,
      coverageFilter: 'all_logged_days',
    }
  );
}

export function trendQueryRouteParam(query: TrendQueryInput): string {
  return JSON.stringify(query);
}

export function trendQueryFromRouteParam(
  value: string | undefined,
): TrendQueryInput | null {
  if (value === undefined) return null;
  try {
    const parsed = trendQueryInputSchema.safeParse(JSON.parse(value));
    if (!parsed.success) return null;
    const { comparisonMetric, includeForecast, ...required } = parsed.data;
    return {
      ...required,
      ...(comparisonMetric === undefined ? {} : { comparisonMetric }),
      ...(includeForecast === undefined ? {} : { includeForecast }),
    };
  } catch {
    return null;
  }
}
