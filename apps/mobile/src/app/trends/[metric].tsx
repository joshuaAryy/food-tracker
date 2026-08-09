import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'react';
import { Pressable, useWindowDimensions, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  analyticsMetricForKey,
  analyticsMetricKeySchema,
  canonicalTrendResponseSchema,
  type AnalyticsMetricKey,
  type CanonicalTrendResponse,
} from '@food-tracker/shared';
import { BarTrendChart } from '@/components/analytics/charts/bar-trend-chart';
import { ComparisonChart } from '@/components/analytics/charts/comparison-chart';
import { ForecastChart } from '@/components/analytics/charts/forecast-chart';
import { HeatmapChart } from '@/components/analytics/charts/heatmap-chart';
import { LineTrendChart } from '@/components/analytics/charts/line-trend-chart';
import { MacroChart } from '@/components/analytics/charts/macro-chart';
import { AppScreen } from '@/components/app-screen';
import { AppText } from '@/components/app-text';
import { ErrorState } from '@/components/error-state';
import { ScreenHeader } from '@/components/screen-header';
import { api, errorMessage } from '@/lib/api-client';
import { useAuthRuntime } from '@/components/auth/auth-bootstrap';
import {
  analyticsCache,
  ANALYTICS_CACHE_KEYS,
} from '@/lib/analytics/analytics-cache-runtime';
import { resolveTrendQuery } from '@/lib/analytics/trend-routing';
import {
  analyticsResourceReducer,
  initialAnalyticsResource,
} from '@/lib/analytics/analytics-resource';
import { coreTrendPresentation } from '@/lib/analytics/trend-presentation';
import {
  metricCoverageMessage,
  referenceMessage,
} from '@/lib/analytics/trend-data-state';
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
  const { userId } = useAuthRuntime();
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
  const [trendResource, dispatchTrend] = useReducer(
    analyticsResourceReducer<CanonicalTrendResponse>,
    undefined,
    initialAnalyticsResource<CanonicalTrendResponse>,
  );
  const trend = trendResource.value;
  const trendRequestId = useRef(0);
  const activeQuery = useMemo(
    () =>
      resolveTrendQuery({
        metric,
        restoredQuery,
        selectedRelativePeriod,
      }),
    [metric, restoredQuery, selectedRelativePeriod],
  );
  const cacheKey = useMemo(
    () => ANALYTICS_CACHE_KEYS.trend(JSON.stringify(activeQuery)),
    [activeQuery],
  );

  const load = useCallback(
    async (asRefresh = false) => {
      const requestId = ++trendRequestId.current;
      dispatchTrend({ type: asRefresh ? 'refresh' : 'load', requestId });
      if (!asRefresh && userId !== null) {
        try {
          const cached = await analyticsCache().read(
            userId,
            cacheKey,
            (value): value is CanonicalTrendResponse =>
              canonicalTrendResponseSchema.safeParse(value).success,
          );
          if (cached !== null) {
            dispatchTrend({
              type: 'hydrate',
              requestId,
              value: cached.value,
              updatedAt: cached.updatedAt,
              stale: cached.stale,
            });
            dispatchTrend({ type: 'refresh', requestId });
          }
        } catch {
          // Cache failures never block canonical network analytics.
        }
      }
      try {
        const replacement = await api.analytics.trend({ ...activeQuery });
        dispatchTrend({
          type: 'commit',
          requestId,
          value: replacement,
          updatedAt: Date.now(),
        });
        if (userId !== null) {
          void analyticsCache()
            .write(userId, cacheKey, replacement)
            .catch(() => undefined);
        }
      } catch (cause) {
        dispatchTrend({
          type: 'failure',
          requestId,
          message: errorMessage(cause),
        });
      }
    },
    [activeQuery, cacheKey, userId],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const dailyPoints = useMemo(
    () =>
      trend?.points.map((point) => ({
        date: point.kind === 'daily' ? point.date : point.bucketStartDate,
        value: point.value,
        ...(point.normalizedValue === undefined
          ? {}
          : { normalizedValue: point.normalizedValue }),
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
  const metricCoverage = useMemo(() => {
    const counts = { recorded: 0, partial: 0, unknown: 0 };
    for (const point of trend?.points ?? []) {
      if (point.kind === 'aggregated') {
        counts.recorded += point.metricCounts.recorded;
        counts.partial += point.metricCounts.partial;
        counts.unknown += point.metricCounts.unknown;
      } else if (point.metricDataState !== null) {
        counts[point.metricDataState] += 1;
      }
    }
    return counts;
  }, [trend]);
  const comparisonChart = useMemo(() => {
    const comparison = trend?.comparison;
    if (
      comparison === undefined ||
      comparison.primaryAxisDomain === null ||
      comparison.comparisonAxisDomain === null
    ) {
      return null;
    }
    return {
      strategy: comparison.strategy,
      metric: comparison.metric,
      primaryAxis: comparison.primaryAxisDomain,
      comparisonAxis: comparison.comparisonAxisDomain,
      comparisonPoints: comparison.points.map((point) => ({
        date: point.kind === 'daily' ? point.date : point.bucketStartDate,
        value: point.value,
        ...(point.normalizedValue === undefined
          ? {}
          : { normalizedValue: point.normalizedValue }),
      })),
    };
  }, [trend]);

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
          {metric !== 'weight' &&
          metric !== 'hydration' &&
          metric !== 'loggingConsistency' &&
          metric !== 'macroComposition' ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="View food contributors"
              onPress={() =>
                router.push({
                  pathname: '/trends/contributors',
                  params: { query: trendQueryRouteParam(activeQuery) },
                } as never)
              }
            >
              <AppText variant="caption">Food contributors</AppText>
            </Pressable>
          ) : null}
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
      {trendResource.error === null ? null : (
        <ErrorState
          {...(trend === null ? {} : { title: 'Showing earlier analytics' })}
          message={trendResource.error}
          onRetry={() => void load(true)}
        />
      )}
      {trendResource.status === 'loading' ? (
        <AppText muted>Loading trend…</AppText>
      ) : null}
      {trendResource.status === 'refreshing' && trend !== null ? (
        <AppText variant="caption" muted>
          Refreshing analytics…
        </AppText>
      ) : null}
      {trend !== null && trendResource.status !== 'loading' ? (
        <View className="gap-3">
          {trend.summary.numericDayCount === 0 &&
          presentation !== 'macro' &&
          presentation !== 'logging_heatmap' ? (
            <View className="gap-1 rounded-app bg-module p-4">
              <AppText variant="label">No numeric trend to chart</AppText>
              <AppText variant="caption" muted>
                Logged foods may still be present, but this metric has no
                recorded values in the selected range. Missing values remain
                gaps rather than zero.
              </AppText>
            </View>
          ) : comparisonChart !== null ? (
            <ComparisonChart
              primary={dailyPoints}
              comparison={comparisonChart.comparisonPoints}
              strategy={comparisonChart.strategy}
              primaryAxis={comparisonChart.primaryAxis}
              comparisonAxis={comparisonChart.comparisonAxis}
              width={Math.max(280, width - 40)}
              accessibilityLabel={`${definition.displayName} and ${analyticsMetricForKey(comparisonChart.metric).displayName} comparison for ${trend.resolvedRange.startDate} through ${trend.resolvedRange.endDate}`}
            />
          ) : trend.forecast?.kind === 'available' ? (
            <ForecastChart
              historical={dailyPoints.map((point) => point.value)}
              forecast={trend.forecast.points}
              width={Math.max(280, width - 40)}
              accessibilityLabel={`${definition.displayName} estimated seven-day projection after ${trend.forecast.todayDate}`}
            />
          ) : presentation === 'macro' &&
            trend.macroComposition !== undefined ? (
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
          {trend.forecast?.kind === 'available' ? (
            <AppText variant="caption" muted>
              Seven-day estimate based on stable recorded history. The shaded
              range shows increasing uncertainty.
            </AppText>
          ) : trend.forecast?.kind === 'unavailable' &&
            activeQuery.includeForecast === true ? (
            <AppText variant="caption" muted>
              A seven-day estimate is unavailable until enough stable history is
              recorded.
            </AppText>
          ) : null}
          {trend.trackingMode === 'complex' ? (
            <View className="gap-1">
              {referenceMessage(trend.reference) === null ? null : (
                <AppText variant="caption" muted>
                  {referenceMessage(trend.reference)}
                </AppText>
              )}
              {trend.interpretation === null ? null : (
                <AppText variant="caption" muted>
                  {trend.interpretation.message}
                </AppText>
              )}
              {metricCoverageMessage(metricCoverage) === null ? null : (
                <AppText variant="caption" muted>
                  {metricCoverageMessage(metricCoverage)}
                </AppText>
              )}
              {trend.relatedMetrics.length === 0 ? null : (
                <View className="gap-2 pt-2">
                  <AppText variant="caption" muted>
                    Related metrics
                  </AppText>
                  <View className="flex-row flex-wrap gap-2">
                    {trend.relatedMetrics.map((relatedMetric) => (
                      <Pressable
                        key={relatedMetric}
                        accessibilityRole="button"
                        accessibilityLabel={`View ${analyticsMetricForKey(relatedMetric).displayName} trend`}
                        className="min-h-11 rounded-full bg-module px-4 py-3"
                        onPress={() =>
                          router.push(`/trends/${relatedMetric}` as never)
                        }
                      >
                        <AppText variant="caption">
                          {analyticsMetricForKey(relatedMetric).displayName}
                        </AppText>
                      </Pressable>
                    ))}
                  </View>
                </View>
              )}
            </View>
          ) : null}
        </View>
      ) : null}
    </AppScreen>
  );
}
