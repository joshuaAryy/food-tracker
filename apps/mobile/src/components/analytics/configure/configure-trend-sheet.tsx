import { Pressable, View } from 'react-native';
import { useState } from 'react';
import type {
  AnalyticsCoverageFilter,
  AnalyticsMetricDefinition,
  AnalyticsAggregation,
  AnalyticsVisualization,
} from '@food-tracker/shared';
import type {
  TrendDraft,
  TrendDraftChanges,
} from '@/lib/analytics/trend-config';
import { AppButton } from '@/components/app-button';
import { AppText } from '@/components/app-text';
import { ScreenHeader } from '@/components/screen-header';
import { supportedAggregationsForPeriod } from '@/lib/analytics/trend-config';
import { AggregationSelector } from './aggregation-selector';
import { CoverageSelector } from './coverage-selector';
import { SelectorRow } from './selector-row';
import { VisualizationSelector } from './visualization-selector';

export function ConfigureTrendSheet({
  draft,
  definition,
  metrics,
  onDraft,
  onCompare,
  onCustomRange,
  onApply,
  onSaveAsNew,
  onClose,
  onReset,
  savedViewName,
  savedViewPeriodLabel,
}: {
  draft: TrendDraft;
  definition: AnalyticsMetricDefinition;
  metrics: readonly AnalyticsMetricDefinition[];
  onDraft: (changes: TrendDraftChanges) => void;
  onCompare: () => void;
  onCustomRange: () => void;
  onApply: () => void;
  onSaveAsNew?: (() => void) | undefined;
  onClose: () => void;
  onReset: () => void;
  savedViewName?: string | undefined;
  savedViewPeriodLabel?: string | undefined;
}) {
  const [selector, setSelector] = useState<
    'metric' | 'period' | 'coverage' | 'aggregation' | 'visualization' | null
  >(null);
  const coverage =
    definition.supportedCoverageFilters as AnalyticsCoverageFilter[];
  const aggregation = supportedAggregationsForPeriod(draft.period).filter(
    (option) => definition.supportedAggregations.includes(option),
  ) as AnalyticsAggregation[];
  if (selector === 'metric') {
    return (
      <View testID="metric-selector" className="gap-5">
        <ScreenHeader
          title="Primary metric"
          subtitle="Choose the metric that owns this trend and summary."
          action={
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Done with Primary metric"
              className="min-h-11 justify-center"
              onPress={() => setSelector(null)}
            >
              <AppText variant="label">Done</AppText>
            </Pressable>
          }
        />
        <View className="gap-2">
          {metrics.map((metric) => (
            <SelectorRow
              key={metric.key}
              label={metric.displayName}
              description={metric.unit}
              accessibilityLabel={`Use ${metric.displayName} as primary metric`}
              selected={draft.primaryMetric === metric.key}
              onPress={() => {
                onDraft({
                  primaryMetric: metric.key,
                  comparisonMetric: null,
                  visualization: 'automatic',
                  aggregation: 'automatic',
                });
                setSelector(null);
              }}
            />
          ))}
        </View>
      </View>
    );
  }
  if (selector === 'coverage') {
    return (
      <CoverageSelector
        value={draft.coverageFilter}
        allowed={coverage}
        onSelect={(value) => onDraft({ coverageFilter: value })}
        onClose={() => setSelector(null)}
      />
    );
  }
  if (selector === 'period') {
    return (
      <View testID="period-selector" className="gap-5">
        <ScreenHeader
          title="Default range"
          subtitle="Choose the period loaded when this trend opens."
          action={
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Done with Default range"
              className="min-h-11 justify-center"
              onPress={() => setSelector(null)}
            >
              <AppText variant="label">Done</AppText>
            </Pressable>
          }
        />
        {[7, 30, 90].map((days) => (
          <SelectorRow
            key={days}
            label={`${days} days`}
            description={
              days === 90 ? 'Weekly by default.' : 'Daily by default.'
            }
            accessibilityLabel={`Use ${days} day default range`}
            selected={
              draft.period.kind === 'relative' && draft.period.days === days
            }
            onPress={() => {
              const period = { kind: 'relative' as const, days };
              onDraft({
                period,
                ...(supportedAggregationsForPeriod(period).includes(
                  draft.aggregation,
                )
                  ? {}
                  : { aggregation: 'automatic' }),
              });
              setSelector(null);
            }}
          />
        ))}
        <SelectorRow
          label="Custom range"
          description="Choose an eligible historical range."
          accessibilityLabel="Open Custom Range"
          selected={draft.period.kind === 'custom'}
          onPress={onCustomRange}
        />
      </View>
    );
  }
  if (selector === 'aggregation') {
    return (
      <AggregationSelector
        value={draft.aggregation}
        allowed={aggregation}
        onSelect={(value) => onDraft({ aggregation: value })}
        onClose={() => setSelector(null)}
      />
    );
  }
  if (selector === 'visualization') {
    return (
      <VisualizationSelector
        value={draft.visualization}
        allowed={definition.supportedVisualizations as AnalyticsVisualization[]}
        onSelect={(visualization) => onDraft({ visualization })}
        onClose={() => setSelector(null)}
      />
    );
  }
  return (
    <View testID="configure-trend-sheet" className="gap-5">
      <View className="h-1 w-[58px] self-center rounded-full bg-[#C7C7BF]" />
      <ScreenHeader
        title="Configure trend"
        subtitle="Draft changes stay local until you apply or save them."
        action={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close Configure Trend"
            className="min-h-11 justify-center"
            onPress={onClose}
          >
            <AppText variant="label">Done</AppText>
          </Pressable>
        }
      />
      <View className="gap-0">
        <ReportRow
          label="Primary metric"
          value={definition.displayName}
          description="Main metric for the chart and summary."
          onPress={() => setSelector('metric')}
        />
        <ReportRow
          label="Compare with"
          value={
            draft.comparisonMetric === undefined
              ? 'None'
              : (metrics.find((item) => item.key === draft.comparisonMetric)
                  ?.displayName ?? 'None')
          }
          description="Optional. Maximum two metrics."
          onPress={onCompare}
        />
      </View>
      <ReportRow
        label="Default range"
        value={periodLabel(draft.period)}
        description="7D/30D daily · 90D weekly by default."
        onPress={() => setSelector('period')}
      />
      <View className="gap-2">
        {coverage.length === 0 ? null : (
          <ReportRow
            label="Data coverage"
            value={coverageLabel(draft.coverageFilter)}
            description="Which logging-quality days are included."
            onPress={
              coverage.length > 1 ? () => setSelector('coverage') : undefined
            }
          />
        )}
        <ReportRow
          label="Aggregation"
          value={titleCase(draft.aggregation)}
          description={descriptionsForAggregation(draft.aggregation)}
          onPress={
            aggregation.length > 1
              ? () => setSelector('aggregation')
              : undefined
          }
        />
        <ReportRow
          label="Visualization"
          value={titleCase(draft.visualization)}
          description="Choose the chart treatment for this trend."
          onPress={() => setSelector('visualization')}
        />
      </View>
      {definition.referenceSupport === 'none' ? null : (
        <ReportRow
          label="Target"
          value={draft.showReference ? 'Show' : 'Hide'}
          description="Display only; edit nutrition targets in Settings."
          onPress={() => onDraft({ showReference: !draft.showReference })}
        />
      )}
      {definition.key === 'calories' || definition.key === 'weight' ? (
        <ReportRow
          label="Forecast"
          value={draft.includeForecast === true ? 'On' : 'Off'}
          description="Calories only · optional short-horizon projection."
          onPress={() =>
            onDraft({ includeForecast: draft.includeForecast !== true })
          }
        />
      ) : null}
      {savedViewName === undefined ? null : (
        <View className="gap-2">
          <AppText variant="caption" className="font-bold uppercase text-muted">
            Saved view
          </AppText>
          <AppText variant="title">{savedViewName}</AppText>
          {savedViewPeriodLabel === undefined ? null : (
            <AppText variant="caption" className="text-muted">
              {savedViewPeriodLabel}
            </AppText>
          )}
          <AppText variant="caption" className="text-muted">
            Changes stay temporary until you explicitly save or update this
            view.
          </AppText>
          {onSaveAsNew === undefined ? null : (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Save as new view"
              className="min-h-[52px] items-center justify-center rounded-[15px] border border-border bg-white"
              onPress={onSaveAsNew}
            >
              <AppText variant="label">Save as new view</AppText>
            </Pressable>
          )}
        </View>
      )}
      <View className="gap-3 pt-2">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Reset Configure Trend"
          className="min-h-11 justify-center"
          onPress={onReset}
        >
          <AppText variant="label" className="text-muted">
            Reset
          </AppText>
        </Pressable>
        <AppButton
          accessibilityLabel="Apply changes"
          className="bg-ink border-ink"
          onPress={onApply}
        >
          Apply changes
        </AppButton>
      </View>
    </View>
  );
}

