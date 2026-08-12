import type { AnalyticsOverviewNutrientHighlight } from '@food-tracker/shared';
import { View } from 'react-native';
import { AppCard } from '@/components/app-card';
import { AppText } from '@/components/app-text';
import { ReportingSectionHeading } from '@/components/reporting-section-heading';
import type { AnalyticsReportOverviewState } from '@/lib/analytics/analytics-report-resource';
import { AnalyticsSectionError } from './analytics-section-error';

function label(metric: AnalyticsOverviewNutrientHighlight['metric']): string {
  if (metric === 'vitaminC') return 'Vitamin C';
  return metric === 'fiber' ? 'Fiber' : 'Sodium';
}

function valueCopy(highlight: AnalyticsOverviewNutrientHighlight): string {
  return highlight.value === null
    ? 'Unknown'
    : `${highlight.value.toLocaleString('en-US', { maximumFractionDigits: 1 })} ${highlight.unit}`;
}

function statusCopy(highlight: AnalyticsOverviewNutrientHighlight): string {
  if (highlight.status === 'unknown') return 'Unavailable';
  if (highlight.status === 'above_limit') return 'Above limit';
  if (highlight.status === 'within_limit') return 'Within limit';
  if (highlight.status === 'above_target') return 'Above target';
  if (highlight.status === 'meets_target') return 'At target';
  if (highlight.status === 'below_target') return 'Near target';
  if (highlight.status === 'above_range') return 'Above range';
  if (highlight.status === 'within_range') return 'Within range';
  if (highlight.status === 'below_range') return 'Below range';
  if (highlight.status === 'meets_minimum') return 'Goal reached';
  return 'Near goal';
}

export function NutrientHighlightsCard({
  overview,
  onRetry,
  testID = 'simple-insights-section-nutrient-highlights',
}: {
  overview: AnalyticsReportOverviewState<'nutrientHighlights'> | undefined;
  onRetry: () => void;
  testID?: string;
}) {
  const data = overview?.data ?? null;
  return (
    <View testID={testID} className="gap-3">
      <ReportingSectionHeading icon="nutrients" title="Nutrient highlights" />
      {data === null ? (
        <AnalyticsSectionError
          title="Nutrient highlights"
          section={overview}
          onRetry={onRetry}
        />
      ) : (
        <AppCard elevated className="gap-0 p-[18px]">
          {data.highlights.map((highlight, index) => (
            <View
              key={highlight.metric}
              className={
                index === 0
                  ? 'flex-row items-center justify-between gap-3 pb-3'
                  : 'flex-row items-center justify-between gap-3 border-t border-line py-3'
              }
            >
              <View className="gap-0.5">
                <AppText variant="label">{label(highlight.metric)}</AppText>
                <AppText variant="caption" className="text-muted">
                  {valueCopy(highlight)}
                </AppText>
              </View>
              <AppText
                variant="caption"
                className={
                  highlight.status === 'above_limit' ||
                  highlight.status === 'above_range'
                    ? 'text-[#eb1226]'
                    : 'text-primary-dark'
                }
              >
                {statusCopy(highlight)}
              </AppText>
            </View>
          ))}
        </AppCard>
      )}
    </View>
  );
}
