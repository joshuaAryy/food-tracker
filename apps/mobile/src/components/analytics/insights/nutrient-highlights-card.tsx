import type { AnalyticsOverviewNutrientHighlight } from '@food-tracker/shared';
import { View } from 'react-native';
import { AppCard } from '@/components/app-card';
import { AppText } from '@/components/app-text';
import { ReportingSectionHeading } from '@/components/reporting-section-heading';
import type { AnalyticsReportOverviewState } from '@/lib/analytics/analytics-report-resource';
import { nutrientGauge } from '@/lib/analytics/overview-visuals';
import { AnalyticsSectionError } from './analytics-section-error';
import { formatMetricWithUnit, formatMetricValue } from '@/lib/reporting-ui';

function label(metric: AnalyticsOverviewNutrientHighlight['metric']): string {
  if (metric === 'vitaminC') return 'Vitamin C';
  return metric === 'fiber' ? 'Fiber' : 'Sodium';
}

function valueCopy(highlight: AnalyticsOverviewNutrientHighlight): string {
  return highlight.value === null
    ? 'Unknown'
    : formatMetricWithUnit(highlight.value, highlight.unit);
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
    return `Range · ${formatMetricValue(reference.lower)}–${formatMetricValue(reference.upper)} ${highlight.unit}`;
  }
  const label =
    reference.kind === 'limit'
      ? 'Limit'
      : reference.kind === 'minimum'
        ? 'Minimum'
        : 'Target';
  return `${label} · ${formatMetricValue(reference.value)} ${highlight.unit}`;
}

function statusBackground(
  highlight: AnalyticsOverviewNutrientHighlight,
): string {
  if (
    highlight.status === 'above_limit' ||
    highlight.status === 'above_range'
  ) {
    return '#FBE8E9';
  }
  if (
    highlight.status === 'below_target' ||
    highlight.status === 'below_minimum' ||
    highlight.status === 'below_range'
  ) {
    return '#FFF4D9';
  }
  if (highlight.status === 'unknown') return '#EEF1EE';
  return '#E3F7EC';
}

export function NutrientHighlightsCard({
  overview,
  onRetry,
  testID = 'simple-insights-section-nutrient-highlights',
  compact = false,
  markerColor,
}: {
  overview: AnalyticsReportOverviewState<'nutrientHighlights'> | undefined;
  onRetry: () => void;
  testID?: string;
  compact?: boolean;
  markerColor?: string;
}) {
  const data = overview?.data ?? null;
  return (
    <View testID={testID} className={compact ? 'gap-2' : 'gap-3'}>
      <ReportingSectionHeading
        icon="nutrients"
        title="Nutrient highlights"
        compact={compact}
        markerColor={markerColor}
      />
      {data === null ? (
        <AnalyticsSectionError
          title="Nutrient highlights"
          section={overview}
          onRetry={onRetry}
        />
      ) : (
        <AppCard
          elevated
          compact={compact}
          className={
            compact ? 'gap-0 rounded-[16px] p-3' : 'gap-0 rounded-[24px] p-5'
          }
        >
          {data.highlights.map((highlight, index) => (
            <View
              key={highlight.metric}
              className={
                index === 0 ? 'gap-3 pb-5' : 'gap-3 border-t border-line py-5'
              }
            >
              <View className="flex-row items-center justify-between gap-3">
                <View className="flex-row items-center gap-2">
                  <View
                    testID={`nutrient-highlight-${highlight.metric}-accent`}
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: statusColor(highlight) }}
                  />
                  <AppText
                    variant="label"
                    className={compact ? '' : 'text-base'}
                  >
                    {label(highlight.metric)}
                  </AppText>
                </View>
                <View
                  className="rounded-full px-2 py-1"
                  style={{ backgroundColor: statusBackground(highlight) }}
                >
                  <AppText
                    variant="caption"
                    style={{ color: statusColor(highlight) }}
                  >
                    {statusCopy(highlight)}
                  </AppText>
                </View>
              </View>
              <View className="flex-row items-end justify-between gap-3">
                <AppText
                  variant={compact ? 'label' : 'heading'}
                  className="tabular-nums"
                >
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
      testID={`nutrient-highlight-${highlight.metric}-gauge`}
      className="h-5 justify-center"
    >
      <View
        className={
          gauge.fillPercent === null
            ? 'h-2.5 rounded-full border border-dashed border-line bg-surface'
            : 'h-2.5 overflow-hidden rounded-full bg-module'
        }
      >
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
          testID={`nutrient-highlight-${highlight.metric}-marker`}
          className="absolute h-5 w-[2px] rounded-full bg-ink"
          style={{ left: `${gauge.primaryMarkerPercent}%` }}
        />
      )}
      {gauge.secondaryMarkerPercent === null ? null : (
        <View
          pointerEvents="none"
          testID={`nutrient-highlight-${highlight.metric}-secondary-marker`}
          className="absolute h-5 w-[2px] rounded-full bg-ink"
          style={{ left: `${gauge.secondaryMarkerPercent}%` }}
        />
      )}
    </View>
  );
}
