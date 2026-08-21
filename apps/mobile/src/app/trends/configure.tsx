import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  analyticsMetricForKey,
  type AnalyticsSavedView,
  type AnalyticsMetricDefinition,
} from '@food-tracker/shared';
import { AppScreen } from '@/components/app-screen';
import { AppText } from '@/components/app-text';
import { ComparePicker } from './compare-picker';
import { ConfigureTrendSheet } from '@/components/analytics/configure/configure-trend-sheet';
import { ErrorState } from '@/components/error-state';
import {
  applyTrendDraft,
  comparisonCandidates,
  createTrendDraft,
  updateTrendDraft,
} from '@/lib/analytics/trend-config';
import { api, errorMessage } from '@/lib/api-client';
import {
  trendQueryFromRouteParam,
  trendQueryRouteParam,
} from '@/lib/analytics/saved-view-configuration';

export default function ConfigureTrendScreen() {
  const router = useRouter();
  const { query: rawQuery, savedViewId } = useLocalSearchParams<{
    query?: string;
    savedViewId?: string;
  }>();
  const active = useMemo(() => trendQueryFromRouteParam(rawQuery), [rawQuery]);
  const [draft, setDraft] = useState(() =>
    active === null ? null : createTrendDraft(active),
  );
  const [catalog, setCatalog] = useState<{
    mode: 'simple' | 'complex';
    metrics: AnalyticsMetricDefinition[];
  } | null>(null);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [savedView, setSavedView] = useState<AnalyticsSavedView | null>(null);
  const [compareOpen, setCompareOpen] = useState(false);
  const loadCatalog = useCallback(async () => {
    setCatalogError(null);
    try {
      const [nextCatalog, nextSavedViews] = await Promise.all([
        api.analytics.trendCatalog(),
        savedViewId === undefined
          ? Promise.resolve([])
          : api.analytics.savedViews(),
      ]);
      setCatalog(nextCatalog);
      setSavedView(
        savedViewId === undefined
          ? null
          : (nextSavedViews.find((view) => view.id === savedViewId) ?? null),
      );
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
  const allowedMetricKeys = new Set(
    catalog.metrics.map((metric) => metric.key),
  );
  const candidates = comparisonCandidates(draft.primaryMetric).filter(
    (metric) => allowedMetricKeys.has(metric),
  );
  if (compareOpen) {
    return (
      <AppScreen backgroundColor="#FFFFFF" contentClassName="gap-6 pb-8">
        <ComparePicker
          primaryMetric={draft.primaryMetric}
          definitions={catalog.metrics.filter((metric) =>
            candidates.includes(metric.key),
          )}
          selectedMetric={draft.comparisonMetric ?? null}
          onSelect={(metric) => {
            setDraft(updateTrendDraft(draft, { comparisonMetric: metric }));
            setCompareOpen(false);
          }}
          onClose={() => setCompareOpen(false)}
        />
      </AppScreen>
    );
  }
  const apply = () => {
    const query = applyTrendDraft(active, draft);
    router.replace({
      pathname: '/trends/[metric]',
      params: {
        metric: query.primaryMetric,
        query: trendQueryRouteParam(query),
        ...(savedViewId === undefined ? {} : { savedViewId }),
      },
    } as never);
  };
  return (
    <AppScreen
      backgroundColor="#D1D1D1"
      contentClassName="rounded-t-[28px] bg-white pb-8 pt-4"
    >
      <ConfigureTrendSheet
        draft={draft}
        definition={definition}
        metrics={catalog.metrics}
        onDraft={(changes) => setDraft(updateTrendDraft(draft, changes))}
        onCompare={() => setCompareOpen(true)}
        onCustomRange={() =>
          router.push({
            pathname: '/trends/custom-range',
            params: {
              query: trendQueryRouteParam(draft),
              ...(savedViewId === undefined ? {} : { savedViewId }),
            },
          } as never)
        }
        onApply={apply}
        onSaveAsNew={
          savedViewId === undefined
            ? undefined
            : () =>
                router.push({
                  pathname: '/trends/save-view',
                  params: {
                    query: trendQueryRouteParam(draft),
                    savedViewId,
                  },
                } as never)
        }
        onClose={close}
        onReset={() => setDraft(createTrendDraft(active))}
        savedViewName={savedView?.name}
        savedViewPeriodLabel={
          savedView === null
            ? undefined
            : `${savedView.periodDays}D · ${savedView.aggregation}`
        }
      />
    </AppScreen>
  );
}
