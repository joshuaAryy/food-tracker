import type {
  AnalyticsMetricDefinition,
  AnalyticsMetricKey,
} from '@food-tracker/shared';
import { Pressable, View } from 'react-native';
import { AppCard } from '@/components/app-card';
import { AppText } from '@/components/app-text';
import { simpleTrendMetrics } from '@/lib/analytics/trend-routing';

const energyKeys = [
  'calories',
  'protein',
  'carbs',
  'fat',
  'macroComposition',
] as const satisfies readonly AnalyticsMetricKey[];

const bodyKeys = [
  'weight',
  'hydration',
  'loggingConsistency',
] as const satisfies readonly AnalyticsMetricKey[];

function exploreLabel(definition: AnalyticsMetricDefinition): string {
  if (definition.key === 'macroComposition') return 'Macro composition';
  if (definition.key === 'loggingConsistency') return 'Logging consistency';
  return definition.displayName;
}

function MetricRow({
  definition,
  onPress,
}: {
  definition: AnalyticsMetricDefinition;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`View ${exploreLabel(definition)} trend`}
      className="min-h-12 flex-row items-center justify-between border-t border-line px-0 py-3 active:opacity-70"
      onPress={onPress}
    >
      <AppText variant="label">{exploreLabel(definition)}</AppText>
      <AppText variant="heading" className="text-[22px] leading-6 text-muted">
        ›
      </AppText>
    </Pressable>
  );
}

function MetricGroup({
  title,
  definitions,
  onMetric,
}: {
  title: string;
  definitions: readonly AnalyticsMetricDefinition[];
  onMetric: (key: AnalyticsMetricKey) => void;
}) {
  if (definitions.length === 0) return null;
  return (
    <View className="gap-3">
      <AppText variant="heading" className="text-[19px] leading-6">
        {title}
      </AppText>
      <AppCard elevated className="gap-0 p-[18px]">
        {definitions.map((definition) => (
          <MetricRow
            key={definition.key}
            definition={definition}
            onPress={() => onMetric(definition.key)}
          />
        ))}
      </AppCard>
    </View>
  );
}

export function ExploreCurated({
  definitions,
  preferredMetric,
  onBack,
  onMetric,
}: {
  definitions: readonly AnalyticsMetricDefinition[];
  preferredMetric: AnalyticsMetricKey;
  onBack: () => void;
  onMetric: (key: AnalyticsMetricKey) => void;
}) {
  const byKey = new Map(
    definitions.map((definition) => [definition.key, definition]),
  );
  const simpleDefinitions = simpleTrendMetrics.flatMap((key) => {
    const definition = byKey.get(key);
    return definition === undefined ? [] : [definition];
  });
  const preferred = byKey.get(preferredMetric) ?? byKey.get('calories');
  const ordered = (keys: readonly AnalyticsMetricKey[]) =>
    keys.flatMap((key) => {
      const definition = byKey.get(key);
      return definition === undefined ? [] : [definition];
    });

  return (
    <View testID="explore-curated" className="gap-7">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Back to Insights"
        className="min-h-11 self-start justify-center"
        onPress={onBack}
      >
        <AppText variant="label">‹ Insights</AppText>
      </Pressable>
      <View className="gap-2">
        <AppText variant="title" className="text-[34px] leading-[42px]">
          Explore trends
        </AppText>
        <AppText muted>
          Choose a curated metric. Advanced comparisons, the full nutrient
          library, and saved-view building stay in Complex mode.
        </AppText>
      </View>
      {preferred === undefined ? null : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Open preferred trend: ${exploreLabel(preferred)}`}
          className="min-h-[58px] flex-row items-center justify-between rounded-[16px] bg-module px-4 active:opacity-70"
          onPress={() => onMetric(preferred.key)}
        >
          <AppText variant="label">Preferred trend</AppText>
          <AppText variant="label" className="text-muted">
            {exploreLabel(preferred)} ›
          </AppText>
        </Pressable>
      )}
      <AppText variant="caption" className="font-bold text-muted">
        CURATED METRICS
      </AppText>
      <MetricGroup
        title="Energy & macros"
        definitions={ordered(energyKeys)}
        onMetric={onMetric}
      />
      <MetricGroup
        title="Body & habits"
        definitions={ordered(bodyKeys)}
        onMetric={onMetric}
      />
      <AppText variant="caption" className="text-muted">
        Simple mode keeps analytics focused on the core metrics you chose to
        track. Switch to Complex mode for micronutrients, arbitrary comparisons,
        and saved analysis views.
      </AppText>
      <AppText testID="simple-explore-metric-count" className="hidden">
        {simpleDefinitions.length}
      </AppText>
    </View>
  );
}
