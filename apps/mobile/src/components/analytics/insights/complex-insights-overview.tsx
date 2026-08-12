import type {
  AnalyticsOverviewKey,
  AnalyticsPreferenceValue,
  AnalyticsSavedView,
} from '@food-tracker/shared';
import { View } from 'react-native';
import { AppButton } from '@/components/app-button';
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
          Open the full Complex catalog for nutrient details, comparisons, and
          saved analysis.
        </AppText>
        <AppButton
          variant="secondary"
          className="min-h-11 self-start rounded-[14px] py-2"
          onPress={onExploreTrends}
        >
          Explore trends
        </AppButton>
      </View>
    </View>
  );
}
