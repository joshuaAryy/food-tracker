import type { ReportsResponse } from '@food-tracker/shared';
import { View } from 'react-native';
import { AppButton } from '@/components/app-button';
import { AppCard } from '@/components/app-card';
import { AppText } from '@/components/app-text';
import { CompleteNutrientReport } from '@/components/complete-nutrient-report';
import { HighlightedNutrientSummary } from '@/components/highlighted-nutrient-summary';
import type { AnalyticsReportOverviewState } from '@/lib/analytics/analytics-report-resource';
import { NutrientHighlightsCard } from './nutrient-highlights-card';

export function ComplexInsightsNutrients({
  report,
  overview,
  loading,
  error,
  onRetry,
  onOverviewRetry,
  onExploreTrends,
}: {
  report: ReportsResponse | null;
  overview: AnalyticsReportOverviewState<'nutrientHighlights'> | undefined;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onOverviewRetry: () => void;
  onExploreTrends: () => void;
}) {
  const setupComplete = report !== null && report.goalDirection !== null;
  return (
    <View testID="complex-insights-nutrients" className="gap-7">
      <View className="gap-2">
        <AppText variant="heading" className="text-[25px] leading-8">
          Nutrients
        </AppText>
        <AppText variant="caption" className="text-muted">
          Explore reference-aware nutrient coverage for the selected reporting
          period.
        </AppText>
        <AppButton
          variant="secondary"
          className="min-h-11 self-start rounded-[14px] py-2"
          onPress={onExploreTrends}
        >
          Explore nutrient trends
        </AppButton>
      </View>
      <NutrientHighlightsCard
        overview={overview}
        testID="complex-insights-nutrient-highlights"
        onRetry={onOverviewRetry}
      />
      <AppCard className="gap-3 bg-module p-4">
        <AppText variant="label">Reference semantics</AppText>
        <View className="gap-2">
          <AppText variant="caption" className="text-muted">
            Target and minimum · progress toward an authoritative goal
          </AppText>
          <AppText variant="caption" className="text-muted">
            Limit · lower values remain within the authoritative ceiling
          </AppText>
          <AppText variant="caption" className="text-muted">
            True range · both authoritative bounds are present
          </AppText>
          <AppText variant="caption" className="text-muted">
            Unknown · no authoritative value or reference is available
          </AppText>
        </View>
      </AppCard>
      {loading ? (
        <AppCard className="bg-module p-4">
          <AppText variant="caption" className="text-muted">
            {report === null
              ? 'Loading nutrient report…'
              : 'Refreshing nutrient details. Earlier details remain visible.'}
          </AppText>
        </AppCard>
      ) : error !== null ? (
        <AppCard elevated className="gap-3 p-[18px]">
          <AppText variant="heading" className="text-[20px] leading-7">
            Nutrient report couldn’t load
          </AppText>
          <AppText variant="caption" className="text-muted">
            Other Insights reports remain available while this report retries.
          </AppText>
          <AppButton
            className="min-h-11 self-start rounded-[14px] px-5 py-2"
            onPress={onRetry}
          >
            Retry nutrient report
          </AppButton>
        </AppCard>
      ) : null}
      {report === null ? null : (
        <>
          {error !== null ? (
            <AppCard className="bg-module p-4">
              <AppText variant="caption" className="text-muted">
                Showing the last committed nutrient details while the report
                retries.
              </AppText>
            </AppCard>
          ) : null}
          <HighlightedNutrientSummary
            report={report.current}
            setupComplete={setupComplete}
          />
          <CompleteNutrientReport
            report={report.current}
            setupComplete={setupComplete}
          />
        </>
      )}
    </View>
  );
}
