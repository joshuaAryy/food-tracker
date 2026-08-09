import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  analyticsMetricForKey,
  type AnalyticsMetricDefinition,
} from '@food-tracker/shared';
import { AppButton } from '@/components/app-button';
import { AppScreen } from '@/components/app-screen';
import { AppText } from '@/components/app-text';
import { ErrorState } from '@/components/error-state';
import { ScreenHeader } from '@/components/screen-header';
import {
  applyTrendDraft,
  comparisonCandidates,
  createTrendDraft,
  supportsForecastControl,
  updateTrendDraft,
} from '@/lib/analytics/trend-config';
import { api, errorMessage } from '@/lib/api-client';
import {
  trendQueryFromRouteParam,
  trendQueryRouteParam,
} from '@/lib/analytics/saved-view-configuration';

const coverageOptions = [
  ['all_logged_days', 'All recorded days'],
  ['complete_and_partial', 'Complete + partial'],
  ['complete_only', 'Complete days only'],
] as const;

export default function ConfigureTrendScreen() {
  const router = useRouter();
  const { query: rawQuery } = useLocalSearchParams<{ query?: string }>();
  const active = useMemo(() => trendQueryFromRouteParam(rawQuery), [rawQuery]);
  const [draft, setDraft] = useState(() =>
    active === null ? null : createTrendDraft(active),
  );
  const [catalog, setCatalog] = useState<{
    mode: 'simple' | 'complex';
    metrics: AnalyticsMetricDefinition[];
  } | null>(null);
  const [catalogError, setCatalogError] = useState<string | null>(null);
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
  const close = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/trends/calories' as never);
  };
  if (active === null || draft === null) {
    return (
      <AppScreen>
        <ErrorState
          title="Trend configuration is unavailable"
          message="This Trend could not be configured."
          onRetry={close}
        />
      </AppScreen>
    );
  }
  if (catalogError !== null) {
    return (
      <AppScreen>
        <ErrorState message={catalogError} onRetry={() => void loadCatalog()} />
      </AppScreen>
    );
  }
  if (catalog === null) {
    return (
      <AppScreen>
        <AppText muted>Loading Trend controls…</AppText>
      </AppScreen>
    );
  }
  if (catalog.mode !== 'complex') {
    return (
      <AppScreen>
        <ErrorState
          title="Complex Trend controls are unavailable"
          message="Switch to Complex mode to configure advanced analytics."
          onRetry={close}
        />
      </AppScreen>
    );
  }
  const definition = analyticsMetricForKey(draft.primaryMetric);
  const allowedMetricKeys = new Set(catalog.metrics.map((metric) => metric.key));
  const candidates = comparisonCandidates(draft.primaryMetric).filter((metric) =>
    allowedMetricKeys.has(metric),
  );
  const apply = () => {
    const query = applyTrendDraft(active, draft);
    router.replace({
      pathname: '/trends/[metric]',
      params: {
        metric: query.primaryMetric,
        query: trendQueryRouteParam(query),
      },
    } as never);
  };
  return (
    <AppScreen
      contentClassName="gap-6 pb-8"
      footer={<AppButton onPress={apply}>Apply changes</AppButton>}
    >
      <ScreenHeader
        title="Configure Trend"
        subtitle="Changes stay temporary until you save a view."
        action={
          <Pressable onPress={close}>
            <AppText variant="label">Close</AppText>
          </Pressable>
        }
      />
      <View className="gap-2">
        <AppText variant="label">Primary metric</AppText>
        {catalog.metrics.map((metric) => (
          <Pressable
            key={metric.key}
            accessibilityRole="button"
            accessibilityState={{
              selected: draft.primaryMetric === metric.key,
            }}
            className={`min-h-11 rounded-app px-4 py-3 ${draft.primaryMetric === metric.key ? 'bg-ink' : 'bg-module'}`}
            onPress={() =>
              setDraft(
                updateTrendDraft(draft, {
                  primaryMetric: metric.key,
                  comparisonMetric: null,
                  visualization: 'automatic',
                  aggregation: 'automatic',
                }),
              )
            }
          >
            <AppText
              className={
                draft.primaryMetric === metric.key ? 'text-white' : 'text-ink'
              }
            >
              {metric.displayName}
            </AppText>
          </Pressable>
        ))}
      </View>
      <View className="gap-2">
        <AppText variant="label">Compare with</AppText>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{
            selected: draft.comparisonMetric === undefined,
          }}
          className={`min-h-11 rounded-app px-4 py-3 ${draft.comparisonMetric === undefined ? 'bg-ink' : 'bg-module'}`}
          onPress={() =>
            setDraft(updateTrendDraft(draft, { comparisonMetric: null }))
          }
        >
          <AppText
            className={
              draft.comparisonMetric === undefined ? 'text-white' : 'text-ink'
            }
          >
            No comparison
          </AppText>
        </Pressable>
        {candidates.map((candidate) => (
          <Pressable
            key={candidate}
            accessibilityRole="button"
            accessibilityState={{
              selected: draft.comparisonMetric === candidate,
            }}
            className={`min-h-11 rounded-app px-4 py-3 ${draft.comparisonMetric === candidate ? 'bg-ink' : 'bg-module'}`}
            onPress={() =>
              setDraft(updateTrendDraft(draft, { comparisonMetric: candidate }))
            }
          >
            <AppText
              className={
                draft.comparisonMetric === candidate ? 'text-white' : 'text-ink'
              }
            >
              {analyticsMetricForKey(candidate).displayName}
            </AppText>
          </Pressable>
        ))}
      </View>
      <View className="gap-2">
        <AppText variant="label">Period</AppText>
        {[7, 30, 90].map((days) => (
          <Pressable
            key={days}
            accessibilityRole="button"
            className="min-h-11 rounded-app bg-module px-4 py-3"
            onPress={() =>
              setDraft(
                updateTrendDraft(draft, { period: { kind: 'relative', days } }),
              )
            }
          >
            <AppText>{days}D</AppText>
          </Pressable>
        ))}
        <Pressable
          accessibilityRole="button"
          className="min-h-11 rounded-app bg-module px-4 py-3"
          onPress={() =>
            router.push({
              pathname: '/trends/custom-range',
              params: { query: trendQueryRouteParam(draft) },
            } as never)
          }
        >
          <AppText>Custom Range</AppText>
        </Pressable>
      </View>
      <View className="gap-2">
        <AppText variant="label">Aggregation</AppText>
        {definition.supportedAggregations.map((aggregation) => (
          <Pressable
            key={aggregation}
            accessibilityRole="button"
            accessibilityState={{ selected: draft.aggregation === aggregation }}
            className={`min-h-11 rounded-app px-4 py-3 ${draft.aggregation === aggregation ? 'bg-ink' : 'bg-module'}`}
            onPress={() => setDraft(updateTrendDraft(draft, { aggregation }))}
          >
            <AppText
              className={
                draft.aggregation === aggregation ? 'text-white' : 'text-ink'
              }
            >
              {aggregation}
            </AppText>
          </Pressable>
        ))}
      </View>
      <View className="gap-2">
        <AppText variant="label">Visualization</AppText>
        {definition.supportedVisualizations.map((visualization) => (
          <Pressable
            key={visualization}
            accessibilityRole="button"
            accessibilityState={{
              selected: draft.visualization === visualization,
            }}
            className={`min-h-11 rounded-app px-4 py-3 ${draft.visualization === visualization ? 'bg-ink' : 'bg-module'}`}
            onPress={() => setDraft(updateTrendDraft(draft, { visualization }))}
          >
            <AppText
              className={
                draft.visualization === visualization
                  ? 'text-white'
                  : 'text-ink'
              }
            >
              {visualization}
            </AppText>
          </Pressable>
        ))}
      </View>
      <View className="gap-2">
        <AppText variant="label">Data coverage</AppText>
        {coverageOptions.map(([value, label]) => (
          <Pressable
            key={value}
            accessibilityRole="button"
            accessibilityState={{ selected: draft.coverageFilter === value }}
            className={`min-h-11 rounded-app px-4 py-3 ${draft.coverageFilter === value ? 'bg-ink' : 'bg-module'}`}
            onPress={() =>
              setDraft(updateTrendDraft(draft, { coverageFilter: value }))
            }
          >
            <AppText
              className={
                draft.coverageFilter === value ? 'text-white' : 'text-ink'
              }
            >
              {label}
            </AppText>
          </Pressable>
        ))}
      </View>
      {definition.referenceSupport === 'none' ? null : (
        <Pressable
          accessibilityRole="switch"
          accessibilityState={{ checked: draft.showReference }}
          className="min-h-11 rounded-app bg-module px-4 py-3"
          onPress={() =>
            setDraft(
              updateTrendDraft(draft, { showReference: !draft.showReference }),
            )
          }
        >
          <AppText variant="label">Show target or reference</AppText>
        </Pressable>
      )}
      {supportsForecastControl(draft.primaryMetric) ? (
        <Pressable
          accessibilityRole="switch"
          accessibilityState={{ checked: draft.includeForecast === true }}
          className="min-h-11 rounded-app bg-module px-4 py-3"
          onPress={() =>
            setDraft(
              updateTrendDraft(draft, {
                includeForecast: draft.includeForecast !== true,
              }),
            )
          }
        >
          <AppText variant="label">Show seven-day estimate</AppText>
        </Pressable>
      ) : null}
    </AppScreen>
  );
}
