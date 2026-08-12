import { useEffect, useMemo, useState } from 'react';
import type {
  AnalyticsPreferenceValue,
  AnalyticsSavedView,
  CanonicalTrendResponse,
} from '@food-tracker/shared';
import { Pressable, useWindowDimensions, View } from 'react-native';
import { AppCard } from '@/components/app-card';
import { AppText } from '@/components/app-text';
import { LineTrendChart } from '@/components/analytics/charts/line-trend-chart';
import { api, errorMessage } from '@/lib/api-client';
import {
  pinnedInsightsTrendQuery,
  trendQueryFromSavedView,
  trendQueryRouteParam,
} from '@/lib/analytics/saved-view-configuration';

export function PinnedAnalysisCard({
  preferences,
  views,
  onManage,
  onOpen,
}: {
  preferences: AnalyticsPreferenceValue;
  views: readonly AnalyticsSavedView[];
  onManage: () => void;
  onOpen: (metric: string, query: string) => void;
}) {
  const { width } = useWindowDimensions();
  const pinned = useMemo(
    () => views.find((view) => view.id === preferences.pinnedSavedViewId),
    [preferences.pinnedSavedViewId, views],
  );
  const query = useMemo(
    () =>
      pinned === undefined
        ? pinnedInsightsTrendQuery(preferences.pinnedSavedViewId, views)
        : (trendQueryFromSavedView(pinned) ??
          pinnedInsightsTrendQuery(null, views)),
    [pinned, preferences.pinnedSavedViewId, views],
  );
  const [preview, setPreview] = useState<CanonicalTrendResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const queryKey = trendQueryRouteParam(query);
  useEffect(() => {
    let active = true;
    setPreview(null);
    setError(null);
    void api.analytics
      .trend(query)
      .then((value) => {
        if (active) setPreview(value);
      })
      .catch((cause: unknown) => {
        if (active) setError(errorMessage(cause));
      });
    return () => {
      active = false;
    };
  }, [query, queryKey]);
  const name = pinned?.name ?? 'Calories';
  const points =
    preview?.points.map((point) => ({
      date: point.kind === 'daily' ? point.date : point.bucketStartDate,
      value: point.value,
    })) ?? [];
  return (
    <View testID="complex-insights-pinned-analysis" className="gap-2">
      <View className="flex-row items-center justify-between">
        <AppText variant="heading" className="text-[22px] leading-7">
          Pinned analysis
        </AppText>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Manage pinned analysis"
          onPress={onManage}
        >
          <AppText variant="caption" className="text-primary-dark">
            Manage
          </AppText>
        </Pressable>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Open pinned view: ${name}`}
        className="min-h-11"
        onPress={() => onOpen(query.primaryMetric, queryKey)}
      >
        <AppCard elevated className="gap-2 p-[18px]">
          <AppText variant="caption" className="text-muted">
            PRIMARY VIEW · {query.primaryMetric}
          </AppText>
          <View className="flex-row items-center justify-between gap-3">
            <AppText variant="label">
              {name} ·{' '}
              {query.period.kind === 'relative'
                ? `${query.period.days}D`
                : 'Custom'}
            </AppText>
            <AppText variant="caption" className="text-primary-dark">
              Open ↗
            </AppText>
          </View>
          {error !== null ? (
            <AppText variant="caption" className="text-muted">
              Preview unavailable. Open the trend to retry.
            </AppText>
          ) : preview === null ? (
            <AppText variant="caption" className="text-muted">
              Loading pinned preview…
            </AppText>
          ) : (
            <LineTrendChart
              data={points}
              width={Math.max(220, width - 76)}
              height={60}
              color="#C9242D"
              accessibilityLabel={`${name} primary view preview`}
            />
          )}
        </AppCard>
      </Pressable>
    </View>
  );
}
