import type {
  AnalyticsMetricDefinition,
  AnalyticsMetricKey,
  AnalyticsSavedView,
} from '@food-tracker/shared';
import type { ReactNode } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { AppCard } from '@/components/app-card';
import { AppText } from '@/components/app-text';
import { searchAnalyticsMetrics } from '@/lib/analytics/nutrient-search';
import { simpleTrendMetrics } from '@/lib/analytics/trend-routing';

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
      className="min-h-11 flex-row items-center justify-between border-t border-line py-2.5 active:opacity-70"
      onPress={onPress}
    >
      <AppText variant="caption" className="font-medium">
        {exploreLabel(definition)}
      </AppText>
      <AppText variant="caption" className="text-muted">
        ›
      </AppText>
    </Pressable>
  );
}

function MetricGroup({
  title,
  definitions,
  onMetric,
  footer,
}: {
  title: string;
  definitions: readonly AnalyticsMetricDefinition[];
  onMetric: (key: AnalyticsMetricKey) => void;
  footer?: ReactNode;
}) {
  if (definitions.length === 0) return null;
  return (
    <View className="gap-2">
      <AppText variant="label">{title}</AppText>
      <AppCard elevated className="gap-0 p-3">
        {definitions.map((definition) => (
          <MetricRow
            key={definition.key}
            definition={definition}
            onPress={() => onMetric(definition.key)}
          />
        ))}
        {footer}
      </AppCard>
    </View>
  );
}

export function ExploreAll({
  definitions,
  savedViews,
  pinnedSavedViewId,
  query,
  onQueryChange,
  onBack,
  onMetric,
  onOpenSavedView,
  onManageSavedViews,
  onOpenNutrientLibrary,
}: {
  definitions: readonly AnalyticsMetricDefinition[];
  savedViews: readonly AnalyticsSavedView[];
  pinnedSavedViewId: string | null;
  query: string;
  onQueryChange: (query: string) => void;
  onBack: () => void;
  onMetric: (key: AnalyticsMetricKey) => void;
  onOpenSavedView: (view: AnalyticsSavedView) => void;
  onManageSavedViews: () => void;
  onOpenNutrientLibrary: () => void;
}) {
  const byKey = new Map(
    definitions.map((definition) => [definition.key, definition]),
  );
  const filtered = searchAnalyticsMetrics(query, definitions);
  const selectedKeys = new Set(filtered.map((definition) => definition.key));
  const group = (keys: readonly AnalyticsMetricKey[]) =>
    keys.flatMap((key) => {
      const definition = byKey.get(key);
      return definition !== undefined && selectedKeys.has(key)
        ? [definition]
        : [];
    });
  const coreKeys = [
    'calories',
    'protein',
    'carbs',
    'fat',
    'macroComposition',
  ] as const;
  const nutrientKeys = ['fiber', 'sodium', 'vitaminC', 'iron'] as const;
  const bodyKeys = ['weight', 'hydration', 'loggingConsistency'] as const;
  const visibleSavedViews = savedViews.slice(0, 3);

  return (
    <View testID="explore-all" className="gap-5">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Back to Insights"
        className="min-h-11 self-start justify-center"
        onPress={onBack}
      >
        <AppText variant="label">‹ Insights</AppText>
      </Pressable>
      <View className="gap-1">
        <AppText variant="title" className="text-[34px] leading-[42px]">
          Explore trends
        </AppText>
        <AppText muted>
          Choose a metric, open a saved view, or continue a recent analysis.
        </AppText>
      </View>
      <TextInput
        accessibilityLabel="Search metrics"
        className="min-h-12 rounded-[16px] bg-module px-4 text-ink"
        placeholder="Search metrics"
        placeholderTextColor="#777777"
        value={query}
        onChangeText={onQueryChange}
      />
      <View className="gap-2">
        <AppText variant="caption" className="font-bold text-muted">
          SAVED VIEWS
        </AppText>
        <AppCard elevated className="gap-0 p-3">
          {visibleSavedViews.length === 0 ? (
            <AppText variant="caption" className="py-2 text-muted">
              No saved views yet.
            </AppText>
          ) : (
            visibleSavedViews.map((view) => (
              <Pressable
                key={view.id}
                accessibilityRole="button"
                accessibilityLabel={`Open saved view: ${view.name}`}
                className="min-h-11 flex-row items-center justify-between border-t border-line py-2.5 active:opacity-70"
                onPress={() => onOpenSavedView(view)}
              >
                <View className="min-w-0 flex-1 flex-row items-center gap-2">
                  <View className="h-2.5 w-2.5 rounded-full bg-primary" />
                  <AppText
                    variant="caption"
                    className="min-w-0 flex-1 font-semibold"
                    numberOfLines={1}
                  >
                    {view.name}
                  </AppText>
                </View>
                <View
                  testID={`saved-view-meta-${view.id}`}
                  className="ml-2 w-[40%]"
                >
                  <AppText
                    variant="caption"
                    className="text-right text-muted"
                    numberOfLines={1}
                  >
                    {view.id === pinnedSavedViewId ? 'PINNED · ' : ''}
                    {view.periodDays}D ·{' '}
                    {view.visualization.replaceAll('_', ' ')}
                  </AppText>
                </View>
              </Pressable>
            ))
          )}
        </AppCard>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Manage saved views"
          className="min-h-10 self-end justify-center active:opacity-70"
          onPress={onManageSavedViews}
        >
          <AppText variant="caption" className="font-semibold">
            Manage saved views ›
          </AppText>
        </Pressable>
      </View>
      <AppText variant="caption" className="font-bold text-muted">
        ALL METRICS
      </AppText>
      <MetricGroup
        title="Energy & macros"
        definitions={group(coreKeys)}
        onMetric={onMetric}
      />
      <MetricGroup
        title="Nutrients"
        definitions={group(nutrientKeys)}
        onMetric={onMetric}
        footer={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open complete nutrient library"
            className="min-h-11 flex-row items-center justify-between border-t border-line py-3 active:opacity-70"
            onPress={onOpenNutrientLibrary}
          >
            <AppText variant="label">Complete nutrient library</AppText>
            <AppText variant="caption" className="text-muted">
              ›
            </AppText>
          </Pressable>
        }
      />
      <MetricGroup
        title="Body & habits"
        definitions={group(bodyKeys)}
        onMetric={onMetric}
        footer={
          <View className="gap-1 border-t border-line px-0 py-3">
            <AppText variant="label">Meal coverage</AppText>
            <AppText variant="caption" className="text-muted">
              See breakfast, lunch, dinner, and snack completeness inside
              Logging consistency reports.
            </AppText>
          </View>
        }
      />
      {query !== '' && filtered.length === 0 ? (
        <AppText variant="caption" className="text-muted">
          No matching metrics.
        </AppText>
      ) : null}
      <AppText testID="complex-explore-simple-boundary" className="hidden">
        {simpleTrendMetrics.length}
      </AppText>
    </View>
  );
}
