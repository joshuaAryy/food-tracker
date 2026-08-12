import type { AnalyticsOverviewNutrientHighlight } from '@food-tracker/shared';
import { View } from 'react-native';
import { AppCard } from '@/components/app-card';
import { AppText } from '@/components/app-text';
import { ReportingSectionHeading } from '@/components/reporting-section-heading';
import type { AnalyticsReportOverviewState } from '@/lib/analytics/analytics-report-resource';
import { nutrientGauge } from '@/lib/analytics/overview-visuals';
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

function statusColor(highlight: AnalyticsOverviewNutrientHighlight): string {
  if (
    highlight.status === 'above_limit' ||
    highlight.status === 'above_range'
  ) {
    return '#C9242D';
  }
  if (
    highlight.status === 'below_target' ||
    highlight.status === 'below_minimum' ||
    highlight.status === 'below_range'
  ) {
    return '#D99000';
  }
  if (highlight.status === 'unknown') return '#6D7C6B';
  return '#00B86B';
}

function referenceCopy(highlight: AnalyticsOverviewNutrientHighlight): string {
  const reference = highlight.reference;
  if (reference.kind === 'none') return 'Reference unavailable';
  if (reference.kind === 'range') {
    return `${reference.lower.toLocaleString('en-US')}–${reference.upper.toLocaleString('en-US')} ${highlight.unit}`;
  }
  return `${reference.value.toLocaleString('en-US')} ${highlight.unit} ${reference.kind === 'limit' ? 'limit' : 'target'}`;
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
                index === 0 ? 'gap-2 pb-3' : 'gap-2 border-t border-line py-3'
              }
            >
              <View className="flex-row items-center justify-between gap-3">
                <AppText variant="label">{label(highlight.metric)}</AppText>
                <AppText
                  variant="caption"
                  style={{ color: statusColor(highlight) }}
                >
                  {statusCopy(highlight)}
                </AppText>
              </View>
              <View className="flex-row items-end justify-between gap-3">
                <AppText variant="caption" className="text-muted">
                  {valueCopy(highlight)}
                </AppText>
                <AppText variant="caption" className="text-muted">
                  {referenceCopy(highlight)}
                </AppText>
              </View>
              <NutrientGauge highlight={highlight} />
            </View>
          ))}
        </AppCard>
      )}
    </View>
  );
}

function NutrientGauge({
  highlight,
}: {
  highlight: AnalyticsOverviewNutrientHighlight;
}) {
  const gauge = nutrientGauge(highlight);
  const color = statusColor(highlight);
  return (
    <View
      accessible
      accessibilityLabel={`${label(highlight.metric)} ${statusCopy(highlight)}; ${valueCopy(highlight)}; ${referenceCopy(highlight)}`}
      className="h-3 justify-center"
    >
      <View className="h-1.5 overflow-hidden rounded-full bg-module">
        {gauge.fillPercent === null ? null : (
          <View
            className="h-full rounded-full"
            style={{ backgroundColor: color, width: `${gauge.fillPercent}%` }}
          />
        )}
      </View>
      {gauge.primaryMarkerPercent === null ? null : (
        <View
          pointerEvents="none"
          className="absolute h-3 w-0.5 rounded-full bg-ink"
          style={{ left: `${gauge.primaryMarkerPercent}%` }}
        />
      )}
      {gauge.secondaryMarkerPercent === null ? null : (
        <View
          pointerEvents="none"
          className="absolute h-3 w-0.5 rounded-full bg-ink"
          style={{ left: `${gauge.secondaryMarkerPercent}%` }}
        />
      )}
    </View>
  );
}
