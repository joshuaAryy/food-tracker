import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, useWindowDimensions, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  analyticsMetricForKey,
  analyticsMetricKeySchema,
  type AnalyticsMetricKey,
  type CanonicalTrendResponse,
} from '@food-tracker/shared';
import { BarTrendChart } from '@/components/analytics/charts/bar-trend-chart';
import { HeatmapChart } from '@/components/analytics/charts/heatmap-chart';
import { LineTrendChart } from '@/components/analytics/charts/line-trend-chart';
import { MacroChart } from '@/components/analytics/charts/macro-chart';
import { AppScreen } from '@/components/app-screen';
import { AppText } from '@/components/app-text';
import { ErrorState } from '@/components/error-state';
import { ScreenHeader } from '@/components/screen-header';
import { api, errorMessage } from '@/lib/api-client';
import { resolveTrendQuery } from '@/lib/analytics/trend-routing';
import { coreTrendPresentation } from '@/lib/analytics/trend-presentation';
import {
  trendQueryFromRouteParam,
  trendQueryRouteParam,
} from '@/lib/analytics/saved-view-configuration';

const periods = [7, 30, 90] as const;

function referenceValue(response: CanonicalTrendResponse): number | null {
  return response.reference.kind === 'target' ||
    response.reference.kind === 'minimum' ||
    response.reference.kind === 'limit'
    ? response.reference.value
    : null;
}

function referenceRange(response: CanonicalTrendResponse): {
  lower: number;
  upper: number;
} | null {
  return response.reference.kind === 'range'
    ? { lower: response.reference.lower, upper: response.reference.upper }
    : null;
}

function loggingHeatmapColor(state: string): string {
  switch (state) {
    case 'complete':
      return '#33B866';
    case 'partial':
      return '#FFAD8F';
    case 'in_progress':
      return '#A5B4A2';
    default:
      return '#E7E7E7';
  }
}