function ReportRow({
  label,
  value,
  description,
  onPress,
}: {
  label: string;
  value: string;
  description: string;
  onPress: (() => void) | undefined;
}) {
  const content = (
    <View className="min-h-[78px] flex-row items-center justify-between gap-4 border-b border-border py-3">
      <View className="min-w-0 flex-1 gap-0.5">
        <AppText variant="label">{label}</AppText>
        <AppText variant="caption" className="text-muted">
          {description}
        </AppText>
      </View>
      <AppText variant="label">
        {value}
        {onPress === undefined ? '' : ' ›'}
      </AppText>
    </View>
  );
  return onPress === undefined ? (
    content
  ) : (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open ${label}`}
      onPress={onPress}
    >
      {content}
    </Pressable>
  );
}

function titleCase(value: string): string {
  return value
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase());
}
function coverageLabel(value: AnalyticsCoverageFilter): string {
  return value === 'all_logged_days'
    ? 'All recorded days'
    : value === 'complete_and_partial'
      ? 'Complete + partial'
      : 'Complete only';
}
function descriptionsForAggregation(value: AnalyticsAggregation): string {
  return value === 'automatic'
    ? 'Recommended for this range.'
    : 'Explicit aggregation override.';
}

function periodLabel(period: TrendDraft['period']): string {
  return period.kind === 'relative'
    ? `${period.days} days`
    : `${period.startDate} – ${period.endDate}`;
}
