import { Pressable, TextInput, View } from 'react-native';
import type {
  AnalyticsMetricDefinition,
  AnalyticsMetricKey,
} from '@food-tracker/shared';
import { AppCard } from '@/components/app-card';
import { AppText } from '@/components/app-text';
import {
  analyticsMetricForKey,
  resolveAnalyticsComparisonStrategy,
} from '@food-tracker/shared';
import { useMemo, useState } from 'react';

export function ComparePicker({
  primaryMetric,
  definitions,
  selectedMetric,
  onSelect,
  onClose,
}: {
  primaryMetric: AnalyticsMetricKey;
  definitions: readonly AnalyticsMetricDefinition[];
  selectedMetric: AnalyticsMetricKey | null;
  onSelect: (metric: AnalyticsMetricKey | null) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  const compatible = useMemo(
    () =>
      definitions.filter(
        (definition) =>
          definition.key !== primaryMetric &&
          resolveAnalyticsComparisonStrategy(primaryMetric, definition.key) !==
            'incompatible',
      ),
    [definitions, primaryMetric],
  );
  const filtered = compatible.filter((definition) =>
    definition.displayName.toLowerCase().includes(query.toLowerCase()),
  );
  const suggestedKeys: AnalyticsMetricKey[] = [
    'protein',
    'weight',
    'loggingConsistency',
  ];
  const suggestions = suggestedKeys
    .map((key) => filtered.find((definition) => definition.key === key))
    .filter(
      (definition): definition is AnalyticsMetricDefinition =>
        definition !== undefined,
    );
  const allCompatible = filtered.filter(
    (definition) => !suggestedKeys.includes(definition.key),
  );
  const relationshipCopy = (definition: AnalyticsMetricDefinition) => {
    const primary = analyticsMetricForKey(primaryMetric);
    const strategy = resolveAnalyticsComparisonStrategy(
      primaryMetric,
      definition.key,
    );
    if (strategy === 'reference_normalized')
      return 'Reference-based · linked trends';
    if (primary.unit !== definition.unit) {
      return `${primary.unit === 'percent' || definition.unit === 'percent' ? 'Different scale' : 'Different unit'} · linked trends`;
    }
    return 'Same unit · linked trends';
  };
  return (
    <View testID="compare-picker" className="gap-5">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Back to Configure"
        className="min-h-11 self-start justify-center"
        onPress={onClose}
      >
        <AppText variant="label">‹ Configure</AppText>
      </Pressable>
      <View className="gap-1">
        <AppText variant="title" className="text-[34px] leading-[42px]">
          Compare with
        </AppText>
        <AppText muted>
          Choose one compatible metric. The presentation adapts to units,
          targets, and available data.
        </AppText>
      </View>
      <TextInput
        accessibilityLabel="Search comparison metrics"
        className="min-h-12 rounded-[16px] bg-module px-4 text-ink"
        placeholder="Search metrics"
        placeholderTextColor="#777777"
        value={query}
        onChangeText={setQuery}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Use no comparison"
        className="min-h-12 rounded-[16px] bg-module px-4 py-3"
        onPress={() => onSelect(null)}
      >
        <AppText variant="label">No comparison</AppText>
      </Pressable>
      <View className="gap-2">
        <AppText variant="caption" className="font-bold uppercase text-muted">
          Suggested with {analyticsMetricForKey(primaryMetric).displayName}
        </AppText>
        {suggestions.map((definition) => (
          <Pressable
            key={definition.key}
            accessibilityRole="button"
            accessibilityLabel={`Compare with ${definition.displayName}`}
            className="min-h-[58px] flex-row items-center justify-between rounded-[16px] border border-border bg-surface px-4"
            onPress={() => onSelect(definition.key)}
          >
            <View className="gap-0.5">
              <AppText variant="label">{definition.displayName}</AppText>
              <AppText variant="caption" className="text-muted">
                {relationshipCopy(definition)}
              </AppText>
            </View>
            <AppText variant="caption">
              {selectedMetric === definition.key ? '✓' : '›'}
            </AppText>
          </Pressable>
        ))}
      </View>
      <View className="gap-1">
        <AppText variant="caption" className="font-bold uppercase text-muted">
          All compatible
        </AppText>
        {allCompatible.map((definition) => (
          <Pressable
            key={definition.key}
            accessibilityRole="button"
            accessibilityLabel={`Compare with ${definition.displayName}`}
            className="min-h-11 flex-row items-center justify-between border-b border-border px-3 py-2"
            onPress={() => onSelect(definition.key)}
          >
            <AppText variant="caption">{definition.displayName}</AppText>
            <AppText variant="caption" className="text-muted">
              Linked trends · ›
            </AppText>
          </Pressable>
        ))}
      </View>
      <AppCard className="gap-1 bg-module p-4">
        <AppText variant="caption" className="text-muted">
          Normalized views are reserved for meaningful reference-based
          relationships; unrelated metrics default to linked honest scales.
        </AppText>
      </AppCard>
    </View>
  );
}