export default function TrendDetailScreen() {
  const router = useRouter();
  const { metric: rawMetric, query: rawQuery } = useLocalSearchParams<{
    metric?: string;
    query?: string;
  }>();
  const restoredQuery = useMemo(
    () => trendQueryFromRouteParam(rawQuery),
    [rawQuery],
  );
  const metricResult = analyticsMetricKeySchema.safeParse(
    restoredQuery?.primaryMetric ?? rawMetric,
  );
  const metric: AnalyticsMetricKey = metricResult.success
    ? metricResult.data
    : 'calories';
  const definition = analyticsMetricForKey(metric);
  const { width } = useWindowDimensions();
  const [selectedRelativePeriod, setSelectedRelativePeriod] = useState<
    (typeof periods)[number] | null
  >(
    restoredQuery?.period.kind === 'relative' &&
      periods.includes(restoredQuery.period.days as (typeof periods)[number])
      ? (restoredQuery.period.days as (typeof periods)[number])
      : restoredQuery === null
        ? 30
        : null,
  );
  const [trend, setTrend] = useState<CanonicalTrendResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const activeQuery = useMemo(
    () =>
      resolveTrendQuery({
        metric,
        restoredQuery,
        selectedRelativePeriod,
      }),
    [metric, restoredQuery, selectedRelativePeriod],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setTrend(
        await api.analytics.trend({
          ...activeQuery,
        }),
      );
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setLoading(false);
    }
  }, [activeQuery]);

  useEffect(() => {
    void load();
  }, [load]);

  const dailyPoints = useMemo(
    () =>
      trend?.points.map((point) => ({
        date: point.kind === 'daily' ? point.date : point.bucketStartDate,
        value: point.value,
      })) ?? [],
    [trend],
  );
  const presentation =
    trend === null ? null : coreTrendPresentation(metric, trend.aggregation);
  const loggingHeatmapPoints = useMemo(
    () =>
      trend?.points.flatMap((point) => {
        if (point.kind !== 'daily') return [];
        return [
          {
            date: point.date,
            state:
              point.loggingDayPhase === 'in_progress'
                ? 'in_progress'
                : point.loggingDayState,
          } as const,
        ];
      }) ?? [],
    [trend],
  );

  return (
    <AppScreen backgroundColor="#FFFFFF" contentClassName="gap-5">
      <ScreenHeader title={definition.displayName} subtitle="Trends" />
      {trend?.trackingMode === 'complex' ? (
        <View className="flex-row gap-4">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Configure this Trend"
            onPress={() =>
              router.push({
                pathname: '/trends/configure',
                params: { query: trendQueryRouteParam(activeQuery) },
              } as never)
            }
          >
            <AppText variant="caption">Configure</AppText>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Save this Trend as a view"
            onPress={() =>
              router.push({
                pathname: '/trends/save-view',
                params: { query: trendQueryRouteParam(activeQuery) },
              } as never)
            }
          >
            <AppText variant="caption">Save view</AppText>
          </Pressable>
        </View>
      ) : null}
      <View className="flex-row gap-2">
        {periods.map((period) => (
          <Pressable
            key={period}
            accessibilityRole="button"
            accessibilityState={{ selected: period === selectedRelativePeriod }}
            className={`min-h-11 rounded-full px-4 py-3 ${period === selectedRelativePeriod ? 'bg-ink' : 'bg-module'}`}
            onPress={() => setSelectedRelativePeriod(period)}
          >
            <AppText
              className={
                period === selectedRelativePeriod ? 'text-white' : 'text-ink'
              }
            >
              {period}D
            </AppText>
          </Pressable>
        ))}
      </View>
      {error === null ? null : (
        <ErrorState message={error} onRetry={() => void load()} />
      )}
      {loading ? <AppText muted>Loading trend…</AppText> : null}
      {trend !== null && !loading ? (
        <View className="gap-3">
          {presentation === 'macro' && trend.macroComposition !== undefined ? (
            <View
              accessible
              accessibilityLabel="Macro composition from recorded food snapshots"
              className="gap-2 rounded-app bg-module p-4"
            >
              <AppText variant="label">Recorded macro composition</AppText>
              <MacroChart
                values={trend.macroComposition}
                accessibilityLabel="Macro composition from recorded food snapshots"
              />
              <AppText>
                Protein: {trend.macroComposition.protein ?? 'Unknown'} g
              </AppText>
              <AppText>
                Carbohydrates: {trend.macroComposition.carbs ?? 'Unknown'} g
              </AppText>
              <AppText>
                Fat: {trend.macroComposition.fat ?? 'Unknown'} g
              </AppText>
            </View>
          ) : presentation === 'logging_heatmap' ? (
            <HeatmapChart
              points={loggingHeatmapPoints}
              colorForState={loggingHeatmapColor}
              accessibilityLabel="Logging consistency by day"
            />
          ) : presentation === 'bars_with_trend' ? (
            <BarTrendChart
              data={dailyPoints}
              width={Math.max(280, width - 40)}
              color={metric === 'hydration' ? '#2F80ED' : '#C9242D'}
              trendValues={trend.rollingTrend?.values}
              reference={referenceValue(trend)}
              accessibilityLabel={`${definition.displayName} trend for ${trend.resolvedRange.startDate} through ${trend.resolvedRange.endDate}`}
            />
          ) : (
            <LineTrendChart
              data={dailyPoints}
              width={Math.max(280, width - 40)}
              color="#C9242D"
              trendValues={trend.rollingTrend?.values}
              reference={referenceValue(trend)}
              referenceRange={referenceRange(trend)}
              showRawPoints={presentation === 'weight_line'}
              accessibilityLabel={`${definition.displayName} trend for ${trend.resolvedRange.startDate} through ${trend.resolvedRange.endDate}`}
            />
          )}
          <AppText variant="caption" muted>
            {trend.summary.average === null
              ? 'No recorded values in this period.'
              : `Average ${trend.summary.average.toFixed(1)} ${definition.unit}`}
          </AppText>
        </View>
      ) : null}
    </AppScreen>
  );
}
