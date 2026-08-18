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

function metricAccentColor(
  highlight: AnalyticsOverviewNutrientHighlight,
): string {
  if (highlight.status === 'unknown') return '#6D7C6B';
  if (highlight.metric === 'fiber') return '#1A9E57';
  if (highlight.metric === 'sodium') return '#EB1226';
  return '#4078A8';
}

function statusColor(highlight: AnalyticsOverviewNutrientHighlight): string {
  if (highlight.status === 'unknown') return '#6D7C6B';
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
  return '#1A9E57';
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

function referenceDetail(
  highlight: AnalyticsOverviewNutrientHighlight,
): string {
  const { reference, value } = highlight;
  if (value === null) return 'No recorded value';
  if (reference.kind === 'none') return 'Reference unavailable';

  if (reference.kind === 'range') {
    if (value < reference.lower) {
      return `${formatMetricValue(reference.lower - value)} ${highlight.unit} below range`;
    }
    if (value > reference.upper) {
      return `${formatMetricValue(value - reference.upper)} ${highlight.unit} above range`;
    }
    return 'Within range';
  }

  if (reference.kind === 'limit') {
    return value > reference.value
      ? `${formatMetricValue(value - reference.value)} ${highlight.unit} over limit`
      : 'Within limit';
  }

  return value >= reference.value
    ? 'Goal complete'
    : `${formatMetricValue(reference.value - value)} ${highlight.unit} remaining`;
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
          testID="nutrient-highlights-card"
          elevated
          compact={compact}
          className={
            compact ? 'gap-0 rounded-[16px] p-3' : 'gap-0 rounded-[20px] p-5'
          }
          style={compact ? undefined : { minHeight: 300 }}
        >
          {data.highlights.map((highlight, index) => (
            <View
              key={highlight.metric}
              className={
                compact
                  ? index === 0
                    ? 'gap-2 pb-3'
                    : 'gap-2 border-t border-line py-3'
                  : index === 0
                    ? 'min-h-[66px] pb-4'
                    : 'min-h-[78px] border-t border-line py-3'
              }
            >
              {compact ? (
                <>
                  <View className="flex-row items-center justify-between gap-3">
                    <AppText variant="label">{label(highlight.metric)}</AppText>
                    <AppText
                      testID={`nutrient-highlight-${highlight.metric}-status`}
                      variant="caption"
                      style={{ color: statusColor(highlight) }}
                    >
                      {statusCopy(highlight)}
                    </AppText>
                  </View>
                  <View className="flex-row items-end justify-between gap-3">
                    <AppText variant="label" className="tabular-nums">
                      {valueCopy(highlight)}
                    </AppText>
                    <AppText variant="caption" className="text-muted">
                      {referenceCopy(highlight)}
                    </AppText>
                  </View>
                  <NutrientGauge highlight={highlight} compact />
                </>
              ) : (
                <View className="flex-row justify-between gap-3">
                  <View className="w-[38%] gap-1">
                    <AppText
                      variant="label"
                      className="text-[15px] leading-[18px]"
                    >
                      {label(highlight.metric)}
                    </AppText>
                    <AppText
                      variant="caption"
                      className="text-[14px] leading-[18px] tabular-nums"
                    >
                      {valueCopy(highlight)}
                    </AppText>
                  </View>
                  <View className="w-[56%] gap-1">
                    <AppText
                      testID={`nutrient-highlight-${highlight.metric}-status`}
                      variant="caption"
                      className="text-right font-semibold"
                      style={{ color: statusColor(highlight) }}
                    >
                      {statusCopy(highlight)}
                    </AppText>
                    <NutrientGauge highlight={highlight} />
                    <AppText
                      testID={`nutrient-highlight-${highlight.metric}-reference-detail`}
                      variant="caption"
                      className="text-right text-[10px] leading-[14px]"
                      style={{ color: statusColor(highlight) }}
                    >
                      {referenceDetail(highlight)}
                    </AppText>
                  </View>
                </View>
              )}
            </View>
          ))}
        </AppCard>
      )}
    </View>
  );
}

function NutrientGauge({
  highlight,
  compact = false,
}: {
  highlight: AnalyticsOverviewNutrientHighlight;
  compact?: boolean;
}) {
  const gauge = nutrientGauge(highlight);
  const color = metricAccentColor(highlight);
  return (
    <View
      accessible
      accessibilityLabel={`${label(highlight.metric)} ${statusCopy(highlight)}; ${valueCopy(highlight)}; ${referenceCopy(highlight)}`}
      testID={`nutrient-highlight-${highlight.metric}-gauge`}
      className={compact ? 'h-5 justify-center' : 'h-[14px] justify-center'}
    >
      <View
        className={
          gauge.fillPercent === null
            ? 'h-1.5 rounded-[3px] border border-dashed border-line bg-surface'
            : 'h-1.5 overflow-hidden rounded-[3px] bg-[#E5E5E0]'
        }
      >
        {gauge.fillPercent === null ? null : (
          <View
            testID={`nutrient-highlight-${highlight.metric}-gauge-fill`}
            className="h-full rounded-full"
            style={{ backgroundColor: color, width: `${gauge.fillPercent}%` }}
          />
        )}
      </View>
      {gauge.primaryMarkerPercent === null ? null : (
        <View
          pointerEvents="none"
          testID={`nutrient-highlight-${highlight.metric}-marker`}
          className={
            compact
              ? 'absolute h-5 w-[2px] rounded-full bg-ink'
              : 'absolute h-[14px] w-[2px] rounded-full bg-ink'
          }
          style={{ left: `${gauge.primaryMarkerPercent}%` }}
        />
      )}
      {gauge.secondaryMarkerPercent === null ? null : (
        <View
          pointerEvents="none"
          testID={`nutrient-highlight-${highlight.metric}-secondary-marker`}
          className={
            compact
              ? 'absolute h-5 w-[2px] rounded-full bg-ink'
              : 'absolute h-[14px] w-[2px] rounded-full bg-ink'
          }
          style={{ left: `${gauge.secondaryMarkerPercent}%` }}
        />
      )}
    </View>
  );
}
