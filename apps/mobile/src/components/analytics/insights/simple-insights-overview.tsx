import type { AnalyticsSectionKey } from '@food-tracker/shared';
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
  onSectionRetry,
}: {
  resource: AnalyticsReportResourceState;
  onExploreTrends: () => void;
  onLogWater: () => void;
  onSectionRetry: (section: AnalyticsSectionKey) => void;
}) {
  const sections = resource.sections;
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
        consistency={sections.loggingConsistency?.data ?? null}
      />
      <EnergyBalanceCard
        section={sections.calories}
        onOpenTrend={onExploreTrends}
        onRetry={() => onSectionRetry('calories')}
      />
      <MacroBalanceCard
        protein={sections.protein}
        carbs={sections.carbs}
        fat={sections.fat}
        macroComposition={sections.macroComposition}
        onOpenTrend={onExploreTrends}
        onRetry={() => onSectionRetry('protein')}
      />
      <NutrientHighlightsCard
        protein={sections.protein}
        carbs={sections.carbs}
        fat={sections.fat}
        onRetry={() => onSectionRetry('protein')}
      />
      <HydrationInsightsCard
        section={sections.hydration}
        onLogWater={onLogWater}
        onOpenTrend={onExploreTrends}
        onRetry={() => onSectionRetry('hydration')}
      />
      <WeightDirectionCard
        section={sections.weight}
        onOpenTrend={onExploreTrends}
        onRetry={() => onSectionRetry('weight')}
      />
      <LoggingConsistencyCard
        section={sections.loggingConsistency}
        onOpenTrend={onExploreTrends}
        onRetry={() => onSectionRetry('loggingConsistency')}
      />
      <View className="gap-2 rounded-[18px] bg-module p-4">
        <AppText variant="label">Explore every trend</AppText>
        <AppText variant="caption" className="text-muted">
          Open the complete Simple reporting catalog for your available metrics.
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
