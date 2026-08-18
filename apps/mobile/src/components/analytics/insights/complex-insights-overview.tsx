import type { AnalyticsOverviewKey } from '@food-tracker/shared';
import { View } from 'react-native';
import { EnergyBalanceCard } from './energy-balance-card';
import { HydrationInsightsCard } from './hydration-insights-card';
import { InsightsPeriodSummary } from './insights-period-summary';
import { LoggingConsistencyCard } from './logging-consistency-card';
import { MacroBalanceCard } from './macro-balance-card';
import { NutrientHighlightsCard } from './nutrient-highlights-card';
import { WeightDirectionCard } from './weight-direction-card';
import type { AnalyticsReportResourceState } from '@/lib/analytics/analytics-report-resource';

export function ComplexInsightsOverview({
  resource,
  onExploreTrends,
  onLogWater,
  onOverviewRetry,
  compact = false,
}: {
  resource: AnalyticsReportResourceState;
  onExploreTrends: () => void;
  onLogWater: () => void;
  onOverviewRetry: (overview: AnalyticsOverviewKey) => void;
  compact?: boolean;
}) {
  return (
    <View
      testID="complex-insights-overview"
      className={compact ? 'gap-4' : 'gap-7'}
    >
      <InsightsPeriodSummary
        period={resource.period ?? 'month'}
        summary={resource.overview.periodSummary}
        onRetry={() => onOverviewRetry('periodSummary')}
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
