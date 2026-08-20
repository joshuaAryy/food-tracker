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
  type AnalyticsContributorsResponse,
  type CanonicalTrendResponse,
  type WaterLog,
} from '@food-tracker/shared';
import { BarTrendChart } from '@/components/analytics/charts/bar-trend-chart';
import { ForecastChart } from '@/components/analytics/charts/forecast-chart';
import { HeatmapChart } from '@/components/analytics/charts/heatmap-chart';
import { LineTrendChart } from '@/components/analytics/charts/line-trend-chart';
import { MacroChart } from '@/components/analytics/charts/macro-chart';
import { CaloriesReport } from '@/components/analytics/trends/calories-report';
import { HydrationReport } from '@/components/analytics/trends/hydration-report';
import { LoggingConsistencyReport } from '@/components/analytics/trends/logging-consistency-report';
import { MacrosReport } from '@/components/analytics/trends/macros-report';
import { TrendReportHeader } from '@/components/analytics/trends/trend-report-header';
import { ComparisonTrendReport } from '@/components/analytics/trends/comparison-trend-report';
import { WeightReport } from '@/components/analytics/trends/weight-report';
import { NutrientGoalDepthCard } from '@/components/analytics/nutrients/nutrient-goal-depth-card';
import { NutrientPairReport } from '@/components/analytics/nutrients/nutrient-pair-report';
import { LeucineDetail } from '@/components/analytics/nutrients/leucine-detail';
import { NutrientDataState } from '@/components/analytics/nutrients/nutrient-data-state';
import { NutrientSparseState } from '@/components/analytics/nutrients/nutrient-sparse-state';
import { VitaminCDetailReport } from '@/components/analytics/nutrients/vitamin-c-detail-report';
import { AppScreen } from '@/components/app-screen';
import { AppText } from '@/components/app-text';
import {
  formatPresentationDate,
  formatPresentationDateRange,
} from '@/lib/date-time';
import { formatMetricWithUnit } from '@/lib/reporting-ui';
import { ErrorState } from '@/components/error-state';
import { api, errorMessage } from '@/lib/api-client';
import { useAuthRuntime } from '@/components/auth/auth-bootstrap';
import {
  analyticsCache,
  ANALYTICS_CACHE_KEYS,
} from '@/lib/analytics/analytics-cache-runtime';
import {
  pairedTrendQuery,
  resolveTrendQuery,
  trendRouteForMetric,
} from '@/lib/analytics/trend-routing';
import {
  analyticsResourceReducer,
  initialAnalyticsResource,
} from '@/lib/analytics/analytics-resource';
import { coreTrendPresentation } from '@/lib/analytics/trend-presentation';
import { axisReferenceLabel } from '@/lib/analytics/chart-axis';
import {
  metricCoverageMessage,
  referenceMessage,
} from '@/lib/analytics/trend-data-state';
import {
  trendQueryFromRouteParam,
  trendQueryRouteParam,
} from '@/lib/analytics/saved-view-configuration';
import { quickAddWater, undoQuickAddWater } from '@/lib/water-actions';

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
  const {
    metric: rawMetric,
    query: rawQuery,
    savedViewId,
  } = useLocalSearchParams<{
    metric?: string;
    query?: string;
    savedViewId?: string;
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
  const isNutrientDetail = ![
    'calories',
    'macroComposition',
    'weight',
    'hydration',
    'loggingConsistency',
  ].includes(metric);
  const definition = analyticsMetricForKey(metric);
  const { width } = useWindowDimensions();
  const [selectedRelativePeriod, setSelectedRelativePeriod] = useState<
    (typeof periods)[number] | null
  >(
    restoredQuery?.period.kind === 'relative' &&
      periods.includes(restoredQuery.period.days as (typeof periods)[number])
      ? (restoredQuery.period.days as (typeof periods)[number])
      : restoredQuery === null
        ? metric === 'hydration'
          ? 7
          : 30
        : null,
  );
  const [trendResource, dispatchTrend] = useReducer(
    analyticsResourceReducer<CanonicalTrendResponse>,
    undefined,
    initialAnalyticsResource<CanonicalTrendResponse>,
  );
  const trend = trendResource.value;
  const trendRequestId = useRef(0);
  const [proteinTrend, setProteinTrend] =
    useState<CanonicalTrendResponse | null>(null);
  const [proteinTrendLoading, setProteinTrendLoading] = useState(false);
  const proteinTrendRequestId = useRef(0);
  const [relatedTrend, setRelatedTrend] =
    useState<CanonicalTrendResponse | null>(null);
  const [nutrientComparisonTrend, setNutrientComparisonTrend] =
    useState<CanonicalTrendResponse | null>(null);
  const [relatedTrendError, setRelatedTrendError] = useState<string | null>(
    null,
  );
  const relatedTrendRequestId = useRef(0);
  const nutrientComparisonRequestId = useRef(0);
  const [calorieContributors, setCalorieContributors] =
    useState<AnalyticsContributorsResponse | null>(null);
  const [nutrientContributors, setNutrientContributors] =
    useState<AnalyticsContributorsResponse | null>(null);
  const [recentWaterLogs, setRecentWaterLogs] = useState<WaterLog[]>([]);
  const [quickAddWaterLog, setQuickAddWaterLog] = useState<WaterLog | null>(
    null,
  );
  const [quickAddPending, setQuickAddPending] = useState(false);
  const [quickAddError, setQuickAddError] = useState<string | null>(null);
  const activeQuery = useMemo(() => {
    const resolved = resolveTrendQuery({
      metric,
      restoredQuery,
      selectedRelativePeriod,
    });
    return metric === 'calories' || metric === 'weight'
      ? { ...resolved, includeForecast: false }
      : resolved;
  }, [metric, restoredQuery, selectedRelativePeriod]);
  const cacheKey = useMemo(
    () => ANALYTICS_CACHE_KEYS.trend(JSON.stringify(activeQuery)),
    [activeQuery],
  );

  const load = useCallback(
    async (asRefresh = false) => {
      const requestId = ++trendRequestId.current;
      const proteinRequestId = ++proteinTrendRequestId.current;
      if (metric === 'calories') setCalorieContributors(null);
      if (isNutrientDetail) setNutrientContributors(null);
      if (metric === 'macroComposition') {
        setProteinTrendLoading(true);
        setProteinTrend(null);
      } else {
        setProteinTrend(null);
        setProteinTrendLoading(false);
      }
      if (isNutrientDetail) setNutrientComparisonTrend(null);
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
        let replacement = await api.analytics.trend({ ...activeQuery });
        if (
          (metric === 'calories' || metric === 'weight') &&
          replacement.trackingMode === 'complex'
        ) {
          try {
            replacement = await api.analytics.trend({
              ...activeQuery,
              includeForecast: true,
            });
          } catch {
            // Forecast eligibility is independent; retain the healthy base trend.
          }
        }
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
        if (metric === 'macroComposition') {
          try {
            const { comparisonMetric: _comparisonMetric, ...proteinQuery } =
              activeQuery;
            void _comparisonMetric;
            const protein = await api.analytics.trend({
              ...proteinQuery,
              primaryMetric: 'protein',
            });
            if (proteinRequestId === proteinTrendRequestId.current) {
              setProteinTrend(protein);
            }
          } catch {
            if (proteinRequestId === proteinTrendRequestId.current) {
              setProteinTrend(null);
            }
          } finally {
            if (proteinRequestId === proteinTrendRequestId.current) {
              setProteinTrendLoading(false);
            }
          }
        } else {
          // The request generation and cleared sibling state were established
          // before the primary replacement request began.
        }
        if (isNutrientDetail) {
          const relatedMetric = replacement.relatedMetrics[0];
          const requestId = ++relatedTrendRequestId.current;
          const comparisonRequestId = ++nutrientComparisonRequestId.current;
          setRelatedTrend(null);
          setRelatedTrendError(null);
          if (relatedMetric !== undefined) {
            try {
              const { comparisonMetric: _comparisonMetric, ...relatedQuery } =
                activeQuery;
              void _comparisonMetric;
              const related = await api.analytics.trend({
                ...relatedQuery,
                primaryMetric: relatedMetric,
              });
              if (requestId === relatedTrendRequestId.current) {
                setRelatedTrend(related);
              }
            } catch (cause) {
              if (requestId === relatedTrendRequestId.current) {
                setRelatedTrendError(errorMessage(cause));
              }
            }
            try {
              const { comparisonMetric: _comparisonMetric, ...nutrientQuery } =
                activeQuery;
              void _comparisonMetric;
              const comparison = await api.analytics.trend({
                ...nutrientQuery,
                comparisonMetric: relatedMetric,
              });
              if (comparisonRequestId === nutrientComparisonRequestId.current) {
                setNutrientComparisonTrend(comparison);
              }
            } catch {
              if (comparisonRequestId === nutrientComparisonRequestId.current) {
                setNutrientComparisonTrend(null);
              }
            }
          }
        } else {
          relatedTrendRequestId.current += 1;
          nutrientComparisonRequestId.current += 1;
          setRelatedTrend(null);
          setRelatedTrendError(null);
          setNutrientComparisonTrend(null);
        }
        if (metric === 'hydration') {
          try {
            setRecentWaterLogs(
              await api.waterLogs.list({
                startDate: replacement.resolvedRange.startDate,
                endDate: replacement.resolvedRange.endDate,
              }),
            );
          } catch {
            setRecentWaterLogs([]);
          }
        } else {
          setRecentWaterLogs([]);
        }
        if (metric === 'calories' && replacement.trackingMode === 'complex') {
          try {
            setCalorieContributors(
              await api.analytics.contributors(activeQuery, true),
            );
          } catch {
            setCalorieContributors(null);
          }
        } else {
          setCalorieContributors(null);
        }
        if (isNutrientDetail && replacement.trackingMode === 'complex') {
          try {
            setNutrientContributors(
              await api.analytics.contributors(activeQuery, true),
            );
          } catch {
            setNutrientContributors(null);
          }
        } else {
          setNutrientContributors(null);
        }
      } catch (cause) {
        if (
          metric === 'macroComposition' &&
          proteinRequestId === proteinTrendRequestId.current
        ) {
          setProteinTrendLoading(false);
        }
        dispatchTrend({
          type: 'failure',
          requestId,
          message: errorMessage(cause),
        });
      }
    },
    [activeQuery, cacheKey, isNutrientDetail, metric, userId],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const quickAdd = useCallback(async () => {
    setQuickAddPending(true);
    setQuickAddError(null);
    try {
      const created = await quickAddWater(api.waterLogs, new Date());
      setQuickAddWaterLog(created);
      await load(true);
    } catch (cause) {
      setQuickAddError(errorMessage(cause));
    } finally {
      setQuickAddPending(false);
    }
  }, [load]);

  const undoQuickAdd = useCallback(async () => {
    if (quickAddWaterLog === null) return;
    setQuickAddPending(true);
    setQuickAddError(null);
    try {
      await undoQuickAddWater(api.waterLogs, quickAddWaterLog.id);
      setQuickAddWaterLog(null);
      await load(true);
    } catch (cause) {
      setQuickAddError(errorMessage(cause));
    } finally {
      setQuickAddPending(false);
    }
  }, [load, quickAddWaterLog]);

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
  const reportPeriods =
    metric === 'loggingConsistency' ? ([30, 90] as const) : periods;
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
      comparison.comparisonAxisDomain === null ||
      comparison.strategy === 'incompatible'
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
      <TrendReportHeader
        metricName={
          metric === 'macroComposition'
            ? 'Macros'
            : metric === 'loggingConsistency'
              ? 'Logging consistency'
              : definition.displayName
        }
        subtitle={
          metric === 'calories'
            ? 'Daily intake'
            : metric === 'macroComposition'
              ? 'Composition and daily balance'
              : metric === 'hydration'
                ? 'Explicitly logged drinks only'
                : metric === 'vitaminC'
                  ? trend?.reference.kind === 'range'
                    ? 'Daily intake within your configured range'
                    : 'Recorded daily intake'
                  : metric === 'weight'
                    ? 'Smoothed trend with raw weigh-ins'
                    : metric === 'loggingConsistency'
                      ? 'Coverage, meal rhythm and completeness'
                      : undefined
        }
        trackingMode={trend?.trackingMode ?? 'simple'}
        selectedPeriod={selectedRelativePeriod}
        onSelectPeriod={setSelectedRelativePeriod}
        periods={reportPeriods}
        showPeriodControls={
          metric !== 'hydration' &&
          metric !== 'weight' &&
          metric !== 'loggingConsistency' &&
          metric !== 'vitaminC'
        }
        onOpenCustomRange={() =>
          router.push({
            pathname: '/trends/custom-range',
            params: {
              query: trendQueryRouteParam(activeQuery),
              ...(savedViewId === undefined ? {} : { savedViewId }),
            },
          } as never)
        }
        onConfigure={
          activeQuery.comparisonMetric === undefined
            ? () =>
                router.push({
                  pathname: '/trends/configure',
                  params: {
                    query: trendQueryRouteParam(activeQuery),
                    ...(savedViewId === undefined ? {} : { savedViewId }),
                  },
                } as never)
            : undefined
        }
        onSave={() =>
          router.push({
            pathname: '/trends/save-view',
            params: {
              query: trendQueryRouteParam(activeQuery),
              ...(savedViewId === undefined ? {} : { savedViewId }),
            },
          } as never)
        }
        onBack={() => router.back()}
        title={
          activeQuery.comparisonMetric === undefined ? 'Trends' : 'Compare'
        }
        backLabel={
          activeQuery.comparisonMetric !== undefined
            ? '‹ Trends'
            : metric === 'vitaminC'
              ? '‹ Vitamins'
              : metric === 'hydration'
                ? '‹ Overview'
                : '‹ Insights'
        }
      />
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
        metric === 'calories' ? (
          <CaloriesReport
            trend={trend}
            width={width}
            simple={trend.trackingMode === 'simple'}
            selectedPeriod={selectedRelativePeriod}
            onSelectPeriod={setSelectedRelativePeriod}
            onOpenCustomRange={() =>
              router.push({
                pathname: '/trends/custom-range',
                params: {
                  query: trendQueryRouteParam(activeQuery),
                  ...(savedViewId === undefined ? {} : { savedViewId }),
                },
              } as never)
            }
            onOpenContributors={() =>
              router.push({
                pathname: '/trends/contributors',
                params: { query: trendQueryRouteParam(activeQuery) },
              } as never)
            }
            contributors={calorieContributors}
            showPeriodControls={false}
          />
        ) : metric === 'weight' ? (
          <WeightReport
            trend={trend}
            width={width}
            simple={trend.trackingMode === 'simple'}
            selectedPeriod={selectedRelativePeriod}
            onSelectPeriod={setSelectedRelativePeriod}
            onOpenCustomRange={() =>
              router.push({
                pathname: '/trends/custom-range',
                params: {
                  query: trendQueryRouteParam(activeQuery),
                  ...(savedViewId === undefined ? {} : { savedViewId }),
                },
              } as never)
            }
            showPeriodControls
          />
        ) : metric === 'macroComposition' ? (
          <MacrosReport
            trend={trend}
            width={width}
            simple={trend.trackingMode === 'simple'}
            proteinTrend={proteinTrend}
            proteinTrendLoading={proteinTrendLoading}
            selectedPeriod={selectedRelativePeriod}
            onSelectPeriod={setSelectedRelativePeriod}
            onOpenCustomRange={() =>
              router.push({
                pathname: '/trends/custom-range',
                params: {
                  query: trendQueryRouteParam(activeQuery),
                  ...(savedViewId === undefined ? {} : { savedViewId }),
                },
              } as never)
            }
            onOpenProtein={() => router.push('/trends/protein' as never)}
            showPeriodControls={false}
          />
        ) : metric === 'loggingConsistency' ? (
          <LoggingConsistencyReport
            trend={trend}
            simple={trend.trackingMode === 'simple'}
            selectedPeriod={selectedRelativePeriod}
            onSelectPeriod={setSelectedRelativePeriod}
            onOpenCustomRange={() =>
              router.push({
                pathname: '/trends/custom-range',
                params: {
                  query: trendQueryRouteParam(activeQuery),
                  ...(savedViewId === undefined ? {} : { savedViewId }),
                },
              } as never)
            }
            showPeriodControls
          />
        ) : metric === 'hydration' ? (
          <HydrationReport
            trend={trend}
            width={width}
            onLogWater={() => void quickAdd()}
            onOpenWaterLogger={() => router.push('/water-log' as never)}
            quickAddPending={quickAddPending}
            quickAddError={quickAddError}
            quickAddUndo={
              quickAddWaterLog === null ? undefined : () => void undoQuickAdd()
            }
            recentWaterLogs={recentWaterLogs}
          />
        ) : metric === 'vitaminC' ? (
          <VitaminCDetailReport
            trend={trend}
            relatedName={
              trend.relatedMetrics[0] === undefined
                ? 'Related metric'
                : analyticsMetricForKey(trend.relatedMetrics[0]).displayName
            }
            relatedTrend={relatedTrend}
            relatedError={relatedTrendError}
            contributors={nutrientContributors}
            width={width}
            simple={trend.trackingMode === 'simple'}
            selectedPeriod={selectedRelativePeriod}
            onSelectPeriod={setSelectedRelativePeriod}
            onOpenCustomRange={() =>
              router.push({
                pathname: '/trends/custom-range',
                params: {
                  query: trendQueryRouteParam(activeQuery),
                  ...(savedViewId === undefined ? {} : { savedViewId }),
                },
              } as never)
            }
            onOpenRelated={() => {
              const relatedMetric = trend.relatedMetrics[0];
              if (relatedMetric === undefined) return;
              router.push({
                pathname: trendRouteForMetric(metric),
                params: {
                  query: trendQueryRouteParam(
                    pairedTrendQuery({
                      query: activeQuery,
                      primaryMetric: metric,
                      comparisonMetric: relatedMetric,
                    }),
                  ),
                },
              } as never);
            }}
            onOpenContributors={() =>
              router.push({
                pathname: '/trends/contributors',
                params: { query: trendQueryRouteParam(activeQuery) },
              } as never)
            }
          />
        ) : (
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
              <ComparisonTrendReport
                primaryMetric={metric}
                comparisonMetric={comparisonChart.metric}
                strategy={comparisonChart.strategy}
                primary={dailyPoints}
                comparison={comparisonChart.comparisonPoints}
                primaryAxis={comparisonChart.primaryAxis}
                comparisonAxis={comparisonChart.comparisonAxis}
                primaryAverage={trend.summary.average}
                width={width}
              />
            ) : trend.forecast?.kind === 'available' ? (
              <ForecastChart
                historical={dailyPoints.map((point) => point.value)}
                historicalDates={dailyPoints.map((point) => point.date)}
                forecast={trend.forecast.points}
                width={Math.max(280, width - 40)}
                showAxes
                periodDays={selectedRelativePeriod ?? undefined}
                unit={definition.unit}
                accessibilityLabel={`${definition.displayName} estimated seven-day projection after ${formatPresentationDate(trend.forecast.todayDate, { includeYear: true })}`}
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
                  Protein:{' '}
                  {formatMetricWithUnit(trend.macroComposition.protein, 'g')}
                </AppText>
                <AppText>
                  Carbohydrates:{' '}
                  {formatMetricWithUnit(trend.macroComposition.carbs, 'g')}
                </AppText>
                <AppText>
                  Fat: {formatMetricWithUnit(trend.macroComposition.fat, 'g')}
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
                color="#C9242D"
                trendValues={trend.rollingTrend?.values}
                reference={referenceValue(trend)}
                referenceRange={referenceRange(trend)}
                showAxes
                showGrid
                periodDays={selectedRelativePeriod ?? undefined}
                unit={definition.unit}
                referenceLabel={
                  axisReferenceLabel(trend.reference) ?? undefined
                }
                accessibilityLabel={`${definition.displayName} trend for ${formatPresentationDateRange(trend.resolvedRange.startDate, trend.resolvedRange.endDate)}`}
              />
            ) : (
              <LineTrendChart
                data={dailyPoints}
                width={Math.max(280, width - 40)}
                color="#C9242D"
                trendValues={trend.rollingTrend?.values}
                reference={referenceValue(trend)}
                referenceRange={referenceRange(trend)}
                showAxes
                showGrid
                periodDays={selectedRelativePeriod ?? undefined}
                unit={definition.unit}
                referenceLabel={
                  axisReferenceLabel(trend.reference) ?? undefined
                }
                showRawPoints={presentation === 'weight_line'}
                accessibilityLabel={`${definition.displayName} trend for ${formatPresentationDateRange(trend.resolvedRange.startDate, trend.resolvedRange.endDate)}`}
              />
            )}
            <AppText variant="caption" muted>
              {trend.summary.average === null
                ? 'No recorded values in this period.'
                : `Average ${formatMetricWithUnit(trend.summary.average, definition.unit)}`}
            </AppText>
            {trend.forecast?.kind === 'available' ? (
              <AppText variant="caption" muted>
                Seven-day estimate based on stable recorded history. The shaded
                range shows increasing uncertainty.
              </AppText>
            ) : trend.forecast?.kind === 'unavailable' &&
              activeQuery.includeForecast === true ? (
              <AppText variant="caption" muted>
                A seven-day estimate is unavailable until enough stable history
                is recorded.
              </AppText>
            ) : null}
            {isNutrientDetail ? (
              <>
                <NutrientGoalDepthCard
                  metricName={definition.displayName}
                  unit={definition.unit}
                  average={trend.summary.average}
                  reference={trend.reference}
                  metricCoverage={metricCoverage}
                />
                {trend.metricDataSummary?.state === 'sparse' ? (
                  <NutrientSparseState
                    metricName={definition.displayName}
                    recorded={trend.metricDataSummary.recorded}
                    total={
                      trend.metricDataSummary.recorded +
                      trend.metricDataSummary.partial +
                      trend.metricDataSummary.unknown
                    }
                  />
                ) : trend.metricDataSummary === undefined ? null : (
                  <NutrientDataState
                    metricName={definition.displayName}
                    unit={definition.unit}
                    state={trend.metricDataSummary.state}
                    recorded={trend.metricDataSummary.recorded}
                    total={
                      trend.metricDataSummary.recorded +
                      trend.metricDataSummary.partial +
                      trend.metricDataSummary.unknown
                    }
                  />
                )}
                {trend.relatedMetrics[0] === undefined ? null : (
                  <NutrientPairReport
                    primaryName={definition.displayName}
                    primaryReference={trend.reference}
                    relatedName={
                      analyticsMetricForKey(trend.relatedMetrics[0]).displayName
                    }
                    relatedMetric={trend.relatedMetrics[0]}
                    relatedTrend={relatedTrend}
                    comparisonTrend={nutrientComparisonTrend}
                    relatedError={relatedTrendError}
                    onOpenRelated={(relatedMetric) => {
                      router.push({
                        pathname: trendRouteForMetric(metric),
                        params: {
                          query: trendQueryRouteParam(
                            pairedTrendQuery({
                              query: activeQuery,
                              primaryMetric: metric,
                              comparisonMetric: relatedMetric,
                            }),
                          ),
                        },
                      } as never);
                    }}
                  />
                )}
                {metric === 'leucine' ? <LeucineDetail trend={trend} /> : null}
              </>
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
        )
      ) : null}
    </AppScreen>
  );
}
