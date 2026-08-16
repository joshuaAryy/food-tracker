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
import { formatMetricValue, formatMetricWithUnit } from '@/lib/reporting-ui';
import { AnalyticsSectionError } from './analytics-section-error';

function grams(value: number | null): string {
  return formatMetricWithUnit(value, 'g', { maximumFractionDigits: 0 });
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
  energyAverage,
  proteinTrend,
  onOpenTrend,
  onRetry,
  compact = false,
}: {
  overview: AnalyticsReportOverviewState<'macros'> | undefined;
  energyAverage: number | null;
  proteinTrend: AnalyticsReportSectionState | undefined;
  onOpenTrend: () => void;
  onRetry: () => void;
  compact?: boolean;
}) {
  const { width } = useWindowDimensions();
  const data = overview?.data ?? null;
  return (
    <View
      testID="simple-insights-section-macro-balance"
      className={compact ? 'gap-2' : 'gap-3'}
    >
      <ReportingSectionHeading
        icon="macros"
        title="Macro balance"
        compact={compact}
      />
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
          <AppCard
            elevated
            compact={compact}
            className="gap-3 rounded-[20px] p-[18px]"
          >
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
                size={104}
                centerValue={
                  energyAverage === null
                    ? undefined
                    : formatMetricValue(energyAverage, {
                        maximumFractionDigits: 0,
                      })
                }
                centerLabel="kcal avg"
                accessibilityLabel="Macro balance composition"
              />
              <View className="min-w-0 flex-1 gap-2">
                {[
                  [
                    'Protein',
                    data.protein.grams,
                    data.protein.percentage,
                    '#C9242D',
                  ],
                  ['Carbs', data.carbs.grams, data.carbs.percentage, '#33B866'],
                  ['Fat', data.fat.grams, data.fat.percentage, '#FFAD8F'],
                ].map(([label, value, percentage, color]) => (
                  <View
                    key={label as string}
                    className="flex-row items-center justify-between gap-2"
                  >
                    <View className="min-w-0 flex-1 flex-row items-center gap-1.5">
                      <View
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: color as string }}
                      />
                      <AppText variant="caption" numberOfLines={1}>
                        {label as string} · {grams(value as number | null)}
                      </AppText>
                    </View>
                    <AppText variant="caption" className="text-ink">
                      {percentage === null ? '—' : `${percentage}%`}
                    </AppText>
                  </View>
                ))}
              </View>
            </View>
            <View className="gap-1 border-t border-line pt-3">
              <View className="flex-row items-center justify-between gap-3">
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
                    width={Math.min(176, Math.max(150, width - 214))}
                    height={50}
                    color="#C9242D"
                    accessibilityLabel="Protein trend"
                  />
                )}
              </View>
            </View>
          </AppCard>
        </Pressable>
      )}
    </View>
  );
}
