import type {
  AnalyticsOverviewKey,
  AnalyticsPreferenceValue,
  AnalyticsSavedView,
} from '@food-tracker/shared';
import { Pressable, View } from 'react-native';
import { AppText } from '@/components/app-text';
import { EnergyBalanceCard } from './energy-balance-card';
import { HydrationInsightsCard } from './hydration-insights-card';
import { InsightsPeriodSummary } from './insights-period-summary';
import { LoggingConsistencyCard } from './logging-consistency-card';
import { MacroBalanceCard } from './macro-balance-card';
import { NutrientHighlightsCard } from './nutrient-highlights-card';
import { PinnedAnalysisCard } from './pinned-analysis-card';
import { WeightDirectionCard } from './weight-direction-card';
import type { AnalyticsReportResourceState } from '@/lib/analytics/analytics-report-resource';

export function ComplexInsightsOverview({
  resource,
  preferences,
  views,
  onExploreTrends,
  onLogWater,
  onOverviewRetry,
  onManagePinned,
  onOpenPinned,
}: {
  resource: AnalyticsReportResourceState;
  preferences: AnalyticsPreferenceValue;
  views: readonly AnalyticsSavedView[];
  onExploreTrends: () => void;
  onLogWater: () => void;
  onOverviewRetry: (overview: AnalyticsOverviewKey) => void;
  onManagePinned: () => void;
  onOpenPinned: (metric: string, query: string) => void;
}) {
  return (
    <View testID="complex-insights-overview" className="gap-7">
      <View testID="complex-insights-explore" className="gap-2">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Explore trends"
          className="min-h-[52px] flex-row items-center justify-between rounded-[14px] bg-module px-4 active:opacity-70"
          onPress={onExploreTrends}
        >
          <AppText variant="label">Explore all trends</AppText>
          <AppText variant="label" className="text-muted">
            ›
          </AppText>
        </Pressable>
      </View>
      <InsightsPeriodSummary
        period={resource.period ?? 'month'}
        summary={resource.overview.periodSummary}
        onRetry={() => onOverviewRetry('periodSummary')}
      />
      <PinnedAnalysisCard
        preferences={preferences}
        views={views}
        onManage={onManagePinned}
        onOpen={onOpenPinned}
      />
      <EnergyBalanceCard
        overview={resource.overview.energy}
        trend={resource.sections.calories}
        onOpenTrend={onExploreTrends}
        onRetry={() => onOverviewRetry('energy')}
      />
      <MacroBalanceCard
        overview={resource.overview.macros}
        energyAverage={resource.overview.energy?.data?.average ?? null}
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
    </View>
  );
}
