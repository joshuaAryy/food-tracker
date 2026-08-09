import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  analyticsMetricForKey,
  type AnalyticsMetricDefinition,
} from '@food-tracker/shared';
import { AppScreen } from '@/components/app-screen';
import { AppText } from '@/components/app-text';
import { ErrorState } from '@/components/error-state';
import { ScreenHeader } from '@/components/screen-header';
import { api, errorMessage } from '@/lib/api-client';
import { searchAnalyticsMetrics } from '@/lib/analytics/nutrient-search';
import {
  simpleTrendMetrics,
  trendRouteForMetric,
} from '@/lib/analytics/trend-routing';

export default function TrendsExploreScreen() {
  const router = useRouter();
  const [catalog, setCatalog] = useState<{
    mode: 'simple' | 'complex';
    metrics: AnalyticsMetricDefinition[];
  } | null>(null);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const loadCatalog = useCallback(async () => {
    setCatalogError(null);
    try {
      setCatalog(await api.analytics.trendCatalog());
    } catch (cause) {
      setCatalogError(errorMessage(cause));
    }
  }, []);

  useEffect(() => {
    void loadCatalog();
  }, [loadCatalog]);

  const visibleMetrics = useMemo(() => {
    if (catalog === null) {
      return simpleTrendMetrics.map(analyticsMetricForKey);
    }
    if (catalog.mode === 'simple') {
      const allowed = new Map(
        catalog.metrics.map((metric) => [metric.key, metric]),
      );
      return simpleTrendMetrics.flatMap((metric) => {
        const definition = allowed.get(metric);
        return definition === undefined ? [] : [definition];
      });
    }
    return searchAnalyticsMetrics(query, catalog.metrics);
  }, [catalog, query]);
  return (
    <AppScreen backgroundColor="#FFFFFF" contentClassName="gap-5">
      <ScreenHeader
        title="Explore Trends"
        subtitle={
          catalog?.mode === 'complex'
            ? 'Search the nutrition metrics available to your account.'
            : 'Choose a focused view for the last 7, 30, or 90 days.'
        }
      />
      {catalog?.mode === 'complex' ? (
        <TextInput
          accessibilityLabel="Search nutrition metrics"
          className="min-h-11 rounded-control border border-line bg-module px-4 text-ink"
          placeholder="Search vitamins, minerals, and more"
          placeholderTextColor="#777777"
          value={query}
          onChangeText={setQuery}
        />
      ) : null}
      {catalogError === null ? null : (
        <ErrorState message={catalogError} onRetry={() => void loadCatalog()} />
      )}
      <View className="gap-2">
        {visibleMetrics.map((definition) => {
          return (
            <Pressable
              key={definition.key}
              accessibilityRole="button"
              accessibilityLabel={`View ${definition.displayName} trend`}
              className="min-h-11 rounded-app border border-line bg-module px-4 py-3 active:opacity-70"
              onPress={() =>
                router.push(trendRouteForMetric(definition.key) as never)
              }
            >
              <AppText variant="label">{definition.displayName}</AppText>
              <AppText variant="caption" muted>
                {catalog?.mode === 'complex'
                  ? `${definition.group} · ${definition.unit}`
                  : definition.unit}
              </AppText>
            </Pressable>
          );
        })}
      </View>
      {catalog?.mode === 'complex' && visibleMetrics.length === 0 ? (
        <AppText muted>No matching nutrition metrics.</AppText>
      ) : null}
    </AppScreen>
  );
}
