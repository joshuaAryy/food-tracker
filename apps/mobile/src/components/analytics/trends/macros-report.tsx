import type { CanonicalTrendResponse } from '@food-tracker/shared';
import { Pressable, View } from 'react-native';
import { LineTrendChart } from '@/components/analytics/charts/line-trend-chart';
import { AppCard } from '@/components/app-card';
import { AppText } from '@/components/app-text';
import { MacroBalanceSummary } from './macro-balance-summary';
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
        <AppText variant="heading" className="text-[22px] leading-7">
          Macro composition
        </AppText>
        {composition === undefined || percentages === undefined ? (
          <AppText variant="caption" className="text-muted">
            Macro composition is unavailable for this period.
          </AppText>
        ) : (
          <>
            <AppText
              variant="heading"
              className="text-[26px] leading-8 tabular-nums"
            >
              {trend.macroAverageEnergy === null ||
              trend.macroAverageEnergy === undefined
                ? 'Unknown'
                : `${Math.round(trend.macroAverageEnergy).toLocaleString('en-US')} kcal`}
            </AppText>
            <AppText variant="caption" className="text-muted">
              Average energy across recorded macro days
            </AppText>
            <MacroBalanceSummary
              percentages={percentages}
              size={Math.min(190, Math.max(150, width - 190))}
            />
          </>
        )}
      </AppCard>
      <AppCard className="gap-1 bg-module p-4">
        <AppText variant="label">Shared macro units</AppText>
        <AppText variant="caption" className="text-muted">
          Macro values and comparisons use the canonical backend composition;
          missing values remain unknown rather than zero.
        </AppText>
      </AppCard>
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
              accessibilityLabel={`Protein trend from ${proteinTrend.resolvedRange.startDate} through ${proteinTrend.resolvedRange.endDate}`}
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
      {trend.macroDailyMix === undefined ? null : (
        <AppCard elevated className="gap-2 p-4">
          <AppText variant="label">Daily macro mix</AppText>
          {trend.macroDailyMix.slice(-7).map((day) => (
            <View key={day.date} className="gap-1">
              <View className="flex-row items-center justify-between">
                <AppText variant="caption">{day.date}</AppText>
                <AppText variant="caption" className="text-muted">
                  P {day.protein ?? '—'}% · C {day.carbs ?? '—'}% · F{' '}
                  {day.fat ?? '—'}%
                </AppText>
              </View>
              <View
                accessible
                accessibilityLabel={`${day.date} macro composition`}
                className="h-2 flex-row overflow-hidden rounded-full bg-line"
              >
                <View
                  className="bg-[#C9242D]"
                  style={{ width: `${day.protein ?? 0}%` }}
                />
                <View
                  className="bg-[#D8A33E]"
                  style={{ width: `${day.carbs ?? 0}%` }}
                />
                <View
                  className="bg-[#7A9B76]"
                  style={{ width: `${day.fat ?? 0}%` }}
                />
              </View>
            </View>
          ))}
        </AppCard>
      )}
    </View>
  );
}
