import { useCallback, useState } from 'react';
import { View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import type { AdvancedAnalytics, Recommendation } from '@food-tracker/shared';
import { AppButton } from '@/components/app-button';
import { AppCard } from '@/components/app-card';
import { AppScreen } from '@/components/app-screen';
import { AppText } from '@/components/app-text';
import { EmptyState } from '@/components/empty-state';
import { ErrorState } from '@/components/error-state';
import { LoadingState } from '@/components/loading-state';
import { ScreenHeader } from '@/components/screen-header';
import { api, errorMessage } from '@/lib/api-client';
import { useAppStore } from '@/store/app-store';

interface MetricRowProps {
  label: string;
  value: string;
  accentClassName?: string | undefined;
}

function MetricRow({ label, value, accentClassName }: MetricRowProps) {
  return (
    <View className="flex-row items-center justify-between gap-4 py-2.5">
      <View className="min-w-0 flex-1 flex-row items-center gap-2">
        {accentClassName === undefined ? null : (
          <View className={`h-2.5 w-2.5 rounded-full ${accentClassName}`} />
        )}
        <AppText>{label}</AppText>
      </View>
      <AppText variant="label" className="tabular-nums">
        {value}
      </AppText>
    </View>
  );
}

function Divider() {
  return <View className="h-px bg-border" />;
}

function formatNumber(value: number, maximumFractionDigits = 1): string {
  return value.toLocaleString('en-US', { maximumFractionDigits });
}

function formatDifference(value: number, unit: string): string {
  const sign = value > 0 ? '+' : '';
  return `${sign}${formatNumber(value)} ${unit}`;
}

function formatWeight(value: number | null): string {
  return value === null ? '—' : `${value.toFixed(1)} lb`;
}

function AnalyticsContent({ analytics }: { analytics: AdvancedAnalytics }) {
  const hasAnalyticsData =
    analytics.loggingConsistency.past30Days.loggedDays > 0 ||
    analytics.weightTrend.latestWeightLb !== null;

  if (!hasAnalyticsData) {
    return (
      <EmptyState
        title="Analytics need tracking data"
        message="Log food or weight to start building 7-day and 30-day trends."
        symbol="◔"
      />
    );
  }

  const macroTotals = [
    {
      label: 'Calories',
      value: `${formatNumber(analytics.macros.totals.calories)} kcal`,
    },
    {
      label: 'Protein',
      value: `${formatNumber(analytics.macros.totals.protein)} g`,
    },
    {
      label: 'Carbs',
      value: `${formatNumber(analytics.macros.totals.carbs)} g`,
    },
    {
      label: 'Fat',
      value: `${formatNumber(analytics.macros.totals.fat)} g`,
    },
    {
      label: 'Fiber',
      value: `${formatNumber(analytics.macros.totals.fiber)} g`,
    },
    {
      label: 'Sugar',
      value: `${formatNumber(analytics.macros.totals.sugar)} g`,
    },
    {
      label: 'Sodium',
      value: `${formatNumber(analytics.macros.totals.sodium)} mg`,
    },
  ];

  return (
    <View className="gap-5">
      <View className="gap-2.5">
        <AppText variant="heading">Trends</AppText>

        <AppCard compact className="gap-3">
          <AppText variant="label">Calorie average</AppText>
          <View className="flex-row gap-3">
            <View className="min-w-0 flex-1 gap-1">
              <AppText variant="caption" muted>
                PAST 7 DAYS
              </AppText>
              <AppText variant="heading" className="tabular-nums">
                {formatNumber(analytics.calorieTrend.average7Day)}
              </AppText>
              <AppText variant="caption" muted>
                kcal / day
              </AppText>
            </View>
            <View className="min-w-0 flex-1 gap-1">
              <AppText variant="caption" muted>
                PAST 30 DAYS
              </AppText>
              <AppText variant="heading" className="tabular-nums">
                {formatNumber(analytics.calorieTrend.average30Day)}
              </AppText>
              <AppText variant="caption" muted>
                kcal / day
              </AppText>
            </View>
          </View>
          <Divider />
          <MetricRow
            label="7-day difference"
            value={formatDifference(analytics.calorieTrend.difference, 'kcal')}
          />
        </AppCard>

        <AppCard compact className="gap-3">
          <AppText variant="label">Protein average</AppText>
          <View className="flex-row gap-3">
            <View className="min-w-0 flex-1 gap-1">
              <AppText variant="caption" muted>
                PAST 7 DAYS
              </AppText>
              <AppText variant="heading" className="tabular-nums">
                {formatNumber(analytics.proteinTrend.average7Day)}
              </AppText>
              <AppText variant="caption" muted>
                grams / day
              </AppText>
            </View>
            <View className="min-w-0 flex-1 gap-1">
              <AppText variant="caption" muted>
                PAST 30 DAYS
              </AppText>
              <AppText variant="heading" className="tabular-nums">
                {formatNumber(analytics.proteinTrend.average30Day)}
              </AppText>
              <AppText variant="caption" muted>
                grams / day
              </AppText>
            </View>
          </View>
          <Divider />
          <MetricRow
            label="7-day difference"
            value={formatDifference(analytics.proteinTrend.difference, 'g')}
          />
        </AppCard>
      </View>

      <View className="gap-2.5">
        <View className="gap-0.5">
          <AppText variant="heading">Macro totals</AppText>
          <AppText variant="caption" muted>
            {analytics.range.startDate} to {analytics.range.endDate}
          </AppText>
        </View>
        <AppCard compact>
          {macroTotals.map((metric, index) => (
            <View key={metric.label}>
              {index === 0 ? null : <Divider />}
              <MetricRow label={metric.label} value={metric.value} />
            </View>
          ))}
        </AppCard>
      </View>

      <View className="gap-2.5">
        <AppText variant="heading">Macro calorie split</AppText>
        <AppCard compact>
          <MetricRow
            label="Protein"
            value={`${formatNumber(
              analytics.macros.calorieSplit.proteinPercent,
            )}%`}
            accentClassName="bg-sage"
          />
          <Divider />
          <MetricRow
            label="Carbs"
            value={`${formatNumber(
              analytics.macros.calorieSplit.carbsPercent,
            )}%`}
            accentClassName="bg-gold"
          />
          <Divider />
          <MetricRow
            label="Fat"
            value={`${formatNumber(analytics.macros.calorieSplit.fatPercent)}%`}
            accentClassName="bg-clay"
          />
        </AppCard>
      </View>

      <View className="gap-2.5">
        <AppText variant="heading">Logging consistency</AppText>
        <AppCard compact>
          <MetricRow
            label="Past 7 days"
            value={`${analytics.loggingConsistency.past7Days.loggedDays} / ${analytics.loggingConsistency.past7Days.expectedDays} days`}
          />
          <Divider />
          <MetricRow
            label="Past 30 days"
            value={`${analytics.loggingConsistency.past30Days.loggedDays} / ${analytics.loggingConsistency.past30Days.expectedDays} days`}
          />
        </AppCard>
      </View>

      <View className="gap-2.5">
        <AppText variant="heading">Weight trend</AppText>
        <AppCard compact>
          <MetricRow
            label="Latest weight"
            value={formatWeight(analytics.weightTrend.latestWeightLb)}
          />
          <Divider />
          <MetricRow
            label="Previous weight"
            value={formatWeight(analytics.weightTrend.previousWeightLb)}
          />
          <Divider />
          <MetricRow
            label="Change"
            value={
              analytics.weightTrend.changeLb === null
                ? '—'
                : formatDifference(analytics.weightTrend.changeLb, 'lb')
            }
          />
          <Divider />
          <MetricRow
            label="Weekly slope"
            value={
              analytics.weightTrend.weeklySlopeLb === null
                ? '—'
                : `${formatDifference(
                    analytics.weightTrend.weeklySlopeLb,
                    'lb',
                  )} / week`
            }
          />
        </AppCard>
      </View>
    </View>
  );
}

export default function InsightsScreen() {
  const dataVersion = useAppStore((state) => state.dataVersion);
  const [analytics, setAnalytics] = useState<AdvancedAnalytics | null>(null);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dismissingId, setDismissingId] = useState<string | null>(null);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);
  const [recommendationsError, setRecommendationsError] = useState<
    string | null
  >(null);

  const loadInsights = useCallback(async (asRefresh = false) => {
    if (asRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setAnalyticsError(null);
    setRecommendationsError(null);

    const [analyticsResult, recommendationsResult] = await Promise.allSettled([
      api.analytics.advanced({ rangeDays: 30 }),
      (async () => {
        await api.recommendations.generate();
        return api.recommendations.list();
      })(),
    ]);

    if (analyticsResult.status === 'fulfilled') {
      setAnalytics(analyticsResult.value);
    } else {
      setAnalyticsError(errorMessage(analyticsResult.reason));
    }

    if (recommendationsResult.status === 'fulfilled') {
      setRecommendations(recommendationsResult.value);
    } else {
      setRecommendationsError(errorMessage(recommendationsResult.reason));
    }

    setLoading(false);
    setRefreshing(false);
  }, []);

  const dismissRecommendation = useCallback(async (id: string) => {
    setDismissingId(id);
    setRecommendationsError(null);
    try {
      await api.recommendations.dismiss(id);
      setRecommendations((current) =>
        current.filter((recommendation) => recommendation.id !== id),
      );
    } catch (dismissError) {
      setRecommendationsError(errorMessage(dismissError));
    } finally {
      setDismissingId(null);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadInsights();
    }, [dataVersion, loadInsights]),
  );

  if (loading && analytics === null && recommendations.length === 0) {
    return (
      <AppScreen>
        <LoadingState message="Checking for insights…" />
      </AppScreen>
    );
  }

  return (
    <AppScreen
      refreshing={refreshing}
      onRefresh={() => void loadInsights(true)}
    >
      <ScreenHeader
        title="Insights"
        subtitle="Deterministic trends and guidance from your tracking data."
      />

      <View className="gap-2.5">
        <AppText variant="heading">Advanced analytics</AppText>
        {analyticsError === null ? null : (
          <ErrorState
            title={
              analytics === null
                ? 'Analytics are unavailable'
                : 'Couldn’t refresh analytics'
            }
            message={analyticsError}
            onRetry={() => void loadInsights()}
          />
        )}
        {analytics === null ? null : <AnalyticsContent analytics={analytics} />}
      </View>

      <View className="gap-2.5">
        <AppText variant="heading">Recommendations</AppText>

        {recommendationsError === null ? null : (
          <ErrorState
            title={
              recommendations.length === 0
                ? 'Recommendations are unavailable'
                : 'Couldn’t refresh recommendations'
            }
            message={recommendationsError}
            onRetry={() => void loadInsights()}
          />
        )}

        {recommendations.length === 0 && recommendationsError === null ? (
          <EmptyState
            title="Recommendations will appear here"
            message="Guidance will show when your tracking data produces an actionable recommendation."
            symbol="✦"
          />
        ) : (
          <View className="gap-3">
            {recommendations.map((recommendation) => (
              <AppCard key={recommendation.id} compact className="gap-2">
                <AppText variant="caption" className="uppercase text-sage-dark">
                  {recommendation.severity} priority
                </AppText>
                <AppText variant="heading">{recommendation.title}</AppText>
                <AppText muted>{recommendation.message}</AppText>
                <AppButton
                  variant="ghost"
                  loading={dismissingId === recommendation.id}
                  disabled={
                    dismissingId !== null && dismissingId !== recommendation.id
                  }
                  className="self-start px-0"
                  onPress={() => void dismissRecommendation(recommendation.id)}
                >
                  Dismiss
                </AppButton>
              </AppCard>
            ))}
          </View>
        )}
      </View>

      <AppCard compact className="gap-2 bg-surface">
        <AppText variant="label">How insights work</AppText>
        <AppText muted>
          Nutrition math and recommendation decisions remain deterministic in
          the backend. This screen only presents the returned facts.
        </AppText>
      </AppCard>
    </AppScreen>
  );
}
