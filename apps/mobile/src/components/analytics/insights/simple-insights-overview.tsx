import type { AnalyticsOverviewKey } from '@food-tracker/shared';
import { Pressable, View } from 'react-native';
import { AppText } from '@/components/app-text';
import type { AnalyticsReportResourceState } from '@/lib/analytics/analytics-report-resource';
import { EnergyBalanceCard } from './energy-balance-card';
import { HydrationInsightsCard } from './hydration-insights-card';
import { InsightsPeriodSummary } from './insights-period-summary';
import { LoggingConsistencyCard } from './logging-consistency-card';
import { MacroBalanceCard } from './macro-balance-card';
import { NutrientHighlightsCard } from './nutrient-highlights-card';
import { WeightDirectionCard } from './weight-direction-card';
import { AnalyticsFirstUse } from '../states/analytics-first-use';

export function SimpleInsightsOverview({
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
  const stale = resource.staleSource === 'refresh_failed';
  const refreshing = resource.status === 'refreshing';
  const earlierAnalyticsAt =
    resource.updatedAt === null
      ? null
      : new Date(resource.updatedAt).toLocaleTimeString([], {
          hour: 'numeric',
          minute: '2-digit',
        });
  const periodSummary = resource.overview.periodSummary;
  const firstUseData =
    periodSummary?.status === 'available' &&
    periodSummary.data !== null &&
    periodSummary.data.interpretation === 'first_use'
      ? periodSummary.data
      : null;
  return (
    <View
      testID="simple-insights-overview"
      className={compact ? 'gap-4' : 'gap-7'}
    >
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
      {firstUseData !== null ? (
        <AnalyticsFirstUse
          mealCount={firstUseData.todaySoFar.mealCount}
          calories={
            firstUseData.todaySoFar.calories.state === 'unknown'
              ? null
              : firstUseData.todaySoFar.calories.value
          }
          proteinGrams={
            firstUseData.todaySoFar.protein.state === 'unknown'
              ? null
              : firstUseData.todaySoFar.protein.value
          }
          loggedDays={firstUseData.eligibleLoggedDayCount}
          requiredDays={firstUseData.eligibleTotalDayCount}
          currentDayPhase={firstUseData.currentDayPhase}
          onExplore={onExploreTrends}
        />
      ) : null}
      {firstUseData === null ? (
        <>
          <View testID="simple-insights-explore" className="gap-2">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Explore all trends"
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
            period={resource.period ?? 'week'}
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
        </>
      ) : null}
    </View>
  );
}
