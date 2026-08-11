import type { AnalyticsOverviewMacros } from '@food-tracker/shared';
import { Pressable, useWindowDimensions, View } from 'react-native';
import { AppCard } from '@/components/app-card';
import { AppText } from '@/components/app-text';
import { LineTrendChart } from '@/components/analytics/charts/line-trend-chart';
import { MacroChart } from '@/components/analytics/charts/macro-chart';
import { ReportingSectionHeading } from '@/components/reporting-section-heading';
import type {
  AnalyticsReportOverviewState,
  AnalyticsReportSectionState,
} from '@/lib/analytics/analytics-report-resource';
import { AnalyticsSectionError } from './analytics-section-error';

function grams(value: number | null): string {
  return value === null ? '—' : `${Math.round(value)} g`;
}

function trendData(section: AnalyticsReportSectionState | undefined) {
  return (
    section?.data?.points.map((point) => ({
      date: point.kind === 'daily' ? point.date : point.bucketStartDate,
      value: point.value,
    })) ?? []
  );
}

export function MacroBalanceCard({
  overview,
  proteinTrend,
  onOpenTrend,
  onRetry,
}: {
  overview: AnalyticsReportOverviewState<'macros'> | undefined;
  proteinTrend: AnalyticsReportSectionState | undefined;
  onOpenTrend: () => void;
  onRetry: () => void;
}) {
  const { width } = useWindowDimensions();
  const data = overview?.data ?? null;
  return (
    <View testID="simple-insights-section-macro-balance" className="gap-3">
      <ReportingSectionHeading icon="macros" title="Macro balance" />
      {data === null ? (
        <AnalyticsSectionError
          title="Macro balance"
          section={overview}
          onRetry={onRetry}
        />
      ) : (
        <Pressable
          accessibilityLabel="Open macro trends"
          accessibilityRole="button"
          onPress={onOpenTrend}
        >
          <AppCard elevated className="gap-3 p-[18px]">
            <AppText variant="caption" className="text-muted">
              REPORT · Period composition
            </AppText>
            <View className="flex-row items-center gap-4">
              <MacroChart
                values={{
                  protein: data.protein.grams,
                  carbs: data.carbs.grams,
                  fat: data.fat.grams,
                }}
                size={112}
                accessibilityLabel="Macro balance composition"
              />
              <View className="min-w-0 flex-1 gap-2">
                {[
                  ['Protein', data.protein.grams, data.protein.percentage],
                  ['Carbs', data.carbs.grams, data.carbs.percentage],
                  ['Fat', data.fat.grams, data.fat.percentage],
                ].map(([label, value, percentage]) => (
                  <View
                    key={label as string}
                    className="flex-row justify-between gap-2"
                  >
                    <AppText variant="label">
                      {label as string} · {grams(value as number | null)}
                    </AppText>
                    <AppText variant="caption" className="text-ink">
                      {percentage === null ? '—' : `${percentage}%`}
                    </AppText>
                  </View>
                ))}
              </View>
            </View>
            <View className="flex-row items-center justify-between border-t border-line pt-3">
              <AppText variant="caption" className="text-muted">
                TREND · Protein
              </AppText>
              {proteinTrend?.data === null ||
              proteinTrend?.data === undefined ? (
                <AppText variant="caption" className="text-muted">
                  Unavailable
                </AppText>
              ) : (
                <LineTrendChart
                  data={trendData(proteinTrend)}
                  width={Math.max(150, width - 210)}
                  height={50}
                  color="#C9242D"
                  accessibilityLabel="Protein trend"
                />
              )}
            </View>
          </AppCard>
        </Pressable>
      )}
    </View>
  );
}
