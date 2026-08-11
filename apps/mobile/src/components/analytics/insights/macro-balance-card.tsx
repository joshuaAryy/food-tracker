import { View } from 'react-native';
import { AppButton } from '@/components/app-button';
import { AppCard } from '@/components/app-card';
import { AppText } from '@/components/app-text';
import { MacroChart } from '@/components/analytics/charts/macro-chart';
import { ReportingSectionHeading } from '@/components/reporting-section-heading';
import type { AnalyticsReportSectionState } from '@/lib/analytics/analytics-report-resource';
import { AnalyticsSectionError } from './analytics-section-error';

function macroValue(
  section: AnalyticsReportSectionState | undefined,
): number | null {
  return section?.data?.summary.average ?? null;
}

function macroLabel(label: string, value: number | null): string {
  return value === null ? `${label} · —` : `${label} · ${Math.round(value)} g`;
}

export function MacroBalanceCard({
  protein,
  carbs,
  fat,
  macroComposition,
  onOpenTrend,
  onRetry,
}: {
  protein: AnalyticsReportSectionState | undefined;
  carbs: AnalyticsReportSectionState | undefined;
  fat: AnalyticsReportSectionState | undefined;
  macroComposition: AnalyticsReportSectionState | undefined;
  onOpenTrend: () => void;
  onRetry: () => void;
}) {
  const values = {
    protein: macroValue(protein),
    carbs: macroValue(carbs),
    fat: macroValue(fat),
  };
  const allUnavailable =
    protein?.data === null && carbs?.data === null && fat?.data === null;
  const compositionDays = macroComposition?.data?.summary.numericDayCount ?? 0;
  return (
    <View testID="simple-insights-section-macro-balance" className="gap-3">
      <ReportingSectionHeading icon="macros" title="Macro balance" />
      {allUnavailable ? (
        <AnalyticsSectionError
          title="Macro balance"
          section={protein ?? carbs ?? fat}
          onRetry={onRetry}
        />
      ) : (
        <AppCard elevated className="gap-3 p-[18px]">
          <AppText variant="caption" className="text-muted">
            REPORT · Period composition · {compositionDays} recorded days
          </AppText>
          <View className="flex-row items-center gap-4">
            <MacroChart
              values={values}
              size={112}
              accessibilityLabel="Macro balance composition"
            />
            <View className="min-w-0 flex-1 gap-2">
              <AppText variant="label">
                {macroLabel('Protein', values.protein)}
              </AppText>
              <AppText variant="label">
                {macroLabel('Carbs', values.carbs)}
              </AppText>
              <AppText variant="label">{macroLabel('Fat', values.fat)}</AppText>
            </View>
          </View>
          {values.protein === null ||
          values.carbs === null ||
          values.fat === null ? (
            <AppText variant="caption" className="text-muted">
              Some macro facts are unavailable and remain a gap.
            </AppText>
          ) : null}
          <AppButton
            accessibilityLabel="Open macro balance trend"
            variant="secondary"
            className="min-h-11 rounded-[14px] py-2"
            onPress={onOpenTrend}
          >
            Explore macro trend
          </AppButton>
        </AppCard>
      )}
    </View>
  );
}
