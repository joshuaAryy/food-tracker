import type { CanonicalTrendResponse } from '@food-tracker/shared';
import { Pressable, View } from 'react-native';
import { LineTrendChart } from '@/components/analytics/charts/line-trend-chart';
import { AppCard } from '@/components/app-card';
import { AppText } from '@/components/app-text';
import { formatPresentationDateRange } from '@/lib/date-time';
import { MacroBalanceSummary } from './macro-balance-summary';
import { MacroDailyMixChart } from './macro-daily-mix-chart';
import { TrendPeriodPills } from './trend-period-pills';

export function MacrosReport({
  trend,
  width,
  simple,
  proteinTrend,
  proteinTrendLoading,
  selectedPeriod,
  onSelectPeriod,
  onOpenCustomRange,
  showPeriodControls = true,
  onOpenProtein,
}: {
  trend: CanonicalTrendResponse;
  width: number;
  simple: boolean;
  proteinTrend: CanonicalTrendResponse | null;
  proteinTrendLoading: boolean;
  selectedPeriod: 7 | 30 | 90 | null;
  onSelectPeriod: (period: 7 | 30 | 90) => void;
  onOpenCustomRange: () => void;
  showPeriodControls?: boolean;
  onOpenProtein?: (() => void) | undefined;
}) {
  const composition = trend.macroComposition;
  const percentages = trend.macroPercentages;
  return (
    <View testID="macros-report" className="gap-4">
      {showPeriodControls ? (
        <TrendPeriodPills
          selectedPeriod={selectedPeriod}
          onSelect={onSelectPeriod}
          simple={simple}
          onOpenCustomRange={onOpenCustomRange}
        />
      ) : null}
      <AppCard elevated className="gap-3 p-[18px]">
        <AppText variant="label" className="text-muted">
          {selectedPeriod === 30 ? '30-DAY COMPOSITION' : 'COMPOSITION'}
        </AppText>
        {composition === undefined || percentages === undefined ? (
          <AppText variant="caption" className="text-muted">
            Macro composition is unavailable for this period.
          </AppText>
        ) : (
          <MacroBalanceSummary
            percentages={percentages}
            averageEnergy={trend.macroAverageEnergy ?? null}
            size={Math.min(140, Math.max(124, width - 246))}
          />
        )}
        <AppText variant="caption" className="text-muted">
          Protein remained the most consistent macro across logged days.
        </AppText>
        <AppText variant="label">View exact totals below</AppText>
      </AppCard>
      {trend.macroDailyMix === undefined ? null : (
        <AppCard elevated className="gap-2 p-4">
          <AppText variant="label" className="text-muted">
            DAILY MACRO MIX
          </AppText>
          <MacroDailyMixChart days={trend.macroDailyMix.slice(-7)} />
        </AppCard>
      )}
      <AppCard elevated className="gap-3 p-3">
        <AppText variant="heading" className="text-[18px] leading-6">
          Protein trend
        </AppText>
        {proteinTrendLoading ? (
          <AppText variant="caption" className="text-muted">
            Loading Protein trend…
          </AppText>
        ) : proteinTrend === null ? (
          <AppText variant="caption" className="text-muted">
            Protein trend unavailable for this period.
          </AppText>
        ) : (
          <>
            <LineTrendChart
              data={proteinTrend.points.map((point) => ({
                date:
                  point.kind === 'daily' ? point.date : point.bucketStartDate,
                value: point.value,
              }))}
              width={Math.max(260, width - 76)}
              color="#C9242D"
              reference={
                proteinTrend.reference.kind === 'target' ||
                proteinTrend.reference.kind === 'minimum' ||
                proteinTrend.reference.kind === 'limit'
                  ? proteinTrend.reference.value
                  : null
              }
              accessibilityLabel={`Protein trend for ${formatPresentationDateRange(proteinTrend.resolvedRange.startDate, proteinTrend.resolvedRange.endDate)}`}
            />
            {onOpenProtein === undefined ? null : (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Open individual Protein trend"
                className="min-h-11 self-start justify-center"
                onPress={onOpenProtein}
              >
                <AppText
                  variant="caption"
                  className="font-semibold text-primary-dark"
                >
                  Open individual Protein trend ›
                </AppText>
              </Pressable>
            )}
          </>
        )}
      </AppCard>
    </View>
  );
}
