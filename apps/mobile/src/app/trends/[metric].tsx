import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, useWindowDimensions, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import {
  analyticsMetricForKey,
  analyticsMetricKeySchema,
  type AnalyticsMetricKey,
  type CanonicalTrendResponse,
} from '@food-tracker/shared';
import { LineTrendChart } from '@/components/analytics/charts/line-trend-chart';
import { AppScreen } from '@/components/app-screen';
import { AppText } from '@/components/app-text';
import { ErrorState } from '@/components/error-state';
import { ScreenHeader } from '@/components/screen-header';
import { api, errorMessage } from '@/lib/api-client';

const periods = [7, 30, 90] as const;

function referenceValue(response: CanonicalTrendResponse): number | null {
  return response.reference.kind === 'target' ||
    response.reference.kind === 'minimum' ||
    response.reference.kind === 'limit'
    ? response.reference.value
    : null;
}

export default function TrendDetailScreen() {
  const { metric: rawMetric } = useLocalSearchParams<{ metric?: string }>();
  const metricResult = analyticsMetricKeySchema.safeParse(rawMetric);
  const metric: AnalyticsMetricKey = metricResult.success
    ? metricResult.data
    : 'calories';
  const definition = analyticsMetricForKey(metric);
  const { width } = useWindowDimensions();
  const [days, setDays] = useState<(typeof periods)[number]>(30);
  const [trend, setTrend] = useState<CanonicalTrendResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setTrend(
        await api.analytics.trend({
          primaryMetric: metric,
          period: { kind: 'relative', days },
          aggregation: 'automatic',
          visualization: 'automatic',
          showReference: true,
          coverageFilter: 'all_logged_days',
        }),
      );
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setLoading(false);
    }
  }, [days, metric]);

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

  return (
    <AppScreen backgroundColor="#FFFFFF" contentClassName="gap-5">
      <ScreenHeader title={definition.displayName} subtitle="Trends" />
      <View className="flex-row gap-2">
        {periods.map((period) => (
          <Pressable
            key={period}
            accessibilityRole="button"
            accessibilityState={{ selected: period === days }}
            className={`min-h-11 rounded-full px-4 py-3 ${period === days ? 'bg-ink' : 'bg-module'}`}
            onPress={() => setDays(period)}
          >
            <AppText className={period === days ? 'text-white' : 'text-ink'}>
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
          {metric === 'macroComposition' &&
          trend.macroComposition !== undefined ? (
            <View
              accessible
              accessibilityLabel="Macro composition from recorded food snapshots"
              className="gap-2 rounded-app bg-module p-4"
            >
              <AppText variant="label">Recorded macro composition</AppText>
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
          ) : (
            <LineTrendChart
              data={dailyPoints}
              width={Math.max(280, width - 40)}
              color="#C9242D"
              reference={referenceValue(trend)}
              accessibilityLabel={`${definition.displayName} trend for ${days} days`}
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
