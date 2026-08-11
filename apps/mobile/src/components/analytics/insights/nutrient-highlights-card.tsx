import { View } from 'react-native';
import { AppCard } from '@/components/app-card';
import { AppText } from '@/components/app-text';
import { ReportingSectionHeading } from '@/components/reporting-section-heading';
import type { AnalyticsReportSectionState } from '@/lib/analytics/analytics-report-resource';
import { AnalyticsSectionError } from './analytics-section-error';

function highlight(
  label: string,
  section: AnalyticsReportSectionState | undefined,
) {
  const value = section?.data?.summary.average;
  const reference = section?.data?.reference;
  const status =
    reference?.kind === 'target'
      ? value === null || value === undefined
        ? 'Unknown'
        : value >= reference.value
          ? 'Goal reached'
          : 'In progress'
      : 'Recorded';
  return {
    label,
    value:
      value === null || value === undefined ? '—' : `${Math.round(value)} g`,
    status,
  };
}

export function NutrientHighlightsCard({
  protein,
  carbs,
  fat,
  onRetry,
}: {
  protein: AnalyticsReportSectionState | undefined;
  carbs: AnalyticsReportSectionState | undefined;
  fat: AnalyticsReportSectionState | undefined;
  onRetry: () => void;
}) {
  const entries = [
    highlight('Protein', protein),
    highlight('Carbs', carbs),
    highlight('Fat', fat),
  ];
  const allUnavailable =
    protein?.data === null && carbs?.data === null && fat?.data === null;
  return (
    <View
      testID="simple-insights-section-nutrient-highlights"
      className="gap-3"
    >
      <ReportingSectionHeading icon="nutrients" title="Nutrient highlights" />
      {allUnavailable ? (
        <AnalyticsSectionError
          title="Nutrient highlights"
          section={protein ?? carbs ?? fat}
          onRetry={onRetry}
        />
      ) : (
        <AppCard elevated className="gap-3 p-[18px]">
          {entries.map((entry, index) => (
            <View
              key={entry.label}
              className={
                index === 0
                  ? 'flex-row items-center justify-between gap-3'
                  : 'flex-row items-center justify-between gap-3 border-t border-line pt-3'
              }
            >
              <View className="gap-0.5">
                <AppText variant="label">{entry.label}</AppText>
                <AppText variant="caption" className="text-muted">
                  {entry.value}
                </AppText>
              </View>
              <AppText variant="caption" className="text-primary-dark">
                {entry.status}
              </AppText>
            </View>
          ))}
        </AppCard>
      )}
    </View>
  );
}
