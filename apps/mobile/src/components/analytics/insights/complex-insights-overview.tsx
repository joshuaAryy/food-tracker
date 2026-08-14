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
  compact = false,
}: {
  resource: AnalyticsReportResourceState;
  preferences: AnalyticsPreferenceValue;
  views: readonly AnalyticsSavedView[];
  onExploreTrends: () => void;
  onLogWater: () => void;
  onOverviewRetry: (overview: AnalyticsOverviewKey) => void;
  onManagePinned: () => void;
  onOpenPinned: (metric: string, query: string) => void;
  compact?: boolean;
}) {
  return (
    <View
      testID="complex-insights-overview"
      className={compact ? 'gap-4' : 'gap-7'}
    >
      <View testID="complex-insights-explore" className="gap-2">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Explore trends"
          className={`flex-row items-center justify-between rounded-[12px] bg-module-muted px-4 active:opacity-70 ${compact ? 'min-h-10' : 'min-h-[52px]'}`}
          onPress={onExploreTrends}
        >
          <AppText variant={compact ? 'caption' : 'label'}>
            Explore all trends
          </AppText>
          <AppText variant="label" className="text-muted">
            ›
          </AppText>
        </Pressable>
      </View>
      <InsightsPeriodSummary
        period={resource.period ?? 'month'}
        summary={resource.overview.periodSummary}
        onRetry={() => onOverviewRetry('periodSummary')}
        compact={compact}
      />
      <PinnedAnalysisCard
        preferences={preferences}
        views={views}
        onManage={onManagePinned}
        onOpen={onOpenPinned}
        compact={compact}
      />
      <EnergyBalanceCard
        overview={resource.overview.energy}
        trend={resource.sections.calories}
        onOpenTrend={onExploreTrends}
        onRetry={() => onOverviewRetry('energy')}
        compact={compact}
      />
      <MacroBalanceCard
        overview={resource.overview.macros}
        energyAverage={resource.overview.energy?.data?.average ?? null}
        proteinTrend={resource.sections.protein}
        onOpenTrend={onExploreTrends}
        onRetry={() => onOverviewRetry('macros')}
        compact={compact}
      />
      <NutrientHighlightsCard
        overview={resource.overview.nutrientHighlights}
        onRetry={() => onOverviewRetry('nutrientHighlights')}
        compact={compact}
      />
      <HydrationInsightsCard
        overview={resource.overview.hydration}
        trend={resource.sections.hydration}
        onLogWater={onLogWater}
        onOpenTrend={onExploreTrends}
        onRetry={() => onOverviewRetry('hydration')}
        compact={compact}
      />
      <WeightDirectionCard
        overview={resource.overview.weight}
        trend={resource.sections.weight}
        onOpenTrend={onExploreTrends}
        onRetry={() => onOverviewRetry('weight')}
        compact={compact}
      />
      <LoggingConsistencyCard
        overview={resource.overview.loggingConsistency}
        onRetry={() => onOverviewRetry('loggingConsistency')}
        compact={compact}
      />
    </View>
  );
}
