import type { CanonicalTrendResponse } from '@food-tracker/shared';
import { Pressable, View } from 'react-native';
import { LineTrendChart } from '@/components/analytics/charts/line-trend-chart';
import { AppCard } from '@/components/app-card';
import { AppText } from '@/components/app-text';
import {
  formatPresentationDate,
  formatPresentationDateRange,
} from '@/lib/date-time';
import { formatMetricWithUnit } from '@/lib/reporting-ui';
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
  const proteinPoints =
    proteinTrend?.points.map((point) => ({
      date: point.kind === 'daily' ? point.date : point.bucketStartDate,
      value: point.value,
    })) ?? [];
  const latestProteinIndex = proteinPoints.reduce(
    (latest, point, index) => (point.value === null ? latest : index),
    -1,
  );
  const latestProtein =
    latestProteinIndex < 0 ? null : (proteinPoints[latestProteinIndex] ?? null);
  const proteinReference = proteinTrend?.reference;
  const proteinTarget =
    proteinReference !== undefined &&
    (proteinReference.kind === 'target' ||
      proteinReference.kind === 'minimum' ||
      proteinReference.kind === 'limit')
      ? proteinReference.value
      : null;
  const proteinReferenceRange =
    proteinReference?.kind === 'range'
      ? {
          lower: proteinReference.lower,
          upper: proteinReference.upper,
        }
      : null;
  const proteinRollingValues = proteinTrend?.rollingTrend?.values;
  const hasProteinRollingTrend =
    proteinRollingValues !== undefined &&
    proteinRollingValues.filter(
      (value) => value !== null && Number.isFinite(value),
    ).length >= 2;
  const compositionDonutSize = width >= 360 ? 124 : 108;
  return (
    <View testID="macros-report" className="gap-6">
      {showPeriodControls ? (
        <TrendPeriodPills
          selectedPeriod={selectedPeriod}
          onSelect={onSelectPeriod}
          simple={simple}
          onOpenCustomRange={onOpenCustomRange}
        />
      ) : null}
      <AppCard
        elevated
        testID="macro-composition-card"
        className="min-h-[300px] justify-between gap-3 p-[18px]"
        style={{ minHeight: 300 }}
      >
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
            size={compositionDonutSize}
          />
        )}
        <AppText variant="caption" className="text-muted">
          Protein remained the most consistent macro across logged days.
        </AppText>
        <AppText variant="label">View exact totals below</AppText>
      </AppCard>
      {trend.macroDailyMix === undefined ? null : trend.macroDailyMix.length ===
        0 ? (
        <AppCard elevated className="p-4">
          <AppText variant="caption" className="text-muted">
            Daily macro mix is unavailable for this period.
          </AppText>
        </AppCard>
      ) : (
        <View testID="macro-daily-mix-section" className="gap-3">
          <AppText variant="label" className="text-muted">
            DAILY MACRO MIX
          </AppText>
          <AppCard
            elevated
            className="min-h-[280px] justify-between p-[18px]"
            style={{ minHeight: 280 }}
          >
            <MacroDailyMixChart days={trend.macroDailyMix.slice(-7)} />
          </AppCard>
        </View>
      )}
      <AppCard
        elevated
        testID="macro-protein-trend-card"
        className="min-h-[226px] gap-3 p-[18px]"
        style={{ minHeight: 226 }}
      >
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
              data={proteinPoints}
              width={Math.max(260, width - 76)}
              height={112}
              color="#C9242D"
              trendValues={
                hasProteinRollingTrend ? proteinRollingValues : undefined
              }
              connectTrendGaps={hasProteinRollingTrend}
              initialSelectedIndex={
                latestProteinIndex < 0 ? null : latestProteinIndex
              }
              showSelectionTooltip={false}
              showSelectionDescription={false}
              reference={proteinTarget}
              referenceRange={proteinReferenceRange}
              accessibilityLabel={`Protein trend for ${formatPresentationDateRange(proteinTrend.resolvedRange.startDate, proteinTrend.resolvedRange.endDate)}`}
            />
            {latestProtein === null ? null : (
              <View className="flex-row justify-between border-t border-border pt-3">
                <AppText variant="label">
                  {formatPresentationDate(latestProtein.date)}
                </AppText>
                <AppText variant="caption" className="text-muted">
                  {latestProtein.value === null
                    ? 'No recorded value'
                    : formatMetricWithUnit(
                        latestProtein.value,
                        proteinTrend.reference.unit,
                      )}{' '}
                  · Recorded value
                </AppText>
              </View>
            )}
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
