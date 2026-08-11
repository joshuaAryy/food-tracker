import type { AnalyticsOverviewKey } from '@food-tracker/shared';
import { View } from 'react-native';
import { AppButton } from '@/components/app-button';
import { AppText } from '@/components/app-text';
import type { AnalyticsReportResourceState } from '@/lib/analytics/analytics-report-resource';
import { EnergyBalanceCard } from './energy-balance-card';
import { HydrationInsightsCard } from './hydration-insights-card';
import { InsightsPeriodSummary } from './insights-period-summary';
import { LoggingConsistencyCard } from './logging-consistency-card';
import { MacroBalanceCard } from './macro-balance-card';
import { NutrientHighlightsCard } from './nutrient-highlights-card';
import { WeightDirectionCard } from './weight-direction-card';

export function SimpleInsightsOverview({
  resource,
  onExploreTrends,
  onLogWater,
  onOverviewRetry,
}: {
  resource: AnalyticsReportResourceState;
  onExploreTrends: () => void;
  onLogWater: () => void;
  onOverviewRetry: (overview: AnalyticsOverviewKey) => void;
}) {
  const stale = resource.staleSource === 'refresh_failed';
  const refreshing = resource.status === 'refreshing';
  const earlierAnalyticsAt =
    resource.updatedAt === null
      ? null
      : new Date(resource.updatedAt).toLocaleTimeString([], {
          hour: 'numeric',
          minute: '2-digit',
        });
  return (
    <View testID="simple-insights-overview" className="gap-7">
      {refreshing ? (
        <View className="gap-1 rounded-[18px] border border-border bg-module p-4">
          <AppText variant="label">Refreshing…</AppText>
          <AppText variant="caption" className="text-muted">
            Current analytics remain visible while the new response is
            validated.
          </AppText>
        </View>
      ) : null}
      {stale ? (
        <View className="gap-2 rounded-[18px] border border-border bg-module p-4">
          <AppText variant="label">Couldn’t refresh</AppText>
          <AppText variant="caption" className="text-muted">
            {earlierAnalyticsAt === null
              ? 'Showing earlier analytics. Your committed reports were not replaced.'
              : `Showing earlier analytics from ${earlierAnalyticsAt}. Your committed reports were not replaced.`}
          </AppText>
        </View>
      ) : null}
      <InsightsPeriodSummary
        period={resource.period ?? 'week'}
        summary={resource.overview.periodSummary}
        onRetry={() => onOverviewRetry('periodSummary')}
      />
      <EnergyBalanceCard
        overview={resource.overview.energy}
        trend={resource.sections.calories}
        onOpenTrend={onExploreTrends}
        onRetry={() => onOverviewRetry('energy')}
      />
      <MacroBalanceCard
        overview={resource.overview.macros}
        proteinTrend={resource.sections.protein}
        onOpenTrend={onExploreTrends}
        onRetry={() => onOverviewRetry('macros')}
      />
      <NutrientHighlightsCard
        overview={resource.overview.nutrientHighlights}
        onRetry={() => onOverviewRetry('nutrientHighlights')}
      />
      <HydrationInsightsCard
        overview={resource.overview.hydration}
        trend={resource.sections.hydration}
        onLogWater={onLogWater}
        onOpenTrend={onExploreTrends}
        onRetry={() => onOverviewRetry('hydration')}
      />
      <WeightDirectionCard
        overview={resource.overview.weight}
        trend={resource.sections.weight}
        onOpenTrend={onExploreTrends}
        onRetry={() => onOverviewRetry('weight')}
      />
      <LoggingConsistencyCard
        overview={resource.overview.loggingConsistency}
        onRetry={() => onOverviewRetry('loggingConsistency')}
      />
      <View className="gap-2 rounded-[18px] bg-module p-4">
        <AppText variant="label">Explore every trend</AppText>
        <AppText variant="caption" className="text-muted">
          Simple mode keeps trend controls curated. Advanced micronutrient
          drill-down, comparisons, and saved analysis stay in Complex mode.
        </AppText>
        <AppButton
          accessibilityLabel="Explore all trends"
          variant="secondary"
          className="min-h-11 self-start rounded-[14px] py-2"
          onPress={onExploreTrends}
        >
          Explore all trends
        </AppButton>
      </View>
    </View>
  );
}
