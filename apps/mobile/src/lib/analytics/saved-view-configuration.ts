import {
  analyticsMetricForKey,
  type AnalyticsMetricKey,
  type AnalyticsSavedViewCreateInput,
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
